// drive.mjs — send Selam a task via the app (CDP), optionally screen-recording
// the whole run, and wait until she's actually finished before stopping.
//
//   PROMPT="…"                node drive.mjs          # just drive the task
//   RECORD=1 SCOPE=screen PROMPT="…" node drive.mjs   # record while she works
//
// Completion = she spoke at least once, then went fully quiet (no speech, no new
// sentence) for SILENCE_MS — generous, so long tool-call pauses don't cut her
// off — or MAX_MS as a hard ceiling.
import pkg from "/opt/homebrew/lib/node_modules/openclaw/dist/extensions/diffs/node_modules/playwright-core/index.js";
import { execSync } from "child_process";
const { chromium } = pkg;

// Make Pages the frontmost, maximized app (so it covers the Terminal that
// Claude runs in) and tuck the always-on-top Selam panel into the corner.
// Called from inside the recorded run — no Bash call re-raises Terminal here.
const STAGE_APP = process.env.STAGE_APP || "Pages";   // the visible work app to keep maximized
function focusStage() {
  try { execSync(`osascript -e 'tell application "${STAGE_APP}" to activate' -e 'delay 0.25' -e 'tell application "System Events" to tell process "${STAGE_APP}" to set position of window 1 to {0, 25}' -e 'tell application "System Events" to tell process "${STAGE_APP}" to set size of window 1 to {1512, 957}'`, { stdio: "ignore" }); } catch (_) {}
  try { execSync(`osascript -e 'tell application "System Events" to tell process "Electron" to set position of window 1 to {840, 450}'`, { stdio: "ignore" }); } catch (_) {}
}

const PROMPT   = process.env.PROMPT || "";
const RECORD   = process.env.RECORD === "1";
const SCOPE    = process.env.SCOPE === "screen" ? "screen" : "window";
const SILENCE  = parseInt(process.env.SILENCE_MS || "40000", 10);
const MAX_MS   = parseInt(process.env.MAX_MS || "540000", 10);
const PREROLL  = parseInt(process.env.PREROLL_MS || "1800", 10);
const POSTROLL = parseInt(process.env.POSTROLL_MS || "2500", 10);
const START_DELAY = parseInt(process.env.START_DELAY_MS || "0", 10);  // grace to minimize Terminal before capture
if (!PROMPT) { console.error("✗ set PROMPT"); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
let pg = null;
for (const c of b.contexts()) for (const p of c.pages()) {
  if (p.url().startsWith("devtools://")) continue;
  try { if (await p.evaluate(() => !!document.getElementById("text-input"))) { pg = p; break; } } catch (_) {}
}
if (!pg) { console.error("✗ no app window (CDP 9222)"); process.exit(1); }

// Session on?
if (!(await pg.evaluate(() => !!(window.__selamSessionActive && window.__selamSessionActive())))) {
  await pg.evaluate(() => { const s = document.getElementById("start-btn"); if (s) s.click(); });
  for (let i = 0; i < 20; i++) { await sleep(800); if (await pg.evaluate(() => !!(window.__selamSessionActive && window.__selamSessionActive()))) break; }
  await sleep(1500);
}
// Mute the mic so room noise can't barge in mid-demo.
try { await pg.evaluate(() => { const m = document.getElementById("mute-btn"); if (m && document.body.classList.contains("mic-listening")) m.click(); }); } catch (_) {}

// Hook her spoken sentences so we can tell when she's active / done.
await pg.evaluate(() => {
  const a = window.__selamAdapter; if (!a || a.__driveHooked) return;
  a.__driveHooked = true; window.__driveCap = { n: 0, sentences: [] };
  const os = a.onSentenceStart;
  a.onSentenceStart = function (s) { try { if (typeof s === "string" && s.trim()) { window.__driveCap.sentences.push(s.trim()); window.__driveCap.n++; } } catch (_) {} return os && os.apply(this, arguments); };
});
const state = () => pg.evaluate(() => {
  const a = window.__selamAdapter, av = a && a.avatar, c = window.__driveCap || { n: 0 };
  return { f: av ? (av.speakingFactor || 0) : 0, n: c.n };
});

// Keep the stage clean throughout: exit Selam's mini-bubble + keep Pages
// front/maximized (it may not have a window until she creates the doc, so
// re-assert on an interval rather than once).
let _keeper = null;
async function stageKeep() {
  try { await pg.evaluate(() => { try { window.__selamExitMini && window.__selamExitMini(); } catch (_) {} }); } catch (_) {}
  focusStage();
}

// Start recording.
let recStarted = false;
if (RECORD) {
  if (START_DELAY > 0) { console.log(`⏳ starting capture in ${Math.round(START_DELAY / 1000)}s — minimize Terminal now`); await sleep(START_DELAY); }
  const r = await pg.evaluate(async (scope) => { try { return await window.__selamRecorder.start({ scope }); } catch (e) { return { ok: false, error: String(e) }; } }, SCOPE);
  if (!r || !r.ok) { console.error(`✗ recording failed (${SCOPE}):`, r && r.error); if (r && r.permissionDenied) console.error("  → grant Screen Recording permission to the app"); await b.close(); process.exit(2); }
  recStarted = true;
  console.log(`⏺ recording (${r.scope}, voice=${r.hasVoice})`);
  await stageKeep();
  _keeper = setInterval(() => { stageKeep().catch(() => {}); }, 2500);
  await sleep(PREROLL);
}

// Deliver the task exactly like a typed message.
console.log("→ task sent");
await pg.evaluate((t) => {
  const i = document.getElementById("text-input"), s = document.getElementById("speak-btn");
  i.value = t; i.dispatchEvent(new Event("input", { bubbles: true })); s.click();
  i.value = ""; i.dispatchEvent(new Event("input", { bubbles: true }));
}, PROMPT);

// Re-assert the stage after the task lands (doc create/open can shift focus).
const t0 = Date.now();
for (; Date.now() - t0 < 20000; ) { const s = await state(); if (s.n > 0 || s.f > 0.06) break; await sleep(200); }
let lastN = 0, lastActive = Date.now();
while (Date.now() - t0 < MAX_MS) {
  const s = await state();
  if (s.n > lastN) { lastN = s.n; lastActive = Date.now(); }
  if (s.f >= 0.06) lastActive = Date.now();
  if (s.n > 0 && s.f < 0.06 && Date.now() - lastActive > SILENCE) break;
  await sleep(300);
}
const spokeSecs = Math.round((Date.now() - t0) / 1000);
console.log(`✓ finished (~${spokeSecs}s active, ${lastN} sentences)`);
if (_keeper) clearInterval(_keeper);
if (recStarted) await stageKeep();   // keep Pages front for the tail so the menu bar never flips
await sleep(POSTROLL);

if (recStarted) {
  const res = await pg.evaluate(async () => { try { return await window.__selamRecorder.stop(); } catch (e) { return { ok: false, error: String(e) }; } });
  console.log("⏹ saved:", JSON.stringify(res));
}
const said = await pg.evaluate(() => (window.__driveCap ? window.__driveCap.sentences.slice(0, 40) : []));
console.log("— she said —\n" + said.join(" "));
await b.close();
