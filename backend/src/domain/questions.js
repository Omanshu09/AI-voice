// The investigation question catalogue. Each question has one topic and a parser
// that turns the seller's spoken answer into a fact (or null if it can't tell).

const UNSURE = /\b(not sure|don'?t know|do not know|no idea|unsure|can'?t say|cannot say|haven'?t checked|not checked|never checked|not aware|dunno)\b/i;
const NEG = /\b(no|nope|nah|not|none|never|haven'?t|hasn'?t|didn'?t|aren'?t|isn'?t|wasn'?t|nothing)\b/i;
const POS = /\b(yes|yeah|yep|yup|correct|right|sure|some|few|couple|many|most|several|definitely|absolutely|of course|true|probably|i think so)\b/i;

export function yesNo(m) {
  if (UNSURE.test(m)) return "unsure";
  if (NEG.test(m)) return "no";
  if (POS.test(m)) return "yes";
  return null;
}

export const questions = {
  inv_top: {
    topic: "inventory",
    text: "Are your best-selling products among the ones that are out of stock?",
    short: "Are your best sellers out of stock right now? A simple yes or no is fine.",
    suggestions: ["Yes, my best sellers are out of stock", "No, they are in stock", "I'm not sure"],
    parse(m) {
      if (UNSURE.test(m)) return "unsure";
      const negatedOut = /\b(not|no|none|aren'?t|isn'?t)\b[^.]{0,20}\b(out of stock|unavailable|sold out)\b/i.test(m);
      if (!negatedOut && /\b(out of stock|not in stock|unavailable|not available|sold out|ran out|run out|stock ?out|finished)\b/i.test(m)) return "yes";
      if (negatedOut || /\b(in stock|have stock|still available|stocked)\b/i.test(m)) return "no";
      return yesNo(m);
    }
  },
  inv_eta: {
    topic: "inventory",
    text: "When can you restock them, and roughly how long have they been unavailable?",
    short: "Can you restock them within a week, or will it take longer?",
    suggestions: ["Within this week", "It will take a few weeks", "I don't know yet"],
    parse(m) {
      if (UNSURE.test(m)) return "unsure";
      const longer = /\b(weeks|month|months|long time|later|delay|delayed|supplier)\b/i.test(m);
      if (!longer && /\b(tomorrow|today|day|days|this week|next week|few days|couple of days|soon|within a week|48 hours|24 hours)\b/i.test(m)) return "soon";
      if (longer || /\b(can'?t|cannot)\b/i.test(m)) return "later";
      return null;
    }
  },
  inv_sub: {
    topic: "inventory",
    text: "Do you have similar products in stock that you could promote in the meantime?",
    short: "Do you have a similar substitute product that is in stock? Yes or no.",
    suggestions: ["Yes, I have substitutes", "No substitutes", "I'm not sure"],
    parse: yesNo
  },
  can_reason: {
    topic: "cancellations",
    text: "Are most cancellations on your side, such as stock mismatch, late dispatch or courier pickup failures, or are customers cancelling?",
    short: "Are cancellations mainly from your side, or do customers cancel?",
    suggestions: ["Mostly stock mismatch", "Late dispatch or courier pickup", "Customers cancel", "I'm not sure"],
    parse(m) {
      if (UNSURE.test(m)) return "unsure";
      if (/\b(stock|inventory|mismatch)\b/i.test(m)) return "stock_mismatch";
      if (/\b(dispatch|dispatched|handling|packing|late|delay|delayed|slow)\b/i.test(m)) return "dispatch_delay";
      if (/\b(courier|pickup|pick-up|pick up|logistics|carrier)\b/i.test(m)) return "courier";
      if (/\b(customer|customers|buyer|buyers|changed (their|his|her) mind|cod|cash on delivery)\b/i.test(m)) return "customer";
      if (/\b(seller|my side|our side|mine)\b/i.test(m)) return "seller_unspecified";
      return null;
    }
  },
  can_detail: {
    topic: "cancellations",
    text: "On your side, is it mainly stock mismatch, late dispatch, or courier pickup problems?",
    short: "Is it stock mismatch, late dispatch, or courier pickup?",
    suggestions: ["Stock mismatch", "Late dispatch", "Courier pickup failures", "I'm not sure"],
    parse(m) {
      if (UNSURE.test(m)) return "unsure";
      if (/\b(stock|inventory|mismatch)\b/i.test(m)) return "stock_mismatch";
      if (/\b(dispatch|handling|packing|late|delay)\b/i.test(m)) return "dispatch_delay";
      if (/\b(courier|pickup|pick-up|pick up|logistics)\b/i.test(m)) return "courier";
      return null;
    }
  },
  vis_trend: {
    topic: "visibility",
    text: "Have visits or impressions on your listings gone down this month?",
    short: "Have listing visits gone down, or are they about the same?",
    suggestions: ["Yes, visits have dropped", "No, visits are about the same", "I haven't checked"],
    parse(m) {
      if (UNSURE.test(m)) return "unsure";
      if (/\b(same|steady|stable|similar|unchanged|no change|not changed|normal|fine|consistent)\b/i.test(m)) return "steady";
      if (/\b(down|dropped|drop|fell|fallen|decline|declined|lower|less|fewer|reduced|decreased)\b/i.test(m)) return "down";
      if (/\b(up|increased|higher|more|growing)\b/i.test(m)) return "steady";
      const yn = yesNo(m);
      return yn === "yes" ? "down" : yn === "no" ? "steady" : yn;
    }
  },
  vis_conv: {
    topic: "visibility",
    text: "Since visits look steady, are customers visiting your listings but not buying?",
    short: "Are people visiting your listings but not placing orders?",
    suggestions: ["Yes, they visit but don't buy", "No, buying looks normal", "I'm not sure"],
    parse: yesNo
  },
  price_comp: {
    topic: "pricing",
    text: "Have any competitors lowered the price on your main products?",
    short: "Have competitors lowered prices on your main products?",
    suggestions: ["Yes, competitors are cheaper", "No, prices are similar", "I haven't checked"],
    parse(m) {
      if (UNSURE.test(m)) return "unsure";
      if (/\b(cheaper|lower|undercut|reduced|low price)\b/i.test(m) && !NEG.test(m)) return "lower";
      const yn = yesNo(m);
      return yn === "yes" ? "lower" : yn === "no" ? "same" : yn;
    }
  }
};

/** Decide the next question from what is already known. Never repeats a question. */
export function nextQuestion(state) {
  const f = state.facts;
  const asked = new Set(state.asked);
  const need = id => !asked.has(id);
  if (need("inv_top")) return "inv_top";
  if (f.inv_top === "yes" && need("inv_eta")) return "inv_eta";
  if (f.inv_top === "yes" && f.inv_eta === "later" && need("inv_sub")) return "inv_sub";
  if (need("can_reason")) return "can_reason";
  if (f.can_reason === "seller_unspecified" && need("can_detail")) return "can_detail";
  if (need("vis_trend")) return "vis_trend";
  if (f.vis_trend === "steady" && need("vis_conv")) return "vis_conv";
  const priceRelevant = f.vis_conv === "yes" || state.flags.priceMentioned;
  if (priceRelevant && need("price_comp")) return "price_comp";
  return null;
}
