require("dotenv").config();
const path = require("path");

// Reads a number from the environment; empty or invalid values use the default.
function numberEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return fallback;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function booleanEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || String(raw).trim() === "") return fallback;
  return String(raw).trim().toLowerCase() === "true";
}

// Only these three values are valid; anything else falls back to the safe one.
function privacyEnv(name) {
  const value = String(process.env[name] || "private").trim().toLowerCase();
  return ["private", "unlisted", "public"].includes(value) ? value : "private";
}

const config = {
  PORT: Number(process.env.PORT || 5000),
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_TTS_MODEL:
    process.env.GEMINI_TTS_PRIMARY ||
    process.env.GEMINI_TTS_MODEL ||
    "gemini-3.8-flash-tts",

  GEMINI_TTS_PRIMARY:
    process.env.GEMINI_TTS_PRIMARY ||
    process.env.GEMINI_TTS_MODEL ||
    "gemini-3.8-flash-tts",

  GEMINI_TTS_SECONDARY:
    process.env.GEMINI_TTS_SECONDARY || "gemini-3.8-flash-lite-tts",

  GEMINI_TTS_TERTIARY:
    process.env.GEMINI_TTS_TERTIARY || "gemini-2.5-flash-preview-tts",

  GEMINI_TTS_FALLBACK_ENABLED:
    (process.env.GEMINI_TTS_FALLBACK_ENABLED || "true").toLowerCase() ===
    "true",

  GEMINI_TEXT_PRIMARY:
    process.env.GEMINI_TEXT_PRIMARY ||
    process.env.GEMINI_TEXT_MODEL ||
    "gemini-3.8-flash",

  GEMINI_TEXT_SECONDARY: process.env.GEMINI_TEXT_SECONDARY || null,

  GEMINI_TEXT_TERTIARY: process.env.GEMINI_TEXT_TERTIARY || null,

  GEMINI_TEXT_FALLBACK_ENABLED:
    (process.env.GEMINI_TEXT_FALLBACK_ENABLED || "false").toLowerCase() ===
    "true",

  // Backward compatibility with existing service code
  GEMINI_TEXT_MODEL:
    process.env.GEMINI_TEXT_MODEL ||
    process.env.GEMINI_TEXT_PRIMARY ||
    "gemini-3.8-flash",

  RENDERER_URL: process.env.RENDERER_URL || "http://renderer:5002",
  AUDIO_DIR:
    process.env.MEDIA_AUDIO_DIR ||
    process.env.AUDIO_DIR ||
    path.join(__dirname, "../../media/audio"),
  OUTPUT_DIR:
    process.env.MEDIA_OUTPUT_DIR ||
    process.env.OUTPUT_DIR ||
    path.join(__dirname, "../../media/output"),
  CHANNEL_NAME: process.env.CHANNEL_NAME || "CODING GALAXY",
  STALE_JOB_MINUTES: Number(process.env.STALE_JOB_MINUTES || 20),

  // V1: YouTube upload (OAuth2 refresh token, created once with youtube:auth)
  YT_CLIENT_ID: process.env.YT_CLIENT_ID || "",
  YT_CLIENT_SECRET: process.env.YT_CLIENT_SECRET || "",
  YT_REFRESH_TOKEN: process.env.YT_REFRESH_TOKEN || "",
  YT_DEFAULT_PRIVACY: privacyEnv("YT_DEFAULT_PRIVACY"),
  YT_CATEGORY_ID: String(process.env.YT_CATEGORY_ID || "27"),
  YT_MADE_FOR_KIDS: booleanEnv("YT_MADE_FOR_KIDS", false),
  YT_CONTAINS_SYNTHETIC_MEDIA: booleanEnv("YT_CONTAINS_SYNTHETIC_MEDIA", false),
  UPLOAD_STALE_MINUTES: numberEnv("UPLOAD_STALE_MINUTES", 30),

  // V1: local video/audio files older than RETENTION_DAYS are deleted (0 = off)
  RETENTION_DAYS: numberEnv("RETENTION_DAYS", 3),
  CLEANUP_INTERVAL_MINUTES: numberEnv("CLEANUP_INTERVAL_MINUTES", 360),
  CLEANUP_DRY_RUN: booleanEnv("CLEANUP_DRY_RUN", false),
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
