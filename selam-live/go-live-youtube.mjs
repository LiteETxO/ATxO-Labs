// go-live-youtube.mjs — one command to take Selam live on YouTube.
//
// The proven sequence (avoids YouTube Studio's "preparing" trap):
//   ① connect the app encoder → the YouTube RTMP key (window capture + voice)
//   ② wait until YouTube's ingest health is good
//   ③ create a broadcast with preview OFF + auto-start OFF (so we control it),
//      bind it to the stream, and transition it to LIVE via the API
//   ④ start the host-loop (content + YouTube live-chat, answered verbally)
//
// Auth for the YouTube API goes through Composio's proxy using the already-
// connected YouTube OAuth (youtube.force-ssl) — no Google Cloud setup.
//
//   node go-live-youtube.mjs        (needs the app running in dev mode, CDP 9222)
import fs from "fs";
import path from "path";
import { execSync, spawn } from "child_process";
import { fileURLToPath } from "url";
import pkg from "/opt/homebrew/lib/node_modules/openclaw/dist/extensions/diffs/node_modules/playwright-core/index.js";
const { chromium } = pkg;

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const l of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const YT_URL = process.env.SELAM_YT_URL || "";
const BITRATE = process.env.SELAM_YT_BITRATE || "2500k";
if (!YT_URL) { console.error("✗ SELAM_YT_URL not set in .env"); process.exit(1); }
const YT_KEY = YT_URL.split("/").pop().split("?")[0];   // stream key = last path segment

