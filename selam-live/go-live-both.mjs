// go-live-both.mjs — take Selam live on Facebook AND YouTube simultaneously.
//
// One encode is teed to BOTH ingests (main.js tees when __selamLive.start gets a
// `youtube` URL), and each platform's broadcast is then properly PUBLISHED via
// its own API:
//   • Facebook — Graph API: create UNPUBLISHED → confirm ingest → LIVE_NOW
//   • YouTube  — Data API (via Composio proxy): create → bind → transition live
// Content + speech go to both; live-chat answering runs on ONE platform
// (SELAM_CHAT_PLATFORM, default facebook) since the host-loop reads one feed.
//
//   node go-live-both.mjs                 (app must be running in dev, CDP 9222)
//   SELAM_LIVE_MINUTES=30 node go-live-both.mjs   (timed; host-loop auto-wraps)
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import pkg from "/opt/homebrew/lib/node_modules/openclaw/dist/extensions/diffs/node_modules/playwright-core/index.js";
const { chromium } = pkg;

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const l of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

// ── Facebook (Graph API) ──────────────────────────────────────────────────
const FB_TOKEN = process.env.SELAM_FB_TOKEN, FB_PAGE = process.env.SELAM_FB_PAGE_ID;
const FB_SECRET = process.env.FB_APP_SECRET, FB_NOPROOF = !!process.env.SELAM_FB_NOPROOF;
const GRAPH = "https://graph.facebook.com/v21.0";
function fbProof() { return (FB_NOPROOF || !FB_SECRET) ? "" : crypto.createHmac("sha256", FB_SECRET).update(FB_TOKEN).digest("hex"); }
async function graph(method, node, params = {}) {
  const body = new URLSearchParams(params); body.set("access_token", FB_TOKEN);
  const p = fbProof(); if (p) body.set("appsecret_proof", p);
  const url = `${GRAPH}/${node}`;
  const r = method === "GET" ? await fetch(url + "?" + body.toString()) : await fetch(url, { method, body });
  const j = await r.json(); if (j.error) throw new Error(`${node}: ${j.error.message}`); return j;
}
if (!FB_TOKEN || !FB_PAGE) { console.error("✗ SELAM_FB_TOKEN / SELAM_FB_PAGE_ID not set in .env"); process.exit(1); }

