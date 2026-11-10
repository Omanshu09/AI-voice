import React, { useEffect, useState } from "react";
import { useVoiceSession } from "./hooks/useVoiceSession.js";
import { browserSupportNote } from "./lib/speech.js";
import VoicePanel from "./components/VoicePanel.jsx";
import Transcript from "./components/Transcript.jsx";
import Progress from "./components/Progress.jsx";
import Suggestions, { TypeBox } from "./components/Suggestions.jsx";
import Insights from "./components/Insights.jsx";
import Diagnosis from "./components/Diagnosis.jsx";
import ActionPlan from "./components/ActionPlan.jsx";
import CallSummary from "./components/CallSummary.jsx";

const BACKEND = { checking: "Connecting", waking: "Waking the server, this can take up to a minute", ready: "Server ready", offline: "Server unreachable" };

export default function App() {
  const { ui, ctl, supports } = useVoiceSession();
  const [tab, setTab] = useState("talk");
  const { started, ended, voice, analysis } = ui;
  const note = browserSupportNote(typeof navigator !== "undefined" ? navigator.userAgent : "");
  const busy = voice === "thinking";
  useEffect(() => { if (ui.summary) setTab("plan"); }, [ui.summary]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="avatar" aria-hidden="true">A</span>
          <div>
            <h1>Asha</h1>
            <p>Virtual Key Account Manager for sellers</p>
          </div>
        </div>
        <div className="status-group">
          <span className="tag" title="All numbers in this are simulated. Nothing is connected to live systems.">Simulated seller data</span>
          <span className={`server server-${ui.backend}`} role="status"><i aria-hidden="true" />{BACKEND[ui.backend]}</span>
        </div>
      </header>

      <nav className="tabs" aria-label="Sections">
        {[["talk", "Conversation"], ["insights", "Insights"], ["plan", "Plan"]].map(([k, label]) => (
          <button key={k} className={tab === k ? "is-active" : ""} onClick={() => setTab(k)} aria-pressed={tab === k}>{label}</button>
        ))}
      </nav>

      <main className="layout">
        <section className={`col col-talk ${tab === "talk" ? "" : "is-hidden"}`} aria-label="Conversation">
          {!started ? (
            <div className="welcome">
              <h2>Talk through what's happening with your sales</h2>
              <p>Asha reviews your numbers, asks a few questions one at a time, and ends with a short plan you can act on this week.</p>
              <ul className="plain small">
                <li>The microphone is only requested when you first speak, never on page load.</li>
                <li>Use the microphone for each answer, or switch on hands-free so Asha listens after she speaks.</li>
                <li>You can type or tap a suggested reply at any time.</li>
              </ul>
              <button className="btn btn-primary" onClick={() => ctl.startCall()} disabled={ui.backend === "offline"}>Start conversation</button>
              {ui.backend === "offline" && <p className="notice notice-error" role="alert">The server can't be reached. Check your connection and reload.</p>}
            </div>
          ) : (
            <>
              <VoicePanel ui={ui} ctl={ctl} supports={supports} />
              <Progress analysis={analysis} />
              <Transcript messages={ui.messages} interim={ui.interim} thinking={busy} />
              {ui.notice && (
                <div className={`notice notice-${ui.notice.kind}`} role={ui.notice.kind === "error" ? "alert" : "status"}>
                  {ui.notice.text}
                  {ui.notice.retry && <button className="btn btn-quiet" onClick={() => ctl.retry()}>Try again</button>}
                </div>
              )}
              {!ended && <Suggestions items={analysis?.suggestions} disabled={busy} onPick={t => ctl.submit(t)} />}
              {!ended && <TypeBox disabled={busy} onSend={t => ctl.submit(t)} />}
            </>
          )}
          {(note || !supports.recognition || !supports.synthesis) && (
            <p className="support-note">
              {!supports.recognition && "Voice input isn't available in this browser, so type or tap suggestions. "}
              {!supports.synthesis && "Spoken replies aren't available either, so read Asha's text. "}
              {note}
            </p>
          )}
          <p className="support-note">Speech recognition varies by browser. Chrome and Edge work best. In Chrome, recognition sends audio to a Google speech service, so use only simulated data.</p>
        </section>

        <aside className="col col-dash" aria-label="Business analysis">
          <div className={tab === "insights" ? "" : "hide-mobile"}>
            <Insights seller={ui.seller} backend={ui.backend} />
            <Diagnosis diagnosis={analysis?.diagnosis} />
          </div>
          <div className={tab === "plan" ? "" : "hide-mobile"}>
            <ActionPlan recommendations={analysis?.recommendations} />
            <CallSummary summary={ui.summary} onRestart={() => { setTab("talk"); ctl.restart(); }} />
          </div>
        </aside>
      </main>
    </div>
  );
}
