<h1 align="center">✨ Full-Stack Interview Platform ✨</h1>

✨ Highlights:

- 🧑‍💻 VSCode-Powered Code Editor
- 🔐 Authentication via Clerk
- 🎥 1-on-1 Video Interview Rooms
- 🧭 Dashboard with Live Stats
- 🔊 Mic & Camera Toggle, Screen Sharing & Recording
- 💬 Real-time Chat Messaging
- ⚙️ Secure Code Execution in Isolated Environment
- 🎯 Auto Feedback — Success / Fail based on test cases
- 🎉 Confetti on Success + Notifications on Fail
- 🧩 Practice Problems Page (solo coding mode)
- 🔒 Room Locking — allows only 2 participants
- 🧠 Background Jobs with Inngest (async tasks)
- 🧰 REST API with Node.js & Express
- ⚡ Data Fetching & Caching via TanStack Query
- 🤖 CodeRabbit for PR Analysis & Code Optimization
- 🧑‍💻 Git & GitHub Workflow (branches, PRs, merges)
- 🚀 Deployment on Sevalla (free-tier friendly)

---

## 🧪 .env Setup

### Backend (`/backend`)

```bash
PORT=3000
NODE_ENV=development

DB_URL=your_mongodb_connection_url

INNGEST_EVENT_KEY=your_inngest_event_key
INNGEST_SIGNING_KEY=your_inngest_signing_key

STREAM_API_KEY=your_stream_api_key
STREAM_API_SECRET=your_stream_api_secret

CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

CLIENT_URL=http://localhost:5173

# Code execution. Locally, JavaScript/Python/Java run on the backend if
# these are unset. For production (Sevalla), set RapidAPI Judge0 CE:
# https://rapidapi.com/judge0-official/api/judge0-ce
JUDGE0_API_KEY=your_rapidapi_key
JUDGE0_API_HOST=judge0-ce.p.rapidapi.com
JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com

# Optional: self-hosted Piston instead of Judge0
# PISTON_API_URL=http://localhost:2000/api/v2
```

### Frontend (`/frontend`)

```bash
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key

# Local: backend API. Production: set this to https://your-api-host/api
# or omit it if the frontend is served from the same backend (uses "/api").
VITE_API_URL=http://localhost:3000/api

VITE_STREAM_API_KEY=your_stream_api_key
```

---

## 🚀 Deploy (Render)

The live frontend was built with `VITE_API_URL=http://localhost:3000/api`, so the browser called your laptop. That is blocked by CORS (`https://hiresync-1-5y0a.onrender.com` → `localhost:3000`).

**Recommended: one Web Service** (backend serves the built frontend)

1. Root directory: repo root. Build: `npm run build`. Start: `npm start`.
2. Backend env: `NODE_ENV=production`, `CLIENT_URL=https://hiresync-1-5y0a.onrender.com` (your real URL), plus Clerk/Stream/Mongo/Inngest, and `JUDGE0_API_KEY`.
3. Do **not** set `VITE_API_URL` to localhost. Production uses `/api` on the same host.
4. In Clerk, add the Render URL under allowed origins / redirect URLs.
5. Redeploy so the new frontend bundle is built.

**If frontend and API are two services:** set the frontend build env to `VITE_API_URL=https://your-api.onrender.com/api`, set backend `CLIENT_URL` to the frontend HTTPS origin, then rebuild both.

Vite env vars are baked in at **build** time. Changing them in the dashboard without a rebuild does nothing.


---

## 🔧 Run the Backend

```bash

cd backend
npm install
npm run dev
```

---

## 🔧 Run the Frontend

```
bash
cd frontend
npm install
npm run dev
```
