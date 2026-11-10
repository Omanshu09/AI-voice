# API

Base URL: backend origin. JSON only. Errors: `{ "error": "message" }`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | `{ok, aiConfigured, model}`. Never exposes the key. |
| GET | `/api/seller` | Simulated profile, raw data and computed metrics |
| GET | `/api/session/start` | Greeting, initial state, diagnosis |
| POST | `/api/chat` | One conversation turn |
| POST | `/api/summary` | Final summary from a state |

## POST /api/chat
Request: `{ "message": "string 1-600 chars", "history": [{"role":"user|assistant","content":"..."}] (max 20), "state": <object from previous response> }`

Response: `{ reply, mode: "gemini"|"local"|"local-fallback", notice, phase, state, suggestions[], summary|null, diagnosis, recommendations[], progress }`

Status codes: 200, 400 (validation, bad JSON), 403 (origin not allowed), 413 (body over 24 KB), 429 (40 requests/min/IP), 500 (generic safe message).

## POST /api/summary
Request `{ "state": <state> }`. Response: `{ mainProblem, confirmedFindings[], rootCauses[], notSupported[], missing[], actions[], nextSteps[], metricsToWatch[], spokenText, markdown, confidence }`.
