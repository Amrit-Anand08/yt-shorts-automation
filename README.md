# YouTube Shorts Studio

An automated, AI-powered pipeline to generate animated coding educational YouTube Shorts from a single Telegram prompt.

---

## 🏗️ Architecture Overview

```mermaid
flowchart LR
    A["📱 Telegram User"] -->|"Topic, Audience, Duration"| B["⚡ n8n Workflow"]
    B -->|"Generate Script & Job"| C["🛠️ Node.js Worker"]
    C -->|"Prompt & Script JSON"| D["🧠 Gemini 3.8 Flash"]
    C -->|"Text-to-Speech (WAV)"| E["🎙️ Gemini 3.8 Flash TTS"]
    C -->|"Render Job Payload"| F["🎬 Remotion Renderer"]
    F -->|"Rendered MP4"| C
    C -->|"Video Ready"| B
    B -->|"Send Video File"| A
```

### Pipeline Flow
1. **Telegram Trigger:** User sends video details (`Topic`, `Audience`, `Language`, `Duration`) via Telegram bot.
2. **n8n Orchestrator:** Parses the incoming text and invokes the worker backend.
3. **Node.js Worker (`/scripts/generate`):**
   - Calls **Gemini 3.8 Flash** with structured prompts to generate scene-by-scene script JSON (hook, explanation, code, example, outro).
   - Persists requests and scripts in PostgreSQL.
4. **Voiceover Generation (`/jobs/:id/process`):**
   - Synthesizes spoken voiceover via **Gemini Flash TTS** (`Puck` voice in Indian Hinglish/English style).
   - Computes precise audio durations with `ffprobe` and calculates scene frame budgets.
5. **Remotion Renderer (`/render`):**
   - Renders motion graphics, code editor animations, captions, and sound effects to 1080x1920 MP4 video.
6. **Delivery:** Completed video is sent to the user on Telegram.
7. **YouTube upload (V1):** The worker uploads the video to your channel (`/jobs/:id/upload`, private by default) with AI-written title, description and tags, and Telegram gets the link. See [`YOUTUBE_SETUP_GUIDE.md`](YOUTUBE_SETUP_GUIDE.md).
8. **Auto cleanup (V1):** Local video/audio files older than `RETENTION_DAYS` (default 3) are deleted automatically.

---

## 📋 Prerequisites

- **Docker & Docker Compose** (Docker Desktop on Windows/macOS or Docker Engine on Linux)
- **Node.js 20+** (if running services locally outside Docker)
- **FFmpeg & FFprobe** (installed in containers; required on host only for local worker development)
- **Google Gemini API Key** (with access to Gemini text and TTS models)
- **Telegram Bot Token** (from `@BotFather` for the n8n trigger)

---

## 🚀 Quickstart

### 1. Clone the repository
```bash
git clone https://github.com/your-username/youtube-shorts-studio.git
cd youtube-shorts-studio
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

| Variable | Description | Example |
| :--- | :--- | :--- |
| `POSTGRES_DB` | PostgreSQL database name | `n8n` |
| `POSTGRES_USER` | PostgreSQL username | `studio_admin` |
| `POSTGRES_PASSWORD` | PostgreSQL password | Strong random password |
| `N8N_ENCRYPTION_KEY` | n8n encryption key (32 hex characters) | Random 32 hex chars |
| `N8N_WEBHOOK_URL` | *(Optional)* Public URL for Telegram webhooks | `https://your-tunnel.trycloudflare.com/` |
| `GEMINI_API_KEY` | Google Gemini API Key | `AIza...` |
| `CHANNEL_NAME` | Channel name shown in the video | `CODING GALAXY` |
| `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN` | YouTube upload login (one-time, see guide) | |
| `YT_DEFAULT_PRIVACY` | `private` / `unlisted` / `public` | `private` |
| `RETENTION_DAYS` | Delete local videos older than N days (0 = off) | `3` |

### 3. Launch with Docker Compose
```bash
docker compose up -d --build
```

### 4. Verify Services
Check running containers:
```bash
docker compose ps
```
- **n8n:** `http://localhost:5678`
- **Worker API:** `http://localhost:5001` (health check: `http://localhost:5001/health`)
- **Remotion Renderer:** Internal `http://renderer:5002` (accessible within Docker network)
- **PostgreSQL:** internal only (not published to the host)
- **YouTube check:** `http://localhost:5001/youtube/status`

