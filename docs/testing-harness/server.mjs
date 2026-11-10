import http from "node:http"; import fs from "node:fs";
import { createChatService } from "/home/claude/out/snapdeal-virtual-kam/backend/src/services/chatService.js";
import { validateChatBody, validateSummaryBody } from "/home/claude/out/snapdeal-virtual-kam/backend/src/http/validation.js";
import { sellerProfile, sellerData } from "/home/claude/out/snapdeal-virtual-kam/backend/src/data/sellerData.js";
const svc = createChatService({ geminiKey: "", geminiModel: "x", geminiFallbackModel: "", geminiTimeoutMs: 100 });
let delayMs = 0; globalThis.__fail = false;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" };
const send = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json", ...cors }); res.end(JSON.stringify(obj)); };
http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
  if (u.pathname === "/favicon.ico") { res.writeHead(204); return res.end(); }
  if (u.pathname === "/" ) { res.writeHead(200, { "Content-Type": "text/html" }); return res.end(fs.readFileSync("/tmp/harness/index.html")); }
  if (u.pathname === "/app.js") { res.writeHead(200, { "Content-Type": "text/javascript" }); return res.end(fs.readFileSync("/tmp/web/app.js")); }
  if (u.pathname === "/styles.css") { res.writeHead(200, { "Content-Type": "text/css" }); return res.end(fs.readFileSync("/home/claude/out/snapdeal-virtual-kam/frontend/src/styles.css")); }
  if (u.pathname === "/__fail") { globalThis.__fail = u.searchParams.get("on") === "1"; return send(res, 200, { fail: globalThis.__fail }); }
  if (u.pathname === "/health") return send(res, 200, { ok: true });
  if (u.pathname === "/api/seller") return send(res, 200, { profile: sellerProfile, data: sellerData, metrics: svc.metrics, simulated: true });
  if (u.pathname === "/api/session/start") return send(res, 200, svc.start());
  let body = ""; for await (const c of req) body += c;
  if (globalThis.__fail && u.pathname === "/api/chat") return send(res, 503, { error: "down" });
  if (u.pathname === "/api/chat") { const v = validateChatBody(JSON.parse(body)); if (!v.ok) return send(res, 400, { error: v.error }); await new Promise(r => setTimeout(r, 150)); return send(res, 200, await svc.turn(v.value)); }
  if (u.pathname === "/api/summary") { const v = validateSummaryBody(JSON.parse(body)); return send(res, 200, svc.summary(v.value.state)); }
  send(res, 404, { error: "nf" });
}).listen(8099, () => console.log("harness on 8099"));
