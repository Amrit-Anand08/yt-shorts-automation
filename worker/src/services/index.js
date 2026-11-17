const {
  requestScriptOnce,
  generateVideoScript,
  generateVoiceover,
} = require("./geminiService");
const { claimJob, processJob } = require("./jobService");
const { uploadJob } = require("./uploadService");
const { runCleanup } = require("./cleanupService");

module.exports = {
  requestScriptOnce,
  generateVideoScript,
  generateVoiceover,
  claimJob,
  processJob,
  uploadJob,
  runCleanup,
};
