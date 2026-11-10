import React from "react";
import { Mic, Stop, Volume, VolumeOff, Repeat, PhoneOff, Restart } from "./Icons.jsx";

const LABEL = { idle: "Ready", listening: "Listening", thinking: "Thinking", speaking: "Asha is speaking" };
const HINT = {
  idle: "Tap the microphone and speak",
  listening: "Speak now. Tap again when you're done.",
  thinking: "Looking at your numbers",
  speaking: "Tap the microphone to interrupt"
};

export default function VoicePanel({ ui, ctl, supports }) {
  const { voice, handsFree, muted, started, ended } = ui;
  const micLabel = voice === "listening" ? "Stop listening and send" : voice === "speaking" ? "Interrupt Asha and speak" : "Start speaking";
  const micDisabled = !started || ended || voice === "thinking";
  return (
    <div className={`voice voice-${voice}`}>
      <div className="voice-main">
        <button className="mic" onClick={() => ctl.pressMic()} disabled={micDisabled} aria-label={micLabel} title={micLabel}>
          <span className="mic-ring" aria-hidden="true" />
          {voice === "speaking" ? <Stop width={26} height={26} /> : <Mic width={26} height={26} />}
        </button>
        <div className="voice-text">
          <div className="voice-state" role="status" aria-live="polite">
            <span className="bars" aria-hidden="true"><i /><i /><i /><i /><i /></span>
            {LABEL[voice]}
          </div>
          <div className="voice-hint">{started && !ended ? HINT[voice] : ended ? "Consultation ended" : ""}</div>
        </div>
      </div>
      <div className="controls" role="group" aria-label="Conversation controls">
        <label className={`switch ${!supports.recognition ? "is-disabled" : ""}`} title="Asha listens again automatically after she speaks">
          <input type="checkbox" checked={handsFree} onChange={() => ctl.toggleHandsFree()} disabled={!supports.recognition || ended} />
          <span className="switch-track" aria-hidden="true"><span /></span>
          Hands-free
        </label>
        <button className="btn btn-quiet" onClick={() => ctl.toggleMute()} aria-pressed={muted} disabled={!supports.synthesis}>
          {muted ? <VolumeOff /> : <Volume />}{muted ? "Unmute" : "Mute"}
        </button>
        <button className="btn btn-quiet" onClick={() => ctl.repeat()} disabled={!started || voice === "thinking" || ui.messages.length === 0}>
          <Repeat />Repeat
        </button>
        <button className="btn btn-quiet" onClick={() => ctl.restart()} disabled={!started}>
          <Restart />Restart
        </button>
        <button className="btn btn-end" onClick={() => ctl.endCall()} disabled={!started || ended}>
          <PhoneOff />End call
        </button>
      </div>
    </div>
  );
}
