// api/usage.js — token-gated snapshot for the Ops dashboard (/ops). Returns
// month spend vs cap, 7-day series, token/char totals, 429 counts, and the
// recent anonymous questions. Guarded by OPS_TOKEN (never public).

import { usageSnapshot } from "./_svc.js";

const OPS_TOKEN = process.env.OPS_TOKEN || "";

export default async function handler(req, res) {
  const key =
    (req.query && (req.query.key || req.query.token)) ||
    (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!OPS_TOKEN || key !== OPS_TOKEN) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const snap = await usageSnapshot();
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json(snap);
}
