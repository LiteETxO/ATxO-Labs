// comment-loop.mjs — the interactive layer of "Selam live".
// Watches a comment SOURCE, and for each new comment has Selam greet the person
// and reply out loud (through the live avatar). The source here is a mock file
// (mock-comments.txt, "Name | comment" per line) that you can append to live;
// swap fetchComments() for the Facebook Graph API /{live-video-id}/comments later.
//
//   node comment-loop.mjs            # process the mock file, poll for appended lines
//
// Requires the Selam app running with a session active (auto-starts one if not).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pkg from "/opt/homebrew/lib/node_modules/openclaw/dist/extensions/diffs/node_modules/playwright-core/index.js";
const { chromium } = pkg;

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const MOCK = path.join(ROOT, "mock-comments.txt");
let seen = 0;   // how many mock lines we've already handled

// --- comment source (mock). Returns [{name, text}] of NEW comments. ---
function fetchComments() {
  let lines = [];
  try { lines = fs.readFileSync(MOCK, "utf8").split(/\r?\n/).filter((l) => l.trim()); } catch (_) {}
  const fresh = lines.slice(seen);
  seen = lines.length;
  return fresh.map((l) => {
    const i = l.indexOf("|");
    return i > 0 ? { name: l.slice(0, i).trim(), text: l.slice(i + 1).trim() } : { name: "Viewer", text: l.trim() };
  });
}

const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
let pg = null;
for (const p of b.contexts()[0].pages()) {
  if (p.url().startsWith("devtools://")) continue;
  try { if (await p.evaluate(() => !!document.getElementById("text-input"))) { pg = p; break; } } catch (_) {}
}
if (!pg) { console.error("no app window"); process.exit(1); }

// ensure a session is live (she speaks through the session/brain path)
const active = await pg.evaluate(() => !!(window.__selamSessionActive && window.__selamSessionActive()));
if (!active) {
  console.log("starting a session…");
  await pg.evaluate(() => { const s = document.getElementById("start-btn"); if (s) s.click(); });
  for (let i = 0; i < 25; i++) { await new Promise(r => setTimeout(r, 800)); if (await pg.evaluate(() => !!(window.__selamSessionActive && window.__selamSessionActive()))) break; }
}
// mute the mic so room noise doesn't interrupt her while she hosts
try { await pg.evaluate(() => { const m = document.getElementById("mute-btn"); if (m && document.body.classList.contains("mic-listening")) m.click(); }); } catch (_) {}

const speaking = () => pg.evaluate(() => { const av = window.__selamAdapter && window.__selamAdapter.avatar; return av ? (av.speakingFactor || 0) : 0; });
async function waitUntilIdle(maxMs = 35000) {
  const t0 = Date.now(); let quiet = 0;
  // wait for her to START (up to 8s), then to finish (quiet ~1.5s)
  while (Date.now() - t0 < 8000) { if ((await speaking()) > 0.06) break; await new Promise(r => setTimeout(r, 200)); }
  while (Date.now() - t0 < maxMs) {
    if ((await speaking()) < 0.06) { quiet++; if (quiet >= 8) return; } else quiet = 0;
    await new Promise(r => setTimeout(r, 200));
  }
}
async function askSelam(name, text) {
  const framed = `[Live viewer "${name}" just commented]: ${text}\n(You're hosting a live stream — greet ${name} by name and answer warmly in one or two short sentences.)`;
  await pg.evaluate((t) => {
    const inp = document.getElementById("text-input"); const btn = document.getElementById("speak-btn");
    inp.value = t; inp.dispatchEvent(new Event("input", { bubbles: true })); btn.click();
  }, framed);
  await waitUntilIdle();
}

console.log("live comment loop running — watching", MOCK);
const MAX = process.env.LOOP_MAX ? parseInt(process.env.LOOP_MAX) : Infinity;
let handled = 0;
for (let tick = 0; handled < MAX; tick++) {
  const fresh = fetchComments();
  for (const c of fresh) {
    console.log(`→ ${c.name}: ${c.text}`);
    await askSelam(c.name, c.text);
    console.log(`  ✓ answered`);
    handled++;
    if (handled >= MAX) break;
    await new Promise(r => setTimeout(r, 1500));
  }
  if (handled >= MAX) break;
  await new Promise(r => setTimeout(r, 3000));   // poll for appended comments
}
console.log("done,", handled, "answered");
await b.close();
