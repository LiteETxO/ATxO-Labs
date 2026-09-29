// drive-adcap.mjs — while LIVE, record locally and drive deterministic trivia + roast
// via the mock-comment file + a trivia steer, so the ad has both segments.
import fs from "node:fs";
import path from "node:path";
import pkg from "/opt/homebrew/lib/node_modules/openclaw/dist/extensions/diffs/node_modules/playwright-core/index.js";
const { chromium } = pkg;
const ROOT = "/Users/michaelderibe/selam-live";
const MOCK = path.join(ROOT, "mock-comments.txt");
const CONTROL = path.join(ROOT, "control.json");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const drip = (line) => { fs.appendFileSync(MOCK, line + "\n"); console.log("💬 drip:", line); };
const steer = (obj) => { fs.writeFileSync(CONTROL, JSON.stringify(obj)); console.log("🎛 steer:", JSON.stringify(obj)); };

const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
let pg = null;
for (const c of b.contexts()) for (const p of c.pages()) { if (p.url().startsWith("devtools://")) continue; try { if (await p.evaluate(() => !!document.getElementById("text-input"))) { pg = p; break; } } catch (_) {} }
const rec = await pg.evaluate(() => window.__selamRecorder && window.__selamRecorder.start ? window.__selamRecorder.start({ scope: "window" }) : { ok: false });
const live = await pg.evaluate(() => window.__selamLive && window.__selamLive.isLive ? window.__selamLive.isLive() : null);
console.log("recorder:", JSON.stringify(rec), "| isLive:", live);
const t0 = Date.now();
const at = async (sec, fn) => { const w = sec * 1000 - (Date.now() - t0); if (w > 0) await sleep(w); fn(); };

await at(22, () => drip("t0ast_lord|honestly this is boring, my microwave has more charisma 🥱"));
await at(48, () => steer({ cmd: "trivia", arg: "red planet" }));   // Mars — answer "mars"
await at(78, () => drip("GuessGuy|is it Venus?? lol probably wrong 😂"));   // wrong → roast
await at(108, () => drip("AstroMia|it's Mars!! 🔴"));                       // correct → celebration
await at(140, () => drip("skeptic99|an AI hosting a show? nobody's actually watching this 😭"));  // troll → roast
// keep recording to capture the responses, then stop
await at(250, () => {});
const out = await pg.evaluate(() => window.__selamRecorder && window.__selamRecorder.stop ? window.__selamRecorder.stop() : { ok: false });
console.log("SAVED:", JSON.stringify(out));
await b.close();
