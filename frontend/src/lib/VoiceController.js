import { api } from "./api.js";
import { getRecognitionCtor, hasSynthesis, pickVoice, splitSentences, toSpeech } from "./speech.js";

export const initialUi = () => ({
  started: false, ended: false, voice: "idle", messages: [], interim: "", handsFree: false, muted: false,
  notice: null, micStatus: "unknown", analysis: null, summary: null, backend: "checking", seller: null
});

/**
 * Owns the microphone, speech synthesis and the conversation lifecycle.
 * One instance, plain mutable fields, and ONE place that starts recognition, so two
 * microphone sessions can never run at once. React only receives state patches via `emit`.
 *
 *   idle -> listening -> thinking -> speaking -> idle (-> listening again in hands-free)
 */
export class VoiceController {
  constructor(emit) {
    this.emit = emit;
    this.Rec = getRecognitionCtor();
    this.synth = hasSynthesis() ? window.speechSynthesis : null;
    // Fallback for browsers without usable built-in recognition: record audio, transcribe on the server.
    this.canRecord = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined";
    this.useRecorder = !this.Rec && this.canRecord;
    this.recorder = null; this.transcribing = false;
    this.supports = { recognition: Boolean(this.Rec) || this.canRecord, synthesis: Boolean(this.synth) };
    this.active = false; this.busy = false; this.speaking = false; this.destroyed = false;
    this.recog = null; this.gen = 0; this.timers = new Set(); this.watchdog = null;
    this.handsFree = false; this.muted = false; this.silence = 0;
    this.session = null; this.history = []; this.lastAssistant = ""; this.lastSent = { key: "", at: 0 };
    this.retryText = null; this.msgId = 0; this.voice = null;
    if (this.synth) this.synth.onvoiceschanged = () => { this.voice = null; };
  }

  // ---- helpers ----
  setVoice(v) { this.emit({ voice: v }); }
  later(fn, ms) { const t = setTimeout(() => { this.timers.delete(t); if (!this.destroyed) fn(); }, ms); this.timers.add(t); }
  clearTimers() { this.timers.forEach(clearTimeout); this.timers.clear(); clearTimeout(this.watchdog); }
  addMessage(role, content, mode) { this.emit(p => ({ messages: [...p.messages, { id: ++this.msgId, role, content, mode }] })); }
  applyAnalysis(d) {
    this.emit({ analysis: { diagnosis: d.diagnosis, recommendations: d.recommendations, progress: d.progress, suggestions: d.suggestions, phase: d.phase, mode: d.mode } });
  }

  // ---- startup ----
  init() {
    const slow = setTimeout(() => this.emit({ backend: "waking" }), 2500);
    const ping = (n = 0) => {
      api.health()
        .then(() => { clearTimeout(slow); this.emit({ backend: "ready" }); })
        .catch(() => {
          if (n >= 12 || this.destroyed) { clearTimeout(slow); this.emit({ backend: "offline" }); return; }
          this.emit({ backend: "waking" });
          this.later(() => ping(n + 1), 5000);
        });
    };
    ping();
    api.seller().then(s => this.emit({ seller: s })).catch(() => {});
  }

  // ---- call lifecycle ----
  async startCall() {
    if (this.active || this.busy) return;
    this.resetSession();
    this.active = true; this.busy = true;
    this.emit({ started: true, ended: false, voice: "thinking", notice: null });
    try {
      const d = await api.start();
      this.session = d.state; this.applyAnalysis(d);
      this.addMessage("assistant", d.reply, d.mode);
      this.history.push({ role: "assistant", content: d.reply });
      this.busy = false;
      this.speak(d.reply);
    } catch (e) {
      console.warn("Could not start the conversation:", e?.message);
      this.busy = false; this.active = false;
      this.emit({ started: false, voice: "idle", notice: { kind: "error", text: e.userMessage || "Could not start the conversation." } });
    }
  }

  resetSession() {
    this.cancelSpeech(); this.discardRecognition(); this.clearTimers();
    this.session = null; this.history = []; this.lastAssistant = ""; this.retryText = null; this.silence = 0; this.transcribing = false; this.lastSent = { key: "", at: 0 };
    this.emit(p => ({ ...initialUi(), handsFree: p.handsFree, muted: p.muted, backend: p.backend, seller: p.seller, micStatus: p.micStatus }));
  }

