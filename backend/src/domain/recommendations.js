import { cancellationCause } from "./state.js";

const RANK = { high: 0, medium: 1, low: 2 };

/** Two or three recommendations, each with what/why/how/priority/metric. */
export function buildRecommendations(state) {
  const f = state.facts;
  const cause = cancellationCause(f);
  const all = [];

  if (f.inv_top !== "no") {
    all.push({
      id: "inventory", title: "Recover stock on high-demand products", priority: "high",
      what: "Restock your best-selling unavailable products first, instead of restocking every item equally.",
      why: "Products that cannot be bought cannot generate orders, and out-of-stock products rose from 5 to 18.",
      how: [
        "List the 18 unavailable products and rank them by last month's orders.",
        "Place restock orders for the top sellers first and note the expected date.",
        f.inv_eta === "later" || f.inv_sub !== "yes" ? "Promote an in-stock substitute for any product that will stay unavailable for more than a week." : "Promote your in-stock substitutes while the restock arrives.",
        "Set a low-stock alert so best sellers never reach zero again."
      ],
      metric: "Number of out-of-stock best sellers, and daily orders",
      spoken: "Restock your best-selling unavailable products first, because products that are out of stock cannot get orders."
    });
  }

  const canHow = {
    stock_mismatch: ["Reconcile your system stock with physical stock today.", "Keep a small safety buffer on fast-moving products.", "Switch off listings the moment stock reaches zero."],
    dispatch_delay: ["Fix a daily packing and dispatch cut-off time.", "Assign one person to clear pending orders each morning.", "Check that your handling time on listings matches what you can actually do."],
    courier: ["Note the dates and locations where pickups failed.", "Raise those cases with your logistics partner and ask for fixed pickup slots.", "Have a backup pickup option for busy days."],
    customer: ["Review the reasons customers give when cancelling.", "Make delivery timelines and product details clear on the listing.", "Check whether cancellations cluster around specific products or payment methods."]
  };
  all.push({
    id: "cancellations", title: "Cut cancellations at the source", priority: ["stock_mismatch", "dispatch_delay", "courier"].includes(cause) ? "high" : "medium",
    what: cause && canHow[cause] ? "Fix the main cancellation cause you identified." : "Find the biggest cancellation reason first, then fix that operational issue.",
    why: "Cancellations rose from 8% to 14%, which loses orders you had already won. They do not explain the whole drop, but they are fixable.",
    how: cause && canHow[cause] ? canHow[cause] : ["Pull a list of last month's cancelled orders with their reasons.", "Group them into stock, dispatch, courier and customer reasons.", "Fix the largest group first."],
    metric: "Cancellation rate (now 14%, last month 8%)",
    spoken: cause && canHow[cause] ? `Fix the main cancellation cause, which is ${({ stock_mismatch: "stock mismatch", dispatch_delay: "late dispatch", courier: "courier pickup failures", customer: "customer cancellations" })[cause]}.` : "Find your biggest cancellation reason and fix that first."
  });

  if (f.vis_trend !== "steady" || f.vis_conv === "yes") {
    all.push({
      id: "listings", title: "Improve visibility on your important listings", priority: f.vis_trend === "down" ? "high" : "medium",
      what: "Review titles, images and product attributes on the listings that matter most.",
      why: f.vis_trend === "down" ? "You told us visits have fallen, and fewer visits mean fewer orders." : "Visits and impressions are not in the sample data, so listing quality is the part you can improve without new data.",
      how: [
        "Pick your top ten listings by last month's orders.",
        "Make sure titles include the product type, key features and size or quantity.",
        "Use clear, well-lit images and fill every product attribute.",
        "Check that these listings are in stock, since unavailable items lose visibility."
      ],
      metric: "Listing visits and impressions, then conversion",
      spoken: "Review the titles, images and attributes of your most important listings to bring visits back."
    });
  }

  if (f.price_comp === "lower") {
    all.push({
      id: "pricing", title: "Match competitors on a few key products", priority: "medium",
      what: "Compare prices on your top products and adjust only where a competitor is clearly cheaper.",
      why: "You reported competitors are cheaper. Your overall average price is unchanged, so avoid blanket price cuts.",
      how: ["Compare your top five products against the closest competing listings.", "Adjust only those with a verified price gap.", "Check conversion after a few days before changing more."],
      metric: "Conversion on the adjusted products",
      spoken: "Compare prices on your top products and adjust only where a competitor is clearly cheaper."
    });
  }

  return all.sort((a, b) => RANK[a.priority] - RANK[b.priority]).slice(0, 3);
}
