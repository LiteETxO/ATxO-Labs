// test-growth.mjs — short rehearsal with SELAM_PROMO_LIVE=1, capturing her
// SPOKEN lines so we can verify growth-mode welcoming energy + that she never
// mentions ads/promotion/owner.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import pkg from "/opt/homebrew/lib/node_modules/openclaw/dist/extensions/diffs/node_modules/playwright-core/index.js";
const { chromium } = pkg;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ROOT = "/Users/michaelderibe/selam-live";
const MOCK = path.join(ROOT, "mock-comments.txt");
fs.writeFileSync(MOCK, "");
const drips = [
  [16, "NewViewer22|omg just found this — first time catching you live!"],
  [44, "t0aster_boy|boooring 🥱 my microwave has more personality"],
];
for (const [t, line] of drips) setTimeout(() => { try { fs.appendFileSync(MOCK, line + "\n"); console.log(`💬 @${t}s: ${line}`); } catch (_) {} }, t * 1000);

const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
let pg = null;
for (const c of b.contexts()) for (const p of c.pages()) { try { if (await p.evaluate(() => !!document.getElementById("text-input"))) { pg = p; break; } } catch (_) {} }
if (!pg) { console.log("no app page"); process.exit(1); }
if (!(await pg.evaluate(() => !!(window.__selamSessionActive && window.__selamSessionActive())))) {
  await pg.evaluate(() => { const s = document.getElementById("start-btn"); if (s) s.click(); });
  for (let i = 0; i < 25; i++) { await sleep(700); if (await pg.evaluate(() => !!(window.__selamSessionActive && window.__selamSessionActive()))) break; }
  await sleep(1200);
}
console.log("session on — starting growth-mode rehearsal (SELAM_PROMO_LIVE=1)");

const env = { ...process.env, SELAM_REHEARSE: "1", SELAM_CHAT_PLATFORM: "mock", SELAM_LIVE_MINUTES: "1", SELAM_PROMO_LIVE: "1" };
const child = spawn("node", ["host-loop.mjs"], { cwd: ROOT, env, stdio: "inherit" });

let printed = 0;
const dump = async (label) => {
  try {
    const s = await pg.evaluate(() => (window.__hostCap && window.__hostCap.sentences) || []);
    for (let i = printed; i < s.length; i++) console.log(`🗣️  ${s[i]}`);
    printed = s.length;
  } catch (_) {}
};
const iv = setInterval(() => dump("tick"), 6000);
child.on("exit", async (code) => {
  clearInterval(iv);
  await sleep(800); await dump("final");
  console.log(`\n=== ${printed} spoken lines captured ===`);
  try { await b.close(); } catch (_) {}
  process.exit(code || 0);
});
