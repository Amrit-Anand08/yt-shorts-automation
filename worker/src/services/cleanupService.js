const fs = require("fs/promises");
const path = require("path");
const config = require("../config");
const { pool } = require("../db");

// Only files created by this pipeline are ever touched: job-<id>.mp4 / .wav
const FILE_PATTERN = /^job-(\d+)\.(mp4|wav)$/;
const DAY_MS = 24 * 60 * 60 * 1000;

// Lists pipeline files in a folder that are older than the cutoff time.
async function findOldFiles(dir, cutoffMs) {
  let names;

  try {
    names = await fs.readdir(dir);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  const found = [];

  for (const name of names) {
    const match = FILE_PATTERN.exec(name);
    if (!match) continue;

    const fullPath = path.join(dir, name);
    const stat = await fs.stat(fullPath).catch(() => null);

    if (stat && stat.isFile() && stat.mtimeMs < cutoffMs) {
      found.push({ fullPath, jobId: Number(match[1]), size: stat.size });
    }
  }

  return found;
}

// Deletes local video/audio files older than RETENTION_DAYS.
// Uploaded YouTube videos and database records (topic, script) are kept.
async function runCleanup({ now = Date.now() } = {}) {
  const days = config.RETENTION_DAYS;

  if (!(days > 0)) {
    return { skipped: true, reason: "RETENTION_DAYS is 0 (cleanup disabled)" };
  }

  const dryRun = config.CLEANUP_DRY_RUN;
  const cutoffMs = now - days * DAY_MS;

  const candidates = [
    ...(await findOldFiles(config.OUTPUT_DIR, cutoffMs)),
    ...(await findOldFiles(config.AUDIO_DIR, cutoffMs)),
  ];

  if (candidates.length === 0) {
    return { dryRun, deletedFiles: 0, deletedBytes: 0, jobs: 0 };
  }

  const jobIds = [...new Set(candidates.map((item) => item.jobId))];

  // Never touch a job that is being rendered or uploaded right now.
  const busy = await pool.query(
    `SELECT id FROM studio.video_jobs
       WHERE id = ANY($1::bigint[]) AND status = 'processing'
     UNION
     SELECT job_id AS id FROM studio.uploads
       WHERE job_id = ANY($1::bigint[]) AND status = 'uploading'`,
    [jobIds],
  );

  const busyIds = new Set(busy.rows.map((row) => Number(row.id)));

  let deletedFiles = 0;
  let deletedBytes = 0;
  const cleanedJobs = new Set();

  for (const item of candidates) {
    if (busyIds.has(item.jobId)) continue;

    try {
      if (!dryRun) await fs.unlink(item.fullPath);

      deletedFiles += 1;
      deletedBytes += item.size;
      cleanedJobs.add(item.jobId);

      console.log(
        `${dryRun ? "[dry run] would delete" : "Deleted"} ${item.fullPath}`,
      );
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error(`Could not delete ${item.fullPath}: ${error.message}`);
      }
    }
  }

  if (!dryRun && cleanedJobs.size > 0) {
    await pool.query(
      `UPDATE studio.video_jobs
       SET files_deleted_at = NOW(), output_path = NULL, updated_at = NOW()
       WHERE id = ANY($1::bigint[])
         AND status IN ('completed', 'failed')
         AND files_deleted_at IS NULL`,
      [[...cleanedJobs]],
    );
  }

  const summary = {
    dryRun,
    deletedFiles,
    deletedBytes,
    jobs: cleanedJobs.size,
  };

  console.log(
    `Cleanup finished: ${deletedFiles} file(s), ${(deletedBytes / 1048576).toFixed(1)} MB, ${cleanedJobs.size} job(s)${dryRun ? " (dry run)" : ""}`,
  );

  return summary;
}

// Runs once shortly after start, then every CLEANUP_INTERVAL_MINUTES.
function startCleanupScheduler() {
  if (!(config.RETENTION_DAYS > 0)) {
    console.log("Auto cleanup is disabled (RETENTION_DAYS=0)");
    return;
  }

  const intervalMs = Math.max(1, config.CLEANUP_INTERVAL_MINUTES) * 60 * 1000;

  const safeRun = () =>
    runCleanup().catch((error) => {
      console.error("Cleanup run failed:", error.message);
    });

  console.log(
    `Auto cleanup on: local videos older than ${config.RETENTION_DAYS} day(s) are deleted every ${config.CLEANUP_INTERVAL_MINUTES} min${config.CLEANUP_DRY_RUN ? " (DRY RUN)" : ""}`,
  );

  setTimeout(safeRun, 60 * 1000);
  setInterval(safeRun, intervalMs);
}

module.exports = { runCleanup, startCleanupScheduler, findOldFiles };
