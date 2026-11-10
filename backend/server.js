import { loadConfig } from "./src/config.js";
import { createApp } from "./src/app.js";

const config = loadConfig();
const app = createApp(config);
const server = app.listen(config.port, () => {
  console.log(`Virtual KAM API on :${config.port} | AI: ${config.geminiKey ? `Gemini (${config.geminiModel})` : "local engine only"}`);
});
server.requestTimeout = 25_000;
server.headersTimeout = 20_000;
