const fs = require("fs");
const { google } = require("googleapis");
const config = require("../config");

// Which YT_* settings are still empty (used for clear error messages).
function missingSettings() {
  return [
    ["YT_CLIENT_ID", config.YT_CLIENT_ID],
    ["YT_CLIENT_SECRET", config.YT_CLIENT_SECRET],
    ["YT_REFRESH_TOKEN", config.YT_REFRESH_TOKEN],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
}

function isConfigured() {
  return missingSettings().length === 0;
}

function getAuthClient() {
  const client = new google.auth.OAuth2(
    config.YT_CLIENT_ID,
    config.YT_CLIENT_SECRET,
  );
  client.setCredentials({ refresh_token: config.YT_REFRESH_TOKEN });
  return client;
}

// Refreshes the access token. Costs no API quota and proves the login works.
async function checkToken() {
  const { token } = await getAuthClient().getAccessToken();
  return Boolean(token);
}

// Turns a Google API error into a short, actionable message.
function explainYoutubeError(error) {
  const text = String(error?.message || "");
  const status = Number(error?.code || error?.response?.status || 0);
  const apiErrors =
    error?.errors || error?.response?.data?.error?.errors || [];
  const reasons = apiErrors.map((item) => item?.reason).filter(Boolean);
  const has = (...names) => names.some((name) => reasons.includes(name));

  if (/invalid_grant/i.test(text)) {
    return "YouTube login token expire ya revoke ho gaya hai. youtube:auth dobara chalao aur naya YT_REFRESH_TOKEN .env me daalo. (OAuth app 'Testing' mode me ho to token 7 din me expire ho jata hai; app ko 'In production' me daalo.)";
  }

  if (/invalid_client|unauthorized_client/i.test(text)) {
    return "YT_CLIENT_ID ya YT_CLIENT_SECRET galat hai. Google Cloud me OAuth client check karo.";
  }

  if (has("quotaExceeded", "rateLimitExceeded", "dailyLimitExceeded")) {
    return "YouTube API quota khatam ho gaya hai. Thodi der baad dobara try karo ya Google Cloud Console me quota dekho.";
  }

  if (has("uploadLimitExceeded")) {
    return "Is channel ki daily upload limit ho gayi hai. Kuch ghante baad dobara try karo.";
  }

  if (has("youtubeSignupRequired")) {
    return "Is Google account pe YouTube channel bana hua nahi hai. Pehle channel banao.";
  }

  if (has("insufficientPermissions", "forbidden") || status === 403) {
    return "YouTube ne permission nahi di (403). Check karo: YouTube Data API enabled hai, aur login me upload permission allow ki thi. Zarurat ho to youtube:auth dobara chalao.";
  }

  if (status === 401) {
    return "YouTube login valid nahi hai (401). youtube:auth dobara chalao.";
  }

  return `YouTube upload fail hua: ${text || "unknown error"}`.slice(0, 500);
}

// Uploads one video file as a YouTube video (Shorts need no special flag:
// vertical + up to 3 minutes + #Shorts in the description).
async function uploadVideo({ filePath, title, description, tags }) {
  const youtube = google.youtube({ version: "v3", auth: getAuthClient() });

  const status = {
    privacyStatus: config.YT_DEFAULT_PRIVACY,
    selfDeclaredMadeForKids: config.YT_MADE_FOR_KIDS,
  };

  // Only sent when enabled; the default (false) is the same as omitting it.
  if (config.YT_CONTAINS_SYNTHETIC_MEDIA) {
    status.containsSyntheticMedia = true;
  }

  const response = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title,
        description,
        tags,
        categoryId: config.YT_CATEGORY_ID,
      },
      status,
    },
    media: { body: fs.createReadStream(filePath) },
  });

  const videoId = response?.data?.id;

  if (!videoId) {
    throw new Error("YouTube did not return a video id");
  }

  return {
    videoId,
    url: `https://www.youtube.com/shorts/${videoId}`,
  };
}

module.exports = {
  missingSettings,
  isConfigured,
  checkToken,
  explainYoutubeError,
  uploadVideo,
};
