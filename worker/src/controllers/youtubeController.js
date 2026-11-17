const config = require("../config");
const youtube = require("../services/youtubeService");

// Shows whether YouTube upload is ready. Never returns any secret.
async function getYoutubeStatus(req, res) {
  const missing = youtube.missingSettings();

  if (missing.length > 0) {
    return res.json({
      configured: false,
      missing,
      hint: "YOUTUBE_SETUP_GUIDE.md follow karo",
    });
  }

  try {
    await youtube.checkToken();

    return res.json({
      configured: true,
      token_ok: true,
      privacy: config.YT_DEFAULT_PRIVACY,
      category_id: config.YT_CATEGORY_ID,
    });
  } catch (error) {
    return res.json({
      configured: true,
      token_ok: false,
      error: youtube.explainYoutubeError(error),
    });
  }
}

module.exports = { getYoutubeStatus };
