const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { stub, unload } = require("./helpers");

const DAY = 24 * 60 * 60 * 1000;

function makeDirs() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cleanup-"));
  const out = path.join(root, "output");
  const audio = path.join(root, "audio");
  fs.mkdirSync(out);
  fs.mkdirSync(audio);
  return { root, out, audio };
}

function touch(file, ageDays) {
  fs.writeFileSync(file, "data");
  const t = new Date(Date.now() - ageDays * DAY);
  fs.utimesSync(file, t, t);
}

function load({ out, audio, dryRun = false, days = 3, busyIds = [] }) {
  const queries = [];
  stub("src/config/index.js", {
    OUTPUT_DIR: out,
    AUDIO_DIR: audio,
    RETENTION_DAYS: days,
    CLEANUP_DRY_RUN: dryRun,
    CLEANUP_INTERVAL_MINUTES: 360,
  });
  stub("src/db/index.js", {
    pool: {
      query: async (sql, params) => {
        queries.push({ sql, params });
        if (/SELECT id FROM studio.video_jobs/.test(sql)) {
          return { rows: busyIds.map((id) => ({ id })) };
        }
        return { rows: [], rowCount: 0 };
      },
    },
  });
  unload("src/services/cleanupService.js");
  return { service: require("../src/services/cleanupService"), queries };
}

test("deletes only old job files and keeps new or unrelated files", async () => {
  const { out, audio } = makeDirs();
  touch(path.join(out, "job-1.mp4"), 5);
  touch(path.join(audio, "job-1.wav"), 5);
  touch(path.join(out, "job-2.mp4"), 1);
  touch(path.join(out, "notes.txt"), 30);
  touch(path.join(out, "job-abc.mp4"), 30);

  const { service, queries } = load({ out, audio });
  const result = await service.runCleanup();

  assert.strictEqual(result.deletedFiles, 2);
  assert.ok(!fs.existsSync(path.join(out, "job-1.mp4")));
  assert.ok(!fs.existsSync(path.join(audio, "job-1.wav")));
  assert.ok(fs.existsSync(path.join(out, "job-2.mp4")));
  assert.ok(fs.existsSync(path.join(out, "notes.txt")));
  assert.ok(fs.existsSync(path.join(out, "job-abc.mp4")));
  assert.ok(queries.some((q) => /UPDATE studio.video_jobs/.test(q.sql)));
});

test("dry run deletes nothing", async () => {
  const { out, audio } = makeDirs();
  touch(path.join(out, "job-7.mp4"), 10);

  const { service, queries } = load({ out, audio, dryRun: true });
  const result = await service.runCleanup();

  assert.strictEqual(result.deletedFiles, 1);
  assert.ok(fs.existsSync(path.join(out, "job-7.mp4")));
  assert.ok(!queries.some((q) => /UPDATE studio.video_jobs/.test(q.sql)));
});

test("never deletes files of a job that is processing or uploading", async () => {
  const { out, audio } = makeDirs();
  touch(path.join(out, "job-9.mp4"), 10);

  const { service } = load({ out, audio, busyIds: [9] });
  const result = await service.runCleanup();

  assert.strictEqual(result.deletedFiles, 0);
  assert.ok(fs.existsSync(path.join(out, "job-9.mp4")));
});

test("RETENTION_DAYS=0 disables cleanup", async () => {
  const { out, audio } = makeDirs();
  touch(path.join(out, "job-3.mp4"), 99);

  const { service } = load({ out, audio, days: 0 });
  const result = await service.runCleanup();

  assert.strictEqual(result.skipped, true);
  assert.ok(fs.existsSync(path.join(out, "job-3.mp4")));
});

test("missing folders do not crash", async () => {
  const { service } = load({ out: "/nonexistent/a", audio: "/nonexistent/b" });
  const result = await service.runCleanup();
  assert.strictEqual(result.deletedFiles, 0);
});
