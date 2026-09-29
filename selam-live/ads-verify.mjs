// ads-verify.mjs — confirm the Google Ads API connection end-to-end BEFORE we
// touch any campaigns. It refreshes an access token, lists the accounts your
// token can reach, and pulls each one's name / currency / timezone so you can
// see the whole auth chain (developer token + OAuth + login-customer-id) works.
//
// Needs these in ~/selam-live/.env (see ads-auth.mjs + the walkthrough):
//   GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET,
//   GOOGLE_ADS_REFRESH_TOKEN, GOOGLE_ADS_LOGIN_CUSTOMER_ID (MCC),
//   GOOGLE_ADS_CUSTOMER_ID (the ad-running account; optional).
//
// RUN:  node ads-verify.mjs
// Read-only — it never creates, changes, or spends anything.
//
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const ENV = path.join(ROOT, ".env");
// Bump this if Google returns a "version … is deprecated/not found" error.
const API_VERSION = process.env.GOOGLE_ADS_API_VERSION || "v18";
const BASE = `https://googleads.googleapis.com/${API_VERSION}`;

function readEnv() {
  const out = {};
  try {
    for (const l of fs.readFileSync(ENV, "utf8").split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].trim();
    }
  } catch (_) {}
  // process.env overrides .env, so you can also pass values inline.
  for (const k of Object.keys(process.env)) if (k.startsWith("GOOGLE_ADS_")) out[k] = process.env[k];
  return out;
}
const digits = (s) => (s || "").replace(/[^0-9]/g, "");

const env = readEnv();
const DEV = env.GOOGLE_ADS_DEVELOPER_TOKEN;
const CID = env.GOOGLE_ADS_CLIENT_ID;
const SECRET = env.GOOGLE_ADS_CLIENT_SECRET;
const REFRESH = env.GOOGLE_ADS_REFRESH_TOKEN;
const LOGIN = digits(env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);
const TARGET = digits(env.GOOGLE_ADS_CUSTOMER_ID);

const missing = [];
if (!DEV) missing.push("GOOGLE_ADS_DEVELOPER_TOKEN");
if (!CID) missing.push("GOOGLE_ADS_CLIENT_ID");
if (!SECRET) missing.push("GOOGLE_ADS_CLIENT_SECRET");
if (!REFRESH) missing.push("GOOGLE_ADS_REFRESH_TOKEN");
if (missing.length) {
  console.error("✗ Missing in ~/selam-live/.env:\n   " + missing.join("\n   "));
  console.error("\n   Run ads-auth.mjs to mint the refresh token, and copy the developer token from the Ads manager's API Center.");
  process.exit(1);
}

function headers(token, loginId) {
  const h = { Authorization: `Bearer ${token}`, "developer-token": DEV, "Content-Type": "application/json" };
  if (loginId) h["login-customer-id"] = loginId;
  return h;
}

async function accessToken() {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({ client_id: CID, client_secret: SECRET, refresh_token: REFRESH, grant_type: "refresh_token" }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("token refresh failed: " + JSON.stringify(j).slice(0, 300));
  return j.access_token;
}

async function listAccessible(token) {
  const r = await fetch(`${BASE}/customers:listAccessibleCustomers`, { headers: headers(token, LOGIN) });
  const j = await r.json();
  if (!r.ok) throw new Error(`listAccessibleCustomers ${r.status}: ${JSON.stringify(j).slice(0, 400)}`);
  return (j.resourceNames || []).map((n) => n.split("/").pop());
}

async function describe(token, custId, loginId) {
  const query = "SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.manager, customer.test_account, customer.status FROM customer LIMIT 1";
  const r = await fetch(`${BASE}/customers/${custId}/googleAds:search`, {
    method: "POST", headers: headers(token, loginId || custId), body: JSON.stringify({ query }),
  });
  const j = await r.json();
  if (!r.ok) return { id: custId, error: (j.error && j.error.message) || `HTTP ${r.status}` };
  const c = j.results && j.results[0] && j.results[0].customer;
  return c
    ? { id: c.id, name: c.descriptiveName || "(no name)", currency: c.currencyCode, tz: c.timeZone, manager: !!c.manager, test: !!c.testAccount, status: c.status }
    : { id: custId, error: "no customer row returned" };
}

const pad = (s, n) => String(s ?? "").padEnd(n).slice(0, n);

(async () => {
  console.log(`— Google Ads API check (${API_VERSION}) —\n`);
  const token = await accessToken();
  console.log("✅ access token obtained (OAuth refresh works)");

  const ids = await listAccessible(token);
  console.log(`✅ developer token valid — ${ids.length} accessible account(s): ${ids.join(", ") || "(none)"}\n`);

  // Prefer the target account; otherwise describe everything reachable.
  const toShow = TARGET ? [TARGET, ...ids.filter((i) => i !== TARGET)] : ids;
  if (!toShow.length) { console.log("No accounts to describe. If this is empty, check login-customer-id / access."); return; }

  console.log(pad("CUSTOMER ID", 14) + pad("NAME", 26) + pad("CUR", 5) + pad("TIMEZONE", 20) + "FLAGS");
  console.log("-".repeat(78));
  for (const id of toShow) {
    const d = await describe(token, id, LOGIN);
    if (d.error) { console.log(pad(id, 14) + "⚠ " + d.error.slice(0, 55)); continue; }
    const flags = [d.manager ? "manager" : "", d.test ? "TEST" : "", d.status].filter(Boolean).join(" · ");
    console.log(pad(d.id, 14) + pad(d.name, 26) + pad(d.currency, 5) + pad(d.tz, 20) + flags);
  }

  console.log("\n✅ Connection verified. If you see your ad-running account above (not a TEST account),");
  console.log("   the chain is ready — tell me and I'll script the campaign build.");
  if (toShow.some((id) => id) && !TARGET) console.log("   Tip: set GOOGLE_ADS_CUSTOMER_ID to the account you'll advertise from.");
})().catch((e) => {
  console.error("\n✗ " + e.message);
  console.error("\nCommon fixes:");
  console.error("  • developer token still in TEST mode → apply for Basic access (API Center).");
  console.error("  • wrong login-customer-id → it must be the MANAGER (MCC) id, digits only.");
  console.error(`  • API version error → set GOOGLE_ADS_API_VERSION (currently ${API_VERSION}) to a supported one.`);
  console.error("  • PERMISSION_DENIED → the OAuth user isn't a user on that Ads account.");
  process.exit(1);
});
