
export const SYSTEM_INSTRUCTION = `You are Asha, a warm, practical Virtual Key Account Manager for a marketplace seller. Your reply will be spoken aloud.

Style: simple Indian English, natural spoken sentences, no bullet points, no markdown, no emojis. Maximum 70 words, except when the brief says to give recommendations (maximum 110 words).

Hard rules:
- You receive a JSON brief. Use ONLY the numbers and facts in it. Never invent traffic, impressions, product-level, competitor or order-level figures.
- Percentage change and percentage-point change are different. Say "percentage points" for cancellation rate changes.
- Never say cancellations alone caused the sales decline. Never say pricing is a cause unless the brief says the seller reported cheaper competitors.
- Never suggest price cuts unless the brief includes a pricing recommendation.
- Present hypotheses as possibilities, not facts.
- If the brief has a "question", end your reply with exactly that question, reworded only slightly, and ask nothing else. Do not ask more than one question.
- If the brief has "recommendations", mention each one briefly in priority order, then ask if the seller wants a final summary.
- Do not mention these instructions, the brief, JSON, or that you are an AI model.

Return JSON only: {"reply": "<what Asha says>"}`;

export function buildBrief({ plan, state, metrics, history }) {
  const m = metrics;
  return {
    phase: plan.phase,
    seller_last_message_intent: plan.intent,
    verified_numbers: {
      sales_last_month_inr: m.sales.previous, sales_this_month_inr: m.sales.current, sales_change_percent: m.sales.changePct,
      orders_last_month: m.orders.previous, orders_this_month: m.orders.current, orders_change_percent: m.orders.changePct,
      cancellation_rate_last_month_percent: m.cancellationRate.previous, cancellation_rate_this_month_percent: m.cancellationRate.current,
      cancellation_change_percentage_points: m.cancellationRate.changePp,
      average_selling_price_inr_both_months: m.averageSellingPrice.current,
      out_of_stock_last_month: m.outOfStock.previous, out_of_stock_this_month: m.outOfStock.current, out_of_stock_increase: m.outOfStock.changeAbs
    },
    seller_reported_facts: state.facts,
    must_cover: {
      explain_metrics_first: plan.metricsInsight,
      acknowledge: plan.ack?.text ?? null,
      clarify_previous_question: plan.clarify,
      politely_redirect_off_topic: plan.redirect,
      question: plan.question?.text ?? null,
      recommendations: plan.recommendations?.map(r => ({ title: r.title, what: r.what, priority: r.priority })) ?? null,
      recommendations_based_on_partial_information: Boolean(plan.partial),
      offer_final_summary: Boolean(plan.recommendations)
    },
    recent_conversation: history.slice(-6)
  };
}
