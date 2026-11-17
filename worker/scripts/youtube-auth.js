// One-time helper: creates the YouTube refresh token for YT_REFRESH_TOKEN.
//
// Docker (no Node needed on your PC):
//   docker compose build worker
//   docker compose run --rm --no-deps -p 127.0.0.1:53682:53682 \
//     -e YT_AUTH_HOST=0.0.0.0 worker node scripts/youtube-auth.js
//
// Local Node:  cd worker && npm install && npm run youtube:auth
const http = require("http");
const crypto = require("crypto");
const path = require("path");
const { google } = require("googleapis");

require("dotenv").config({ path: path.join(__dirname, "../../.env") });
require("dotenv").config();

const clientId = process.env.YT_CLIENT_ID;
const clientSecret = process.env.YT_CLIENT_SECRET;
const port = Number(process.env.YT_AUTH_PORT || 53682);
const host = process.env.YT_AUTH_HOST || "127.0.0.1";
const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;

if (!clientId || !clientSecret) {
  console.error(
    "\nYT_CLIENT_ID aur YT_CLIENT_SECRET .env me daalo, phir ye command dobara chalao.\nSteps: YOUTUBE_SETUP_GUIDE.md\n",
  );
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
const state = crypto.randomBytes(16).toString("hex");

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: ["https://www.googleapis.com/auth/youtube.upload"],
  state,
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, redirectUri);

  if (url.pathname !== "/oauth2callback") {
    res.writeHead(404).end("Not found");
    return;
  }

  const finish = (code, message) => {
    res.writeHead(code, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(message);
    setTimeout(() => server.close(() => process.exit(code === 200 ? 0 : 1)), 300);
  };

  if (url.searchParams.get("error")) {
    console.error(`\nGoogle ne login reject kiya: ${url.searchParams.get("error")}`);
    return finish(400, "Login cancel ya fail hua. Terminal dekho.");
  }

  if (url.searchParams.get("state") !== state) {
    console.error("\nState match nahi hua. Command dobara chalao.");
    return finish(400, "Invalid state. Command dobara chalao.");
  }

  try {
    const { tokens } = await oauth2Client.getToken(url.searchParams.get("code"));

    if (!tokens.refresh_token) {
      console.error(
        "\nRefresh token nahi mila. https://myaccount.google.com/permissions se is app ka access hatao aur command dobara chalao.",
      );
      return finish(400, "Refresh token nahi mila. Terminal dekho.");
    }

    console.log("\n✅ Success! Ye line apni .env file me daalo:\n");
    console.log(`YT_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    console.log("Phir: docker compose up -d   (aur http://127.0.0.1:5001/youtube/status check karo)\n");

    finish(200, "Done! Terminal me YT_REFRESH_TOKEN dikh raha hai. Ye tab band kar sakte ho.");
  } catch (error) {
    console.error(`\nToken lene me error: ${error.message}`);
    finish(500, "Token exchange fail hua. Terminal dekho.");
  }
});

server.listen(port, host, () => {
  console.log("\nStep 1: Ye link browser me kholo (jis Google account me tumhara YouTube channel hai):\n");
  console.log(authUrl);
  console.log("\nStep 2: Login karke Allow karo. Is terminal ko khula rehne do.\n");
});
