# Asha: Virtual Key Account Manager for Snapdeal sellers

A voice-first assistant that reviews a seller's sales data, asks one question at a time, and ends with a short action plan. All seller data is **simulated**.

- **Frontend** (`/frontend`): React + Vite. Browser speech recognition (`en-IN`) and SpeechSynthesis.
- **Backend** (`/backend`): Node + Express. Deterministic business engine plus Google Gemini (free tier) for natural phrasing, with a complete local fallback.
- **Cost:** no paid services. Hosting on Vercel Hobby and Render Free.

## How it works in one paragraph
A deterministic engine owns the numbers, the conversation state, the next question, the diagnosis and the recommendations. Gemini only *phrases* each reply. Every model reply is validated (no invented numbers, no unsupported price advice, one question only). If Gemini is missing, rate-limited, slow or returns junk, the engine's own reply is used, so the conversation never breaks. See `docs/ARCHITECTURE.md`.

