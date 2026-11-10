import { computeMetrics, inr } from "./metrics.js";
import { cancellationCause } from "./state.js";

/**
 * Builds the structured diagnosis. "confirmed" holds only things the sample data
 * proves, or things the seller said. "potential" are hypotheses and are labelled so.
 */
export function buildDiagnosis(state, metrics = computeMetrics()) {
  const f = state.facts;
  const m = metrics;
  const answered = Object.keys(f).length;

  const confirmed = [
    { id: "sales", source: "data", text: `Sales fell ${Math.abs(m.sales.changePct)}%, from ${inr(m.sales.previous)} to ${inr(m.sales.current)}.` },
    { id: "orders", source: "data", text: `Orders fell ${Math.abs(m.orders.changePct)}%, from ${m.orders.previous} to ${m.orders.current}.` },
    { id: "asp", source: "data", text: `Average selling price is unchanged at ${inr(m.averageSellingPrice.current)}, so the sales drop comes from fewer orders, not lower prices.` },
    { id: "cancel", source: "data", text: `Cancellation rate rose ${m.cancellationRate.changePp} percentage points, from ${m.cancellationRate.previous}% to ${m.cancellationRate.current}%.` },
    { id: "oos", source: "data", text: `Out-of-stock products rose by ${m.outOfStock.changeAbs}, from ${m.outOfStock.previous} to ${m.outOfStock.current} (up ${m.outOfStock.changePctRelative}% relative to last month).` }
  ];
  if (f.inv_top === "yes") confirmed.push({ id: "s_inv", source: "seller", text: "You told us some best-selling products are out of stock." });
  if (f.inv_top === "no") confirmed.push({ id: "s_inv", source: "seller", text: "You told us your best-selling products are in stock." });
  const cause = cancellationCause(f);
  const causeText = { stock_mismatch: "stock mismatch", dispatch_delay: "late dispatch", courier: "courier pickup failures", customer: "customer-side cancellations", seller_unspecified: "seller-side issues" };
  if (cause && causeText[cause]) confirmed.push({ id: "s_can", source: "seller", text: `You told us cancellations are mainly from ${causeText[cause]}.` });
  if (f.vis_trend === "down") confirmed.push({ id: "s_vis", source: "seller", text: "You told us listing visits or impressions have fallen." });
  if (f.vis_trend === "steady") confirmed.push({ id: "s_vis", source: "seller", text: "You told us listing visits are about the same." });

  const potential = [];
  const caveat = " This is a possible cause, not yet proven.";
  if (f.inv_top === "yes") {
    potential.push({ id: "inventory", area: "Inventory", priority: "high", confidence: "medium",
      text: `Best sellers being unavailable is a likely contributor to fewer orders.${f.inv_eta === "later" ? " The restock gap looks long." : ""}${caveat}` });
  } else if (f.inv_top === "no") {
    potential.push({ id: "inventory", area: "Inventory", priority: "medium", confidence: "low",
      text: "Out-of-stock products rose, but they are not your best sellers, so the order impact is probably smaller." });
  } else {
    potential.push({ id: "inventory", area: "Inventory", priority: "high", confidence: "low",
      text: "Out-of-stock products rose from 5 to 18. Whether best sellers are affected is unknown." });
  }
  const canPriority = ["stock_mismatch", "dispatch_delay", "courier"].includes(cause) ? "high" : "medium";
  potential.push({ id: "cancellations", area: "Cancellations", priority: canPriority, confidence: cause && cause !== "unsure" ? "medium" : "low",
    text: `Rising cancellations are a warning sign and can reduce completed orders, but on their own they do not explain a ${Math.abs(m.orders.changePct)}% fall in orders.` });
  if (f.vis_trend === "down") {
    potential.push({ id: "visibility", area: "Visibility", priority: "high", confidence: "medium",
      text: `Fewer listing visits could explain fewer orders.${caveat}` });
  } else if (f.vis_conv === "yes") {
    potential.push({ id: "visibility", area: "Conversion", priority: "medium", confidence: "low",
      text: `Visits are steady but customers are not buying. Availability, listing quality or delivery promise may be factors.${caveat}` });
  }
  if (f.price_comp === "lower") {
    potential.push({ id: "pricing", area: "Pricing", priority: "medium", confidence: "low",
      text: `You report competitors are cheaper on main products. That may reduce conversion on those products.${caveat}` });
  }

  const notSupported = [];
  if (f.price_comp !== "lower") {
    notSupported.push({ area: "Pricing", text: `Your average price is unchanged at ${inr(m.averageSellingPrice.current)} and no competitor price drop has been reported, so there is no evidence of a pricing problem.` });
  }

  const missing = [];
  if (!("inv_top" in f) || f.inv_top === "unsure") missing.push({ area: "Inventory", text: "Whether best-selling products are among the out-of-stock items." });
  if (!cause || cause === "unsure") missing.push({ area: "Cancellations", text: "The main reason for cancellations." });
  if (!("vis_trend" in f) || f.vis_trend === "unsure") missing.push({ area: "Visibility", text: "Listing impressions and visits. These are not in the sample data." });
  if (f.price_comp === "unsure") missing.push({ area: "Pricing", text: "Competitor prices on your main products." });

  const known = ["inv_top", "can_reason", "vis_trend"].filter(id => f[id] && f[id] !== "unsure").length;
  const confidence = known >= 3 ? "medium" : known === 2 ? "medium" : "low"; // never "high": no live data
  return {
    headline: `Orders are down ${Math.abs(m.orders.changePct)}% at an unchanged price. Out-of-stock products and cancellations are the main warning signs to investigate.`,
    confirmed, potential, notSupported, missing, confidence, answered,
    priority: potential.some(p => p.priority === "high") ? "high" : "medium"
  };
}
