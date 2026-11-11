import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { isOriginAllowed } from "./http/cors.js";
import { validateChatBody, validateSummaryBody } from "./http/validation.js";
import { createChatService } from "./services/chatService.js";
import { sellerProfile, sellerData } from "./data/sellerData.js";
import { transcribeAudio } from "./ai/transcribe.js";

export function createApp(config, deps = {}) {
  const app = express();
  const service = createChatService(config, { log: m => console.warn("[ai]", m), ...deps });
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use((req, res, next) => {
    if (!isOriginAllowed(req.headers.origin, config.allowedOrigins)) return res.status(403).json({ error: "Origin not allowed." });
    next();
  });
  app.use(cors({ origin: (origin, cb) => cb(null, isOriginAllowed(origin, config.allowedOrigins)), methods: ["GET", "POST", "OPTIONS"], maxAge: 600 }));
  app.use(express.json({ limit: "24kb" }));
  app.use("/api/", rateLimit({
    windowMs: 60_000, limit: config.rateLimitPerMinute, standardHeaders: true, legacyHeaders: false,
    message: { error: "Too many requests. Please wait a moment and try again." }
  }));

  app.get("/health", (_req, res) => res.json({ ok: true, service: "snapdeal-virtual-kam", aiConfigured: service.aiEnabled, model: service.aiEnabled ? config.geminiModel : null }));
  app.get("/api/seller", (_req, res) => res.json({ profile: sellerProfile, data: sellerData, metrics: service.metrics, simulated: true }));
  app.get("/api/session/start", (_req, res) => res.json(service.start()));

  app.post("/api/chat", async (req, res) => {
    const v = validateChatBody(req.body);
    if (!v.ok) return res.status(400).json({ error: v.error });
    try {
      res.json(await service.turn(v.value));
    } catch (e) {
      console.error("chat failed:", e?.message);
      res.status(500).json({ error: "Something went wrong on our side. Please try again." });
    }
  });
  app.post("/api/transcribe", express.raw({ type: () => true, limit: "5mb" }), async (req, res) => {
    if (!config.geminiKey && !deps.transcribe) return res.status(503).json({ error: "Voice transcription is not configured on the server." });
    const audio = req.body;
    if (!Buffer.isBuffer(audio) || audio.length < 500) return res.status(400).json({ error: "No audio received." });
    try {
      const run = deps.transcribe ?? transcribeAudio;
      res.json({ text: await run({ apiKey: config.geminiKey, buffer: audio, mimeType: req.headers["content-type"] || "" }) });
    } catch (e) {
      console.warn("transcribe failed:", e?.kind || e?.message);
      res.status(e?.kind === "quota" ? 429 : 502).json({ error: e?.kind === "quota" ? "Voice service is busy. Try again in a moment." : "Could not transcribe the audio." });
    }
  });
  
  app.post("/api/summary", (req, res) => {
    const v = validateSummaryBody(req.body);
    if (!v.ok) return res.status(400).json({ error: v.error });
    res.json(service.summary(v.value.state));
  });

  app.use((_req, res) => res.status(404).json({ error: "Not found." }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Request body is not valid JSON." });
    if (err?.type === "entity.too.large") return res.status(413).json({ error: "Request body is too large." });
    console.error("unhandled:", err?.message);
    res.status(500).json({ error: "Something went wrong on our side." });
  });
  return app;
}
