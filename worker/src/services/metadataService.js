const config = require("../config");
const { parseModelJson } = require("../utils/text");

const MAX_TITLE = 100;
const MAX_DESCRIPTION = 4000;
const MAX_TAGS = 12;
const MAX_TAG_LENGTH = 30;
const MAX_TAGS_TOTAL = 400;

// YouTube rejects < and > in titles, descriptions and tags.
function stripBrackets(value) {
  return String(value ?? "").replace(/[<>]/g, "");
}

function cleanLine(value, maxLength) {
  return stripBrackets(value).replace(/\s+/g, " ").trim().slice(0, maxLength);
}

// Makes any model output safe and valid for the YouTube API.
function sanitizeMetadata(raw, fallback) {
  const title =
    cleanLine(raw?.title, MAX_TITLE) ||
    cleanLine(fallback.title, MAX_TITLE) ||
    "New Short";

  let description = stripBrackets(raw?.description)
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_DESCRIPTION - 20);

  if (!description) description = cleanLine(fallback.title, 200);

  // The #Shorts hashtag helps YouTube treat the upload as a Short.
  if (!/#shorts\b/i.test(description) && !/#shorts\b/i.test(title)) {
    description = `${description}\n\n#Shorts`;
  }

  const seen = new Set();
  const tags = [];
  let total = 0;

  const candidates = Array.isArray(raw?.tags) ? raw.tags : [];

  for (const item of candidates) {
    const tag = cleanLine(item, MAX_TAG_LENGTH).replace(/^#/, "").replace(/,/g, "");
    const key = tag.toLowerCase();

    if (!tag || seen.has(key)) continue;
    if (tags.length >= MAX_TAGS || total + tag.length > MAX_TAGS_TOTAL) break;

    seen.add(key);
    tags.push(tag);
    total += tag.length;
  }

  return { title, description, tags };
}

// Used when Gemini is unavailable, so a metadata problem never blocks upload.
function fallbackMetadata({ topic, script }) {
  const title = cleanLine(script?.title || topic, MAX_TITLE) || "New Short";

  return sanitizeMetadata(
    {
      title,
      description: `${cleanLine(topic, 200)}\n\n#Shorts #coding #programming`,
      tags: ["coding", "programming", "shorts", cleanLine(topic, MAX_TAG_LENGTH)],
    },
    { title },
  );
}

async function askGeminiForJson(prompt) {
  const models = [
    config.GEMINI_TEXT_PRIMARY,
    ...(config.GEMINI_TEXT_FALLBACK_ENABLED
      ? [config.GEMINI_TEXT_SECONDARY, config.GEMINI_TEXT_TERTIARY]
      : []),
  ].filter((model, index, list) => model && list.indexOf(model) === index);

  let lastError;

  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": config.GEMINI_API_KEY,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
          signal: AbortSignal.timeout(60000),
        },
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          `Gemini ${model} error (${response.status}): ${result?.error?.message || "request failed"}`,
        );
      }

      const text = result.candidates
        ?.flatMap((candidate) => candidate.content?.parts ?? [])
        .filter((part) => typeof part.text === "string")
        .map((part) => part.text)
        .join("")
        .trim();

      if (!text) throw new Error(`Gemini ${model} returned empty text`);

      return parseModelJson(text);
    } catch (error) {
      lastError = error;
      console.warn(`Metadata generation failed with ${model}: ${error.message}`);
    }
  }

  throw lastError || new Error("No Gemini text model is configured");
}

// Title, description and tags for the YouTube upload. Never throws.
async function generateYoutubeMetadata({ topic, language, script }) {
  const fallback = fallbackMetadata({ topic, script });

  if (!config.GEMINI_API_KEY) return fallback;

  const sceneLines = (script?.scenes ?? [])
    .map((scene) => `- ${scene.on_screen_text || ""}`)
    .join("\n")
    .slice(0, 800);

  const prompt = `
You write YouTube Shorts metadata for the channel "${config.CHANNEL_NAME}", a coding education channel.

Video topic: ${topic}
Narration language: ${language}
Script title: ${script?.title || topic}
On-screen points:
${sceneLines}

Return ONLY this JSON:
{
  "title": "...",
  "description": "...",
  "tags": ["...", "..."]
}

Rules:
- title: at most 70 characters, specific and curiosity-driven but honest (no false promises), no emojis, no quotation marks.
- description: 2 to 3 short lines written in ${language} that summarise what the viewer learns, then one line with 4 to 6 hashtags including #Shorts.
- tags: 8 to 12 short lowercase keywords (each at most 25 characters), no hashtags.
- Do not use the characters < or >.
`;

  try {
    const raw = await askGeminiForJson(prompt);
    return sanitizeMetadata(raw, { title: script?.title || topic });
  } catch (error) {
    console.warn(`Using fallback YouTube metadata: ${error.message}`);
    return fallback;
  }
}

module.exports = {
  sanitizeMetadata,
  fallbackMetadata,
  generateYoutubeMetadata,
};
