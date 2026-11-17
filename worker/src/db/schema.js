const pool = require("./pool");

// Additive only: creates missing tables/columns and never deletes data.
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

    -- V1: set when the 3-day cleanup removed the local video/audio files.
    ALTER TABLE studio.video_jobs
      ADD COLUMN IF NOT EXISTS files_deleted_at TIMESTAMPTZ;

    CREATE INDEX IF NOT EXISTS idx_video_jobs_status
      ON studio.video_jobs (status);

    -- V1: one YouTube upload record per job.
    CREATE TABLE IF NOT EXISTS studio.uploads (
      id BIGSERIAL PRIMARY KEY,
      job_id BIGINT NOT NULL UNIQUE
        REFERENCES studio.video_jobs(id) ON DELETE CASCADE,
      request_id BIGINT NOT NULL
        REFERENCES studio.video_requests(id) ON DELETE CASCADE,
      status VARCHAR(20) NOT NULL DEFAULT 'uploading',
      youtube_video_id TEXT,
      youtube_url TEXT,
      title TEXT,
      description TEXT,
      tags JSONB,
      privacy VARCHAR(20),
      error_message TEXT,
      started_at TIMESTAMPTZ,
      uploaded_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  console.log("Database schema and tables are ready");
}

module.exports = {
  initializeDatabase,
};
