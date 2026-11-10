import { chromium } from "/opt/npm-tools/node_modules/playwright-core/index.mjs";
import fs from "node:fs";
const exe = fs.readdirSync("/opt/pw-browsers").filter(d => d.startsWith("chromium-"))[0];
const browser = await chromium.launch({ executablePath: `/opt/pw-browsers/${exe}/chrome-linux64/chrome`, args: ["--no-sandbox"] });
const mocks = fs.readFileSync("/tmp/harness/mocks.js", "utf8");
const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  -> " + extra}`); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const T = p => p.evaluate(() => ({ ...window.__t, instances: undefined, cur: undefined }));
const stateText = p => p.locator(".voice-state").innerText();
async function until(p, fn, ms = 4000) { const t = Date.now(); while (Date.now() - t < ms) { if (await p.evaluate(fn)) return true; await wait(50); } return false; }
const userMsgs = p => p.locator(".line-user:not(.line-interim)").count();
const asstMsgs = p => p.locator(".line-assistant").count();

async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport ?? { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  const errors = []; p.on("pageerror", e => errors.push(e.message)); p.on("console", m => m.type() === "error" && errors.push(m.text()));
  if (!opts.noSR) await p.addInitScript(mocks); else await p.addInitScript(() => { window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined; });
  await p.goto("http://127.0.0.1:8099/"); p.errors = errors;
  return p;
}

// 1. No microphone request on load / start
let p = await newPage();
await p.waitForSelector("text=Start conversation");
check("no recognition started on page load", (await T(p)).starts === 0);
await p.click("text=Start conversation");
await p.waitForSelector(".line-assistant:not(:has(.dots))");
check("greeting is shown and spoken", (await T(p)).spoken.join(" ").includes("Asha"));
await until(p, () => !window.__t.speakingNow);
await wait(700);
check("push-to-talk: mic does NOT auto-start after greeting", (await T(p)).starts === 0, JSON.stringify(await T(p)));
check("state returns to Ready after speaking", (await stateText(p)).includes("Ready"), await stateText(p));

// 2. Push-to-talk turn
await p.click(".mic"); await p.waitForFunction(() => document.querySelector(".voice-state")?.innerText.includes("Listening"));
check("listening indicator shown", true);
await p.evaluate(() => window.__t.say("My sales have dropped a lot this month"));
await p.waitForFunction(() => document.querySelectorAll(".line-assistant:not(:has(.dots))").length >= 2);
check("seller message appears once", (await userMsgs(p)) === 1);
const reply1 = await p.locator(".line-assistant:not(:has(.dots))").last().innerText();
check("reply explains 32.5% and 6 percentage points, one question", /32\.5%/.test(reply1) && /6 percentage points/.test(reply1) && (reply1.match(/\?/g) || []).length === 1, reply1);
check("reply spoken with rupee/percent normalised", (await T(p)).spoken.some(s => /32\.5 percent/.test(s) && /500 rupees/.test(s)), JSON.stringify((await T(p)).spoken.slice(-3)));
check("business insights show verified figures", (await p.locator(".metrics").innerText()).includes("−32.5%") && (await p.locator(".metrics").innerText()).includes("+6 percentage points") && (await p.locator(".metrics").innerText()).includes("Unchanged"));
check("diagnosis panel lists confirmed facts, not traffic claims", /Confirmed/.test(await p.locator("section[aria-labelledby=h-diag]").innerText()));

// 3. duplicate prevention
await until(p, () => !window.__t.speakingNow); await wait(200);
await p.click(".mic"); await p.waitForFunction(() => document.querySelector(".voice-state")?.innerText.includes("Listening"));
await p.evaluate(() => window.__t.say("Yes some of my best sellers are out of stock"));
await p.waitForFunction(() => document.querySelectorAll(".line-assistant:not(:has(.dots))").length >= 3);
const uBefore = await userMsgs(p);
await until(p, () => !window.__t.speakingNow); await wait(200);
await p.click(".mic"); await p.waitForFunction(() => document.querySelector(".voice-state")?.innerText.includes("Listening"));
await p.evaluate(() => window.__t.say("Yes some of my best sellers are out of stock"));
await wait(800);
check("identical recognition result within 4s is not sent twice", (await userMsgs(p)) === uBefore, `${uBefore} -> ${await userMsgs(p)}`);

