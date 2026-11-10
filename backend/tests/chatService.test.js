import test from "node:test";
import assert from "node:assert/strict";
import { createChatService } from "../src/services/chatService.js";
import { GeminiError } from "../src/ai/gemini.js";
import { initialState } from "../src/domain/state.js";

const cfg = { geminiKey: "test-key", geminiModel: "m1", geminiFallbackModel: "", geminiTimeoutMs: 100 };
const body = (message, state = initialState(), history = []) => ({ message, history, state });

test("no API key: runs on the local engine", async () => {
  const s = createChatService({ ...cfg, geminiKey: "" });
  const r = await s.turn(body("my sales dropped"));
  assert.equal(r.mode, "local"); assert.match(r.reply, /32\.5%/); assert.ok(r.reply.endsWith("?"));
});

test("Gemini error: falls back with a useful local reply and a notice", async () => {
  const s = createChatService(cfg, { gemini: async () => { throw new GeminiError("boom", { status: 500, kind: "server" }); } });
  const r = await s.turn(body("my sales dropped"));
  assert.equal(r.mode, "local-fallback"); assert.match(r.reply, /32\.5%/); assert.ok(r.notice);
});

test("Gemini quota (429): falls back, then skips Gemini during the cooldown", async () => {
  let calls = 0, t = 1000;
  const s = createChatService(cfg, { now: () => t, gemini: async () => { calls++; throw new GeminiError("quota", { status: 429, kind: "quota" }); } });
  await s.turn(body("my sales dropped"));
  const r2 = await s.turn(body("my sales dropped"));
  assert.equal(calls, 1); assert.equal(r2.mode, "local-fallback");
  t += 61_000;
  await s.turn(body("my sales dropped"));
  assert.equal(calls, 2);
});

test("malformed model output never reaches the seller", async () => {
  const s = createChatService(cfg, { gemini: async () => "{{ not json" });
  const r = await s.turn(body("my sales dropped"));
  assert.equal(r.mode, "local-fallback"); assert.match(r.reply, /32\.5%/);
});

test("model that invents a statistic is rejected in favour of the local reply", async () => {
  const s = createChatService(cfg, { gemini: async () => JSON.stringify({ reply: "Your traffic fell 55 percent last week. Are your best-selling products out of stock?" }) });
  const r = await s.turn(body("my sales dropped"));
  assert.equal(r.mode, "local-fallback"); assert.doesNotMatch(r.reply, /55/);
});

test("a valid model reply is used", async () => {
  const reply = "Your sales and orders are both down 32.5 percent at the same 500 rupee price, so fewer orders is the issue. Are your best-selling products out of stock?";
  const s = createChatService(cfg, { gemini: async () => JSON.stringify({ reply }) });
  const r = await s.turn(body("my sales dropped"));
  assert.equal(r.mode, "gemini"); assert.equal(r.reply, reply);
});

test("fallback model is tried when the first model is unavailable", async () => {
  const tried = [];
  const reply = "Thanks for that. Your best sellers being out of stock could be hurting orders. When can you restock them?";
  const s = createChatService({ ...cfg, geminiFallbackModel: "m2" }, { gemini: async (_b, model) => { tried.push(model); if (model === "m1") throw new GeminiError("nf", { status: 404, kind: "model" }); return JSON.stringify({ reply }); } });
  const first = await s.turn(body("my sales dropped"));
  const r = await s.turn(body("yes they are out of stock", first.state));
  assert.deepEqual(tried.slice(-2), ["m1", "m2"]); assert.equal(r.mode, "gemini");
});

test("summary is always generated locally, even if Gemini is down", async () => {
  const s = createChatService(cfg, { gemini: async () => { throw new Error("should not be called"); } });
  const r = await s.turn(body("please give me the summary", { ...initialState(), flags: { concernRaised: true, priceMentioned: false, recsGiven: false } }));
  assert.equal(r.mode, "local"); assert.ok(r.summary.actions.length >= 2);
});

test("repeat returns the last assistant message verbatim", async () => {
  const s = createChatService(cfg, { gemini: async () => { throw new Error("no"); } });
  const r = await s.turn(body("can you repeat that", initialState(), [{ role: "assistant", content: "Previous words from Asha." }]));
  assert.equal(r.reply, "Previous words from Asha.");
});

test("the API key is never placed in the prompt brief", async () => {
  let seen = "";
  const s = createChatService(cfg, { gemini: async b => { seen = JSON.stringify(b); return "x"; } });
  await s.turn(body("my sales dropped"));
  assert.ok(!seen.includes("test-key"));
});
