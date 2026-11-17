// Returns a positive safe integer, or null when the value is not one.
function parseId(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function cleanText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

// Keeps line breaks (needed for code) but removes tabs, CRs and trailing space.
function cleanCode(value) {
  if (typeof value !== "string") return "";

  return value
    .replace(/\r/g, "")
    .replace(/\t/g, "  ")
    .split("\n")
    .map((line) => line.replace(/\s+$/, "").slice(0, 70))
    .slice(0, 12)
    .join("\n")
    .trim();
}

// Gemini sometimes wraps JSON in ```json fences or adds a sentence around it.
function parseModelJson(text) {
  let candidate = text.trim();

  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidate = fenced[1].trim();

  try {
    return JSON.parse(candidate);
  } catch {
    // fall through
  }

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start !== -1 && end > start) {
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
      // fall through
    }
  }

  const error = new Error("Gemini returned invalid JSON for the video script");
  error.retryable = true;
  throw error;
}

// Reading time estimate used to split the audio between scenes: words plus
// a little extra for sentence and comma pauses.
function speechWeight(text) {
  const words = text.trim().split(/\s+/).length;
  const stops = (text.match(/[.!?।]/g) || []).length;
  const commas = (text.match(/[,;:]/g) || []).length;

  return words + (stops + commas * 0.5) * 0.7;
}

module.exports = {
  parseId,
  cleanText,
  cleanCode,
  parseModelJson,
  speechWeight,
};
