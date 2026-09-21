// fb-check.mjs — diagnose a Facebook token for LIVE comment reading.
// Tells you exactly what the token is, which Pages it can see, whether a
// live video is up, and whether comments are readable — so we know it works
// BEFORE going live. Then prints the exact token to feed host-loop.mjs.
//
//   node fb-check.mjs '<TOKEN>'        (or: SELAM_FB_TOKEN=<TOKEN> node fb-check.mjs)
import fs from "fs";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
const ROOT = path.dirname(fileURLToPath(import.meta.url));
try { for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; } } catch (_) {}

const GV = "v21.0";
const APP_SECRET = process.env.FB_APP_SECRET || "";
const TOKEN = (process.argv[2] || process.env.SELAM_FB_TOKEN || "").trim();
if (!TOKEN) { console.error("usage: node fb-check.mjs '<TOKEN>'"); process.exit(1); }

// appsecret_proof only applies to tokens minted by OUR app. For a token from
// Facebook's own Graph API Explorer app, set SELAM_FB_NOPROOF=1 to skip it.
const NOPROOF = !!process.env.SELAM_FB_NOPROOF;
const appProof = (tok) => (APP_SECRET && !NOPROOF) ? `&appsecret_proof=${crypto.createHmac("sha256", APP_SECRET).update(tok).digest("hex")}` : "";
async function g(pathq, tok = TOKEN) {
  const url = `https://graph.facebook.com/${GV}/${pathq}${pathq.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(tok)}${appProof(tok)}`;
  const r = await fetch(url); const j = await r.json();
  if (j.error) throw new Error(`${j.error.type || "error"}: ${j.error.message}`);
  return j;
}
const ok = (s) => console.log("  ✓ " + s);
const bad = (s) => console.log("  ✗ " + s);

console.log("\n── Facebook token check ──\n");

// 1) What kind of token is this, and what can it do?
try {
  const d = await g(`debug_token?input_token=${encodeURIComponent(TOKEN)}`);
  const t = d.data || {};
  console.log("Token type :", t.type || "(unknown)");
  console.log("App        :", t.application || `id ${t.app_id}`);
  console.log("Valid      :", t.is_valid === true ? "yes" : "NO");
  console.log("Scopes     :", (t.scopes || []).join(", ") || "(none)");
  if ((t.type || "").toUpperCase() === "APP") {
    bad("This is an APP token — it cannot read user/page/live data. Get a USER token instead (see below).");
  }
  const need = ["pages_show_list", "pages_read_engagement"];
  const have = new Set(t.scopes || []);
  const missing = need.filter((s) => !have.has(s));
  if ((t.type || "").toUpperCase() === "USER") {
    if (missing.length) bad("Missing scopes: " + missing.join(", ") + "  (re-generate the token with these ticked)");
    else ok("Has the scopes we need to find Pages + read Page-live comments.");
  }
} catch (e) { bad("debug_token failed: " + e.message); }

// 2) Who is this?
console.log("\nIdentity:");
try { const me = await g("me?fields=id,name"); ok(`me = ${me.name} (${me.id})`); }
catch (e) { bad("me: " + e.message); }

// Detect token kind so we branch correctly (a PAGE token can't call me/accounts).
let isPageToken = false;
try { const d = await g(`debug_token?input_token=${encodeURIComponent(TOKEN)}`); isPageToken = (d.data && (d.data.type || "").toUpperCase() === "PAGE"); } catch (_) {}

// 3) Pages: for a USER token, enumerate managed Pages; for a PAGE token, it IS the page.
let pages = [];
if (isPageToken) {
  try { const me = await g("me?fields=id,name"); pages = [{ id: me.id, name: me.name, access_token: TOKEN }]; ok(`page token for: ${me.name} (${me.id})`); }
  catch (e) { bad("me: " + e.message); }
} else {
  console.log("\nPages you manage:");
  try {
    const acc = await g("me/accounts?fields=id,name,access_token,tasks");
    pages = acc.data || [];
    if (!pages.length) bad("No Pages found. Live-comment reading needs the broadcast to be on a PAGE, so create/select a Page first.");
    for (const p of pages) ok(`${p.name} (${p.id})${p.access_token ? "  [page token ✓]" : ""}`);
  } catch (e) { bad("me/accounts: " + e.message); }
}

// 4) For each Page: is there a live video, and can we read its comments?
for (const p of pages) {
  console.log(`\nPage "${p.name}" → live videos:`);
  const ptok = p.access_token || TOKEN;
  let vids = [];
  try { const lv = await g(`${p.id}/live_videos?fields=id,status,title&limit=5`, ptok); vids = lv.data || []; }
  catch (e) { bad("live_videos: " + e.message); continue; }
  if (!vids.length) { console.log("  (no live videos yet — start the broadcast, then re-run)"); continue; }
  for (const v of vids) {
    console.log(`  • ${v.id}  status=${v.status}  ${v.title || ""}`);
    try {
      const c = await g(`${v.id}/comments?fields=id,from,message&limit=3`, ptok);
      const n = (c.data || []).length;
      ok(`    comments readable (${n} so far). USE: SELAM_FB_TOKEN='${ptok.slice(0, 12)}…' SELAM_FB_VIDEO=${v.id}`);
    } catch (e) { bad("    comments: " + e.message); }
  }
}

console.log("\n── done ──\n");
