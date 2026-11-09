const fs = require("fs/promises");
const path = require("path");
const config = require("../config");
const { pool } = require("../db");
const { SFX_BY_TYPE, TAIL_SECONDS } = require("../constants");
const { normalizeScene } = require("../utils/scene");
const { speechWeight } = require("../utils/text");
const { getAudioDuration } = require("../utils/audio");
const { generateVoiceover } = require("./geminiService");

// Atomically move a job to 'processing' and load its request and script.
// This runs OUTSIDE the failure handler of processJob on purpose: a rejected
// claim (404/409) must never overwrite the status of a job that another
// request is currently processing.
async function claimJob(jobId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const claimResult = await client.query(
      `UPDATE studio.video_jobs
       SET
         status = 'processing',
         error_message = NULL,
         output_path = NULL,
         started_at = NOW(),
         completed_at = NULL,
         updated_at = NOW()
       WHERE id = $1
         AND (
           status IN ('queued', 'failed')
           OR (
             status = 'processing'
             AND started_at < NOW() - make_interval(mins => $2::int)
           )
         )
       RETURNING id, request_id`,
      [jobId, config.STALE_JOB_MINUTES],
    );

    if (claimResult.rowCount === 0) {
      await client.query("ROLLBACK");

      const existing = await pool.query(
        "SELECT id, status FROM studio.video_jobs WHERE id = $1",
        [jobId],
      );

      const error = new Error(
        existing.rowCount === 0
          ? "Job not found"
          : `Job cannot be processed because its status is '${existing.rows[0].status}'`,
      );
      error.statusCode = existing.rowCount === 0 ? 404 : 409;
      throw error;
    }

    const { request_id: requestId } = claimResult.rows[0];

    const scriptResult = await client.query(
      `SELECT
         vr.topic,
         vr.audience,
         vr.language,
         vr.duration_seconds,
         vs.script_json
       FROM studio.video_requests vr
       INNER JOIN studio.video_scripts vs
         ON vs.request_id = vr.id
       WHERE vr.id = $1`,
      [requestId],
    );

    if (scriptResult.rowCount === 0) {
      throw new Error("Video request or script not found");
    }

    await client.query("COMMIT");

    return scriptResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    // The connection is released here, BEFORE the long TTS/render work.
    client.release();
  }
}

// Fetch the script, generate audio, and ask Remotion to render the video.
async function processJob(jobId) {
  const request = await claimJob(jobId);

  try {
    const script = request.script_json;

    if (!Array.isArray(script?.scenes) || script.scenes.length === 0) {
      throw new Error("The saved script has no scenes");
    }

    const total = script.scenes.length;

    const scenes = script.scenes.map((rawScene, index) => {
      const scene = normalizeScene(rawScene, index, total);

      return {
        duration: 0,
        voiceover: scene.voiceover,
        on_screen_text: scene.on_screen_text,
        visual_description: scene.visual_description,
        scene_type: scene.scene_type,
        ...(scene.caption ? { caption: scene.caption } : {}),
        ...(scene.points ? { points: scene.points } : {}),
        ...(scene.code_snippet ? { code_snippet: scene.code_snippet } : {}),
        ...(scene.code_language ? { code_language: scene.code_language } : {}),
        ...(scene.compare ? { compare: scene.compare } : {}),
        sfxFile: SFX_BY_TYPE[scene.scene_type],
        sfxVolume: 0.3,
      };
    });

    const audioFileName = `job-${jobId}.wav`;
    const audioOutputPath = path.join(config.AUDIO_DIR, audioFileName);
    const relativeAudioFile = `generated-audio/${audioFileName}`;

    // Combine all scene voiceovers into one continuous script.
    const fullVoiceoverText = scenes
      .map((scene) => scene.voiceover)
      .join("\n\n");

    console.log(`Generating one complete voiceover for job ${jobId}...`);

    // Exactly ONE Gemini TTS request per video.
    await generateVoiceover(fullVoiceoverText, audioOutputPath);

    // Measure the actual duration of the complete audio.
    const combinedDuration = await getAudioDuration(audioOutputPath);

    console.log(
      `Complete voiceover duration: ${combinedDuration.toFixed(2)} seconds`,
    );

    // Allocate visual scene durations proportionally to speech weight.
    // Each scene gets at least 1 second.
    if (combinedDuration < scenes.length) {
      throw new Error("Voiceover is too short for the number of scenes.");
    }

    const weights = scenes.map((scene) => speechWeight(scene.voiceover));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

    let allocatedDuration = 0;

    scenes.forEach((scene, index) => {
      if (index === scenes.length - 1) {
        // The final scene takes the remaining time (no rounding drift)
        // plus a short tail so the video does not end abruptly.
        scene.duration = combinedDuration - allocatedDuration + TAIL_SECONDS;
      } else {
        scene.duration =
          1 +
          (combinedDuration - scenes.length) * (weights[index] / totalWeight);

        allocatedDuration += scene.duration;
      }

      console.log(
        `Scene ${index + 1} (${scene.scene_type}) duration: ${scene.duration.toFixed(2)} seconds`,
      );
    });

    console.log(`Audio duration: ${combinedDuration.toFixed(2)} seconds`);
    console.log(`Sending job ${jobId} to Remotion...`);

    const rendererResponse = await fetch(`${config.RENDERER_URL}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: String(jobId),
        topic: request.topic,
        channelName: config.CHANNEL_NAME,
        scenes,
        audioFile: relativeAudioFile,
        musicFile: "audio/background-music.wav",
      }),
      signal: AbortSignal.timeout(300000),
    });

    const renderResult = await rendererResponse.json().catch(() => ({}));

    if (!rendererResponse.ok || renderResult.status !== "completed") {
      throw new Error(renderResult.error || "Remotion rendering failed");
    }

    const outputFileName = `job-${jobId}.mp4`;
    const workerOutputPath = path.join(config.OUTPUT_DIR, outputFileName);

    await fs.access(workerOutputPath);

    await pool.query(
      `UPDATE studio.video_jobs
       SET
         status = 'completed',
         output_path = $2,
         error_message = NULL,
         completed_at = NOW(),
         updated_at = NOW()
       WHERE id = $1`,
      [jobId, workerOutputPath],
    );

    console.log(`Job ${jobId} completed successfully`);

    return {
      jobId,
      status: "completed",
      outputPath: workerOutputPath,
      durationInFrames: renderResult.durationInFrames,
      width: renderResult.width,
      height: renderResult.height,
    };
  } catch (error) {
    await pool
      .query(
        `UPDATE studio.video_jobs
         SET
           status = 'failed',
           error_message = $2,
           updated_at = NOW()
         WHERE id = $1
           AND status = 'processing'`,
        [jobId, String(error.message).slice(0, 2000)],
      )
      .catch((dbError) => {
        console.error("Could not save job failure:", dbError.message);
      });

    throw error;
  }
}

module.exports = {
  claimJob,
  processJob,
};