### 5. Import the n8n Pipeline
1. Open n8n at `http://localhost:5678`.
2. Set up your Telegram Bot credential under **Credentials** > **Telegram API**.
3. Import the workflow from [`n8n/YouTube_Shorts_Studio_Main_Pipeline.json`](n8n/YouTube_Shorts_Studio_Main_Pipeline.json).
4. Activate the workflow.

---

## 📁 Project Structure

```
youtube-shorts-studio/
├── docker-compose.yml              # Multi-container orchestration (PostgreSQL, n8n, renderer, worker)
├── .env.example                    # Root environment variable template
├── .gitignore                      # Git ignore rules for node_modules, outputs, secrets
├── .dockerignore                   # Docker context ignore rules
├── n8n/
│   └── YouTube_Shorts_Studio_Main_Pipeline.json  # Exported n8n workflow
├── renderer/                       # Remotion video rendering service
│   ├── Dockerfile                  # Slim Debian image with Chromium dependencies & Remotion browser
│   ├── package.json
│   ├── remotion.config.ts          # Remotion studio configuration
│   ├── server.js                   # Express server entry point
│   ├── server/                     # Modular server services (validation & renderJob)
│   │   ├── validate.js
│   │   └── renderJob.js
│   ├── public/audio/               # Background music and UI sound effects
│   └── src/
│       ├── index.ts                # Remotion entry point
│       ├── Root.tsx                # Composition registration
│       ├── Composition.tsx         # Main dynamic composition assembly & backwards-compatible re-exports
│       ├── PremiumPrototype.tsx    # Standalone demo composition
│       ├── types/                  # TypeScript interfaces and type definitions
│       ├── constants/              # Design tokens (colors, typography, defaults)
│       ├── utils/                  # Animation, syntax tokenizer, and scene helpers
│       └── components/             # Modular React Remotion components
│           ├── common/             # Backdrop, Chrome, KineticTitle, Card, Badge, Stack
│           ├── mascot/             # Animated Robot Mascot, SpeechBubble
│           ├── code/               # CodePanel with syntax highlighting & moving scan line
│           ├── scenes/             # Hook, Explanation, Code, Example, and Outro layouts
│           └── MainVideo.tsx       # Root sequence & multi-track audio orchestrator
└── worker/                         # Business logic & AI orchestration
    ├── Dockerfile                  # Node.js alpine image with FFmpeg
    ├── package.json
    └── src/
        ├── server.js               # Entry point & server listener
        ├── app.js                  # Express application setup & middleware
        ├── config/                 # Environment variables & runtime settings
        ├── constants/              # Scene types & SFX audio mapping
        ├── db/                     # PostgreSQL pool & schema migrations
        ├── utils/                  # Text sanitization, audio WAV packaging, ffprobe duration
        ├── services/               # Gemini AI script generation, TTS, Remotion caller & job claim
        ├── controllers/            # Route handler logic for health, scripts, and jobs
        ├── routes/                 # Express route definitions
        └── middlewares/            # Error handling middleware
```

---

## 🛠️ Worker API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Worker service health check |
| `GET` | `/health/db` | Database connectivity check |
| `POST` | `/scripts/generate` | Generates a structured multi-scene script via Gemini |
| `POST` | `/jobs` | Creates a video job for an existing request |
| `POST` | `/jobs/:id/upload` | Uploads the finished video to YouTube (once per job) |
| `GET` | `/youtube/status` | Checks YouTube setup and login token |
| `POST` | `/jobs/:id/process` | Generates TTS voiceover, measures audio, and triggers video rendering |
| `GET` | `/jobs/:id` | Returns job status (`queued`, `processing`, `completed`, `failed`) |
| `GET` | `/jobs/:id/video` | Downloads the completed `.mp4` video file |

---

## 🧪 Local Development

### Remotion Studio Preview
To preview and tweak video compositions in the browser:
```bash
cd renderer
npm install
npm run dev
```

### Worker Unit / Manual Run
```bash
cd worker
npm install
npm start
```

---