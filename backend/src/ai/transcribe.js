// Speech-to-text fallback for browsers without usable built-in recognition.
// Uses Groq's Whisper endpoint with the same API key as the chat model.

const ENDPOINT = "https://api.groq.com/openai/v1/audio/transcriptions";

export class TranscribeError extends Error {
  constructor(message, { status = 0, kind = "error" } = {}) { super(message); this.status = status; this.kind = kind; }
}

export async function transcribeAudio({ apiKey, buffer, mimeType = "", model = "whisper-large-v3-turbo", timeoutMs = 20000, fetchImpl = fetch }) {
  const ext = /mp4|m4a|aac/i.test(mimeType) ? "mp4" : /ogg/i.test(mimeType) ? "ogg" : /wav/i.test(mimeType) ? "wav" : "webm";
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimeType.split(";")[0] || "audio/webm" }), `audio.${ext}`);
  form.append("model", model);
  form.append("language", "en");
  form.append("response_format", "json");
  form.append("temperature", "0");
  form.append("prompt", "A seller talking about sales, orders, cancellations, out of stock products, dispatch, courier pickup, listings, visits, impressions and competitor prices.");
  let res;
  try {
    res = await fetchImpl(ENDPOINT, { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    throw new TranscribeError("transcription network error", { kind: e?.name === "TimeoutError" ? "timeout" : "network" });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new TranscribeError(`transcription HTTP ${res.status}`, { status: res.status, kind: res.status === 429 ? "quota" : "error" });
  return String(data?.text ?? "").trim();
}
