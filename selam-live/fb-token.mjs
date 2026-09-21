// fb-token.mjs — turn a short-lived USER token into a PERMANENT Page token.
// Uses the app secret (in .env) to: (1) exchange the short-lived user token
// for a long-lived one, (2) read your Pages, whose tokens — when derived from
// a long-lived user token — do not expire. Reading LIVE comments needs the
// broadcast to be on a PAGE and a Page token, so this hands you exactly that.
//
//   node fb-token.mjs '<SHORT_LIVED_USER_TOKEN>'
import fs from "fs";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const APP_ID = process.env.FB_APP_ID, APP_SECRET = process.env.FB_APP_SECRET, GV = "v21.0";
const SHORT = (process.argv[2] || process.env.SELAM_FB_TOKEN || "").trim();
if (!APP_ID || !APP_SECRET) { console.error("missing FB_APP_ID / FB_APP_SECRET in .env"); process.exit(1); }
if (!SHORT) { console.error("usage: node fb-token.mjs '<SHORT_LIVED_USER_TOKEN>'"); process.exit(1); }

const proof = (tok) => crypto.createHmac("sha256", APP_SECRET).update(tok).digest("hex");
async function g(pathq, tok) {
  const sep = pathq.includes("?") ? "&" : "?";
  const url = `https://graph.facebook.com/${GV}/${pathq}${sep}access_token=${encodeURIComponent(tok)}&appsecret_proof=${proof(tok)}`;
  const r = await fetch(url); const j = await r.json();
  if (j.error) throw new Error(`${j.error.type || "error"}: ${j.error.message}`);
  return j;
}

console.log("\n── Facebook token upgrade ──\n");

// 1) short-lived user token → long-lived user token (uses app secret)
let longUser;
try {
  const q = `oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${encodeURIComponent(SHORT)}`;
  const r = await fetch(`https://graph.facebook.com/${GV}/${q}`); const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  longUser = j.access_token;
  console.log("✓ long-lived USER token obtained" + (j.expires_in ? `  (~${Math.round(j.expires_in / 86400)} days)` : ""));
} catch (e) { console.error("✗ exchange failed:", e.message, "\n  (is this a USER token with pages_show_list + pages_read_engagement?)"); process.exit(1); }

// 2) identity
try { const me = await g("me?fields=id,name", longUser); console.log(`✓ you = ${me.name} (${me.id})`); } catch (e) { console.log("✗ me:", e.message); }

// 3) Pages + their (permanent) tokens
console.log("\nPages you manage:");
let pages = [];
try { const acc = await g("me/accounts?fields=id,name,access_token", longUser); pages = acc.data || []; }
catch (e) { console.log("✗ me/accounts:", e.message); }
if (!pages.length) {
  console.log("  (none) — LIVE comment reading requires the broadcast to be on a PAGE.");
  console.log("  Create a Facebook Page, then re-run this. Save your long-lived USER token meanwhile:");
  console.log("\n  LONG-LIVED USER TOKEN:\n  " + longUser + "\n");
  process.exit(0);
}
for (const p of pages) {
  console.log(`\n• ${p.name} (${p.id})`);
  console.log("  PERMANENT PAGE TOKEN:");
  console.log("  " + p.access_token);
  // sanity: any live videos?
  try {
    const lv = await g(`${p.id}/live_videos?fields=id,status&limit=3`, p.access_token);
    const vids = lv.data || [];
    if (vids.length) for (const v of vids) console.log(`    live video ${v.id} (${v.status})`);
    else console.log("    (no live videos yet — start the broadcast as this Page, then host-loop finds it)");
  } catch (e) { console.log("    live_videos:", e.message); }
  console.log(`\n  ▶ launch:  SELAM_FB_TOKEN='${p.access_token}' node ~/selam-live/host-loop.mjs`);
}
console.log("\n── done ──\n");
