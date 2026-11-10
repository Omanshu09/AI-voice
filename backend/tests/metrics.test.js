import test from "node:test";
import assert from "node:assert/strict";
import { computeMetrics, pctChange, ppChange } from "../src/domain/metrics.js";

const m = computeMetrics();

test("₹2,00,000 to ₹1,35,000 is a 32.5% decline", () => assert.equal(m.sales.changePct, -32.5));
test("400 to 270 orders is a 32.5% decline", () => assert.equal(m.orders.changePct, -32.5));
test("8% to 14% cancellation is +6 percentage points (not +75%)", () => {
  assert.equal(m.cancellationRate.changePp, 6);
  assert.equal(m.cancellationRate.changePp, ppChange(14, 8));
  assert.notEqual(m.cancellationRate.changePp, pctChange(14, 8));
});
test("average selling price ₹500 is unchanged", () => {
  assert.equal(m.averageSellingPrice.unchanged, true);
  assert.equal(m.averageSellingPrice.changePct, 0);
});
test("out-of-stock count rises by 13, which is +260% relative", () => {
  assert.equal(m.outOfStock.changeAbs, 13);
  assert.equal(m.outOfStock.changePctRelative, 260);
});
test("the sales decline is entirely an order-volume effect", () => {
  assert.equal(m.decomposition.volumeEffect, -65000);
  assert.equal(m.decomposition.priceEffect, 0);
  assert.equal(m.decomposition.volumeShare, 100);
});
test("division by zero and bad input return null, never NaN or Infinity", () => {
  assert.equal(pctChange(5, 0), null);
  assert.equal(pctChange(undefined, 5), null);
  assert.equal(ppChange(NaN, 5), null);
});
