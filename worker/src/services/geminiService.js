const fs = require("fs/promises");
const path = require("path");
const config = require("../config");
const { parseModelJson, cleanText } = require("../utils/text");
const { normalizeScene } = require("../utils/scene");
const { ensureWav } = require("../utils/audio");

async function requestScriptOnce({
  topic,
  audience,
  language,
  durationSeconds,
}) {
  if (!config.GEMINI_API_KEY) {
    throw new Error("Gemini API key is not configured in the Worker");
  }

  const sceneCount = Math.max(3, Math.min(12, Math.ceil(durationSeconds / 6)));

  const prompt = `
You are a professional YouTube Shorts scriptwriter for a coding education channel.

Create an engaging YouTube Shorts script using these details:

Topic: ${topic}
Target audience: ${audience}
Narration language: ${language}
Target duration: ${durationSeconds} seconds
Number of scenes: ${sceneCount}

General requirements:

MANDATORY JSON RULES:
- Every scene MUST contain "scene_number" as an integer.
- Every scene MUST contain "scene_type" as a string.
- Every scene MUST contain "voiceover" as a non-empty string.
- Every scene MUST contain "on_screen_text" as a non-empty string.
- Every scene MUST contain "visual_description" as a string.
- Never use null, arrays, objects, or numbers for these string fields.
- Never omit any mandatory field from any scene.
- Before returning JSON, verify every scene against these rules.
- If a field has no suitable content, write a short valid string instead.

- Write natural, engaging spoken narration.
- Start with a strong hook.
- Keep the explanation accurate and beginner-friendly.
- End with a short, relevant call to action.
- Distribute the narration across exactly ${sceneCount} scenes.
- Keep the total narration appropriate for approximately ${durationSeconds} seconds.
- Scene 1 must be scene_type "hook". The last scene must be "outro".
  Scenes in between use "explanation", "code" or "example".
- "voiceover" is plain spoken text only (no markdown, no stage directions).
  Only the voiceover follows the narration language.
- Everything shown on screen (on_screen_text, caption, points, compare) must be
  short, simple, Latin-script English text without emojis.
- "visual_description" is an internal director note and is never shown.

Fields per scene type:
- hook: on_screen_text is a bold question or statement of at most 6 words.
  caption is one friendly line of at most 14 words.
- explanation: on_screen_text is the concept title (at most 5 words).
  points is a list of 2 to 4 steps, each at most 6 words, showing the idea
  as a step-by-step flow. caption is one short line (at most 14 words).
- code: include code_snippet (3 to 8 lines, each at most 40 characters,
  correct and runnable) and code_language (for example "javascript").
  caption names the key idea of the code in at most 14 words.
- example: include compare with left_label, left_text, right_label,
  right_text. It shows before/after, problem/solution or input/output.
  Each text is at most 40 characters and each label at most 2 uppercase words.
- outro: points is a recap of 2 to 3 items, each at most 5 words.
  The voiceover ends with a short call to action.

Omit optional fields that do not apply to a scene.
Do not include markdown or explanations outside the JSON.

Return this exact JSON structure:
{
  "title": "Short video title",
  "scenes": [
    {
      "scene_number": 1,
      "scene_type": "hook",
      "voiceover": "Narration for this scene",
      "on_screen_text": "Short readable text",
      "caption": "One short supporting line",
      "visual_description": "Detailed visual direction",
      "points": ["Step one", "Step two"],
      "code_language": "javascript",
      "code_snippet": "const x = 1;",
      "compare": {
        "left_label": "BEFORE",
        "left_text": "Slow way",
        "right_label": "AFTER",
        "right_text": "Fast way"
      }
    }
  ]
}
`;

  const apiUrl =
    "https://generativelanguage.googleapis.com/v1beta/interactions";

  // Generate script using the configured text models.
  const models = [
    config.GEMINI_TEXT_PRIMARY,
    ...(config.GEMINI_TEXT_FALLBACK_ENABLED
      ? [config.GEMINI_TEXT_SECONDARY, config.GEMINI_TEXT_TERTIARY]
      : []),
  ].filter((model, index, list) => model && list.indexOf(model) === index);

  let generatedText = "";
  let lastRequestError;

  for (const model of models) {
    let modelSucceeded = false;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        console.log(`Generating script with model: ${model}`);

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": config.GEMINI_API_KEY,
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [{ text: prompt }],
                },
              ],
              generationConfig: {
                responseMimeType: "application/json",
              },
            }),
            signal: AbortSignal.timeout(60000),
          },
        );

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          const message =
            result?.error?.message || "Gemini script generation failed";

          const error = new Error(
            `Gemini ${model} error (${response.status}): ${message}`,
          );

          error.status = response.status;
          throw error;
        }

        generatedText = result.candidates
          ?.flatMap((candidate) => candidate.content?.parts ?? [])
          .filter((part) => typeof part.text === "string")
          .map((part) => part.text)
          .join("")
          .trim();

        if (!generatedText) {
          throw new Error(`Gemini ${model} returned empty text`);
        }

        console.log(`Script generated successfully with ${model}`);
        modelSucceeded = true;
        break;
      } catch (error) {
        lastRequestError = error;

        const retryable =
          !error.status ||
          [408, 429, 500, 502, 503, 504].includes(error.status);

        if (retryable && attempt < 2) {
          console.warn(
            `${model} attempt ${attempt} failed; retrying after backoff`,
          );

          await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));

          continue;
        }

        console.warn(`${model} failed: ${error.message}`);
        break;
      }
    }

    if (modelSucceeded) break;
  }

  if (!generatedText) {
    throw new Error(
      `All configured Gemini text models failed. Last error: ${
        lastRequestError?.message || "Unknown error"
      }`,
    );
  }

  // Step 4: Parse JSON (tolerates code fences).
  const script = parseModelJson(generatedText);

  // Step 5: Validate and normalise the structure.
  if (
    !script ||
    typeof script.title !== "string" ||
    !Array.isArray(script.scenes) ||
    script.scenes.length === 0
  ) {
    const error = new Error("Gemini returned an invalid script structure");
    error.retryable = true;
    throw error;
  }

  const total = script.scenes.length;

  script.title = cleanText(script.title, 120);
  script.scenes = script.scenes.map((scene, index) =>
    normalizeScene(scene, index, total),
  );

  return script;
}

