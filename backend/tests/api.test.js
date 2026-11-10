// HTTP integration tests. They need `npm install` (express). If express is not
// installed they are SKIPPED, not silently passed.
import test from "node:test";
import assert from "node:assert/strict";

let createApp, haveExpress = true;
try { await import("express"); ({ createApp } = await import("../src/app.js")); } catch { haveExpress = false; }
const skip = haveExpress ? false : "express is not installed (run npm install)";

const cfg = { allowedOrigins: ["http://localhost:5173"], geminiKey: "", geminiModel: "m", geminiFallbackModel: "", geminiTimeoutMs: 100, rateLimitPerMinute: 1000 };
async function withServer(fn, config = cfg) {
  const server = createApp(config).listen(0);
  try { await fn(`http://127.0.0.1:${server.address().port}`); } finally { server.close(); }
}
const post = (base, path, body, headers = {}) => fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });

test("GET /health", { skip }, () => withServer(async b => {
  const j = await (await fetch(b + "/health")).json();
  assert.equal(j.ok, true); assert.equal(j.aiConfigured, false); assert.ok(!JSON.stringify(j).includes("key"));
}));
test("GET /api/seller returns verified metrics", { skip }, () => withServer(async b => {
  const j = await (await fetch(b + "/api/seller")).json();
  assert.equal(j.metrics.sales.changePct, -32.5); assert.equal(j.metrics.cancellationRate.changePp, 6); assert.equal(j.simulated, true);
}));
test("GET /api/session/start returns the greeting", { skip }, () => withServer(async b => {
  const j = await (await fetch(b + "/api/session/start")).json();
  assert.match(j.reply, /Asha/);
}));
test("POST /api/chat works end to end without an API key", { skip }, () => withServer(async b => {
  const r = await post(b, "/api/chat", { message: "my sales dropped", history: [] });
  const j = await r.json(); assert.equal(r.status, 200); assert.equal(j.mode, "local"); assert.match(j.reply, /32\.5%/);
}));
test("POST /api/chat validates input", { skip }, () => withServer(async b => {
  assert.equal((await post(b, "/api/chat", {})).status, 400);
  assert.equal((await post(b, "/api/chat", { message: "x".repeat(601) })).status, 400);
  assert.equal((await post(b, "/api/chat", "{bad json")).status, 400);
  assert.equal((await post(b, "/api/chat", { message: "a", pad: "x".repeat(30000) })).status, 413);
}));
test("CORS: disallowed origin gets 403; allowed origin gets headers", { skip }, () => withServer(async b => {
  assert.equal((await fetch(b + "/health", { headers: { Origin: "https://evil.example" } })).status, 403);
  const ok = await fetch(b + "/health", { headers: { Origin: "http://localhost:5173" } });
  assert.equal(ok.headers.get("access-control-allow-origin"), "http://localhost:5173");
}));
test("rate limiting returns 429", { skip }, () => withServer(async b => {
  const codes = []; for (let i = 0; i < 4; i++) codes.push((await fetch(b + "/api/seller")).status);
  assert.ok(codes.includes(429));
}, { ...cfg, rateLimitPerMinute: 2 }));
test("unknown route returns a safe 404", { skip }, () => withServer(async b => {
  const r = await fetch(b + "/nope"); assert.equal(r.status, 404); assert.deepEqual(await r.json(), { error: "Not found." });
}));
