import dotenv from "dotenv";
dotenv.config();

export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT) || 8080,
    geminiKey: env.GEMINI_API_KEY || "",
    geminiModel: env.GEMINI_MODEL || "gemini-flash-latest",
    geminiFallbackModel: env.GEMINI_FALLBACK_MODEL || "",
    geminiTimeoutMs: Number(env.GEMINI_TIMEOUT_MS) || 9000,
    allowedOrigins: (env.FRONTEND_ORIGIN || "http://localhost:5173")
      .split(",").map(s => s.trim()).filter(Boolean),
    rateLimitPerMinute: Number(env.RATE_LIMIT_PER_MINUTE) || 40
  };
}
