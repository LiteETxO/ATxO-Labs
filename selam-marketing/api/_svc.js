// api/_svc.js — shared durable rate limiting + monthly OpenAI budget guard for
// the Ask Selam endpoints, backed by Upstash Redis over its REST API (no SDK,
// no build step). Degrades gracefully: with no Upstash env configured it falls
// back to a per-instance in-memory limiter and an un-capped budget, so the
// endpoints keep working before/without provisioning.
//
// Env (auto-set by the Vercel Upstash/KV integration, or set by hand):
//   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN   (or KV_REST_API_URL / KV_REST_API_TOKEN)
//   OPENAI_MONTHLY_BUDGET   USD cap for the month        (default 25)
//   OPENAI_BUDGET_WARN      warn fraction of the cap     (default 0.8)
//   ALERT_WEBHOOK_URL       Slack/Discord/webhook for the alert (optional)

const REST_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";
const HAS_UPSTASH = !!(REST_URL && REST_TOKEN);

const MONTHLY_BUDGET = parseFloat(process.env.OPENAI_MONTHLY_BUDGET || "25");
const WARN_AT = parseFloat(process.env.OPENAI_BUDGET_WARN || "0.8");
const ALERT_WEBHOOK = process.env.ALERT_WEBHOOK_URL || "";

export const budgetConfigured = HAS_UPSTASH;

