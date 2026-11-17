const fs = require("fs/promises");
const path = require("path");
const config = require("../config");
const { pool } = require("../db");
const { generateYoutubeMetadata } = require("./metadataService");
const youtube = require("./youtubeService");

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function successPayload(jobId, upload, alreadyUploaded) {
  return {
    jobId,
    status: "uploaded",
    already_uploaded: alreadyUploaded,
    youtube_video_id: upload.youtube_video_id,
    youtube_url: upload.youtube_url,
    title: upload.title,
    privacy: upload.privacy,
    retention_days: config.RETENTION_DAYS,
  };
}

// Uploads the finished video of a job to YouTube (once per job).
async function uploadJob(jobId) {
  const jobResult = await pool.query(
    `SELECT
       j.id,
       j.request_id,
       j.status,
       j.files_deleted_at,
       vr.topic,
       vr.language,
       vs.script_json
     FROM studio.video_jobs j
     INNER JOIN studio.video_requests vr ON vr.id = j.request_id
     LEFT JOIN studio.video_scripts vs ON vs.request_id = vr.id
     WHERE j.id = $1`,
    [jobId],
  );

  if (jobResult.rowCount === 0) throw httpError("Job not found", 404);

  const job = jobResult.rows[0];

  if (job.status !== "completed") {
    throw httpError(
      `Job cannot be uploaded because its status is '${job.status}'`,
      409,
    );
  }

  if (job.files_deleted_at) {
    throw httpError(
      `Video file was deleted by the ${config.RETENTION_DAYS}-day cleanup, so it cannot be uploaded`,
      410,
    );
  }

  const filePath = path.join(config.OUTPUT_DIR, `job-${jobId}.mp4`);

  try {
    await fs.access(filePath);
  } catch {
    throw httpError("Video file not found on disk", 404);
  }

  // Claim the upload. A row is only (re)claimed when it is new, failed, or an
  // 'uploading' attempt that went stale, so a double request never uploads twice.
  const claim = await pool.query(
    `INSERT INTO studio.uploads
       (job_id, request_id, status, privacy, started_at)
     VALUES ($1, $2, 'uploading', $3, NOW())
     ON CONFLICT (job_id) DO UPDATE
       SET status = 'uploading',
           error_message = NULL,
           privacy = EXCLUDED.privacy,
           started_at = NOW(),
           updated_at = NOW()
       WHERE studio.uploads.status = 'failed'
          OR (
            studio.uploads.status = 'uploading'
            AND studio.uploads.started_at < NOW() - make_interval(mins => $4::int)
          )
     RETURNING id`,
    [jobId, job.request_id, config.YT_DEFAULT_PRIVACY, config.UPLOAD_STALE_MINUTES],
  );

  if (claim.rowCount === 0) {
    const existing = (
      await pool.query("SELECT * FROM studio.uploads WHERE job_id = $1", [jobId])
    ).rows[0];

    if (existing?.status === "uploaded") {
      return successPayload(jobId, existing, true);
    }

    throw httpError("An upload for this job is already in progress", 409);
  }

  try {
    const missing = youtube.missingSettings();

    if (missing.length > 0) {
      const error = new Error(
        `YouTube setup incomplete. .env me ye values daalo: ${missing.join(", ")} (guide: YOUTUBE_SETUP_GUIDE.md)`,
      );
      error.statusCode = 503;
      throw error;
    }

    const metadata = await generateYoutubeMetadata({
      topic: job.topic,
      language: job.language,
      script: job.script_json,
    });

    console.log(`Uploading job ${jobId} to YouTube as "${metadata.title}"...`);

    const uploaded = await youtube.uploadVideo({
      filePath,
      title: metadata.title,
      description: metadata.description,
      tags: metadata.tags,
    });

    const saved = await pool.query(
      `UPDATE studio.uploads
       SET status = 'uploaded',
           youtube_video_id = $2,
           youtube_url = $3,
           title = $4,
           description = $5,
           tags = $6::jsonb,
           privacy = $7,
           error_message = NULL,
           uploaded_at = NOW(),
           updated_at = NOW()
       WHERE job_id = $1
       RETURNING *`,
      [
        jobId,
        uploaded.videoId,
        uploaded.url,
        metadata.title,
        metadata.description,
        JSON.stringify(metadata.tags),
        config.YT_DEFAULT_PRIVACY,
      ],
    );

    console.log(`Job ${jobId} uploaded: ${uploaded.url}`);

    return successPayload(jobId, saved.rows[0], false);
  } catch (error) {
    const message = error.statusCode
      ? error.message
      : youtube.explainYoutubeError(error);

    await pool
      .query(
        `UPDATE studio.uploads
         SET status = 'failed', error_message = $2, updated_at = NOW()
         WHERE job_id = $1`,
        [jobId, String(message).slice(0, 2000)],
      )
      .catch((dbError) => {
        console.error("Could not save upload failure:", dbError.message);
      });

    console.error(`Upload for job ${jobId} failed: ${message}`);

    throw httpError(message, error.statusCode || 502);
  }
}

module.exports = { uploadJob };
