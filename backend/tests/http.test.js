import test from "node:test";
import assert from "node:assert/strict";
import { validateChatBody, validateSummaryBody, LIMITS } from "../src/http/validation.js";
import { isOriginAllowed } from "../src/http/cors.js";
import { sanitizeState } from "../src/domain/state.js";

test("rejects non-object, missing, empty and oversized messages", () => {
  assert.equal(validateChatBody(null).ok, false);
  assert.equal(validateChatBody([]).ok, false);
  assert.equal(validateChatBody({}).ok, false);
  assert.equal(validateChatBody({ message: 42 }).ok, false);
  assert.equal(validateChatBody({ message: "   " }).ok, false);
  assert.equal(validateChatBody({ message: "a".repeat(LIMITS.message + 1) }).ok, false);
});
test("rejects bad or oversized history", () => {
  assert.equal(validateChatBody({ message: "hi", history: "x" }).ok, false);
  assert.equal(validateChatBody({ message: "hi", history: Array(21).fill({ role: "user", content: "a" }) }).ok, false);
  assert.equal(validateChatBody({ message: "hi", history: [{ role: "system", content: "a" }] }).ok, false);
});
test("accepts a valid body and strips control characters", () => {
  const r = validateChatBody({ message: "  my sales\u0000 dropped  ", history: [{ role: "user", content: "hello" }] });
  assert.equal(r.ok, true); assert.equal(r.value.message, "my sales dropped");
});
test("tampered state is sanitised, not trusted", () => {
  const s = sanitizeState({ turn: 9999, phase: "hacked", pending: "drop table", asked: ["inv_top", "bogus"], facts: { inv_top: "maybe", can_reason: "courier", extra: 1 }, flags: { recsGiven: "yes" } });
  assert.equal(s.turn, 100); assert.equal(s.phase, "greeting"); assert.equal(s.pending, null);
  assert.deepEqual(s.asked, ["inv_top"]); assert.deepEqual(s.facts, { can_reason: "courier" }); assert.equal(s.flags.recsGiven, false);
  assert.equal(validateSummaryBody({ state: "x" }).ok, true);
});
test("CORS: exact origins, wildcard patterns, and rejection", () => {
  const allowed = ["https://app.example.com", "https://*.vercel.app"];
  assert.equal(isOriginAllowed("https://app.example.com", allowed), true);
  assert.equal(isOriginAllowed("https://my-app-git-main.vercel.app", allowed), true);
  assert.equal(isOriginAllowed("https://evil.com", allowed), false);
  assert.equal(isOriginAllowed("https://vercel.app", allowed), false);
  assert.equal(isOriginAllowed("http://my-app.vercel.app", allowed), false);
  assert.equal(isOriginAllowed("https://app.example.com.evil.com", allowed), false);
  assert.equal(isOriginAllowed(undefined, allowed), true);
});
