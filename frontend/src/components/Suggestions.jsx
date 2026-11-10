import React, { useState } from "react";
import { Send } from "./Icons.jsx";

export default function Suggestions({ items, disabled, onPick }) {
  return items?.length ? (
    <div className="chips" aria-label="Suggested replies">
      {items.map(t => <button key={t} className="chip" disabled={disabled} onClick={() => onPick(t)}>{t}</button>)}
    </div>
  ) : null;
}

export function TypeBox({ disabled, onSend }) {
  const [v, setV] = useState("");
  const go = () => { if (v.trim()) { onSend(v); setV(""); } };
  return (
    <div className="typebox">
      <input value={v} maxLength={600} disabled={disabled} placeholder="Or type your answer"
        onChange={e => setV(e.target.value)} onKeyDown={e => e.key === "Enter" && go()} aria-label="Type your message to Asha" />
      <button className="btn btn-quiet" onClick={go} disabled={disabled || !v.trim()} aria-label="Send message"><Send /></button>
    </div>
  );
}