// --- Upstash REST pipeline: [["INCR","k"],["EXPIRE","k","600"]] → [result,...]
async function redis(commands) {
  const r = await fetch(`${REST_URL}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${REST_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  if (!r.ok) throw new Error("upstash " + r.status);
  const j = await r.json();
  return j.map((x) => (x && "result" in x ? x.result : null));
}

// --- in-memory fallback (per instance; resets on cold start) ---
const _mem = new Map();
function memLimit(key, max, windowMs) {
  const now = Date.now();
  const arr = (_mem.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  _mem.set(key, arr);
  if (_mem.size > 5000) _mem.clear();
  return arr.length > max;
}

function monthKey() { return new Date().toISOString().slice(0, 7); }   // UTC YYYY-MM
function dayKey() { return new Date().toISOString().slice(0, 10); }    // UTC YYYY-MM-DD
function last7Days() {
  const out = [];
  const now = Date.now();
  for (let i = 6; i >= 0; i--) out.push(new Date(now - i * 86400000).toISOString().slice(0, 10));
  return out;   // oldest → today
}
const num = (v) => parseFloat(v || "0") || 0;
const int = (v) => parseInt(v || "0", 10) || 0;
const DAY_TTL = "3888000";    // ~45d
const MON_TTL = "3456000";    // ~40d

// true = caller is OVER the limit and should be blocked.
export async function rateLimited(bucket, ip, max, windowSec) {
  const key = `rl:${bucket}:${ip}`;
  if (!HAS_UPSTASH) return memLimit(key, max, windowSec * 1000);
  try {
    const [count] = await redis([["INCR", key]]);
    if (count === 1) await redis([["EXPIRE", key, String(windowSec)]]);
    const over = Number(count) > max;
    if (over) redis([["INCR", `n:429:${dayKey()}`], ["EXPIRE", `n:429:${dayKey()}`, DAY_TTL]]).catch(() => {});
    return over;
  } catch (_) {
    return memLimit(key, max, windowSec * 1000);   // fail-open to in-memory
  }
}

// { over, spent } — over = this month's budget is exhausted.
export async function budgetStatus() {
  if (!HAS_UPSTASH) return { over: false, spent: 0 };
  try {
    const [v] = await redis([["GET", `budget:${monthKey()}`]]);
    const spent = parseFloat(v || "0") || 0;
    return { over: spent >= MONTHLY_BUDGET, spent };
  } catch (_) { return { over: false, spent: 0 }; }
}

// Record one billed call: bumps the monthly budget + daily spend + per-endpoint
// counts + token/char totals in one pipeline, and fires the one-time monthly
// warn alert when the budget crosses the threshold. Never throws into the
// request. m = { usd, inTok, outTok, chars }.
export async function record(kind, m = {}) {
  if (!HAS_UPSTASH) return;
  const usd = Number(m.usd || 0);
  try {
    const mk = monthKey(), dk = dayKey();
    const cmds = [];
    if (usd > 0) {
      cmds.push(["INCRBYFLOAT", `budget:${mk}`, String(usd)], ["EXPIRE", `budget:${mk}`, MON_TTL]);
      cmds.push(["INCRBYFLOAT", `spend:${dk}`, String(usd)], ["EXPIRE", `spend:${dk}`, DAY_TTL]);
    }
    cmds.push(["INCR", `n:${kind}:${dk}`], ["EXPIRE", `n:${kind}:${dk}`, DAY_TTL]);
    if (m.inTok)  cmds.push(["INCRBY", `tin:${mk}`, String(m.inTok | 0)], ["EXPIRE", `tin:${mk}`, MON_TTL]);
    if (m.outTok) cmds.push(["INCRBY", `tout:${mk}`, String(m.outTok | 0)], ["EXPIRE", `tout:${mk}`, MON_TTL]);
    if (m.chars)  cmds.push(["INCRBY", `tchars:${mk}`, String(m.chars | 0)], ["EXPIRE", `tchars:${mk}`, MON_TTL]);
    const r = await redis(cmds);
    if (usd > 0) {
      const total = parseFloat(r[0] || "0") || 0;   // first result = new monthly total
      if (total >= MONTHLY_BUDGET * WARN_AT) {
        const [set] = await redis([["SET", `budget:${mk}:warned`, "1", "NX"]]);
        if (set === "OK" || set === true) await sendAlert(mk, total);
      }
    }
  } catch (_) {}
}

// Keep the last 50 anonymous questions (text only, no IP) for the Ops feed.
export async function logQuestion(q) {
  if (!HAS_UPSTASH || !q) return;
  try {
    const item = JSON.stringify({ t: Date.now(), q: String(q).slice(0, 180) });
    await redis([["LPUSH", "recent:q", item], ["LTRIM", "recent:q", "0", "49"]]);
  } catch (_) {}
}

// Full snapshot for the Ops dashboard (one pipeline).
export async function usageSnapshot() {
  if (!HAS_UPSTASH) return { configured: false };
  try {
    const mk = monthKey();
    const days = last7Days();
    const head = [
      ["GET", `budget:${mk}`], ["GET", `budget:${mk}:warned`],
      ["GET", `tin:${mk}`], ["GET", `tout:${mk}`], ["GET", `tchars:${mk}`],
    ];
    const dayCmds = days.flatMap((d) => [
      ["GET", `spend:${d}`], ["GET", `n:ask:${d}`], ["GET", `n:tts:${d}`], ["GET", `n:429:${d}`],
    ]);
    const tail = [["LRANGE", "recent:q", "0", "49"]];
    const r = await redis([...head, ...dayCmds, ...tail]);
    let i = 0;
    const monthSpend = num(r[i++]);
    const warned = !!r[i++];
    const tokIn = int(r[i++]), tokOut = int(r[i++]), ttsChars = int(r[i++]);
    const series = days.map((d) => {
      const spend = num(r[i++]), ask = int(r[i++]), tts = int(r[i++]), rl = int(r[i++]);
      return { day: d, spend, ask, tts, rl };
    });
    const recentRaw = Array.isArray(r[i]) ? r[i] : [];
    const recent = recentRaw.map((s) => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
    return { configured: true, month: mk, cap: MONTHLY_BUDGET, warnAt: WARN_AT, monthSpend, warned, tokIn, tokOut, ttsChars, series, recent };
  } catch (e) {
    return { configured: true, error: String(e).slice(0, 120) };
  }
}

async function sendAlert(mk, spent) {
  const pct = Math.round((spent / MONTHLY_BUDGET) * 100);
  const msg = `⚠️ Ask Selam — OpenAI spend for ${mk} has reached $${spent.toFixed(2)} of the $${MONTHLY_BUDGET.toFixed(2)} monthly budget (${pct}%). Live answers stop at the cap; they resume next month.`;
  console.warn(msg);
  if (!ALERT_WEBHOOK) return;
  try {
    await fetch(ALERT_WEBHOOK, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: msg, content: msg }),   // Slack `text` / Discord `content`
    });
  } catch (_) {}
}

// --- cost estimates (USD), OpenAI list prices ---
export function chatCostUSD(inTok, outTok) {
  return (Number(inTok || 0) / 1e6) * 0.15 + (Number(outTok || 0) / 1e6) * 0.60;   // gpt-4o-mini
}
export function ttsCostUSD(chars) {
  return (Number(chars || 0) / 1000) * 0.015;   // gpt-4o-mini-tts ≈ $0.015/1K chars
}
