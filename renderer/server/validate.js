const path = require("path");

function validateRequest(body) {
  if (!body || !/^[a-zA-Z0-9_-]+$/.test(String(body.jobId || ""))) {
    throw new Error("A valid jobId is required");
  }

  if (!Array.isArray(body.scenes) || body.scenes.length === 0) {
    throw new Error("At least one scene is required");
  }

  for (const scene of body.scenes) {
    if (
      !Number.isFinite(Number(scene.duration)) ||
      Number(scene.duration) <= 0 ||
      typeof scene.on_screen_text !== "string" ||
      typeof scene.visual_description !== "string"
    ) {
      throw new Error("Invalid scene data");
    }
  }

  for (const scene of body.scenes) {
    if (scene.sfxFile !== undefined) {
      if (
        typeof scene.sfxFile !== "string" ||
        scene.sfxFile.includes("..") ||
        path.isAbsolute(scene.sfxFile) ||
        !/^[a-zA-Z0-9_./-]+$/.test(scene.sfxFile)
      ) {
        throw new Error("Invalid scene sfxFile");
      }
    }
  }

  for (const field of ["audioFile", "musicFile"]) {
    if (
      typeof body[field] !== "string" ||
      body[field].includes("..") ||
      path.isAbsolute(body[field]) ||
      !/^[a-zA-Z0-9_./-]+$/.test(body[field])
    ) {
      throw new Error(`Invalid ${field}`);
    }
  }
}

module.exports = {
  validateRequest,
};