// ── YouTube (Composio proxy) ──────────────────────────────────────────────
const YT_URL = (process.env.SELAM_YT_URL || "").trim();
const YT_KEY = YT_URL ? YT_URL.split("/").pop().split("?")[0] : "";
function composioKey() {
  try { const f = fs.readFileSync(path.join(process.env.HOME, ".openclaw/secrets/composio_api_key"), "utf8").trim(); if (f) return f; } catch (_) {}
  try { return execSync("security find-generic-password -s selam.byok -a composio_api_key -w", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch (_) {}
  return "";
}
const CKEY = composioKey();
let CID = process.env.SELAM_YT_CID || "";
async function capi(p) { const r = await fetch("https://backend.composio.dev/api/v3/" + p, { headers: { "x-api-key": CKEY } }); return r.json(); }
async function proxy(endpoint, method = "GET", body) {
  const b = { connected_account_id: CID, endpoint, method }; if (body !== undefined) b.body = body;
  const r = await fetch("https://backend.composio.dev/api/v3/tools/execute/proxy", {
    method: "POST", headers: { "x-api-key": CKEY, "Content-Type": "application/json" }, body: JSON.stringify(b),
  });
  const j = await r.json(); return (j && j.data !== undefined) ? j.data : j;
}
async function ytFindCID() { if (CID) return CID; const j = await capi("connected_accounts?limit=50"); const a = (j.items || []).find((i) => ((i.toolkit || {}).slug) === "youtube" && i.status === "ACTIVE"); if (!a) throw new Error("no ACTIVE YouTube account connected in Composio"); CID = a.id; return CID; }
async function ytStreamFor(key) { const d = await proxy("https://www.googleapis.com/youtube/v3/liveStreams?part=id,cdn,status&mine=true&maxResults=25"); return (d.items || []).find((x) => (x.cdn && x.cdn.ingestionInfo && x.cdn.ingestionInfo.streamName) === key) || null; }

const DO_YT = !!YT_URL && !!CKEY;

// ── 1. Create the Facebook broadcast (UNPUBLISHED so we warm the ingest first) ─
console.log("① creating Facebook broadcast on page", FB_PAGE, "…");
const created = await graph("POST", `${FB_PAGE}/live_videos`, {
  status: "UNPUBLISHED", title: "Selam — Live",
  description: "Meet Selam, an AI operator for your Mac. heyselam.ai",
});
const FB_VIDEO = created.id, FB_STREAM_URL = created.secure_stream_url;
if (!FB_STREAM_URL) throw new Error("no FB secure_stream_url returned");
fs.writeFileSync(path.join(ROOT, ".live.json"), JSON.stringify({ id: FB_VIDEO, secure_stream_url: FB_STREAM_URL }, null, 2));
let env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
env = /^SELAM_FB_VIDEO=/m.test(env) ? env.replace(/^SELAM_FB_VIDEO=.*$/m, `SELAM_FB_VIDEO=${FB_VIDEO}`) : env.trimEnd() + `\nSELAM_FB_VIDEO=${FB_VIDEO}\n`;
fs.writeFileSync(path.join(ROOT, ".env"), env);
console.log("   FB broadcast id:", FB_VIDEO, DO_YT ? "(simulcast → YouTube ON)" : "(Facebook only — YouTube not configured)");

if (DO_YT) await ytFindCID();

// ── 2. Start the encoder ONCE, teed to both ingests ───────────────────────
console.log(`② starting encoder (Facebook${DO_YT ? " + YouTube" : ""}) …`);
try { execSync("pkill -9 -f 'rtmp://a.rtmp.youtube.com'", { stdio: "ignore" }); } catch (_) {}
// Best-effort: bring the app window forward so the web-frame capture actually
// paints (a hidden window delivers zero frames → ingest never goes healthy).
try { execSync(`osascript -e 'tell application "System Events" to set frontmost of process "Electron" to true'`, { stdio: "ignore" }); } catch (_) {}
const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
let page = null;
for (const c of b.contexts()) for (const p of c.pages()) {
  if (await p.evaluate(() => !!(window.__selamLive && window.__selamLive.start)).catch(() => 0)) { page = p; break; }
}
if (!page) { await b.close(); throw new Error("app not running / CDP 9222 unavailable — launch the app in dev mode first"); }
// Open a session off-air first, so the owner greeting never airs.
const had = await page.evaluate(() => !!(window.__selamSessionActive && window.__selamSessionActive()));
if (!had) {
  console.log("   opening session off-air…");
  await page.evaluate(() => { const s = document.getElementById("start-btn"); if (s) s.click(); });
  for (let i = 0; i < 15; i++) { await sleep(600); if (await page.evaluate(() => !!(window.__selamSessionActive && window.__selamSessionActive()))) break; }
  await sleep(2500);
}
await page.evaluate(async () => { try { await window.__selamLive.stop(); } catch (_) {} });
await sleep(1000);
// Simulcast tees ONE encode to both ingests, so the per-stream bitrate must fit
// HALF the sustained uplink or YouTube (stricter than FB) flags the stream "bad"
// and never leaves liveStarting. Conservative default for a slow uplink; tune via
// SELAM_SIMULCAST_BITRATE (both) / SELAM_FB_BITRATE (Facebook-only).
const SIMUL_BR = process.env.SELAM_SIMULCAST_BITRATE || "1200k";
const SOLO_BR = process.env.SELAM_FB_BITRATE || "4000k";
const res = await page.evaluate(
  async ({ u, yt, br }) => await window.__selamLive.start(u, { music: true, overlay: true, youtube: yt || undefined, bitrate: br }),
  { u: FB_STREAM_URL, yt: DO_YT ? YT_URL : "", br: DO_YT ? SIMUL_BR : SOLO_BR });
await b.close();
if (!res || !res.ok) throw new Error("encoder start failed: " + (res && res.error));
console.log("   encoder up:", JSON.stringify(res));

// ── 3. Facebook: publish once real data is arriving ───────────────────────
async function fbBitrate() {
  try { const j = await graph("GET", FB_VIDEO, { fields: "ingest_streams{stream_health}" });
    const h = j.ingest_streams && j.ingest_streams[0] && j.ingest_streams[0].stream_health; return h ? (h.video_bitrate || 0) : 0;
  } catch { return 0; }
}
console.log("③ waiting for Facebook ingest to carry data …");
let fbOk = false;
for (let i = 0; i < 20; i++) { await sleep(3000); const v = await fbBitrate(); console.log(`   FB ingest ${i + 1}: video=${v}`); if (v > 0) { fbOk = true; break; } }
if (!fbOk) throw new Error("Facebook ingest never delivered frames — is the app window visible on screen?");
await graph("POST", FB_VIDEO, { status: "LIVE_NOW" });
const fbChk = await graph("GET", FB_VIDEO, { fields: "status,permalink_url" });
const fbUrl = fbChk.permalink_url && (fbChk.permalink_url.startsWith("http") ? fbChk.permalink_url : "https://www.facebook.com" + fbChk.permalink_url);
console.log("   ✅ Facebook LIVE:", fbUrl);

// ── 4. YouTube: wait for ingest health, then create → bind → transition ───
let ytUrl = "";
if (DO_YT) {
  console.log("④ waiting for YouTube ingest health …");
  let ytHealthy = false;
  for (let i = 0; i < 20; i++) {
    const s = await ytStreamFor(YT_KEY);
    const h = s && s.status && s.status.healthStatus ? s.status.healthStatus.status : "none";
    console.log(`   YT health: ${h}`);
    if (h === "good" || h === "ok") { ytHealthy = true; break; }
    await sleep(3000);
  }
  if (!ytHealthy) {
    console.log("⚠ YouTube ingest never went healthy — Facebook is live, YouTube skipped.");
  } else {
    // Complete any leftover live/ready broadcasts on this key first.
    try {
      const old = await proxy("https://www.googleapis.com/youtube/v3/liveBroadcasts?part=id,status&broadcastStatus=all&broadcastType=all&maxResults=10");
      for (const i of (old.items || [])) {
        const st = i.status && i.status.lifeCycleStatus;
        if (["live", "liveStarting", "testing", "ready"].includes(st)) {
          await proxy(`https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?part=status&broadcastStatus=complete&id=${i.id}`, "POST");
          console.log("   ended leftover YT broadcast:", i.id, st);
        }
      }
    } catch (_) {}
    const stream = await ytStreamFor(YT_KEY);
    const start = new Date(Date.now() + 15000).toISOString().replace(/\.\d+Z$/, "Z");
    const cr = await proxy("https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails", "POST", {
      snippet: { title: "Selam AI Agent — Live", scheduledStartTime: start },
      status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
      contentDetails: { enableAutoStart: false, enableAutoStop: true, monitorStream: { enableMonitorStream: false }, latencyPreference: "normal" },
    });
    const bid = cr.id;
    if (!bid) throw new Error("YT create broadcast failed: " + JSON.stringify(cr).slice(0, 200));
    await proxy(`https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?part=id,status&id=${bid}&streamId=${stream.id}`, "POST");
    const t = await proxy(`https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?part=status&broadcastStatus=live&id=${bid}`, "POST");
    ytUrl = `https://www.youtube.com/watch?v=${bid}`;
    console.log("   ✅ YouTube LIVE:", ytUrl, "| transition:", (t.status && t.status.lifeCycleStatus) || "");
  }
}

// ── 5. Start the host-loop (content + comments) ───────────────────────────
const CHAT = process.env.SELAM_CHAT_PLATFORM || "facebook";
console.log(`⑤ starting host-loop (live-chat answered on: ${CHAT}) …`);
try { execSync("pkill -f 'host-loop.mjs'", { stdio: "ignore" }); } catch (_) {}
await sleep(800);
const out = fs.openSync(path.join(ROOT, "host-loop.log"), "a");
spawn("node", ["host-loop.mjs"], { cwd: ROOT, stdio: ["ignore", out, out], detached: true, env: { ...process.env, SELAM_CHAT_PLATFORM: CHAT } }).unref();

console.log("\n✅ SIMULCAST LIVE");
console.log("   Facebook:", fbUrl);
if (ytUrl) console.log("   YouTube: ", ytUrl);
else if (DO_YT) console.log("   YouTube:  (skipped — ingest not healthy)");
