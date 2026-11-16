const {
  requestScriptOnce,
  generateVideoScript,
  generateVoiceover,
} = require("./geminiService");
const { claimJob, processJob } = require("./jobService");

module.exports = {
  requestScriptOnce,
  generateVideoScript,
  generateVoiceover,
  claimJob,
  processJob,
};
