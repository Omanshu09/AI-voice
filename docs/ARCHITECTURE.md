# Architecture note

**Goal:** a trustworthy voice consultant, not a generic chatbot. The model may phrase; it may not decide facts.

## Flow of one turn
```
Browser mic -> SpeechRecognition (en-IN) -> POST /api/chat {message, history, state}
  -> validate + sanitise (limits, whitelist state)
  -> processTurn(): classify intent, parse answer into a fact, pick next question  [deterministic]
  -> plan {ack, question | recommendations | summary}
  -> Gemini (JSON) phrases the plan  -> validateReply()  -> reply
        any failure / quota / bad output -> composeReply() local text
  <- {reply, state, diagnosis, recommendations, progress, suggestions}
Browser <- SpeechSynthesis speaks reply; dashboard updates
```

## Backend modules
| Concern | File |
|---|---|
| Metrics (percent vs percentage-point, decomposition) | `domain/metrics.js` |
| Question catalogue, answer parsers, next-question rules | `domain/questions.js` |
| Conversation state transitions and local reply composer | `domain/conversation.js` |
| Diagnosis (confirmed / potential / not supported / missing / confidence) | `domain/diagnosis.js` |
| Recommendations (what, why, how, priority, metric) | `domain/recommendations.js` |
| Final summary (spoken text + markdown) | `domain/summary.js` |
| Prompts and brief builder | `ai/prompts.js` |
| Gemini client (key in header, timeout, typed errors) | `ai/gemini.js` |
| Model output validation | `ai/validate.js` |
| Orchestration, fallback, quota circuit breaker | `services/chatService.js` |
| Validation, CORS, Express app | `http/*`, `app.js` |

## Key decisions
- **Stateless server.** Conversation state is returned to the client and sent back each turn, then re-validated against a whitelist. Render restarts cannot lose a session and tampered state cannot crash anything.
- **Numbers cannot be invented.** Validation rejects any number in a model reply that is not in the verified metrics or the seller's own words; it also rejects unsupported price advice, blaming cancellations alone, markdown, and more than one question.
- **Honest confidence.** Confidence is capped at "medium" because data is simulated and has no traffic figures. Pricing is shown as "not supported by the data" unless the seller reports cheaper competitors.
- **Quota safety.** A 429 opens a 60 s circuit so the free tier is not hammered; replies continue locally.
- **Summaries and repeats never use the model**, so they always work.

## Voice state machine (`frontend/src/lib/VoiceController.js`)
`idle -> listening -> thinking -> speaking -> idle`, with hands-free resuming `listening` ~450 ms after speech ends.
- Only `startListening()` creates a recogniser, guarded by `active`, `busy`, `speaking` and an existing-instance check, so two sessions cannot overlap.
- Recognition is aborted before any speech starts; hands-free waits before reopening the mic (no feedback loop).
- Duplicate results (same text within 4 s) are dropped; a `busy` flag blocks overlapping requests.
- Speech is chunked by sentence and has a watchdog, because some browsers drop long utterances or never fire `onend`.
- Interrupt cancels speech then opens the mic. Permission denial turns hands-free off and falls back to typing.