// 4. interrupt
await p.evaluate(() => { window.__t.hold = true; });
await p.fill(".typebox input", "it will take a few weeks");
await p.keyboard.press("Enter");
await p.waitForFunction(() => document.querySelectorAll(".line-assistant:not(:has(.dots))").length >= 4);
await p.waitForFunction(() => document.querySelector(".voice-state")?.innerText.includes("speaking"));
const cancelsBefore = (await T(p)).cancels;
await p.click(".mic");
await p.waitForFunction(() => document.querySelector(".voice-state")?.innerText.includes("Listening"));
check("interrupt cancels speech and opens the microphone", (await T(p)).cancels > cancelsBefore);
check("never more than one recognition session at once", (await T(p)).maxActive === 1, String((await T(p)).maxActive));
await p.evaluate(() => { window.__t.hold = false; window.__t.say("no I have no substitutes"); });
await p.waitForFunction(() => document.querySelectorAll(".line-assistant:not(:has(.dots))").length >= 5);

// 5. mute + repeat
await until(p, () => !window.__t.speakingNow);
await p.click("text=Mute");
const spokenBefore = (await T(p)).spoken.length;
await p.fill(".typebox input", "mostly late dispatch"); await p.keyboard.press("Enter");
await p.waitForFunction(() => document.querySelectorAll(".line-assistant:not(:has(.dots))").length >= 6);
await wait(300);
check("muted: reply is shown but not spoken", (await T(p)).spoken.length === spokenBefore);
await p.click("text=Unmute");
await p.click("text=Repeat"); await wait(200);
const last = await p.locator(".line-assistant:not(:has(.dots))").last().innerText();
check("repeat speaks the previous response again", (await T(p)).spoken.length > spokenBefore);

// 6. end call -> summary
await p.click("text=End call");
await p.waitForSelector("#h-sum", { timeout: 5000 });
const sum = await p.locator("section[aria-labelledby=h-sum]").innerText();
check("summary has all required sections", ["Main business problem", "Confirmed findings", "Potential root causes", "Priority actions", "Follow-up checklist", "Metrics to monitor"].every(s => sum.includes(s)), sum.slice(0, 200));
const dl = p.waitForEvent("download"); await p.click("text=Download"); const d = await dl;
check("summary downloads as markdown", d.suggestedFilename().endsWith(".md"));
check("mic stays closed after call ended", await until(p, () => window.__t.active === 0));
check("no page errors in main flow", p.errors.length === 0, p.errors.join(" | "));
await p.screenshot({ path: "/tmp/harness/desktop-final.png", fullPage: true });

// 7. hands-free loop
p = await newPage();
await p.click("text=Start conversation"); await p.waitForSelector(".line-assistant:not(:has(.dots))");
await p.click("text=Hands-free");
await p.waitForFunction(() => window.__t.starts >= 1, null, { timeout: 4000 }).catch(() => {});
check("hands-free: toggling on starts listening", (await T(p)).starts >= 1);
await p.evaluate(() => window.__t.say("sales are down, please help"));
await p.waitForFunction(() => document.querySelectorAll(".line-assistant:not(:has(.dots))").length >= 2);
const s1 = (await T(p)).starts;
await p.waitForFunction(n => window.__t.starts > n, s1, { timeout: 5000 }).catch(() => {});
check("hands-free: listens again automatically after Asha finishes speaking", (await T(p)).starts > s1);
check("hands-free: microphone never opened while Asha was speaking", (await T(p)).startsWhileSpeaking === 0, String((await T(p)).startsWhileSpeaking));
check("hands-free: one session at a time", (await T(p)).maxActive === 1);
// silence handling
for (let i = 0; i < 4; i++) { await p.waitForFunction(() => window.__t.active === 1, null, { timeout: 3000 }).catch(() => {}); await p.evaluate(() => window.__t.silence()); await wait(700); }
check("repeated silence pauses hands-free with a clear message", /Hands-free is paused/.test(await p.locator(".notice").innerText().catch(() => "")));
check("silence did not create duplicate messages", (await userMsgs(p)) === 1);

