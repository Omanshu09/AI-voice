import test from "node:test";
import assert from "node:assert/strict";
import { processTurn, composeReply, classifyIntent, buildProgress } from "../src/domain/conversation.js";
import { initialState } from "../src/domain/state.js";
import { buildDiagnosis } from "../src/domain/diagnosis.js";
import { buildRecommendations } from "../src/domain/recommendations.js";
import { buildSummary } from "../src/domain/summary.js";

function say(state, msg) {
  const { state: s, plan } = processTurn(state, msg);
  return { s, plan, reply: composeReply(plan, s) };
}

test("first concern: explains metrics and asks exactly one question about inventory", () => {
  const { s, plan, reply } = say(initialState(), "My sales have dropped a lot this month");
  assert.equal(plan.phase, "understanding");
  assert.equal(s.pending, "inv_top");
  assert.match(reply, /32\.5%/);
  assert.match(reply, /6 percentage points/);
  assert.equal((reply.match(/\?/g) || []).length, 1);
});

test("a full session follows seller answers and never repeats a question", () => {
  let st = initialState();
  const asked = [];
  const turns = ["my sales are down", "yes some of my best sellers are out of stock", "it will take a few weeks", "no I don't have substitutes",
    "mostly late dispatch", "visits are about the same", "no buying looks normal"];
  for (const t of turns) {
    const r = say(st, t); st = r.s;
    if (r.plan.question) asked.push(r.plan.question.id);
    assert.ok((r.reply.match(/\?/g) || []).length <= 1, `too many questions in: ${r.reply}`);
  }
  assert.deepEqual(asked, ["inv_top", "inv_eta", "inv_sub", "can_reason", "vis_trend", "vis_conv"]);
  assert.equal(new Set(asked).size, asked.length);
  assert.equal(st.phase, "recommendations");
  assert.equal(st.facts.can_reason, "dispatch_delay");
});

test("answers change the path: best sellers in stock skips restock questions", () => {
  let st = say(initialState(), "sales dropped").s;
  const r = say(st, "No, they are in stock");
  assert.equal(r.plan.question.id, "can_reason");
  assert.ok(!r.s.asked.includes("inv_eta"));
});

test("seller says 'not sure': recorded as unsure and the conversation moves on", () => {
  let st = say(initialState(), "sales dropped").s;
  const r = say(st, "I'm not sure");
  assert.equal(r.s.facts.inv_top, "unsure");
  assert.equal(r.plan.question.id, "can_reason");
});

test("unclear answer gets one clarification, then is recorded as unsure", () => {
  let st = say(initialState(), "sales dropped").s;
  let r = say(st, "hmm well it is complicated");
  assert.equal(r.plan.clarify, true);
  assert.equal(r.s.pending, "inv_top");
  r = say(r.s, "hmm well it is complicated");
  assert.equal(r.s.facts.inv_top, "unsure");
});

test("unrelated question is politely redirected and the pending question is kept", () => {
  let st = say(initialState(), "sales dropped").s;
  const r = say(st, "Who won the cricket match yesterday evening");
  assert.equal(r.plan.redirect, true);
  assert.equal(r.s.pending, "inv_top");
  assert.match(r.reply, /Snapdeal business/);
});

test("off-topic before any concern is redirected without starting the diagnosis", () => {
  const r = say(initialState(), "tell me a joke about cats");
  assert.equal(r.plan.redirect, true);
  assert.equal(r.s.flags.concernRaised, false);
});

test("summary can be requested at any time", () => {
  let st = say(initialState(), "sales dropped").s;
  const r = say(st, "please wrap up and give me a summary");
  assert.equal(r.s.phase, "summary");
  assert.ok(r.plan.summary.actions.length >= 2);
});

test("intent classification", () => {
  assert.equal(classifyIntent("can you repeat that"), "repeat");
  assert.equal(classifyIntent("hello"), "greeting");
  assert.equal(classifyIntent("who are you"), "about");
  assert.equal(classifyIntent("what should I do now"), "recommend");
});

test("diagnosis separates confirmed facts from possibilities and never invents traffic", () => {
  const d = buildDiagnosis(initialState());
  assert.ok(d.confirmed.length >= 5);
  assert.ok(d.confirmed.every(c => !/visit|impression|traffic/i.test(c.text)));
  assert.ok(d.missing.some(x => /Listing impressions and visits/.test(x.text)));
  assert.ok(d.confidence !== "high");
});

test("no pricing blame or price cut without evidence", () => {
  let st = initialState();
  st.facts = { inv_top: "yes", can_reason: "stock_mismatch", vis_trend: "steady", vis_conv: "no" };
  const d = buildDiagnosis(st), recs = buildRecommendations(st);
  assert.ok(!d.potential.some(p => p.id === "pricing"));
  assert.ok(d.notSupported.some(n => n.area === "Pricing"));
  assert.ok(!recs.some(r => r.id === "pricing"));
  assert.ok(!JSON.stringify(recs).match(/reduce (your )?price|lower (your )?price|cut (your )?price/i));
});

test("pricing recommendation appears only when the seller reports cheaper competitors", () => {
  const st = initialState();
  st.facts = { inv_top: "no", can_reason: "customer", vis_trend: "down", price_comp: "lower" };
  assert.ok(buildRecommendations(st).some(r => r.id === "pricing"));
});

test("recommendations: 2-3 items, each with what/why/how/priority/metric", () => {
  const st = initialState(); st.facts = { inv_top: "yes", can_reason: "courier", vis_trend: "down" };
  const recs = buildRecommendations(st);
  assert.ok(recs.length >= 2 && recs.length <= 3);
  for (const r of recs) for (const k of ["what", "why", "priority", "metric"]) assert.ok(r[k], `${r.id} missing ${k}`);
  for (const r of recs) assert.ok(Array.isArray(r.how) && r.how.length >= 2);
});

test("final summary has every required section and does not claim causes are proven", () => {
  const st = initialState(); st.facts = { inv_top: "yes", can_reason: "stock_mismatch", vis_trend: "steady" };
  const s = buildSummary(st);
  for (const k of ["mainProblem", "confirmedFindings", "rootCauses", "actions", "nextSteps", "metricsToWatch", "spokenText", "markdown"]) assert.ok(s[k]);
  assert.match(s.spokenText, /possibilit/);
  assert.match(s.markdown, /Simulated seller data/);
});

test("progress reports covered areas", () => {
  const st = initialState(); st.facts = { inv_top: "yes" };
  assert.equal(buildProgress(st).areas.inventory, "done");
  assert.equal(buildProgress(st).areas.visibility, "pending");
});
