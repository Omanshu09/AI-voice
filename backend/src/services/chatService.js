import { computeMetrics } from "../domain/metrics.js";
import { initialState } from "../domain/state.js";
import { processTurn, composeReply, buildProgress, suggestionsFor, GREETING, GREETING_SUGGESTIONS } from "../domain/conversation.js";
import { buildDiagnosis } from "../domain/diagnosis.js";
import { buildRecommendations } from "../domain/recommendations.js";
import { buildSummary } from "../domain/summary.js";
import { buildBrief } from "../ai/prompts.js";
import { callGemini, GeminiError } from "../ai/gemini.js";
import { validateReply } from "../ai/validate.js";

/**
 * Orchestrates one turn. `gemini` is injectable: (brief, model) => Promise<string>.
 * Quota errors open a short circuit so a rate-limited free tier is not hammered.
 */
export function createChatService(config, { gemini, now = Date.now, log = () => {} } = {}) {
  const metrics = computeMetrics();
  let cooldownUntil = 0;
  const models = [config.geminiModel, config.geminiFallbackModel].filter(Boolean);
  const callModel = gemini ?? ((brief, model) => callGemini({ apiKey: config.geminiKey, model, brief, timeoutMs: config.geminiTimeoutMs }));
  const aiEnabled = Boolean(gemini || config.geminiKey);

  const snapshot = state => {
    const diagnosis = buildDiagnosis(state, metrics);
    return { diagnosis, progress: buildProgress(state), recommendations: state.flags.recsGiven ? buildRecommendations(state) : [] };
  };

  async function tryAi({ plan, state, history, message }) {
    if (!aiEnabled) return { mode: "local" };
    if (now() < cooldownUntil) return { mode: "local-fallback", notice: "AI is rate-limited right now. Using built-in guidance." };
    const brief = buildBrief({ plan, state, metrics, history });
    const userTexts = [message, ...history.filter(h => h.role === "user").map(h => h.content)];
    let lastError = "";
    for (const model of models.length ? models : ["default"]) {
      try {
        const raw = await callModel(brief, model);
        const checked = validateReply(raw, { plan, metrics, userTexts });
        if (checked.ok) return { mode: "gemini", reply: checked.reply };
        log(`model reply rejected: ${checked.reason}`);
        return { mode: "local-fallback", notice: null, rejected: checked.reason };
      } catch (e) {
        lastError = e instanceof GeminiError ? e.kind : "error";
        if (e instanceof GeminiError && e.kind === "quota") { cooldownUntil = now() + Math.max(e.retryAfterMs, 60_000); break; }
        if (e instanceof GeminiError && e.kind === "auth") break;
        // "model" errors fall through to the next model; others also try the next one
      }
    }
    log(`gemini unavailable: ${lastError}`);
    return { mode: "local-fallback", notice: "AI is temporarily unavailable. Using built-in guidance." };
  }

  return {
    metrics,
    aiEnabled,
    start() {
      const state = initialState();
      return { reply: GREETING, mode: "local", phase: "greeting", state, suggestions: GREETING_SUGGESTIONS, ...snapshot(state) };
    },
    async turn({ message, history, state: prior }) {
      const { state, plan } = processTurn(prior, message);
      const lastAssistant = [...history].reverse().find(h => h.role === "assistant")?.content ?? "";
      const local = composeReply(plan, state, metrics, lastAssistant);
      let reply = local, mode = "local", notice = null;
      // Summaries, repeats and unscripted-safe replies are never left to the model.
      const modelEligible = !plan.summary && plan.intent !== "repeat";
      if (modelEligible) {
        const ai = await tryAi({ plan, state, history, message });
        mode = ai.mode; notice = ai.notice ?? null;
        if (ai.mode === "gemini") reply = ai.reply;
      }
      return {
        reply, mode, notice, phase: state.phase, state,
        suggestions: suggestionsFor(plan, state),
        summary: plan.summary ?? null,
        ...snapshot(state)
      };
    },
    summary(state) {
      return buildSummary(state, metrics);
    }
  };
}
