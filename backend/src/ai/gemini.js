import { SYSTEM_INSTRUCTION } from "./prompts.js";

export class GeminiError extends Error {
  constructor(message, { status = 0, retryAfterMs = 0, kind = "unknown" } = {}) {
    super(message); this.status = status; this.retryAfterMs = retryAfterMs; this.kind = kind;
  }
}

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

// Calls Groq (OpenAI-compatible). The function name stays callGemini so chatService.js is untouched.
export async function callGemini({ apiKey, model, brief, timeoutMs = 9000, fetchImpl = fetch }) {
  let res;
  try {
    res = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_INSTRUCTION },
          { role: "user", content: JSON.stringify(brief) }
        ],
        temperature: 0.5,
        max_tokens: 500,
        response_format: { type: "json_object" }
      }),
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (e) {
    const timeout = e?.name === "TimeoutError";
    throw new GeminiError(timeout ? "AI timed out" : "AI network error", { kind: timeout ? "timeout" : "network" });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const retry = Number(res.headers?.get?.("retry-after")) * 1000 || 0;
    const kind = res.status === 429 ? "quota" : res.status === 404 || res.status === 400 ? "model" : res.status === 401 || res.status === 403 ? "auth" : "server";
    throw new GeminiError(`AI HTTP ${res.status}`, { status: res.status, retryAfterMs: retry, kind });
  }
  const text = data?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new GeminiError("AI returned no text", { kind: "empty" });
  return text;
}
