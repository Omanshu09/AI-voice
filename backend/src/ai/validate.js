// Validates what the model returns before it can reach the seller.

const NUM = /\d[\d,]*(?:\.\d+)?/g;
const toNumber = s => Number(s.replace(/,/g, ""));

export function parseModelJson(text) {
  if (typeof text !== "string") return null;
  const cleaned = text.replace(/```json|```/gi, "").trim();
  try { return JSON.parse(cleaned); } catch { /* try to find an object inside */ }
  const a = cleaned.indexOf("{"), b = cleaned.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(cleaned.slice(a, b + 1)); } catch { return null; } }
  return null;
}

/** Numbers the model may legitimately mention. */
export function allowedNumbers(metrics, userTexts = []) {
  const m = metrics;
  const set = new Set([
    m.sales.previous, m.sales.current, Math.abs(m.sales.changePct), Math.abs(m.sales.changeAbs),
    m.orders.previous, m.orders.current, Math.abs(m.orders.changePct), Math.abs(m.orders.changeAbs),
    m.cancellationRate.previous, m.cancellationRate.current, Math.abs(m.cancellationRate.changePp),
    m.averageSellingPrice.current, m.outOfStock.previous, m.outOfStock.current, m.outOfStock.changeAbs, m.outOfStock.changePctRelative,
    // small counts used in ordinary speech: "two or three", "first", "seven days", "top ten"
    0, 1, 2, 3, 4, 5, 7, 10, 24, 48
  ]);
  for (const t of userTexts) for (const n of String(t).match(NUM) ?? []) set.add(toNumber(n));
  return set;
}

export function validateReply(raw, { plan, metrics, userTexts = [] }) {
  const parsed = typeof raw === "string" ? parseModelJson(raw) : raw;
  if (!parsed || typeof parsed.reply !== "string") return { ok: false, reason: "malformed" };
  const reply = parsed.reply.replace(/\s+/g, " ").trim();
  const max = plan.recommendations ? 900 : 650;
  if (reply.length < 15 || reply.length > max) return { ok: false, reason: "length" };
  if (/[*#_`]|\bjson\b|system prompt|as an ai|language model/i.test(reply)) return { ok: false, reason: "format" };

  const allowed = allowedNumbers(metrics, userTexts);
  for (const n of reply.match(NUM) ?? []) {
    if (!allowed.has(toNumber(n))) return { ok: false, reason: `invented-number:${n}` };
  }
  const wantsPricing = plan.recommendations?.some(r => r.id === "pricing");
  if (!wantsPricing) {
    if (/\b(reduce|lower|cut|drop|decrease|slash)\b[^.?!]{0,25}\b(price|prices|pricing)\b/i.test(reply)) return { ok: false, reason: "unsupported-price-advice" };
    const blame = reply.match(/\b(pricing|prices?)\b[^.,?!]{0,12}\b(is|was|are)\b[^.,?!]{0,12}\b(cause|reason|problem|issue)\b/i);
    if (blame && !/\b(not|n't|never|no)\b/i.test(blame[0])) return { ok: false, reason: "pricing-blame" };
  }
  if (/cancellations?\b[^.?!]{0,40}\b(caused|is the (cause|reason)|explain(s)? (all|the whole|the entire))\b/i.test(reply) && !/\b(not|n't|alone|only part|partly|may|might|could)\b/i.test(reply)) return { ok: false, reason: "cancellation-blame" };
  if (/\bconfirmed\b/i.test(reply) && /\b(cause|reason)s?\b/i.test(reply) && /\bpossible|may|might|could\b/i.test(reply) === false && !plan.summary) return { ok: false, reason: "assumption-as-fact" };
  const q = (reply.match(/\?/g) ?? []).length;
  if (plan.question && !plan.recommendations) { if (q !== 1 || !reply.trim().endsWith("?")) return { ok: false, reason: "question-shape" }; }
  else if (q > 1) return { ok: false, reason: "too-many-questions" };
  return { ok: true, reply };
}
