const express = require("express");
const path = require("path");
const fs = require("fs");
const { bundle } = require("@remotion/bundler");
const { renderMedia, selectComposition } = require("@remotion/renderer");
const { validateRequest } = require("./server/validate");
const { renderJob } = require("./server/renderJob");

const app = express();
const PORT = process.env.PORT || 5002;

const ENTRY_POINT = path.resolve(__dirname, "src/index.ts");
const OUTPUT_DIR =
  process.env.OUTPUT_DIR || path.resolve(__dirname, "out/jobs");

app.use(express.json({ limit: "2mb" }));

let serveUrl;
let renderQueue = Promise.resolve();

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

    const currentTask = renderQueue.then(() =>
      renderJob(req.body, {
        serveUrl,
        outputDir: OUTPUT_DIR,
        baseDir: __dirname,
      }),
    );

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

module.exports = {
  app,
  validateRequest,
  renderJob,
  startServer,
};
