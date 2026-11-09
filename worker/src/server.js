require("dotenv").config();

const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const { Pool } = require("pg");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const app = express();
const PORT = Number(process.env.PORT || 5000);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_TTS_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-tts";
const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-3.8-flash";

const RENDERER_URL = process.env.RENDERER_URL || "http://renderer:5002";

const AUDIO_DIR =
  process.env.MEDIA_AUDIO_DIR ||
  process.env.AUDIO_DIR ||
  path.join(__dirname, "../media/audio");
const OUTPUT_DIR =
  process.env.MEDIA_OUTPUT_DIR ||
  process.env.OUTPUT_DIR ||
  path.join(__dirname, "../media/output");

const CHANNEL_NAME = process.env.CHANNEL_NAME;

// A job stuck in 'processing' for longer than this is treated as crashed
// and may be picked up again.
const STALE_JOB_MINUTES = Number(process.env.STALE_JOB_MINUTES || 20);

// Extra seconds the last scene stays on screen after the voiceover ends.
const TAIL_SECONDS = 0.6;

const SCENE_TYPES = new Set([
  "hook",
  "explanation",
  "code",
  "example",
  "outro",
]);

// One sound effect per scene type (files live in the renderer's public/audio/sfx).
const SFX_BY_TYPE = {
  hook: "audio/sfx/impact.wav",
  explanation: "audio/sfx/whoosh.wav",
  code: "audio/sfx/click.wav",
  example: "audio/sfx/pop.wav",
  outro: "audio/sfx/pop.wav",
};

app.use(express.json({ limit: "2mb" }));

const pool = new Pool({
  host: process.env.DB_HOST || "postgres",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL error:", error.message);
});

// --------------------------------------------------
// Small helpers
// --------------------------------------------------

// Returns a positive safe integer, or null when the value is not one.
function parseId(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function cleanText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

// Keeps line breaks (needed for code) but removes tabs, CRs and trailing space.
function cleanCode(value) {
  if (typeof value !== "string") return "";

  return value
    .replace(/\r/g, "")
    .replace(/\t/g, "  ")
    .split("\n")
    .map((line) => line.replace(/\s+$/, "").slice(0, 70))
    .slice(0, 12)
    .join("\n")
    .trim();
}

// Gemini sometimes wraps JSON in ```json fences or adds a sentence around it.
function parseModelJson(text) {
  let candidate = text.trim();

  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidate = fenced[1].trim();

  try {
    return JSON.parse(candidate);
  } catch {
    // fall through
  }

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start !== -1 && end > start) {
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
      // fall through
    }
  }

  const error = new Error("Gemini returned invalid JSON for the video script");
  error.retryable = true;
  throw error;
}

// Validates one scene and fills in the fields the renderer expects.
// Used both for fresh scripts and for scripts that were saved earlier.
function normalizeScene(scene, index, total) {
  const fail = (message) => {
    const error = new Error(message);
    error.retryable = true;
    return error;
  };

  if (!scene || typeof scene !== "object") {
    throw fail(`Gemini returned invalid data for scene ${index + 1}`);
  }

  const voiceover = cleanText(scene.voiceover, 1200);

  if (!voiceover) {
    throw fail(`Scene ${index + 1}: missing or empty voiceover`);
  }

  if (typeof scene.on_screen_text !== "string") {
    throw fail(`Scene ${index + 1}: on_screen_text must be a string`);
  }

  const codeSnippet = cleanCode(scene.code_snippet);

  const points = Array.isArray(scene.points)
    ? scene.points
        .map((point) => cleanText(point, 60))
        .filter(Boolean)
        .slice(0, 4)
    : [];

  let compare;
  if (scene.compare && typeof scene.compare === "object") {
    const leftText = cleanText(scene.compare.left_text, 70);
    const rightText = cleanText(scene.compare.right_text, 70);

    if (leftText && rightText) {
      compare = {
        left_label: cleanText(scene.compare.left_label, 20).toUpperCase(),
        left_text: leftText,
        right_label: cleanText(scene.compare.right_label, 20).toUpperCase(),
        right_text: rightText,
      };
    }
  }

  let type =
    typeof scene.scene_type === "string"
      ? scene.scene_type.toLowerCase().trim()
      : "";

  if (!SCENE_TYPES.has(type)) {
    if (index === 0) type = "hook";
    else if (index === total - 1) type = "outro";
    else if (codeSnippet) type = "code";
    else if (compare) type = "example";
    else type = "explanation";
  }

  // A "code" scene without code would render an empty editor.
  if (type === "code" && !codeSnippet) type = "explanation";

  const caption = cleanText(scene.caption, 120);
  const codeLanguage = cleanText(scene.code_language, 20);

  return {
    scene_number: index + 1,
    scene_type: type,
    voiceover,
    on_screen_text:
      cleanText(scene.on_screen_text, 60) || cleanText(voiceover, 40),
    visual_description: cleanText(scene.visual_description, 400),
    ...(caption ? { caption } : {}),
    ...(points.length ? { points } : {}),
    ...(codeSnippet ? { code_snippet: codeSnippet } : {}),
    ...(codeSnippet && codeLanguage ? { code_language: codeLanguage } : {}),
    ...(compare ? { compare } : {}),
  };
}

