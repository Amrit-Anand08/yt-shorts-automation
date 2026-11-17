# Changelog

## V1 - Topic dalo, video YouTube pe upload (+ 3 din auto-delete)

**Naya**
- Telegram se topic bhejo -> video ban kar YouTube pe upload (default private) -> Telegram me link.
- `POST /jobs/:id/upload` (ek job ek hi baar upload hota hai; dobara call karne par wahi link milta hai).
- Title, description, tags Gemini banata hai (Gemini fail ho to fallback metadata, upload nahi rukta).
- `GET /youtube/status`: YouTube setup aur token check (secret kabhi show nahi hota).
- `npm run youtube:auth` / Docker command: ek baar ka Google login, refresh token milta hai.
- Auto cleanup: `RETENTION_DAYS=3` din se purani `job-<id>.mp4/.wav` files delete (har 6 ghante). Processing/uploading job ki files kabhi delete nahi hoti. Dry-run mode available.
- Telegram allowlist (`Check Allowed Chat` node): sirf tumhari chat ID.
- DB (additive): `studio.uploads` table, `video_jobs.files_deleted_at`, status index.
- Tests: `cd worker && npm test` (metadata + cleanup).

**Fixes**
- Duration decimal (10.5) pe ab error nahi aata, round hota hai; 1-180 check n8n me bhi.
- `CHANNEL_NAME` ab `.env` se aata hai.
- Renderer har render ke baad bundle me copy hui audio file hata deta hai.
- `.env.example` saaf kiya (jo variables code me use hi nahi hote the, hata diye; `GEMINI_API_KEY=AQ.` placeholder hataya).
- n8n flow ke step numbers 5 step ke hisaab se.

**Upgrade kaise karein**
1. `.env.example` se nayi values `.env` me copy karo.
2. `YOUTUBE_SETUP_GUIDE.md` follow karo (ek baar).
3. n8n me naya `n8n/YouTube_Shorts_Studio_Main_Pipeline.json` import karo, Telegram credential dobara select karo, `Check Allowed Chat` me apni chat ID daalo, activate.
4. `docker compose up -d --build`
