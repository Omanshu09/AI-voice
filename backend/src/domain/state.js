// Conversation state lives on the client and is sent back each turn, so the server
// stays stateless (safe on Render's free tier, which sleeps and restarts).
// Everything coming from the client is whitelisted here before use.

const CAN = ["stock_mismatch", "dispatch_delay", "courier", "customer", "seller_unspecified", "unsure"];
const YNU = ["yes", "no", "unsure"];
export const FACT_ENUMS = {
  inv_top: YNU,
  inv_eta: ["soon", "later", "unsure"],
  inv_sub: YNU,
  can_reason: CAN,
  can_detail: CAN,
  vis_trend: ["down", "steady", "unsure"],
  vis_conv: YNU,
  price_comp: ["lower", "same", "unsure"]
};
export const PHASES = ["greeting", "understanding", "investigation", "diagnosis", "recommendations", "summary"];

export function initialState() {
  return {
    turn: 0, phase: "greeting", pending: null, asked: [], facts: {}, retries: {},
    flags: { concernRaised: false, priceMentioned: false, recsGiven: false }
  };
}

export function sanitizeState(raw) {
  const base = initialState();
  if (!raw || typeof raw !== "object") return base;
  const ids = Object.keys(FACT_ENUMS);
  const s = base;
  s.turn = Number.isInteger(raw.turn) ? Math.max(0, Math.min(raw.turn, 100)) : 0;
  s.phase = PHASES.includes(raw.phase) ? raw.phase : "greeting";
  s.pending = ids.includes(raw.pending) ? raw.pending : null;
  s.asked = Array.isArray(raw.asked) ? [...new Set(raw.asked.filter(id => ids.includes(id)))] : [];
  if (raw.facts && typeof raw.facts === "object") {
    for (const id of ids) {
      if (FACT_ENUMS[id].includes(raw.facts[id])) s.facts[id] = raw.facts[id];
    }
  }
  if (raw.retries && typeof raw.retries === "object") {
    for (const id of ids) if (raw.retries[id] === 1) s.retries[id] = 1;
  }
  for (const k of Object.keys(s.flags)) s.flags[k] = raw.flags?.[k] === true;
  return s;
}

/** Specific cancellation cause if known, otherwise the broad answer. */
export function cancellationCause(facts) {
  const d = facts.can_detail;
  if (d && d !== "unsure" && d !== "seller_unspecified") return d;
  return facts.can_reason ?? null;
}
