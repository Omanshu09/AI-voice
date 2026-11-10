import { computeMetrics, inr } from "./metrics.js";
import { buildDiagnosis } from "./diagnosis.js";
import { buildRecommendations } from "./recommendations.js";

export function buildSummary(state, metrics = computeMetrics()) {
  const d = buildDiagnosis(state, metrics);
  const recs = buildRecommendations(state);
  const m = metrics;
  const mainProblem = `Orders and sales are both down ${Math.abs(m.orders.changePct)}% while your average price is unchanged at ${inr(m.averageSellingPrice.current)}. The drop is a volume problem.`;
  const rootCauses = d.potential.map(p => `${p.area}: ${p.text.replace(" This is a possible cause, not yet proven.", "")} (${p.confidence} confidence)`);
  const nextSteps = [
    "Today: list the out-of-stock products and rank them by past orders.",
    "Within two days: place restock orders and fix the main cancellation cause.",
    "Within a week: review your top listings and compare results with this month."
  ];
  const metricsToWatch = [
    "Daily orders", "Cancellation rate (now 14%)", "Out-of-stock best sellers", "Listing visits and impressions"
  ];
  const spoken = [
    `Here is your summary. ${mainProblem.replace("₹", "₹")}`,
    `The confirmed warning signs are cancellations up 6 percentage points to 14 percent, and out-of-stock products up from 5 to 18.`,
    d.missing.length ? `I could not confirm everything, so treat the causes as possibilities.` : `The causes are still possibilities, not proven facts.`,
    `Your priorities are: ${recs.map((r, i) => `${["first", "second", "third"][i]}, ${r.title.toLowerCase()}`).join("; ")}.`,
    `Over the next seven days, watch daily orders, the cancellation rate, out-of-stock best sellers, and listing visits.`
  ].join(" ");

  const md = [
    "# Virtual KAM consultation summary",
    "_Simulated seller data. Not connected to live Snapdeal systems._", "",
    "## Main business problem", mainProblem, "",
    "## Confirmed findings", ...d.confirmed.map(c => `- ${c.text}${c.source === "seller" ? " (reported by seller)" : ""}`), "",
    "## Potential root causes (not yet proven)", ...rootCauses.map(r => `- ${r}`), "",
    ...(d.notSupported.length ? ["## Not supported by the data", ...d.notSupported.map(n => `- ${n.area}: ${n.text}`), ""] : []),
    ...(d.missing.length ? ["## Still unknown", ...d.missing.map(x => `- ${x.area}: ${x.text}`), ""] : []),
    "## Priority actions", ...recs.flatMap((r, i) => [`${i + 1}. **${r.title}** (${r.priority} priority)`, `   - ${r.what}`, `   - Why: ${r.why}`, ...r.how.map(h => `   - ${h}`), `   - Track: ${r.metric}`]), "",
    "## Next steps", ...nextSteps.map(s => `- [ ] ${s}`), "",
    "## Metrics to monitor for seven days", ...metricsToWatch.map(s => `- ${s}`), ""
  ].join("\n");

  return {
    mainProblem, confirmedFindings: d.confirmed.map(c => c.text), rootCauses,
    notSupported: d.notSupported, missing: d.missing,
    actions: recs, nextSteps, metricsToWatch, spokenText: spoken, markdown: md, confidence: d.confidence
  };
}