  async restart() { this.active = false; this.busy = false; await this.startCall(); }

  async endCall() {
    if (!this.active) return;
    this.active = false;
    this.cancelSpeech(); this.discardRecognition(); this.clearTimers();
    this.emit({ ended: true, voice: "thinking", notice: null, interim: "" });
    try {
      const summary = await api.summary(this.session);
      this.emit({ summary });
      this.speak(summary.spokenText);
    } catch (e) {
      this.emit({ voice: "idle", notice: { kind: "error", text: "Could not build the summary. " + (e.userMessage || "") } });
    }
  }

  destroy() { this.destroyed = true; this.active = false; this.cancelSpeech(); this.discardRecognition(); this.clearTimers(); }

  // ---- user controls ----
  pressMic() {
    if (!this.active || this.busy || this.transcribing) return;
    if ((this.recog && !this.recog.__discard) || (this.recorder && !this.recorder.discard)) return this.stopListening();       // finish and send what was heard
    if (this.speaking) return this.interrupt();
    this.silence = 0; this.startListening();
  }

  interrupt() {
    if (!this.active) return;
    this.cancelSpeech();
    this.finishSpeech(false);
    this.later(() => this.startListening(), 250);                               // let the speaker go quiet first
  }

  toggleMute() {
    this.muted = !this.muted; this.emit({ muted: this.muted });
    if (this.muted && this.speaking) { this.cancelSpeech(); this.finishSpeech(true); }
  }

  toggleHandsFree() {
    this.handsFree = !this.handsFree; this.emit({ handsFree: this.handsFree });
    if (this.handsFree && this.active && !this.busy && !this.speaking && !this.recog && !this.recorder && !this.transcribing) this.startListening();
    if (!this.handsFree && (this.recog || this.recorder)) { this.discardRecognition(); this.setVoice("idle"); }
  }

  repeat() {
    if (!this.lastAssistant || this.busy) return;
    this.speak(this.lastAssistant, { force: true });
  }

  retry() { if (this.retryText) { const t = this.retryText; this.retryText = null; this.submit(t, { isRetry: true }); } }

  // ---- sending ----
  async submit(text, { isRetry = false } = {}) {
    const clean = String(text).replace(/\s+/g, " ").trim();
    if (!clean || !this.active || this.busy) return;
    const key = clean.toLowerCase(), now = Date.now();
    if (!isRetry && key === this.lastSent.key && now - this.lastSent.at < 4000) return; // duplicate recognition result
    this.lastSent = { key, at: now };
    this.busy = true;
    this.discardRecognition(); this.cancelSpeech();
    if (!isRetry) this.addMessage("user", clean);
    this.emit({ voice: "thinking", notice: null, interim: "" });
    const history = this.history.slice(-16);
    try {
      const d = await api.chat({ message: clean, history, state: this.session });
      this.busy = false;
      if (this.destroyed) return;
      this.session = d.state;
      this.history.push({ role: "user", content: clean }, { role: "assistant", content: d.reply });
      this.addMessage("assistant", d.reply, d.mode);
      this.applyAnalysis(d);
      if (d.notice) this.emit({ notice: { kind: "info", text: d.notice } });
      if (d.summary) { this.active = false; this.emit({ summary: d.summary, ended: true }); }
      this.speak(d.reply);
    } catch (e) {
      this.busy = false;
      this.retryText = clean;
      this.emit({ voice: "idle", notice: { kind: "error", text: e.userMessage || "Something went wrong.", retry: true } });
    }
  }

  // ---- speaking ----
  getVoice() { if (!this.voice && this.synth) this.voice = pickVoice(this.synth.getVoices()); return this.voice; }
  cancelSpeech() { this.gen++; this.speaking = false; clearTimeout(this.watchdog); try { this.synth?.cancel(); } catch { /* ignore */ } }

