# Asha: Virtual Key Account Manager for Snapdeal sellers

A voice-first assistant that reviews a seller's sales data, asks one question at a time, and ends with a short action plan. All seller data is **simulated**.

- **Frontend** (`/frontend`): React + Vite. Browser speech recognition (`en-IN`) and SpeechSynthesis.
- **Backend** (`/backend`): Node + Express. Deterministic business engine plus Google Gemini (free tier) for natural phrasing, with a complete local fallback.
- **Cost:** no paid services. Hosting on Vercel Hobby and Render Free.

## How it works in one paragraph
A deterministic engine owns the numbers, the conversation state, the next question, the diagnosis and the recommendations. Gemini only *phrases* each reply. Every model reply is validated (no invented numbers, no unsupported price advice, one question only). If Gemini is missing, rate-limited, slow or returns junk, the engine's own reply is used, so the conversation never breaks. See `docs/ARCHITECTURE.md`.

## Run locally
```bash
# terminal 1
cd backend && cp .env.example .env   # add GEMINI_API_KEY (optional)
npm install && npm start             # http://localhost:8080

# terminal 2
cd frontend && cp .env.example .env
npm install && npm run dev           # http://localhost:5173  (use Chrome or Edge)
```
Without `GEMINI_API_KEY` the app runs entirely on the local engine.

## Choose and verify the Gemini model
Free-tier model names and quotas change. Do not assume. With your key in `backend/.env`:
```bash
cd backend && npm run check:gemini
```
This lists models your key can call and tests `GEMINI_MODEL`. Confirm free-tier eligibility and quotas in Google AI Studio. Set `GEMINI_FALLBACK_MODEL` to a second model if you like. Note: on the free tier Google may use prompts to improve its products, so only simulated data is sent.

## Deploy
### Backend on Render
1. Push the repo to GitHub.
2. Render > New > Blueprint (uses `render.yaml`) or New > Web Service with **Root Directory** `backend`, Build `npm install`, Start `npm start`, Health check `/health`, plan Free.
3. Environment variables:
   - `GEMINI_API_KEY` (optional but recommended)
   - `FRONTEND_ORIGIN` = your Vercel URL, e.g. `https://asha-kam.vercel.app` (comma-separate several; `https://*.vercel.app` allows previews)
   - `GEMINI_MODEL` (default `gemini-flash-latest`)
4. Copy the service URL (e.g. `https://snapdeal-virtual-kam-api.onrender.com`).

### Frontend on Vercel
1. Vercel > Add New Project > import the repo, **Root Directory** `frontend` (Vite is auto-detected).
2. Environment variable: `VITE_API_BASE_URL` = the Render URL (no trailing slash).
3. Deploy, then set `FRONTEND_ORIGIN` on Render to the final Vercel URL and redeploy the backend.

Render's free service sleeps after inactivity; the first request can take up to a minute. The UI shows "Waking the server" and warms it on page load. Open the page a minute before a demo.

## Tests
```bash
cd backend && npm test      # business math, conversation flow, fallback, validation, CORS, API
cd frontend && npm test     # speech helpers
```
Full report: `docs/TESTING.md`. Voice behaviour must be checked manually on a real microphone (checklist there).

## Browser support
Speech recognition is not identical across browsers. Chrome and Edge work best (Chrome sends audio to a Google service, so it needs internet). Safari support is partial. Firefox has none; typing and suggested replies still work, and Asha can still speak.

## Project layout
```
backend/   src/domain (metrics, questions, diagnosis, recommendations, summary, conversation)
           src/ai (prompts, gemini client, output validation) src/http src/services tests
frontend/  src/lib/VoiceController.js (mic + speech state machine) src/components src/hooks
docs/      ARCHITECTURE, API, TESTING, RECORDING_SCRIPT, testing-harness
```
