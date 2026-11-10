import React from "react";

const STEPS = [["greeting", "Greeting"], ["understanding", "Understanding"], ["investigation", "Investigation"], ["recommendations", "Recommendations"], ["summary", "Summary"]];
const AREAS = [["inventory", "Inventory"], ["cancellations", "Cancellations"], ["visibility", "Visibility"], ["pricing", "Pricing"]];

export default function Progress({ analysis }) {
  const phase = analysis?.phase === "diagnosis" ? "investigation" : analysis?.phase ?? "greeting";
  const idx = Math.max(0, STEPS.findIndex(([k]) => k === phase));
  const areas = analysis?.progress?.areas ?? {};
  return (
    <div className="progress">
      <ol className="steps" aria-label="Consultation progress">
        {STEPS.map(([k, label], i) => (
          <li key={k} className={i < idx ? "is-done" : i === idx ? "is-current" : ""} aria-current={i === idx ? "step" : undefined}>{label}</li>
        ))}
      </ol>
      <ul className="areas" aria-label="Areas checked">
        {AREAS.map(([k, label]) => (
          <li key={k} className={`area-${areas[k] ?? "pending"}`}>
            <span className="area-dot" aria-hidden="true" />{label}
            <span className="sr-only">{areas[k] === "done" ? ", checked" : areas[k] === "skipped" ? ", not needed" : areas[k] === "unchecked" ? ", still unknown" : ", not checked yet"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