  speak(text, { force = false } = {}) {
    this.cancelSpeech(); this.discardRecognition();
    this.lastAssistant = text;
    if (!this.synth || (this.muted && !force)) { this.speaking = false; this.finishSpeech(true); return; }
    const gen = this.gen;
    const chunks = splitSentences(toSpeech(text));
    this.speaking = true; this.setVoice("speaking");
    const voice = this.getVoice();
    try {
      chunks.forEach((chunk, i) => {
        const u = new SpeechSynthesisUtterance(chunk);
        u.lang = "en-IN"; u.rate = 1; if (voice) u.voice = voice;
        u.onend = () => { if (gen === this.gen && i === chunks.length - 1) this.finishSpeech(true); };
        u.onerror = e => {
          if (gen !== this.gen || e.error === "interrupted" || e.error === "canceled") return;
          this.cancelSpeech(); this.finishSpeech(true);
        };
        this.synth.speak(u);
      });
    } catch (e) {
      // A speech failure must never lose the reply: the text is already on screen.
      console.warn("Speech synthesis failed:", e?.message);
      this.cancelSpeech(); this.finishSpeech(true);
      return;
    }
    // Safety net: some browsers never fire onend.
    this.watchdog = setTimeout(() => { if (gen === this.gen && this.speaking) { this.cancelSpeech(); this.finishSpeech(true); } }, 4000 + text.length * 95);
  }

  finishSpeech(resume) {
    this.speaking = false; clearTimeout(this.watchdog);
    if (this.busy) return;
    this.setVoice("idle");
    if (resume && this.active && this.handsFree) this.later(() => this.startListening(), 450); // wait so the mic does not hear the speaker
  }