function composioKey() {
  try { const f = fs.readFileSync(path.join(process.env.HOME, ".openclaw/secrets/composio_api_key"), "utf8").trim(); if (f) return f; } catch (_) {}
  try { return execSync("security find-generic-password -s selam.byok -a composio_api_key -w", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch (_) {}
  return "";
}
const CKEY = composioKey();
if (!CKEY) { console.error("✗ no Composio API key (Keychain selam.byok / secrets file)"); process.exit(1); }
let CID = process.env.SELAM_YT_CID || "";

async function capi(p) {
  const r = await fetch("https://backend.composio.dev/api/v3/" + p, { headers: { "x-api-key": CKEY } });
  return r.json();
}
async function proxy(endpoint, method = "GET", body) {
  const b = { connected_account_id: CID, endpoint, method };
  if (body !== undefined) b.body = body;
  const r = await fetch("https://backend.composio.dev/api/v3/tools/execute/proxy", {
    method: "POST", headers: { "x-api-key": CKEY, "Content-Type": "application/json" }, body: JSON.stringify(b),
  });
  const j = await r.json();
  return (j && j.data !== undefined) ? j.data : j;
}
async function findCID() {
  if (CID) return CID;
  const j = await capi("connected_accounts?limit=50");
  const a = (j.items || []).find((i) => ((i.toolkit || {}).slug) === "youtube" && i.status === "ACTIVE");
  if (!a) throw new Error("no ACTIVE YouTube account connected in Composio (connect it in Settings)");
  CID = a.id; return CID;
}
async function streamFor(key) {
  const d = await proxy("https://www.googleapis.com/youtube/v3/liveStreams?part=id,cdn,status&mine=true&maxResults=25");
  return (d.items || []).find((x) => (x.cdn && x.cdn.ingestionInfo && x.cdn.ingestionInfo.streamName) === key) || null;
}

(async () => {
  await findCID();

  console.log(`① connecting encoder → YouTube @${BITRATE} …`);
  try { execSync("pkill -9 -f 'rtmp://a.rtmp.youtube.com'", { stdio: "ignore" }); } catch (_) {}
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
  let page = null;
  for (const c of b.contexts()) for (const p of c.pages()) {
    if (await p.evaluate(() => !!(window.__selamLive && window.__selamLive.start)).catch(() => 0)) { page = p; break; }
  }
  if (!page) { await b.close(); throw new Error("app not running / CDP 9222 unavailable — launch the app in dev mode first"); }
  // Open a session BEFORE the encoder captures, so the app's personalized owner
  // greeting ("hey <owner>, what do you need?") plays OFF-air. Otherwise the
  // host-loop starts the session after the stream is live and it airs.
  const hadSession = await page.evaluate(() => !!(window.__selamSessionActive && window.__selamSessionActive()));
  if (!hadSession) {
    console.log("   opening session off-air (so the owner greeting isn't broadcast)…");
    await page.evaluate(() => { const s = document.getElementById("start-btn"); if (s) s.click(); });
    for (let i = 0; i < 15; i++) { await sleep(600); if (await page.evaluate(() => !!(window.__selamSessionActive && window.__selamSessionActive()))) break; }
    await sleep(2500);   // let the off-air greeting finish before capture starts
  }
  await page.evaluate(async () => { try { await window.__selamLive.stop(); } catch (_) {} });
  await sleep(1000);
  const res = await page.evaluate(async ({ u, br }) => await window.__selamLive.start(u, { music: true, overlay: true, bitrate: br }), { u: YT_URL, br: BITRATE });
  await b.close();
  if (!res || !res.ok) throw new Error("encoder start failed: " + (res && res.error));
  console.log("   encoder up.");

  console.log("② waiting for YouTube ingest health …");
  let healthy = false;
  for (let i = 0; i < 24; i++) {           // poll fast (~3s) up to ~72s so we proceed the moment it's ready
    const s = await streamFor(YT_KEY);
    const h = s && s.status && s.status.healthStatus ? s.status.healthStatus.status : "none";
    console.log(`   health: ${h}`);
    if (h === "good" || h === "ok") { healthy = true; break; }
    await sleep(3000);
  }
  if (!healthy) throw new Error("stream never reported healthy — check uplink / lower SELAM_YT_BITRATE");

  // Complete any leftover live/ready broadcasts first — re-using one stream key
  // across broadcasts otherwise piles up duplicates that confuse YouTube.
  try {
    const old = await proxy("https://www.googleapis.com/youtube/v3/liveBroadcasts?part=id,status&broadcastStatus=all&broadcastType=all&maxResults=10");
    for (const i of (old.items || [])) {
      const st = i.status && i.status.lifeCycleStatus;
      if (["live", "liveStarting", "testing", "ready"].includes(st)) {
        await proxy(`https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?part=status&broadcastStatus=complete&id=${i.id}`, "POST");
        console.log("   ended leftover broadcast:", i.id, st);
      }
    }
  } catch (_) {}

  console.log("③ creating broadcast (preview off, autostart off) → bind → live …");
  const stream = await streamFor(YT_KEY);
  if (!stream) throw new Error("no YouTube stream matches the key in SELAM_YT_URL");
  const start = new Date(Date.now() + 15000).toISOString().replace(/\.\d+Z$/, "Z");
  const created = await proxy("https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails", "POST", {
    snippet: { title: "Selam AI Agent — Live", scheduledStartTime: start },
    status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
    contentDetails: { enableAutoStart: false, enableAutoStop: true, monitorStream: { enableMonitorStream: false }, latencyPreference: "normal" },
  });
  const bid = created.id;
  if (!bid) throw new Error("create broadcast failed: " + JSON.stringify(created).slice(0, 300));
  await proxy(`https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?part=id,status&id=${bid}&streamId=${stream.id}`, "POST");
  const t = await proxy(`https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?part=status&broadcastStatus=live&id=${bid}`, "POST");
  console.log("   transition →", (t.status && t.status.lifeCycleStatus) || JSON.stringify(t).slice(0, 200));

  console.log("④ starting host-loop (content + YouTube chat) …");
  try { execSync("pkill -f 'host-loop.mjs'", { stdio: "ignore" }); } catch (_) {}
  await sleep(800);
  const out = fs.openSync(path.join(ROOT, "host-loop.log"), "a");
  spawn("node", ["host-loop.mjs"], { cwd: ROOT, stdio: ["ignore", out, out], detached: true, env: { ...process.env, SELAM_CHAT_PLATFORM: "youtube" } }).unref();

  console.log(`\n✅ LIVE → https://www.youtube.com/watch?v=${bid}`);
})().catch((e) => { console.error("✗ go-live failed:", e.message); process.exit(1); });
