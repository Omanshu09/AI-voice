import React from "react";
import { PRIORITY_LABEL } from "../lib/format.js";

export default function ActionPlan({ recommendations }) {
  return (
    <section className="panel" aria-labelledby="h-plan">
      <h2 id="h-plan">Action plan</h2>
      {!recommendations?.length ? (
        <p className="muted">Your action plan appears once Asha has asked her questions. You can also say "what should I do?" at any time.</p>
      ) : (
        <ol className="actions">
          {recommendations.map(r => (
            <li key={r.id}>
              <div className="action-head">
                <h3>{r.title}</h3>
                <span className={`prio prio-${r.priority}`}><span className="prio-dot" aria-hidden="true" />{PRIORITY_LABEL[r.priority]}</span>
              </div>
              <p>{r.what}</p>
              <p className="muted"><strong>Why it matters.</strong> {r.why}</p>
              <details>
                <summary>How to do it</summary>
                <ul className="plain">{r.how.map((h, i) => <li key={i}>{h}</li>)}</ul>
              </details>
              <p className="track"><strong>Track:</strong> {r.metric}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
