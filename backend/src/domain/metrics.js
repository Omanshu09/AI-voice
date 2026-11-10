import { sellerData } from "../data/sellerData.js";

export const round1 = n => Math.round(n * 10) / 10;

/** Relative change in percent. Returns null when it cannot be computed honestly. */
export function pctChange(current, previous) {
  if (![current, previous].every(Number.isFinite) || previous === 0) return null;
  return round1(((current - previous) / previous) * 100);
}

/** Difference between two percentages, in percentage points (NOT percent). */
export function ppChange(current, previous) {
  if (![current, previous].every(Number.isFinite)) return null;
  return round1(current - previous);
}

export function computeMetrics(data = sellerData) {
  const { lastMonth: a, thisMonth: b } = data;
  const salesAbs = b.sales - a.sales;
  const volumeEffect = (b.orders - a.orders) * a.averageSellingPrice;
  const priceEffect = (b.averageSellingPrice - a.averageSellingPrice) * b.orders;
  return {
    sales: { previous: a.sales, current: b.sales, changeAbs: salesAbs, changePct: pctChange(b.sales, a.sales) },
    orders: { previous: a.orders, current: b.orders, changeAbs: b.orders - a.orders, changePct: pctChange(b.orders, a.orders) },
    cancellationRate: { previous: a.cancellationRate, current: b.cancellationRate, changePp: ppChange(b.cancellationRate, a.cancellationRate) },
    averageSellingPrice: {
      previous: a.averageSellingPrice, current: b.averageSellingPrice,
      changePct: pctChange(b.averageSellingPrice, a.averageSellingPrice),
      unchanged: a.averageSellingPrice === b.averageSellingPrice
    },
    outOfStock: {
      previous: a.outOfStockProducts, current: b.outOfStockProducts,
      changeAbs: b.outOfStockProducts - a.outOfStockProducts,
      changePctRelative: pctChange(b.outOfStockProducts, a.outOfStockProducts)
    },
    // Splits the sales change into the part from order volume and the part from price.
    decomposition: {
      volumeEffect, priceEffect,
      volumeShare: salesAbs !== 0 ? round1((volumeEffect / salesAbs) * 100) : null
    }
  };
}

export const inr = n => "₹" + Number(n).toLocaleString("en-IN");
