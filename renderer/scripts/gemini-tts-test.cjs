
const fs = require("node:fs");
const path = require("node:path");

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is missing.");
  }

  const text = `Hey developers! Ready ho?
Aaj hum seekhenge JavaScript ke teen zabardast Array Methods!
Map, Filter aur Reduce.
Aur trust me, inka use samajh aa gaya na,
toh coding aur bhi easy ho jayegi!
Let's go!`;

  console.log("Generating Gemini voiceover...");

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/interactions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model: "gemini-3.8-flash-tts",
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
        response_format: {
          type: "audio",
        },
        generation_config: {
          speech_config: [
            {
              voice: "Puck",
            },
          ],
        },
      }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      JSON.stringify(result.error || result, null, 2)
    );
  }

  // Extract audio from Gemini response
  const audioData = result.steps
    ?.flatMap((step) => step.content ?? [])
    .find((item) => typeof item.data === "string")?.data;

  if (!audioData) {
    throw new Error("Audio data not found in Gemini response.");
  }

  // Convert Base64 to WAV
  const audioBuffer = Buffer.from(audioData, "base64");

  // Save audio file
  const outputPath = path.join(
    __dirname,
    "../public/audio/gemini-voice-test.wav"
  );

  fs.mkdirSync(path.dirname(outputPath), {
    recursive: true,
  });

  fs.writeFileSync(outputPath, audioBuffer);

  console.log("\nGemini TTS test successful!");
  console.log("Audio saved:", outputPath);
  console.log("Audio size:", audioBuffer.length, "bytes");
}

main().catch((error) => {
  console.error("\nGemini TTS test failed:");
  console.error("Message:", error.message);
  console.error("Cause:", error.cause);
  console.error("Error Code:", error.cause?.code);
  console.error("Error Name:", error.name);
});
