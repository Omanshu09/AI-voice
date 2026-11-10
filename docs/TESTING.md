# Testing report

Environment note: the build sandbox had **no network**, so `npm install` and `vite build` could not run there. Results below say exactly what was and was not executed. Run the "run locally" commands to reproduce.

## Executed in the sandbox
| Check | Result |
|---|---|
| Backend syntax check (`node --check` on 20 files) | Pass |
| Backend unit tests: metrics, conversation flow, diagnosis, recommendations, summary, model-output validation, Gemini error/quota/malformed fallback, input validation, CORS rules | 45 pass, 0 fail |
| Frontend unit tests (speech helpers) | 6 pass, 0 fail |
| Frontend compile check using esbuild (stand-in for Vite) | Pass |
| Headless Chromium end-to-end run against the real chat service with mocked SpeechRecognition/SpeechSynthesis | 32 of 32 pass |

Specific assertions: 32.5% sales and order decline; +6 percentage points; ASP unchanged; stock-outs +13 (+260% relative); decline is 100% volume effect; no invented traffic figures; no price advice without evidence; no repeated question; unsure/unclear/off-topic answers handled; no mic on load; no mic during speech; one recogniser at a time; duplicate result dropped; interrupt, mute, repeat, hands-free loop, silence pause, permission denied, backend failure with retry, unsupported browser, summary download, no mobile horizontal overflow.

## NOT executed (need your machine)
- `npm install`, `npm run build` (Vite production build), and the 8 Express HTTP tests in `backend/tests/api.test.js` (health, validation, 413, CORS 403, rate limit 429, 404). They skip themselves when Express is missing.
- Live Gemini calls, free-tier quota confirmation, and the exact model name (`npm run check:gemini`).
- Real microphone, real speech recognition accuracy, real voices, Safari/Firefox behaviour.
- Vercel and Render deployments, cold-start timing.

## Manual checklist (Chrome or Edge)
1. Load the page: no permission prompt. Start conversation: greeting is spoken.
2. Tap the mic: permission prompt, then listening indicator; speak; reply is spoken.
3. Hands-free on: Asha listens by herself after speaking; the mic does not pick up her voice (use speakers once to confirm).
4. Tap the mic while Asha speaks: she stops and listens.
5. Block mic in browser settings: clear message, typing works.
6. Stay silent twice in hands-free: pauses with a message.
7. Turn off Wi-Fi mid-call: error with Try again; works after reconnect.
8. Indian-accent recognition of "best sellers", "dispatch", "courier": note any misses.
9. Phone: tabs work, no sideways scrolling.

## Sandbox harness
`docs/testing-harness/` holds the Playwright script and mocks used above (paths are sandbox-specific; adapt before reuse).
