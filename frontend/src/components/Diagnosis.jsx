import React from "react";
import { PRIORITY_LABEL } from "../lib/format.js";

export default function Diagnosis({ diagnosis }) {
  if (!diagnosis) return null;
  const d = diagnosis;
  return (
    <section className="panel" aria-labelledby="h-diag">
      <div className="panel-head">
        <h2 id="h-diag">Diagnosis</h2>
        <span className="tag" title="Confidence is capped because this is simulated data with no traffic figures">Confidence: {d.confidence}</span>
      </div>
      <p className="lead">{d.headline}</p>

      <h3>Confirmed</h3>
      <ul className="plain">
        {d.confirmed.map(c => <li key={c.id}>{c.text}{c.source === "seller" && <em className="src"> Reported by you</em>}</li>)}
      </ul>

      <h3>Possible contributors <span className="muted small">not yet proven</span></h3>
      <ul className="plain">
        {d.potential.map(p => (
          <li key={p.id}>
            <span className={`prio prio-${p.priority}`}><span className="prio-dot" aria-hidden="true" />{PRIORITY_LABEL[p.priority]}</span>
            <strong>{p.area}.</strong> {p.text}
          </li>
        ))}
      </ul>

      {d.notSupported.length > 0 && (<>
        <h3>Not supported by the data</h3>
        <ul className="plain">{d.notSupported.map(n => <li key={n.area}><strong>{n.area}.</strong> {n.text}</li>)}</ul>
      </>)}

      {d.missing.length > 0 && (<>
        <h3>Still unknown</h3>
        <ul className="plain">{d.missing.map(x => <li key={x.area}><strong>{x.area}.</strong> {x.text}</li>)}</ul>
      </>)}
    </section>
  );
}