// 8. permission denied
p = await newPage();
await p.click("text=Start conversation"); await p.waitForSelector(".line-assistant:not(:has(.dots))");
await until(p, () => !window.__t.speakingNow);
await p.evaluate(() => { window.__t.deny = true; });
await p.click(".mic");
await p.waitForSelector(".notice-error");
check("denied microphone shows guidance and offers typing", /blocked/.test(await p.locator(".notice").innerText()));
await p.fill(".typebox input", "my sales dropped"); await p.keyboard.press("Enter");
await p.waitForFunction(() => document.querySelectorAll(".line-assistant:not(:has(.dots))").length >= 2);
check("typing still works after permission denied", true);

// 9. backend failure + retry
p = await newPage();
await p.click("text=Start conversation"); await p.waitForSelector(".line-assistant:not(:has(.dots))");
await p.evaluate(() => fetch("http://127.0.0.1:8099/__fail?on=1"));
await p.fill(".typebox input", "my sales dropped"); await p.keyboard.press("Enter");
await p.waitForSelector(".notice-error", { timeout: 15000 });
check("backend failure shows a safe error with retry", /Try again/.test(await p.locator(".notice").innerText()));
await p.evaluate(() => fetch("http://127.0.0.1:8099/__fail?on=0"));
await p.click("text=Try again");
await p.waitForFunction(() => document.querySelectorAll(".line-assistant:not(:has(.dots))").length >= 2);
check("retry succeeds without duplicating the seller's message", (await userMsgs(p)) === 1);

// 10. unsupported browser
p = await newPage({ noSR: true });
await p.click("text=Start conversation"); await p.waitForSelector(".line-assistant:not(:has(.dots))");
check("unsupported speech recognition: clear notice, hands-free disabled", /isn't available in this browser/.test(await p.locator(".support-note").first().innerText()) && await p.locator(".switch input").isDisabled());
await p.fill(".typebox input", "my sales dropped"); await p.keyboard.press("Enter");
await p.waitForFunction(() => document.querySelectorAll(".line-assistant:not(:has(.dots))").length >= 2);
check("unsupported browser: typed conversation works", true);

// 11. screenshots, mobile
p = await newPage({ viewport: { width: 390, height: 844 } });
await p.click("text=Start conversation"); await p.waitForSelector(".line-assistant:not(:has(.dots))");
await p.fill(".typebox input", "my sales dropped"); await p.keyboard.press("Enter");
await p.waitForFunction(() => document.querySelectorAll(".line-assistant:not(:has(.dots))").length >= 2);
await p.screenshot({ path: "/tmp/harness/mobile-talk.png" });
await p.click(".tabs >> text=Insights"); await p.screenshot({ path: "/tmp/harness/mobile-insights.png", fullPage: true });
const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
check("mobile: no horizontal overflow", !overflow);

p = await newPage();
await p.screenshot({ path: "/tmp/harness/desktop-welcome.png" });
await p.click("text=Start conversation"); await p.waitForSelector(".line-assistant:not(:has(.dots))");
await p.fill(".typebox input", "my sales dropped"); await p.keyboard.press("Enter");
await p.waitForFunction(() => document.querySelectorAll(".line-assistant:not(:has(.dots))").length >= 2);
await wait(400); await p.screenshot({ path: "/tmp/harness/desktop-talk.png", fullPage: true });

await browser.close();
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} browser checks passed`);
process.exit(failed ? 1 : 0);
