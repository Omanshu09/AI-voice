export const inr = n => "₹" + Number(n).toLocaleString("en-IN");
export const signed = (n, suffix = "") => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}${suffix}`;
export const PRIORITY_LABEL = { high: "High priority", medium: "Medium priority", low: "Low priority" };
