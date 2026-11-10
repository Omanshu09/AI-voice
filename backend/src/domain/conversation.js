import { questions, nextQuestion, yesNo } from "./questions.js";
import { computeMetrics, inr } from "./metrics.js";
import { buildDiagnosis } from "./diagnosis.js";
import { buildRecommendations } from "./recommendations.js";
import { buildSummary } from "./summary.js";
import { initialState } from "./state.js";

export const GREETING = "Hello! I'm Asha, your Virtual Key Account Manager. I can help you understand what's affecting your sales. What would you like us to look into today?";
export const GREETING_SUGGESTIONS = ["My sales have dropped. Can you help?", "Why are my orders down this month?"];

const DOMAIN = /\b(sales?|orders?|stock|inventory|cancel\w*|dispatch\w*|courier|listing\w*|visit\w*|impression\w*|price\w*|pricing|competitor\w*|product\w*|customer\w*|seller|business|revenue|declin\w*|drop\w*|down|snapdeal|deliver\w*|return\w*|ratings?|reviews?|supplier|shipping|conversion|traffic|help|problem|issue)\b/i;
const CONCERN = /\b(sales?|orders?|revenue|business|declin\w*|drop\w*|down|problem|issue|help|worried|low)\b/i;

export function classifyIntent(msg) {
  const m = msg.toLowerCase();
  if (/\b(summary|summari[sz]e|wrap up|wrap it up|that'?s all|thats all|end the call|end the consultation|we are done|i'?m done)\b/.test(m)) return "summary";
  if (/\b(repeat|say that again|come again|pardon|once more|didn'?t (hear|catch))\b/.test(m)) return "repeat";
  if (/\b(who are you|what can you do|what do you do|your name|are you a (bot|robot|human))\b/.test(m)) return "about";
  if (/\b(what should i do|what do you recommend|any (advice|suggestions?)|give me (a )?(plan|recommendations?)|next steps)\b/.test(m)) return "recommend";
  if (/^(hi|hello|hey|namaste|good (morning|afternoon|evening))\b[\s,!.]*(asha)?[\s,!.]*$/.test(m.trim())) return "greeting";
  return "answer";
}

const ACK = {
  inv_top: {
    yes: "Thank you, that matters. Your out-of-stock products rose from 5 to 18, so unavailable best sellers could be hurting orders.",
    no: "Good to know. Then the extra out-of-stock items may not be your main sellers, so let's look at other areas.",
    unsure: "That's okay. Checking your best sellers' stock will be one of our first actions."
  },
  inv_eta: {
    soon: "Good, a quick restock can win orders back fast.",
    later: "A longer gap is risky, so we need a plan to cover it.",
    unsure: "No problem. Getting a firm restock date will be a priority."
  },
  inv_sub: {
    yes: "Good, substitutes can catch some of that demand.",
    no: "Understood, then restocking becomes even more important.",
    unsure: "Fine, we'll include substitutes as something to check."
  },
  can_reason: {
    stock_mismatch: "Stock mismatch fits what we see, since more out-of-stock items can lead to orders you cannot fulfil.",
    dispatch_delay: "Late dispatch is within your control, so that can be fixed.",
    courier: "Courier pickup problems can be improved by working with your logistics partner.",
    customer: "Customer-side cancellations are harder to control, but clear delivery details can reduce them.",
    seller_unspecified: "Okay, so the cancellations are on your side, which means you can act on them.",
    unsure: "That's fine. Finding the main cancellation reason will be one of our actions."
  },
  vis_trend: {
    down: "Fewer visits could mean fewer orders, so that is worth fixing.",
    steady: "Good to know, so customers are still finding your listings.",
    unsure: "No problem. We'll add checking visits to your action list."
  },
  vis_conv: {
    yes: "That suggests something is holding back purchases, such as availability, listing quality or delivery promise.",
    no: "Good, so buying behaviour looks normal.",
    unsure: "Okay, that's something to check in your listing data."
  },
  price_comp: {
    lower: "Thanks. Competitor prices may be affecting some products, though I can't confirm it from your data.",
    same: "Good, so price does not look like the problem.",
    unsure: "Fine. Without a price gap we should not cut prices."
  }
};
ACK.can_detail = ACK.can_reason;

const OPPORTUNISTIC = [
  ["can_reason", /cancel/i],
  ["vis_trend", /(visit|impression|traffic|views)/i],
  ["inv_top", /(stock|inventory)/i]
];

const clone = s => JSON.parse(JSON.stringify(s));
const wordCount = m => m.trim().split(/\s+/).length;
// A question or command aimed at Asha that has nothing to do with the seller's business.
const looksLikeRequest = m => /\?|^\s*(who|what|when|where|why|how|tell|give|play|sing|write|can you|could you|do you|is it)\b/i.test(m);

/**
 * Pure state transition. Returns the new state and a "plan" describing what the
 * reply must contain. The plan is the single source of truth; both the local
 * composer and Gemini phrase it, and neither can change the facts in it.
 */
export function processTurn(prevState, message) {
  const s = clone(prevState ?? initialState());
  const intent = classifyIntent(message);
  const plan = { intent, phase: s.phase, ack: null, question: null, metricsInsight: false, recommendations: null, summary: null, clarify: false, redirect: false };

  if (intent === "repeat") return { state: s, plan };
  s.turn += 1;
  if (/\b(price\w*|competitor\w*|cheaper|discount\w*)\b/i.test(message)) s.flags.priceMentioned = true;

  const askQuestion = id => { s.pending = id; if (!s.asked.includes(id)) s.asked.push(id); plan.question = { id, text: questions[id].text, short: questions[id].short }; };

  if (intent === "summary") {
    s.phase = "summary"; s.pending = null; plan.phase = "summary"; plan.summary = buildSummary(s);
    return { state: s, plan };
  }
  if (intent === "recommend" && s.flags.concernRaised) {
    s.pending = null; s.phase = "recommendations"; s.flags.recsGiven = true;
    plan.phase = "recommendations"; plan.recommendations = buildRecommendations(s); plan.partial = nextQuestion(s) !== null;
    return { state: s, plan };
  }
  if (intent === "about") {
    plan.about = true;
    const q = s.pending ?? (s.flags.concernRaised ? nextQuestion(s) : null);
    if (q) askQuestion(q);
    return { state: s, plan };
  }

  // Before any concern has been raised
  if (!s.flags.concernRaised) {
    if (intent === "greeting") { plan.greetingOnly = true; return { state: s, plan }; }
    if (!DOMAIN.test(message) && wordCount(message) >= 3) { plan.redirect = true; plan.phase = "greeting"; return { state: s, plan }; }
    s.flags.concernRaised = true; s.phase = "understanding"; plan.phase = "understanding"; plan.metricsInsight = true;
    for (const [id, re] of OPPORTUNISTIC) {
      if (id === "inv_top") continue; // first question is always asked explicitly
      if (re.test(message) && !s.asked.includes(id)) {
        const v = questions[id].parse(message);
        if (v) { s.facts[id] = v; s.asked.push(id); }
      }
    }
    const next = nextQuestion(s);
    if (next) askQuestion(next);
    return { state: s, plan };
  }

  // Answering a pending question
  if (s.pending) {
    const q = questions[s.pending];
    let value = q.parse(message);
    if (value === null) {
      const offTopic = !DOMAIN.test(message) && wordCount(message) >= 3 && looksLikeRequest(message);
      if (offTopic) { plan.redirect = true; plan.question = { id: s.pending, text: q.text, short: q.short }; return { state: s, plan }; }
      if (!s.retries[s.pending]) {
        s.retries[s.pending] = 1; plan.clarify = true; plan.question = { id: s.pending, text: q.text, short: q.short };
        return { state: s, plan };
      }
      value = "unsure";
    }
    s.facts[s.pending] = value;
    plan.ack = { id: s.pending, value, text: ACK[s.pending]?.[value] ?? null };
    const answeredId = s.pending;
    s.pending = null;
    for (const [id, re] of OPPORTUNISTIC) {
      if (id !== answeredId && !s.asked.includes(id) && re.test(message)) {
        const v = questions[id].parse(message);
        if (v) { s.facts[id] = v; s.asked.push(id); }
      }
    }
  } else if (s.flags.recsGiven) {
    // After recommendations: a plain yes means "give me the summary".
    if (yesNo(message) === "yes" || /\b(go ahead|please|sure)\b/i.test(message)) {
      s.phase = "summary"; plan.phase = "summary"; plan.summary = buildSummary(s);
      return { state: s, plan };
    }
    plan.followup = true; plan.recommendations = buildRecommendations(s); plan.phase = "recommendations";
    return { state: s, plan };
  }

  const next = nextQuestion(s);
  if (next) {
    s.phase = "investigation"; plan.phase = "investigation"; askQuestion(next);
  } else {
    s.phase = "recommendations"; s.flags.recsGiven = true; plan.phase = "recommendations";
    plan.recommendations = buildRecommendations(s);
  }
  return { state: s, plan };
}

/** Deterministic, always-valid reply. Used standalone and as the fallback for Gemini. */
export function composeReply(plan, state, metrics = computeMetrics(), lastAssistant = "") {
  const m = metrics;
  const insight = `I've compared this month with last month. Sales and orders are both down ${Math.abs(m.orders.changePct)}%. Your average price is still ${inr(m.averageSellingPrice.current)}, so the drop comes from fewer orders, not lower prices. Cancellations rose ${m.cancellationRate.changePp} percentage points to ${m.cancellationRate.current}%, and out-of-stock products went from ${m.outOfStock.previous} to ${m.outOfStock.current}.`;
  if (plan.intent === "repeat") return lastAssistant || "I haven't said anything yet. Tell me what you'd like us to look into.";
  if (plan.summary) return plan.summary.spokenText;
  if (plan.greetingOnly) return "Hello! Tell me what's worrying you about your business. For example, you can say your sales have dropped.";
  if (plan.about) return `I'm Asha, your virtual key account manager. I look at your sales data, ask a few questions one at a time, and suggest practical next steps.${plan.question ? " " + plan.question.text : " What would you like us to look into?"}`;
  if (plan.redirect) return `I can only help with your business here, so let's stay with that. ${plan.question ? plan.question.short : "What would you like us to look into, such as your sales?"}`;
  if (plan.clarify) return `Sorry, I didn't quite catch that. ${plan.question.short}`;
  if (plan.followup) {
    const r = plan.recommendations[0];
    return `The most urgent step is to ${r.title.toLowerCase()}. ${r.spoken} The full action plan is on your screen. Would you like a final summary?`;
  }
  if (plan.recommendations) {
    const ord = ["First", "Second", "Third"];
    const lead = plan.ack?.text ? plan.ack.text + " " : "";
    const caveat = plan.partial ? "This is based on what we know so far. " : "";
    return `${lead}${caveat}Here is where I'd start. ${plan.recommendations.map((r, i) => `${ord[i]}: ${r.spoken}`).join(" ")} Would you like a final summary?`;
  }
  const parts = [];
  if (plan.metricsInsight) parts.push(insight);
  if (plan.ack?.text) parts.push(plan.ack.text);
  if (plan.question) parts.push(plan.question.text);
  return parts.join(" ");
}

/** Which investigation areas have been covered, for the progress indicator. */
export function buildProgress(state) {
  const f = state.facts;
  const done = id => id in f;
  const area = (check, relevant = true) => done(check) ? "done" : state.flags.recsGiven ? (relevant ? "unchecked" : "skipped") : "pending";
  return {
    phase: state.phase,
    areas: {
      inventory: area("inv_top"),
      cancellations: area("can_reason"),
      visibility: area("vis_trend"),
      pricing: done("price_comp") ? "done" : state.flags.recsGiven ? "skipped" : "pending"
    }
  };
}

export function suggestionsFor(plan, state) {
  if (plan.summary) return [];
  if (plan.recommendations) return ["Give me the final summary", "What should I do first?"];
  const id = plan.question?.id ?? state.pending;
  if (id) return questions[id].suggestions;
  return GREETING_SUGGESTIONS;
}