  // ---- listening ----
  startListening(tries = 0) {
    if (!this.active || this.busy || this.speaking || this.transcribing) return;
    if (this.useRecorder) return this.startRecording();
    if (!this.Rec) { this.emit({ micStatus: "unsupported", notice: { kind: "info", text: "Voice input isn't supported in this browser. Type your answer or tap a suggestion instead." } }); return; }
    if (this.recog) { if (this.recog.__discard && tries < 10) this.later(() => this.startListening(tries + 1), 100); return; }
    const rec = new this.Rec();
    rec.lang = "en-IN"; rec.continuous = false; rec.interimResults = true; rec.maxAlternatives = 1;
    let finalText = "", interim = "", error = null;
    rec.onstart = () => { this.setVoice("listening"); this.emit({ micStatus: "granted", interim: "", notice: null }); };
    rec.onresult = e => {
      interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript + " "; else interim += r[0].transcript;
      }
      this.emit({ interim: (finalText + interim).trim() });
    };
    rec.onerror = e => {
      error = e.error;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        this.handsFree = false;
        this.emit({ micStatus: "denied", handsFree: false, notice: { kind: "error", text: "Microphone access is blocked. Allow it in your browser's site settings, or type your answer instead." } });
      } else if (e.error === "audio-capture") {
        this.emit({ notice: { kind: "error", text: "No microphone was found. Check that one is connected, or type your answer." } });
      } else if (e.error === "network") {
        if (this.canRecord) {
          this.useRecorder = true; // built-in recognition is blocked or offline: switch to server transcription
          this.emit({ notice: { kind: "info", text: "Switched to cloud voice transcription for this browser. Tap the microphone and speak." } });
        } else {
          this.emit({ notice: { kind: "error", text: "Speech recognition needs an internet connection. Type your answer or try again." } });
        }
      }
    };
    rec.onend = () => {
      if (this.recog === rec) this.recog = null;
      this.emit({ interim: "" });
      if (rec.__discard || this.destroyed) return;
      if (error === "network" && this.useRecorder) { this.setVoice("idle"); this.later(() => this.startListening(), 300); return; }
      if (error && error !== "no-speech" && error !== "aborted") { this.setVoice("idle"); return; }
      const text = (finalText || interim).trim();
      if (text) { this.silence = 0; this.submit(text); } else this.onSilence();
    };
    this.recog = rec;
    try { rec.start(); } catch { this.recog = null; this.setVoice("idle"); }
  }

  onSilence() {
    this.setVoice("idle");
    this.silence++;
    if (this.handsFree && this.active && this.silence <= 2) { this.later(() => this.startListening(), 400); return; }
    this.silence = 0;
    this.emit({ notice: { kind: "info", text: this.handsFree ? "Hands-free is paused because nothing was heard. Tap the microphone to continue." : "I didn't hear anything. Tap the microphone and try again, or pick a suggestion." } });
  }

  stopListening() {
    if (this.recorder) { try { if (this.recorder.mr.state !== "inactive") this.recorder.mr.stop(); } catch { /* ignore */ } return; }
    try { this.recog?.stop(); } catch { /* ignore */ }
  }
  discardRecognition() {
    if (this.recog) { this.recog.__discard = true; try { this.recog.abort(); } catch { /* ignore */ } }
    if (this.recorder) { this.recorder.discard = true; try { if (this.recorder.mr.state !== "inactive") this.recorder.mr.stop(); } catch { /* ignore */ } }
  }

  // ---- recording fallback (works in any browser with MediaRecorder) ----
  async startRecording() {
    if (this.recorder) return;
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      const denied = e?.name === "NotAllowedError" || e?.name === "SecurityError";
      if (denied) this.handsFree = false;
      this.emit({ micStatus: denied ? "denied" : "unknown", handsFree: this.handsFree, notice: { kind: "error", text: denied ? "Microphone access is blocked. Allow it in your browser's site settings, or type your answer instead." : "No microphone was found. Check that one is connected, or type your answer." } });
      this.setVoice("idle");
      return;
    }
    if (!this.active || this.busy || this.speaking || this.recorder) { stream.getTracks().forEach(t => t.stop()); return; }
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find(m => MediaRecorder.isTypeSupported?.(m));
    const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    const rec = { mr, stream, chunks: [], discard: false, heard: false, timer: null, ctx: null };
    this.recorder = rec;
    mr.ondataavailable = e => { if (e.data && e.data.size) rec.chunks.push(e.data); };
    mr.onstop = () => this.finishRecording(rec);
    try { // stop automatically after the seller goes quiet
      const ctx = new (window.AudioContext || window.webkitAudioContext)(); rec.ctx = ctx; ctx.resume?.();
      const an = ctx.createAnalyser(); an.fftSize = 1024; ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Uint8Array(an.fftSize), t0 = Date.now(); let lastVoice = t0;
      rec.timer = setInterval(() => {
        an.getByteTimeDomainData(buf);
        let sum = 0; for (const v of buf) { const x = (v - 128) / 128; sum += x * x; }
        const now = Date.now();
        if (Math.sqrt(sum / buf.length) > 0.02) { rec.heard = true; lastVoice = now; }
        if ((rec.heard && now - lastVoice > 1500) || (!rec.heard && now - t0 > 8000) || now - t0 > 30000) this.stopListening();
      }, 100);
    } catch { rec.heard = true; } // no analyser: the seller taps the mic again to finish
    mr.start();
    this.setVoice("listening"); this.emit({ micStatus: "granted", interim: "" });
  }

  async finishRecording(rec) {
    clearInterval(rec.timer);
    try { rec.ctx?.close?.(); } catch { /* ignore */ }
    rec.stream.getTracks().forEach(t => t.stop());
    if (this.recorder === rec) this.recorder = null;
    if (rec.discard || this.destroyed) return;
    const blob = new Blob(rec.chunks, { type: rec.mr.mimeType || "audio/webm" });
    if (!rec.heard || blob.size < 1500) { this.onSilence(); return; }
    this.transcribing = true; this.setVoice("thinking"); this.emit({ interim: "Transcribing…" });
    try {
      const text = (await api.transcribe(blob)).trim();
      this.transcribing = false; this.emit({ interim: "" });
      if (!this.active || this.destroyed) return;
      if (text) { this.silence = 0; this.submit(text); if (!this.busy) this.setVoice("idle"); } else this.onSilence();
    } catch (e) {
      this.transcribing = false;
      this.emit({ interim: "", voice: "idle", notice: { kind: "error", text: e.userMessage || "Could not transcribe your voice. Type your answer instead." } });
    }
  }
}
