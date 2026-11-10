import React from "react";
import { Download, Restart } from "./Icons.jsx";
import { PRIORITY_LABEL } from "../lib/format.js";

function download(summary) {
  const blob = new Blob([summary.markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: "asha-consultation-summary.md" });
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

export default function CallSummary({ summary, onRestart }) {
  if (!summary) return null;
  return (
    <section className="panel panel-summary" aria-labelledby="h-sum">
      <div className="panel-head">
        <h2 id="h-sum">Call summary</h2>
        <div className="row">
          <button className="btn btn-quiet" onClick={() => download(summary)}><Download />Download</button>
          <button className="btn btn-quiet" onClick={onRestart}><Restart />New consultation</button>
        </div>
      </div>
      <h3>Main business problem</h3><p>{summary.mainProblem}</p>
      <h3>Confirmed findings</h3><ul className="plain">{summary.confirmedFindings.map((c, i) => <li key={i}>{c}</li>)}</ul>
      <h3>Potential root causes <span className="muted small">not yet proven</span></h3><ul className="plain">{summary.rootCauses.map((c, i) => <li key={i}>{c}</li>)}</ul>
      <h3>Priority actions</h3>
      <ol className="plain">{summary.actions.map(a => <li key={a.id}><strong>{a.title}</strong> <span className="muted">({PRIORITY_LABEL[a.priority].toLowerCase()})</span>. {a.what}</li>)}</ol>
      <h3>Follow-up checklist</h3>
      <ul className="checklist">{summary.nextSteps.map((s, i) => <li key={i}><label><input type="checkbox" /> {s}</label></li>)}</ul>
      <h3>Metrics to monitor for seven days</h3><ul className="plain">{summary.metricsToWatch.map((c, i) => <li key={i}>{c}</li>)}</ul>
    </section>
  );
}
