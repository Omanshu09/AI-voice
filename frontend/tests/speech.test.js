import test from "node:test";
import assert from "node:assert/strict";
import { toSpeech, splitSentences, amountToWords, pickVoice, browserSupportNote } from "../src/lib/speech.js";

test("rupee amounts are spoken the Indian way", () => {
  assert.equal(amountToWords(200000), "2 lakh");
  assert.equal(amountToWords(135000), "1 lakh 35 thousand");
  assert.equal(toSpeech("from ₹2,00,000 to ₹1,35,000"), "from 2 lakh rupees to 1 lakh 35 thousand rupees");
  assert.equal(toSpeech("price is ₹500"), "price is 500 rupees");
});
test("percentages are spoken as percent", () => assert.equal(toSpeech("down 32.5% and 14 %"), "down 32.5 percent and 14 percent"));
test("long text is split into short chunks at sentence boundaries", () => {
  const text = Array(12).fill("This is a fairly long sentence about orders.").join(" ");
  const chunks = splitSentences(text, 120);
  assert.ok(chunks.length > 3);
  assert.ok(chunks.every(c => c.length <= 120));
  assert.equal(chunks.join(" "), text);
});
test("short text stays one chunk; empty-safe", () => {
  assert.deepEqual(splitSentences("Hello there."), ["Hello there."]);
  assert.deepEqual(splitSentences(""), [""]);
});
test("prefers an en-IN voice", () => {
  const v = [{ lang: "en-US", name: "A" }, { lang: "en-IN", name: "B" }];
  assert.equal(pickVoice(v).name, "B");
  assert.equal(pickVoice([]), null);
});
test("browser support notes", () => {
  assert.match(browserSupportNote("Mozilla/5.0 Firefox/130"), /Firefox/);
  assert.match(browserSupportNote("Mozilla/5.0 Version/17 Safari/605"), /Safari/);
  assert.equal(browserSupportNote("Mozilla/5.0 Chrome/130 Safari/537"), "");
});
