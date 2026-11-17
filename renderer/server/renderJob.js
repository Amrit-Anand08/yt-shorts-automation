const path = require("path");
const fs = require("fs");
const { renderMedia, selectComposition } = require("@remotion/renderer");
const { validateRequest } = require("./validate");

async function renderJob(body, { serveUrl, outputDir, baseDir }) {
  validateRequest(body);

  const inputProps = {
    topic: String(body.topic || "Untitled"),
    channelName: String(body.channelName || "CODING GALAXY"),
    scenes: body.scenes,
    audioFile: body.audioFile,
    musicFile: body.musicFile,
  };

  const outputLocation = path.join(outputDir, `job-${body.jobId}.mp4`);

  fs.mkdirSync(outputDir, { recursive: true });

  // Copy dynamically generated audio into the active Remotion bundle.
  const sourceAudioPath = path.resolve(baseDir, "public", body.audioFile);

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

  try {
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
  } finally {
    // The bundle copy is only needed during the render; remove it so copies
    // do not pile up inside the container.
    await fs.promises.unlink(bundledAudioPath).catch(() => {});
  }
}

module.exports = {
  renderJob,
};
