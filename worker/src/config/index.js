require("dotenv").config();
const path = require("path");

const config = {
  PORT: Number(process.env.PORT || 5000),
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_TTS_MODEL: process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-tts",
  GEMINI_TEXT_MODEL: process.env.GEMINI_TEXT_MODEL || "gemini-3.8-flash",
  RENDERER_URL: process.env.RENDERER_URL || "http://renderer:5002",
  AUDIO_DIR:
    process.env.MEDIA_AUDIO_DIR ||
    process.env.AUDIO_DIR ||
    path.join(__dirname, "../../media/audio"),
  OUTPUT_DIR:
    process.env.MEDIA_OUTPUT_DIR ||
    process.env.OUTPUT_DIR ||
    path.join(__dirname, "../../media/output"),
  CHANNEL_NAME: process.env.CHANNEL_NAME,
  STALE_JOB_MINUTES: Number(process.env.STALE_JOB_MINUTES || 20),
  TAIL_SECONDS: 0.6,
  db: {
    host: process.env.DB_HOST || "postgres",
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  },
};

module.exports = config;
