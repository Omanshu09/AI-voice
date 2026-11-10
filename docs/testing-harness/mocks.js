(() => {
  const S = window.__t = { starts: 0, active: 0, maxActive: 0, startsWhileSpeaking: 0, spoken: [], speakingNow: false, hold: false, deny: false, instances: [], cancels: 0 };
  class Rec {
    constructor() { S.instances.push(this); this.ended = false; }
    start() {
      if (S.speakingNow) S.startsWhileSpeaking++;
      S.starts++; S.active++; S.maxActive = Math.max(S.maxActive, S.active); S.cur = this;
      setTimeout(() => {
        if (S.deny) { this.onerror?.({ error: "not-allowed" }); return this._end(); }
        this.onstart?.();
      }, 10);
    }
    _end() { if (this.ended) return; this.ended = true; S.active--; this.onend?.(); }
    stop() { setTimeout(() => this._end(), 10); }
    abort() { setTimeout(() => this._end(), 10); }
  }
  window.SpeechRecognition = Rec;
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  let queue = [];
  Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
    getVoices: () => [{ lang: "en-IN", name: "Mock India" }],
    speak(u) { S.spoken.push(u.text); S.speakingNow = true; queue.push(u); if (!S.hold) setTimeout(() => this._flush(), 40); },
    _flush() { const q = queue; queue = []; q.forEach(u => u.onend?.()); if (!queue.length) S.speakingNow = false; },
    cancel() { S.cancels++; const q = queue; queue = []; S.speakingNow = false; q.forEach(u => u.onerror?.({ error: "interrupted" })); }
  } });
  // helpers for the test
  window.__flush = () => window.speechSynthesis._flush();
  S.say = text => { const r = S.cur; if (!r) return false; r.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal: true })] }); r.stop(); return true; };
  S.silence = () => { const r = S.cur; r?.stop(); };
  S.releaseSpeech = () => window.speechSynthesis._flush();
})();
