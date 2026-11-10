import { SYSTEM_INSTRUCTION } from "./prompts.js";

export class GeminiError extends Error {
  constructor(message, { status = 0, retryAfterMs = 0, kind = "unknown" } = {}) {
    super(message); this.status = status; this.retryAfterMs = retryAfterMs; this.kind = kind;
  }
}

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Calls Gemini's generateContent with a JSON-only response. The API key goes in a
 * header (never in the URL, so it cannot leak into logs). `fetchImpl` is injectable for tests.
 */
export async function callGemini({ apiKey, model, brief, timeoutMs = 9000, fetchImpl = fetch }) {
  let res;
  try {
    res = await fetchImpl(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify(brief) }] }],
        generationConfig: {
          temperature: 0.5, maxOutputTokens: 900, responseMimeType: "application/json",
          responseSchema: { type: "OBJECT", properties: { reply: { type: "STRING" } }, required: ["reply"] }
        }
      }),
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (e) {
    throw new GeminiError(e?.name === "TimeoutError" ? "Gemini timed out" : "Gemini network error", { kind: e?.name === "TimeoutError" ? "timeout" : "network" });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const retry = Number(res.headers?.get?.("retry-after")) * 1000 || 0;
    const kind = res.status === 429 ? "quota" : res.status === 404 || res.status === 400 ? "model" : res.status === 401 || res.status === 403 ? "auth" : "server";
    throw new GeminiError(`Gemini HTTP ${res.status}`, { status: res.status, retryAfterMs: retry, kind });
  }
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text ?? "").join("") ?? "";
  if (!text) throw new GeminiError("Gemini returned no text", { kind: "empty" });
  return text;
}
