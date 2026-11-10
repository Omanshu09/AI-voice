import test from "node:test";
import assert from "node:assert/strict";
import { validateReply, parseModelJson } from "../src/ai/validate.js";
import { computeMetrics } from "../src/domain/metrics.js";

const metrics = computeMetrics();
const plan = { question: { text: "Are your best sellers out of stock?" } };
const ok = reply => validateReply(JSON.stringify({ reply }), { plan, metrics });

test("accepts a grounded, single-question reply", () => {
  assert.equal(ok("Sales and orders are both down 32.5 percent while your price is still 500 rupees. Are your best sellers out of stock?").ok, true);
});
test("rejects invented traffic statistics", () => {
  const r = ok("Your listing visits fell 41 percent this month. Are your best sellers out of stock?");
  assert.equal(r.ok, false); assert.match(r.reason, /invented-number/);
});
test("rejects pricing blame without evidence", () => {
  assert.equal(ok("You should reduce your prices to win customers back. Are your best sellers out of stock?").ok, false);
  assert.equal(ok("Pricing is the main problem here, honestly. Are your best sellers out of stock?").ok, false);
});
test("rejects blaming cancellations alone", () => {
  assert.equal(ok("Cancellations caused your sales decline completely. Are your best sellers out of stock?").ok, false);
});
test("rejects more than one question or a reply that does not end with the question", () => {
  assert.equal(ok("Are you in stock? Are cancellations high? Are visits down?").ok, false);
  assert.equal(ok("Your orders fell 32.5 percent and it is worrying for sure.").ok, false);
});
test("rejects markdown, malformed and empty output", () => {
  assert.equal(ok("**Bold** claim about orders down 32.5 percent. Are you in stock?").ok, false);
  assert.equal(validateReply("not json at all", { plan, metrics }).ok, false);
  assert.equal(validateReply(JSON.stringify({ reply: "" }), { plan, metrics }).ok, false);
  assert.equal(validateReply(JSON.stringify({ other: 1 }), { plan, metrics }).ok, false);
});
test("parses fenced JSON", () => {
  assert.deepEqual(parseModelJson('```json\n{"reply":"hi there everyone"}\n```'), { reply: "hi there everyone" });
});
test("numbers the seller said are allowed back", () => {
  const r = validateReply(JSON.stringify({ reply: "You said 12 products are affected, which is a lot. Are your best sellers out of stock?" }), { plan, metrics, userTexts: ["about 12 products"] });
  assert.equal(r.ok, true);
});