// Tries twice when Gemini returns unusable JSON; other errors fail at once.
async function generateVideoScript(params) {
  let lastError;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await requestScriptOnce(params);
    } catch (error) {
      lastError = error;

      if (!error.retryable) break;

      console.warn(
        `Script attempt ${attempt} was unusable (${error.message}); retrying`,
      );
    }
  }

  throw lastError;
}

// Generate one complete voiceover using the Gemini TTS API.

// Generate one complete voiceover using Gemini TTS with model fallback.
async function generateVoiceover(text, outputPath) {
  if (!config.GEMINI_API_KEY) {
    throw new Error("Gemini API key is not configured in the Worker");
  }

  const primary = config.GEMINI_TTS_PRIMARY || config.GEMINI_TTS_MODEL;

  const models = [
    primary,
    ...(config.GEMINI_TTS_FALLBACK_ENABLED
      ? [config.GEMINI_TTS_SECONDARY, config.GEMINI_TTS_TERTIARY]
      : []),
  ].filter((model, index, list) => model && list.indexOf(model) === index);

  if (!models.length) {
    throw new Error("No Gemini TTS model is configured");
  }

  const apiUrl =
    "https://generativelanguage.googleapis.com/v1beta/interactions";

  let lastError;

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        console.log(
          `Generating voiceover with ${model} (attempt ${attempt}/2)`,
        );

        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": config.GEMINI_API_KEY,
          },
          body: JSON.stringify({
            model,
            input: [
              {
                type: "user_input",
                content: [
                  {
                    type: "text",
                    text,
                    annotations: [
                      {
                        type: "speech_metadata",
                        style:
                          "Speak in natural Indian Hinglish. Use a warm, energetic, confident young male presenter voice. Sound like a real Indian coding YouTuber speaking naturally to an audience. Conversational rhythm, expressive emphasis on important words, friendly enthusiasm, clear pronunciation. Avoid robotic delivery, excessive drama, and unnaturally slow pacing.",
                      },
                    ],
                  },
                ],
              },
            ],
            response_format: { type: "audio" },
            generation_config: {
              speech_config: [{ voice: "Puck" }],
            },
          }),
          signal: AbortSignal.timeout(120000),
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          const message = result?.error?.message || "Gemini TTS request failed";

          const error = new Error(`HTTP ${response.status}: ${message}`);

          error.status = response.status;
          error.retryable =
            response.status === 408 ||
            response.status === 429 ||
            response.status >= 500;

          throw error;
        }

        const audioData = result.steps
          ?.flatMap((step) => step.content ?? [])
          .find((item) => typeof item.data === "string")?.data;

        if (!audioData) {
          const error = new Error("Gemini response did not contain audio data");
          error.retryable = true;
          throw error;
        }

        const audioBuffer = ensureWav(Buffer.from(audioData, "base64"));

        if (audioBuffer.length <= 44) {
          const error = new Error("Gemini returned an empty audio file");
          error.retryable = true;
          throw error;
        }

        // Save only after a valid audio response is received.
        await fs.mkdir(path.dirname(outputPath), {
          recursive: true,
        });

        await fs.writeFile(outputPath, audioBuffer);

        console.log(`Voiceover generated successfully with ${model}`);
        console.log(`Voiceover saved: ${audioBuffer.length} bytes`);

        return;
      } catch (error) {
        lastError = error;

        // Authentication errors will not be fixed by changing models.
        if (error.status === 401 || error.status === 403) {
          throw error;
        }

        console.warn(`${model} attempt ${attempt} failed: ${error.message}`);

        // Retry transient errors once with a short delay.
        if (error.retryable && attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          continue;
        }

        // Move to the next model.
        break;
      }
    }

    console.warn(`TTS model ${model} failed; checking next model`);
  }

  throw new Error(
    `All configured Gemini TTS models failed. Last error: ${
      lastError?.message || "Unknown error"
    }`,
  );
}

module.exports = {
  requestScriptOnce,
  generateVideoScript,
  generateVoiceover,
};