// Gemini TTS can return raw 16-bit PCM without a header. Wrap it as WAV so
// ffprobe and the browser can read it. Already-encoded audio is left as is.
function ensureWav(buffer, sampleRate = 24000) {
  const head = buffer.toString("latin1", 0, 4);

  const alreadyEncoded =
    head === "RIFF" ||
    head === "OggS" ||
    head === "fLaC" ||
    head.startsWith("ID3") ||
    (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0); // MP3 frame sync

  if (alreadyEncoded) return buffer;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + buffer.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(buffer.length, 40);

  return Buffer.concat([header, buffer]);
}

// Reading time estimate used to split the audio between scenes: words plus
// a little extra for sentence and comma pauses.
function speechWeight(text) {
  const words = text.trim().split(/\s+/).length;
  const stops = (text.match(/[.!?।]/g) || []).length;
  const commas = (text.match(/[,;:]/g) || []).length;

  return words + (stops + commas * 0.5) * 0.7;
}

// --------------------------------------------------
// Database
// --------------------------------------------------

// Add processing-related columns without deleting existing job data.
async function initializeDatabase() {
  await pool.query(`
    CREATE SCHEMA IF NOT EXISTS studio;

    CREATE TABLE IF NOT EXISTS studio.video_requests (
      id BIGSERIAL PRIMARY KEY,
      topic TEXT NOT NULL,
      audience TEXT NOT NULL,
      language TEXT NOT NULL,
      duration_seconds INT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS studio.video_scripts (
      id BIGSERIAL PRIMARY KEY,
      request_id BIGINT NOT NULL REFERENCES studio.video_requests(id) ON DELETE CASCADE,
      script_json JSONB NOT NULL,
      ai_provider VARCHAR(50) DEFAULT 'gemini',
      model_name VARCHAR(100),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS studio.video_jobs (
      id BIGSERIAL PRIMARY KEY,
      request_id BIGINT NOT NULL UNIQUE
        REFERENCES studio.video_requests(id)
        ON DELETE CASCADE,
      status VARCHAR(30) NOT NULL DEFAULT 'queued',
      output_path TEXT,
      error_message TEXT,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  console.log("Database schema and tables are ready");
}

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "youtube-shorts-worker",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health/db", async (req, res) => {
  try {
    await pool.query("SELECT NOW()");
    res.json({ status: "healthy", database: "connected" });
  } catch (error) {
    console.error("Database health check failed:", error.message);
    res.status(503).json({
      status: "unhealthy",
      database: "disconnected",
    });
  }
});

// --------------------------------------------------
// Script generation (Gemini)
// --------------------------------------------------

async function requestScriptOnce({
  topic,
  audience,
  language,
  durationSeconds,
}) {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API key is not configured in the Worker");
  }

  const sceneCount = Math.max(3, Math.min(12, Math.ceil(durationSeconds / 6)));

  const prompt = `
You are a professional YouTube Shorts scriptwriter for a coding education channel.

Create an engaging YouTube Shorts script using these details:

Topic: ${topic}
Target audience: ${audience}
Narration language: ${language}
Target duration: ${durationSeconds} seconds
Number of scenes: ${sceneCount}

General requirements:

MANDATORY JSON RULES:
- Every scene MUST contain "scene_number" as an integer.
- Every scene MUST contain "scene_type" as a string.
- Every scene MUST contain "voiceover" as a non-empty string.
- Every scene MUST contain "on_screen_text" as a non-empty string.
- Every scene MUST contain "visual_description" as a string.
- Never use null, arrays, objects, or numbers for these string fields.
- Never omit any mandatory field from any scene.
- Before returning JSON, verify every scene against these rules.
- If a field has no suitable content, write a short valid string instead.

- Write natural, engaging spoken narration.
- Start with a strong hook.
- Keep the explanation accurate and beginner-friendly.
- End with a short, relevant call to action.
- Distribute the narration across exactly ${sceneCount} scenes.
- Keep the total narration appropriate for approximately ${durationSeconds} seconds.
- Scene 1 must be scene_type "hook". The last scene must be "outro".
  Scenes in between use "explanation", "code" or "example".
- "voiceover" is plain spoken text only (no markdown, no stage directions).
  Only the voiceover follows the narration language.
- Everything shown on screen (on_screen_text, caption, points, compare) must be
  short, simple, Latin-script English text without emojis.
- "visual_description" is an internal director note and is never shown.

Fields per scene type:
- hook: on_screen_text is a bold question or statement of at most 6 words.
  caption is one friendly line of at most 14 words.
- explanation: on_screen_text is the concept title (at most 5 words).
  points is a list of 2 to 4 steps, each at most 6 words, showing the idea
  as a step-by-step flow. caption is one short line (at most 14 words).
- code: include code_snippet (3 to 8 lines, each at most 40 characters,
  correct and runnable) and code_language (for example "javascript").
  caption names the key idea of the code in at most 14 words.
- example: include compare with left_label, left_text, right_label,
  right_text. It shows before/after, problem/solution or input/output.
  Each text is at most 40 characters and each label at most 2 uppercase words.
- outro: points is a recap of 2 to 3 items, each at most 5 words.
  The voiceover ends with a short call to action.

Omit optional fields that do not apply to a scene.
Do not include markdown or explanations outside the JSON.

Return this exact JSON structure:
{
  "title": "Short video title",
  "scenes": [
    {
      "scene_number": 1,
      "scene_type": "hook",
      "voiceover": "Narration for this scene",
      "on_screen_text": "Short readable text",
      "caption": "One short supporting line",
      "visual_description": "Detailed visual direction",
      "points": ["Step one", "Step two"],
      "code_language": "javascript",
      "code_snippet": "const x = 1;",
      "compare": {
        "left_label": "BEFORE",
        "left_text": "Slow way",
        "right_label": "AFTER",
        "right_text": "Fast way"
      }
    }
  ]
}
`;

  const apiUrl =
    "https://generativelanguage.googleapis.com/v1beta/interactions";

  // Step 1: Submit background interaction.
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY,
    },
    body: JSON.stringify({
      model: GEMINI_TEXT_MODEL,
      input: prompt,
      background: true,
    }),
    signal: AbortSignal.timeout(30000),
  });

  const initialResult = await response.json().catch(() => ({}));

  if (!response.ok) {
    const apiError = initialResult?.error || {};
    const apiErrors = Array.isArray(initialResult?.errors)
      ? initialResult.errors
      : [];

    console.error("Gemini initial request failed:", {
      httpStatus: response.status,
      statusText: response.statusText,
      requestId: response.headers.get("x-goog-request-id"),
      errorCode: apiError.code,
      errorStatus: apiError.status,
      errorMessage: apiError.message,
      errors: apiErrors.map((e) => ({
        code: e.code,
        message: e.message,
      })),
    });

    const message =
      apiError.message ||
      apiErrors
        .map((e) => `${e.code || "UNKNOWN"}: ${e.message || ""}`)
        .join("; ") ||
      `HTTP ${response.status}: Gemini request failed`;

    throw new Error(`Gemini script error: ${message}`);
  }

  const interactionId = initialResult.id;

  if (!interactionId) {
    throw new Error("Gemini did not return an interaction ID");
  }

  console.log(`Gemini interaction started: ${interactionId}`);

  // Step 2: Poll until Gemini finishes.
  const deadline = Date.now() + 10 * 60 * 1000;
  let result = initialResult;

  while (true) {
    const status = result.status;

    if (status === "completed") {
      break;
    }

    if (
      status === "failed" ||
      status === "incomplete" ||
      status === "cancelled" ||
      status === "requires_action"
    ) {
      console.error(
        "Gemini full failure response:",
        JSON.stringify(result, null, 2),
      );
      const details =
        result.error?.message || result.incomplete_details?.reason || status;

      throw new Error(
        `Gemini interaction ended with status: ${status}. Details: ${details}`,
      );
    }

    if (status !== "in_progress") {
      const apiErrors = Array.isArray(result.errors)
        ? result.errors.map((item) => ({
            code: item.code,
            message: item.message,
          }))
        : [];

      console.error("Gemini interaction failure:", {
        interactionId: result.id,
        status: result.status,
        model: result.model,
        errors: apiErrors,
        incompleteDetails: result.incomplete_details,
      });

      const details =
        apiErrors
          .map((item) => `${item.code || "UNKNOWN"}: ${item.message || ""}`)
          .join("; ") ||
        result.incomplete_details?.reason ||
        `Unexpected status: ${status}`;

      throw new Error(
        `Gemini interaction ended with status: ${status}. Details: ${details}`,
      );
    }

    if (Date.now() >= deadline) {
      throw new Error("Gemini script generation timed out after 10 minutes");
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));

    const statusResponse = await fetch(
      `${apiUrl}/${encodeURIComponent(interactionId)}`,
      {
        method: "GET",
        headers: {
          "x-goog-api-key": GEMINI_API_KEY,
          "Api-Revision": "2026-05-20",
        },
        signal: AbortSignal.timeout(15000),
      },
    );

    result = await statusResponse.json().catch(() => ({}));

    if (!statusResponse.ok) {
      const apiError = result?.error || {};

      console.error("Gemini polling HTTP failure:", {
        httpStatus: statusResponse.status,
        statusText: statusResponse.statusText,
        requestId: statusResponse.headers.get("x-goog-request-id"),
        errorCode: apiError.code,
        errorStatus: apiError.status,
        errorMessage: apiError.message,
      });

      throw new Error(
        `Gemini polling error (HTTP ${statusResponse.status}): ${
          apiError.message || "Failed to retrieve Gemini interaction"
        }`,
      );
    }
  }

  console.log(`Gemini interaction completed: ${interactionId}`);

  // Step 3: Extract model output only.
  const generatedText = result.steps
    ?.filter((step) => step.type === "model_output")
    .flatMap((step) => step.content ?? [])
    .filter((item) => item.type === "text")
    .map((item) => item.text || "")
    .join("")
    .trim();

  if (!generatedText) {
    const error = new Error("Gemini returned an empty script");
    error.retryable = true;
    throw error;
  }

  // Step 4: Parse JSON (tolerates code fences).
  const script = parseModelJson(generatedText);

  // Step 5: Validate and normalise the structure.
  if (
    !script ||
    typeof script.title !== "string" ||
    !Array.isArray(script.scenes) ||
    script.scenes.length === 0
  ) {
    const error = new Error("Gemini returned an invalid script structure");
    error.retryable = true;
    throw error;
  }

  const total = script.scenes.length;

  script.title = cleanText(script.title, 120);
  script.scenes = script.scenes.map((scene, index) =>
    normalizeScene(scene, index, total),
  );

  return script;
}

// Tries twice when Gemini returns unusable JSON; other errors fail at once.
async function generateVideoScript(params) {
  let lastError;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await requestScriptOnce(params);
    } catch (error) {
      lastError = error;

      if (!error.retryable) break;

      console.warn(
        `Script attempt ${attempt} was unusable (${error.message}); retrying`,
      );
    }
  }

  throw lastError;
}

// Create a video request, generate its script and save both in PostgreSQL.
app.post("/scripts/generate", async (req, res) => {
  const {
    topic,
    audience,
    language,
    duration_seconds: durationSeconds,
  } = req.body ?? {};

  if (
    typeof topic !== "string" ||
    !topic.trim() ||
    typeof audience !== "string" ||
    !audience.trim() ||
    typeof language !== "string" ||
    !language.trim() ||
    !Number.isSafeInteger(durationSeconds) ||
    durationSeconds <= 0 ||
    durationSeconds > 180
  ) {
    return res.status(400).json({
      error: "Provide topic, audience, language and duration_seconds (1–180)",
    });
  }

  try {
    console.log(`Generating script for topic: ${topic.trim()}`);

    const script = await generateVideoScript({
      topic: topic.trim(),
      audience: audience.trim(),
      language: language.trim(),
      durationSeconds,
    });

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const requestResult = await client.query(
        `INSERT INTO studio.video_requests
          (topic, audience, language, duration_seconds, status)
         VALUES ($1, $2, $3, $4, 'pending')
         RETURNING *`,
        [topic.trim(), audience.trim(), language.trim(), durationSeconds],
      );

      const request = requestResult.rows[0];

      await client.query(
        `INSERT INTO studio.video_scripts
          (request_id, script_json, ai_provider, model_name)
         VALUES ($1, $2::jsonb, 'gemini', $3)`,
        [request.id, JSON.stringify(script), GEMINI_TEXT_MODEL],
      );

      await client.query("COMMIT");

      return res.status(201).json({
        message: "Video request and script created successfully",
        request,
        script,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Script generation failed:", {
      message: error.message,
      name: error.name,
      code: error.code,
      stack: error.stack,
    });

    return res.status(500).json({
      error: "Unable to generate video script",
      details: error.message,
    });
  }
});

// --------------------------------------------------
// Jobs
// --------------------------------------------------

// Create or retrieve a video job.
app.post("/jobs", async (req, res) => {
  const requestId = parseId(req.body?.request_id);

  if (requestId === null) {
    return res.status(400).json({
      error: "A valid request_id is required",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const scriptResult = await client.query(
      `SELECT
         vr.id AS request_id,
         vr.topic,
         vr.audience,
         vr.language,
         vr.duration_seconds,
         vs.script_json,
         vs.ai_provider,
         vs.model_name
       FROM studio.video_requests vr
       INNER JOIN studio.video_scripts vs
         ON vs.request_id = vr.id
       WHERE vr.id = $1`,
      [requestId],
    );

    if (scriptResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        error: "Request or generated script not found",
        request_id: requestId,
      });
    }

    const insertResult = await client.query(
      `INSERT INTO studio.video_jobs (request_id)
       VALUES ($1)
       ON CONFLICT (request_id) DO NOTHING
       RETURNING *`,
      [requestId],
    );

    let job = insertResult.rows[0];
    let alreadyExists = false;

    if (!job) {
      const existingResult = await client.query(
        `SELECT * FROM studio.video_jobs WHERE request_id = $1`,
        [requestId],
      );
      job = existingResult.rows[0];
      alreadyExists = true;
    }

    await client.query("COMMIT");

    res.status(alreadyExists ? 200 : 201).json({
      message: alreadyExists
        ? "Job already exists"
        : "Video job created successfully",
      already_exists: alreadyExists,
      job,
      script: scriptResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Job creation failed:", error.message);
    res.status(500).json({ error: "Unable to create video job" });
  } finally {
    client.release();
  }
});

// Get a job and its current status.
app.get("/jobs/:id", async (req, res) => {
  const jobId = parseId(req.params.id);

  if (jobId === null) {
    return res.status(400).json({ error: "Invalid job ID" });
  }

  try {
    const result = await pool.query(
      `SELECT
         id,
         request_id,
         status,
         output_path,
         error_message,
         created_at,
         updated_at,
         started_at,
         completed_at
       FROM studio.video_jobs
       WHERE id = $1`,
      [jobId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Job not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Job lookup failed:", error.message);
    res.status(500).json({ error: "Unable to fetch job" });
  }
});

// Download the completed video file for Telegram delivery.
app.get("/jobs/:id/video", async (req, res) => {
  const jobId = parseId(req.params.id);

  if (jobId === null) {
    return res.status(400).json({ error: "Invalid job ID" });
  }

  try {
    const result = await pool.query(
      `SELECT id, status, output_path
       FROM studio.video_jobs
       WHERE id = $1`,
      [jobId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Job not found" });
    }

    const job = result.rows[0];

    if (job.status !== "completed" || !job.output_path) {
      return res.status(409).json({
        error: "Video is not ready yet",
        status: job.status,
      });
    }

    await fs.access(job.output_path);

    return res.download(
      job.output_path,
      path.basename(job.output_path),
      (error) => {
        if (error) {
          console.error("Video download failed:", error.message);

          if (!res.headersSent) {
            res.status(500).json({
              error: "Unable to download video",
            });
          }
        }
      },
    );
  } catch (error) {
    if (error.code === "ENOENT") {
      return res.status(404).json({ error: "Video file not found" });
    }

    console.error("Video download endpoint failed:", error.message);

    if (!res.headersSent) {
      return res.status(500).json({
        error: "Unable to retrieve video",
      });
    }
  }
});

// --------------------------------------------------
// Voiceover (Gemini TTS) and audio helpers
// --------------------------------------------------

// Generate one complete voiceover using the Gemini TTS API.
async function generateVoiceover(text, outputPath) {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API key is not configured in the Worker");
  }

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/interactions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        model: GEMINI_TTS_MODEL,
        input: [
          {
            type: "user_input",
            content: [
              {
                type: "text",
                text,
                annotations: [
                  {
                    type: "speech_metadata",
                    style:
                      "Speak in natural Indian Hinglish. Use a warm, energetic, confident young male presenter voice. Sound like a real Indian coding YouTuber speaking naturally to an audience. Conversational rhythm, expressive emphasis on important words, friendly enthusiasm, clear pronunciation. Avoid robotic delivery, excessive drama, and unnaturally slow pacing.",
                  },
                ],
              },
            ],
          },
        ],
        response_format: { type: "audio" },
        generation_config: {
          speech_config: [{ voice: "Puck" }],
        },
      }),
      signal: AbortSignal.timeout(120000),
    },
  );

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = result?.error?.message || "Gemini TTS request failed";
    throw new Error(`Gemini TTS error: ${message}`);
  }

  const audioData = result.steps
    ?.flatMap((step) => step.content ?? [])
    .find((item) => typeof item.data === "string")?.data;

  if (!audioData) {
    throw new Error("Gemini response did not contain audio data");
  }

  const audioBuffer = ensureWav(Buffer.from(audioData, "base64"));

  if (audioBuffer.length <= 44) {
    throw new Error("Gemini returned an empty audio file");
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, audioBuffer);

  console.log(`Voiceover saved: ${audioBuffer.length} bytes`);
}

// Measure the actual duration of an audio file using FFprobe.
async function getAudioDuration(filePath) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);

  const duration = Number.parseFloat(stdout.trim());

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Unable to measure audio duration: ${filePath}`);
  }

  return duration;
}

