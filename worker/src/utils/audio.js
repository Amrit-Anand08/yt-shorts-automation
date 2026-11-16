const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

// Gemini TTS can return raw 16-bit PCM without a header. Wrap it as WAV so
// ffprobe and the browser can read it. Already-encoded audio is left as is.
function ensureWav(buffer, sampleRate = 24000) {
  const head = buffer.toString("latin1", 0, 4);

  const alreadyEncoded =
    head === "RIFF" ||
    head === "OggS" ||
    head === "fLaC" ||
    head.startsWith("ID3") ||
    (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0); // MP3 frame sync

  if (alreadyEncoded) return buffer;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + buffer.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(buffer.length, 40);

  return Buffer.concat([header, buffer]);
}

// Measure the actual duration of an audio file using FFprobe.
async function getAudioDuration(filePath) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);

  const duration = Number.parseFloat(stdout.trim());

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Unable to measure audio duration: ${filePath}`);
  }

  return duration;
}

module.exports = {
  ensureWav,
  getAudioDuration,
};
