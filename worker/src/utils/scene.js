const { SCENE_TYPES } = require("../constants");
const { cleanText, cleanCode } = require("./text");

// Validates one scene and fills in the fields the renderer expects.
// Used both for fresh scripts and for scripts that were saved earlier.
function normalizeScene(scene, index, total) {
  const fail = (message) => {
    const error = new Error(message);
    error.retryable = true;
    return error;
  };

  if (!scene || typeof scene !== "object") {
    throw fail(`Gemini returned invalid data for scene ${index + 1}`);
  }

  const voiceover = cleanText(scene.voiceover, 1200);

  if (!voiceover) {
    throw fail(`Scene ${index + 1}: missing or empty voiceover`);
  }

  if (typeof scene.on_screen_text !== "string") {
    throw fail(`Scene ${index + 1}: on_screen_text must be a string`);
  }

  const codeSnippet = cleanCode(scene.code_snippet);

  const points = Array.isArray(scene.points)
    ? scene.points
        .map((point) => cleanText(point, 60))
        .filter(Boolean)
        .slice(0, 4)
    : [];

  let compare;
  if (scene.compare && typeof scene.compare === "object") {
    const leftText = cleanText(scene.compare.left_text, 70);
    const rightText = cleanText(scene.compare.right_text, 70);

    if (leftText && rightText) {
      compare = {
        left_label: cleanText(scene.compare.left_label, 20).toUpperCase(),
        left_text: leftText,
        right_label: cleanText(scene.compare.right_label, 20).toUpperCase(),
        right_text: rightText,
      };
    }
  }

  let type =
    typeof scene.scene_type === "string"
      ? scene.scene_type.toLowerCase().trim()
      : "";

  if (!SCENE_TYPES.has(type)) {
    if (index === 0) type = "hook";
    else if (index === total - 1) type = "outro";
    else if (codeSnippet) type = "code";
    else if (compare) type = "example";
    else type = "explanation";
  }

  // A "code" scene without code would render an empty editor.
  if (type === "code" && !codeSnippet) type = "explanation";

  const caption = cleanText(scene.caption, 120);
  const codeLanguage = cleanText(scene.code_language, 20);

  return {
    scene_number: index + 1,
    scene_type: type,
    voiceover,
    on_screen_text:
      cleanText(scene.on_screen_text, 60) || cleanText(voiceover, 40),
    visual_description: cleanText(scene.visual_description, 400),
    ...(caption ? { caption } : {}),
    ...(points.length ? { points } : {}),
    ...(codeSnippet ? { code_snippet: codeSnippet } : {}),
    ...(codeSnippet && codeLanguage ? { code_language: codeLanguage } : {}),
    ...(compare ? { compare } : {}),
  };
}

module.exports = {
  normalizeScene,
};
