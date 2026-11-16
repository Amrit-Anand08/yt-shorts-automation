const fs = require("fs/promises");
const path = require("path");
const { pool } = require("../db");
const { parseId } = require("../utils/text");
const { processJob } = require("../services/jobService");

// Create or retrieve a video job.
async function createJob(req, res) {
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
}

// Get a job and its current status.
async function getJobById(req, res) {
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
}

// Download the completed video file for Telegram delivery.
async function downloadJobVideo(req, res) {
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
}

// Manual processing endpoint.
async function processJobById(req, res) {
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
}

module.exports = {
  createJob,
  getJobById,
  downloadJobVideo,
  processJobById,
};