// --------------------------------------------------
// Job processing
// --------------------------------------------------

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
      [jobId, STALE_JOB_MINUTES],
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
    const audioOutputPath = path.join(AUDIO_DIR, audioFileName);
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

    const rendererResponse = await fetch(`${RENDERER_URL}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: String(jobId),
        topic: request.topic,
        channelName: CHANNEL_NAME,
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
    const workerOutputPath = path.join(OUTPUT_DIR, outputFileName);

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

// Manual processing endpoint. No automatic queue is enabled yet.
app.post("/jobs/:id/process", async (req, res) => {
  const jobId = parseId(req.params.id);

  if (jobId === null) {
    return res.status(400).json({ error: "Invalid job ID" });
  }

  try {
    const result = await processJob(jobId);
    res.json(result);
  } catch (error) {
    console.error(`Job ${jobId} processing failed:`, error.message);

    res.status(error.statusCode || 500).json({
      status: "failed",
      error: error.message,
    });
  }
});

// Malformed JSON bodies get a clean 400 instead of an HTML stack trace.
app.use((error, req, res, next) => {
  if (error?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body is not valid JSON" });
  }

  return next(error);
});

async function startServer() {
  try {
    await initializeDatabase();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Video worker running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Worker startup failed:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

// Exported only so the helpers can be unit-tested.
module.exports = {
  parseId,
  parseModelJson,
  normalizeScene,
  ensureWav,
  speechWeight,
};
