const express = require("express");
const path = require("path");
const fs = require("fs");
const { bundle } = require("@remotion/bundler");
const { renderMedia, selectComposition } = require("@remotion/renderer");

const app = express();
const PORT = process.env.PORT || 5002;

const ENTRY_POINT = path.resolve(__dirname, "src/index.ts");
const OUTPUT_DIR =
  process.env.OUTPUT_DIR || path.resolve(__dirname, "out/jobs");

app.use(express.json({ limit: "2mb" }));

let serveUrl;
let renderQueue = Promise.resolve();

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

async function renderJob(body) {
  validateRequest(body);

  const inputProps = {
    topic: String(body.topic || "Untitled"),
    channelName: String(body.channelName || "CODING GALAXY"),
    scenes: body.scenes,
    audioFile: body.audioFile,
    musicFile: body.musicFile,
  };

  const outputLocation = path.join(OUTPUT_DIR, `job-${body.jobId}.mp4`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Copy dynamically generated audio into the active Remotion bundle.
  const sourceAudioPath = path.resolve(__dirname, "public", body.audioFile);

  const bundlePublicDir = path.resolve(serveUrl, "public");

  const bundledAudioPath = path.resolve(bundlePublicDir, body.audioFile);

  if (!bundledAudioPath.startsWith(bundlePublicDir + path.sep)) {
    throw new Error("Invalid audio destination path");
  }

  await fs.promises.access(sourceAudioPath);

  await fs.promises.mkdir(path.dirname(bundledAudioPath), {
    recursive: true,
  });

  await fs.promises.copyFile(sourceAudioPath, bundledAudioPath);

  console.log(`Audio copied into Remotion bundle: ${body.audioFile}`);

  console.log(`Starting render for job ${body.jobId}`);

  const composition = await selectComposition({
    serveUrl,
    id: "MyComp",
    inputProps,
  });

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation,
    inputProps,
    concurrency: 1,
  });

  console.log(`Completed render for job ${body.jobId}`);

  return {
    jobId: body.jobId,
    status: "completed",
    outputPath: outputLocation,
    durationInFrames: composition.durationInFrames,
    width: composition.width,
    height: composition.height,
  };
}

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    rendererReady: Boolean(serveUrl),
  });
});

app.post("/render-prototype", async (req, res) => {
  try {
    const jobId = String(req.body?.jobId || "");

    if (!/^[a-zA-Z0-9_-]+$/.test(jobId)) {
      return res.status(400).json({
        status: "failed",
        error: "A valid jobId is required",
      });
    }

    const currentTask = renderQueue.then(async () => {
      const composition = await selectComposition({
        serveUrl,
        id: "PremiumPrototype",
      });

      const outputLocation = path.join(OUTPUT_DIR, `prototype-${jobId}.mp4`);

      fs.mkdirSync(OUTPUT_DIR, { recursive: true });

      console.log(`Starting PremiumPrototype render: ${jobId}`);

      await renderMedia({
        composition,
        serveUrl,
        codec: "h264",
        outputLocation,
        concurrency: 1,
      });

      console.log(`PremiumPrototype completed: ${jobId}`);

      return {
        jobId,
        compositionId: "PremiumPrototype",
        status: "completed",
        outputPath: outputLocation,
        durationInFrames: composition.durationInFrames,
        width: composition.width,
        height: composition.height,
      };
    });

    renderQueue = currentTask.catch((error) => {
      console.error("Prototype render queue error:", error.message);
    });

    const result = await currentTask;
    res.json(result);
  } catch (error) {
    console.error("Prototype render failed:", error.message);

    res.status(500).json({
      status: "failed",
      error: error.message,
    });
  }
});

app.post("/render", async (req, res) => {
  try {
    validateRequest(req.body);

    const currentTask = renderQueue.then(() => renderJob(req.body));

    renderQueue = currentTask.catch((error) => {
      console.error("Render queue error:", error.message);
    });

    const result = await currentTask;
    res.json(result);
  } catch (error) {
    console.error("Render failed:", error.message);
    res.status(500).json({
      status: "failed",
      error: error.message,
    });
  }
});

async function startServer() {
  try {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    console.log("Bundling Remotion project...");

    serveUrl = await bundle({
      entryPoint: ENTRY_POINT,
    });

    console.log("Remotion bundle ready");

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Renderer API running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Renderer startup failed:", error);
    process.exit(1);
  }
}

startServer();
