const config = require("../config");
const { pool } = require("../db");
const { generateVideoScript } = require("../services/geminiService");

// Create a video request, generate its script and save both in PostgreSQL.
async function generateScript(req, res) {
  const {
    topic,
    audience,
    language,
    duration_seconds: durationSeconds,
  } = req.body ?? {};

  if (
    typeof topic !== "string" ||
    !topic.trim() ||
    typeof audience !== "string" ||
    !audience.trim() ||
    typeof language !== "string" ||
    !language.trim() ||
    !Number.isSafeInteger(durationSeconds) ||
    durationSeconds <= 0 ||
    durationSeconds > 180
  ) {
    return res.status(400).json({
      error: "Provide topic, audience, language and duration_seconds (1–180)",
    });
  }

  try {
    console.log(`Generating script for topic: ${topic.trim()}`);

    const script = await generateVideoScript({
      topic: topic.trim(),
      audience: audience.trim(),
      language: language.trim(),
      durationSeconds,
    });

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const requestResult = await client.query(
        `INSERT INTO studio.video_requests
          (topic, audience, language, duration_seconds, status)
         VALUES ($1, $2, $3, $4, 'pending')
         RETURNING *`,
        [topic.trim(), audience.trim(), language.trim(), durationSeconds],
      );

      const request = requestResult.rows[0];

      await client.query(
        `INSERT INTO studio.video_scripts
          (request_id, script_json, ai_provider, model_name)
         VALUES ($1, $2::jsonb, 'gemini', $3)`,
        [request.id, JSON.stringify(script), config.GEMINI_TEXT_MODEL],
      );

      await client.query("COMMIT");

      return res.status(201).json({
        message: "Video request and script created successfully",
        request,
        script,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Script generation failed:", error.message);

    return res.status(500).json({
      error: "Unable to generate video script",
      details: error.message,
    });
  }
}

module.exports = {
  generateScript,
};
