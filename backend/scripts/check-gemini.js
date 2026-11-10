// Lists models your key can call with generateContent, and runs one tiny request.
// Use this to confirm GEMINI_MODEL is valid for your key before deploying.
import { loadConfig } from "../src/config.js";
import { callGemini } from "../src/ai/gemini.js";
const c = loadConfig();
if (!c.geminiKey) { console.error("Set GEMINI_API_KEY first."); process.exit(1); }
const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=100", { headers: { "x-goog-api-key": c.geminiKey } });
const j = await r.json();
if (!r.ok) { console.error("Model list failed:", r.status, j?.error?.message); process.exit(1); }
const names = (j.models ?? []).filter(m => m.supportedGenerationMethods?.includes("generateContent")).map(m => m.name.replace("models/", ""));
console.log("Models supporting generateContent:\n" + names.join("\n"));
console.log(`\nTesting configured model "${c.geminiModel}"...`);
try {
  const out = await callGemini({ apiKey: c.geminiKey, model: c.geminiModel, brief: { phase: "test", must_cover: { question: "Are you ready?" } } });
  console.log("OK:", out.slice(0, 200));
} catch (e) { console.error("FAILED:", e.message, e.kind); process.exit(1); }
console.log("\nFree-tier eligibility and quotas: confirm in Google AI Studio (ai.google.dev/pricing).");
