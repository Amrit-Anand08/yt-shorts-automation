const pool = require("./pool");

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

module.exports = {
  initializeDatabase,
};
