import dotenv from "dotenv";
dotenv.config();

export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT) || 8080,
    // Groq is used, but the field names are kept so no other file needs to change.
    geminiKey: env.GROQ_API_KEY || "",
    geminiModel: env.GROQ_MODEL || "llama-3.3-70b-versatile",
    geminiFallbackModel: env.GROQ_FALLBACK_MODEL || "llama-3.1-8b-instant",
    geminiTimeoutMs: Number(env.AI_TIMEOUT_MS) || 9000,
    allowedOrigins: (env.FRONTEND_ORIGIN || "http://localhost:5173")
      .split(",").map(s => s.trim()).filter(Boolean),
    rateLimitPerMinute: Number(env.RATE_LIMIT_PER_MINUTE) || 40
  };
}
