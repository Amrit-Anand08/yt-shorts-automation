const test = require("node:test");
const assert = require("node:assert");
const { sanitizeMetadata, fallbackMetadata } = require("../src/services/metadataService");

test("title is trimmed to 100 chars and brackets are removed", () => {
  const out = sanitizeMetadata(
    { title: "<b>" + "A".repeat(150) + "</b>", description: "x", tags: [] },
    { title: "fallback" },
  );
  assert.ok(out.title.length <= 100);
  assert.ok(!/[<>]/.test(out.title));
});

test("#Shorts is always present in the description", () => {
  const out = sanitizeMetadata(
    { title: "JS arrays", description: "Learn arrays.", tags: ["js"] },
    { title: "x" },
  );
  assert.match(out.description, /#Shorts/);
});

test("#Shorts is not added twice", () => {
  const out = sanitizeMetadata(
    { title: "t", description: "hello #shorts #js", tags: [] },
    { title: "x" },
  );
  assert.strictEqual((out.description.match(/#shorts/gi) || []).length, 1);
});

test("tags are cleaned, de-duplicated and limited", () => {
  const many = Array.from({ length: 40 }, (_, i) => `tag${i}`);
  const out = sanitizeMetadata(
    { title: "t", description: "d", tags: ["#JS", "js", "a,b", "<x>", ...many] },
    { title: "x" },
  );
  assert.ok(out.tags.length <= 12);
  assert.strictEqual(out.tags.filter((t) => t.toLowerCase() === "js").length, 1);
  assert.ok(out.tags.every((t) => !/[<>,#]/.test(t) && t.length <= 30));
});

test("empty model output falls back to the script title", () => {
  const out = sanitizeMetadata({}, { title: "Fallback Title" });
  assert.strictEqual(out.title, "Fallback Title");
  assert.match(out.description, /#Shorts/);
});

test("fallbackMetadata works without Gemini", () => {
  const out = fallbackMetadata({ topic: "Closures", script: { title: "JS Closures Explained" } });
  assert.strictEqual(out.title, "JS Closures Explained");
  assert.ok(out.tags.length > 0);
});
