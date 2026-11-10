import React from "react";
import { inr, signed } from "../lib/format.js";

function Bar({ a, b }) {
  const max = Math.max(a, b) || 1;
  return (
    <div className="bars2" aria-hidden="true">
      <span style={{ width: `${(a / max) * 100}%` }} className="b-prev" />
      <span style={{ width: `${(b / max) * 100}%` }} className="b-curr" />
    </div>
  );
}

export default function Insights({ seller, backend }) {
  if (!seller) return (
    <section className="panel" aria-labelledby="h-insights">
      <h2 id="h-insights">Business insights</h2>
      <p className="muted">{backend === "offline" ? "The server can't be reached, so seller data isn't available yet." : "Loading sample seller data. The free server may take up to a minute to wake."}</p>
    </section>
  );
  const m = seller.metrics;
  const rows = [
    { k: "Sales", prev: inr(m.sales.previous), cur: inr(m.sales.current), change: signed(m.sales.changePct, "%"), bad: true, bar: [m.sales.previous, m.sales.current] },
    { k: "Orders", prev: m.orders.previous, cur: m.orders.current, change: signed(m.orders.changePct, "%"), bad: true, bar: [m.orders.previous, m.orders.current] },
    { k: "Cancellation rate", prev: m.cancellationRate.previous + "%", cur: m.cancellationRate.current + "%", change: signed(m.cancellationRate.changePp, " percentage points"), bad: true },
    { k: "Average selling price", prev: inr(m.averageSellingPrice.previous), cur: inr(m.averageSellingPrice.current), change: m.averageSellingPrice.unchanged ? "Unchanged" : signed(m.averageSellingPrice.changePct, "%") },
    { k: "Out-of-stock products", prev: m.outOfStock.previous, cur: m.outOfStock.current, change: `${signed(m.outOfStock.changeAbs)} (${signed(m.outOfStock.changePctRelative, "%")} relative)`, bad: true }
  ];
  return (
    <section className="panel" aria-labelledby="h-insights">
      <div className="panel-head">
        <h2 id="h-insights">Business insights</h2>
        <span className="tag">Simulated data</span>
      </div>
      <p className="muted small">{seller.profile.store} · last month compared with this month</p>
      <table className="metrics">
        <thead><tr><th scope="col">Metric</th><th scope="col">Last month</th><th scope="col">This month</th><th scope="col">Change</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.k}>
              <th scope="row">{r.k}{r.bar && <Bar a={r.bar[0]} b={r.bar[1]} />}</th>
              <td data-label="Last month">{r.prev}</td>
              <td data-label="This month">{r.cur}</td>
              <td data-label="Change" className={r.bad ? "is-bad" : ""}>{r.change}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">Sales fell because fewer orders came in. The average price did not change, so price is not what moved. Traffic and impressions are not part of this data.</p>
    </section>
  );
}
