import { sanitizeState } from "../domain/state.js";

export const LIMITS = { message: 600, historyItems: 20, historyContent: 1200 };
const clean = s => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();

export function validateChatBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "Request body must be a JSON object." };
  if (typeof body.message !== "string") return { ok: false, error: "message must be a string." };
  const message = clean(body.message);
  if (!message) return { ok: false, error: "message cannot be empty." };
  if (message.length > LIMITS.message) return { ok: false, error: `message must be at most ${LIMITS.message} characters.` };
  let history = [];
  if (body.history !== undefined) {
    if (!Array.isArray(body.history)) return { ok: false, error: "history must be an array." };
    if (body.history.length > LIMITS.historyItems) return { ok: false, error: `history can hold at most ${LIMITS.historyItems} items.` };
    for (const h of body.history) {
      if (!h || !["user", "assistant"].includes(h.role) || typeof h.content !== "string") return { ok: false, error: "Each history item needs a role (user or assistant) and string content." };
      history.push({ role: h.role, content: clean(h.content).slice(0, LIMITS.historyContent) });
    }
  }
  return { ok: true, value: { message, history, state: sanitizeState(body.state) } };
}

export function validateSummaryBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "Request body must be a JSON object." };
  return { ok: true, value: { state: sanitizeState(body.state) } };
}
