const BASE = (import.meta.env?.VITE_API_BASE_URL || "http://localhost:8080").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message, userMessage, kind) { super(message); this.userMessage = userMessage; this.kind = kind; }
}

async function request(path, { method = "GET", body, timeoutMs = 30000, retries = 1 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(BASE + path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return data;
      if (res.status === 429) throw new ApiError("rate limited", "Too many requests. Please wait a few seconds and try again.", "rate");
      if (res.status >= 400 && res.status < 500) throw new ApiError(data.error || "bad request", data.error || "That message could not be processed.", "client");
      lastError = new ApiError(`server ${res.status}`, "The server had a problem. Please try again.", "server");
    } catch (e) {
      if (e instanceof ApiError && e.kind !== "server") throw e;
      lastError = e instanceof ApiError ? e : new ApiError(String(e?.name), "Can't reach the server. It may be waking up. Check your connection and try again.", "network");
    }
    if (attempt < retries) await new Promise(r => setTimeout(r, 1500));
  }
  throw lastError;
}

async function transcribe(blob) {
  let res;
  try {
    res = await fetch(BASE + "/api/transcribe", { method: "POST", headers: { "Content-Type": blob.type || "audio/webm" }, body: blob, signal: AbortSignal.timeout(30000) });
  } catch {
    throw new ApiError("network", "Can't reach the server to transcribe your voice. Type your answer or try again.", "network");
  }
  const data = await res.json().catch(() => ({}));
  if (res.ok) return String(data.text ?? "");
  throw new ApiError("transcribe " + res.status, res.status === 429 ? "The voice service is busy. Wait a moment, or type your answer." : "Couldn't transcribe your voice. Type your answer or try again.", "client");
}

export const api = {
  health: () => request("/health", { retries: 3, timeoutMs: 60000 }),
  seller: () => request("/api/seller", { retries: 2 }),
  start: () => request("/api/session/start", { retries: 2, timeoutMs: 45000 }),
  chat: payload => request("/api/chat", { method: "POST", body: payload, timeoutMs: 30000 }),
  summary: state => request("/api/summary", { method: "POST", body: { state } }),
  transcribe
};
