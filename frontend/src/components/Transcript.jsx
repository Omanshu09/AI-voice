import React, { useEffect, useRef } from "react";

export default function Transcript({ messages, interim, thinking }) {
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, interim, thinking]);
  return (
    <div className="transcript" role="log" aria-live="polite" aria-label="Conversation transcript">
      {messages.map(m => (
        <p key={m.id} className={`line line-${m.role}`}>
          <span className="who">{m.role === "assistant" ? "Asha" : "You"}</span>
          {m.content}
        </p>
      ))}
      {interim && <p className="line line-user line-interim"><span className="who">You</span>{interim}</p>}
      {thinking && <p className="line line-assistant" aria-label="Asha is thinking"><span className="who">Asha</span><span className="dots"><i /><i /><i /></span></p>}
      <div ref={end} />
    </div>
  );
}
