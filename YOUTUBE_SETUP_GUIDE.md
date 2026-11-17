# YouTube Upload Setup (ek baar ka kaam)

Is guide ke baad tumhari automation Telegram se topic lekar video **seedha tumhare YouTube channel pe upload** karegi.
Google Cloud ke menu/button ke naam kabhi kabhi thode badal jate hain; idea wahi rehta hai.

## Step 1: Google Cloud project + YouTube API
1. https://console.cloud.google.com kholo (wahi Google account jisme tumhara YouTube channel hai).
2. Naya project banao (naam: `yt-shorts-studio`).
3. **APIs & Services -> Library** me **YouTube Data API v3** search karo -> **Enable**.

## Step 2: OAuth consent screen (Google Auth Platform)
1. **APIs & Services -> OAuth consent screen** (ya "Google Auth Platform") kholo.
2. App name: `YT Shorts Studio`, support email: apna email. User type: **External**.
3. Scope add karo: `.../auth/youtube.upload`.
4. **Zaroori:** Publishing status ko **"In production"** karo (Audience / Publish app).
   - Agar app "Testing" me rahi to Google ke rules ke hisaab se refresh token **7 din me expire** ho jata hai aur upload band ho jayega.
   - Personal use ke liye "In production" me bina verification chalta hai. Login ke time Google "unverified app" warning dikhayega, wo normal hai.

## Step 3: OAuth client banao
1. **Credentials -> Create credentials -> OAuth client ID**.
2. Application type: **Desktop app**. Naam: `shorts-worker`.
3. **Client ID** aur **Client secret** copy karo aur `.env` me daalo:
```
YT_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
YT_CLIENT_SECRET=xxxxxxxx
```

## Step 4: Login karke refresh token lo
Project folder me (Docker chalu hona chahiye, Node install karna zaroori nahi):
```bash
docker compose build worker
docker compose run --rm --no-deps -p 127.0.0.1:53682:53682 -e YT_AUTH_HOST=0.0.0.0 worker node scripts/youtube-auth.js
```
1. Terminal ek **link** dikhayega -> usse browser me kholo.
2. Wo Google account / channel chuno jisme videos upload karni hain (brand channel ho to wahi select karo).
3. "Google hasn't verified this app" aaye to **Advanced -> Go to YT Shorts Studio (unsafe) -> Continue**, phir **Allow**.
4. Terminal me ek line aayegi: `YT_REFRESH_TOKEN=...` -> use `.env` me paste karo.

Token na mile to https://myaccount.google.com/permissions se is app ka access hatao aur Step 4 dobara chalao.

## Step 5: Chalu karo aur check karo
```bash
docker compose up -d --build
```
Browser me kholo: http://127.0.0.1:5001/youtube/status

- `"configured": true, "token_ok": true` -> sab theek.
- `"configured": false` -> `missing` me jo values hain unhe `.env` me daalo.
- `"token_ok": false` -> `error` me wajah likhi hai (aksar Step 4 dobara).

## Step 6: Telegram bot allowlist
n8n me workflow import karo, **Check Allowed Chat** node kholo aur `ALLOWED_CHAT_IDS` me apni chat ID daalo.
Chat ID nahi pata? Bot ko ek message bhejo, wo tumhari ID reply karega. Ye zaroori hai, warna koi bhi tumhare channel pe video upload karwa sakta hai.

## Privacy: pehle private, phir public
`.env` me `YT_DEFAULT_PRIVACY=private` se shuru karo. Pehle 3-4 videos YouTube Studio me dekh lo, phir `YT_DEFAULT_PRIVACY=public` karke `docker compose up -d` chalao.

## Auto delete (3 din)
Local video aur voiceover files `RETENTION_DAYS=3` din baad apne aap delete hoti hain (har 6 ghante check). YouTube pe upload hui video par iska koi asar nahi. Pehle test karna ho to `CLEANUP_DRY_RUN=true` karo; log me dikhega kya delete hota, par delete nahi hoga. `RETENTION_DAYS=0` = auto delete band.

## Aam errors
| Error | Matlab | Fix |
|---|---|---|
| `invalid_grant` / token expire | Login token kharab ya expire | Step 4 dobara; app "In production" me ho |
| quota khatam | YouTube API limit | Thodi der baad try karo, Cloud Console me quota dekho |
| daily upload limit | Channel ki upload limit | Kuch ghante baad |
| 403 | API enable nahi ya permission nahi di | Step 1 check karo, Step 4 me upload permission allow karo |
