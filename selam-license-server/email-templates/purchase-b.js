// ─── Purchase email — variant B (first-session retention) ───────────
//
// Same information, different emphasis. Variant A leads with download
// mechanics. Variant B leads with what to *do* in the first 5 minutes,
// because the empirical failure mode for a $199 desktop product isn't
// "buyer can't install" — it's "buyer installs, doesn't know what to
// say to it, doesn't come back."
//
// Hypothesis: B converts higher on day-7 active. Measured by Resend tag
// `variant: b` plus session-active rate from the desktop telemetry stub
// (when SENTRY_DSN gets enabled).
//
// Same return shape as purchase.js — { from, to, subject, html, text }.

const FROM_DEFAULT  = 'Selam <support@heyselam.app>';
const SUPPORT_EMAIL = 'support@heyselam.app';
const DOWNLOAD_URL  = 'https://api.heyselam.app/download';
const PRODUCT_NAME  = 'Selam';

function buildPurchaseEmailB({
  to,
  key,
  productSku = 'selam-v1',
  downloadUrl = DOWNLOAD_URL,
  sentAt = new Date(),
  from = FROM_DEFAULT,
}) {
  if (!to)  throw new Error('buildPurchaseEmailB requires a recipient email');
  if (!key) throw new Error('buildPurchaseEmailB requires a license key');

  const sentAtIso = sentAt instanceof Date ? sentAt.toISOString() : new Date(sentAt).toISOString();
  const subject = `Selam is ready — give them the first task`;

  const text = `Welcome.

You'll have ${PRODUCT_NAME} running in 90 seconds. The harder thing —
the thing most people skip and regret — is the first task.

Here's one that works. After install, click the mic and say:

  "Look at my screen and tell me one thing I should do about it."

Watch what they do. That moment — when you stop typing and a real
worker starts looking, thinking, and acting — is what you bought.

─────────────────────────────────────────

Your license key:

  ${key}

To install:
  1. Download from ${downloadUrl}
  2. Drag Selam to Applications
  3. Open Selam — paste your license key
  4. Connect your AI keys (we'll walk you through it)

A couple of things worth knowing:
  - It asks before doing anything risky. You set the trust scopes —
    what Selam can do without checking, what always needs your OK.
  - Selam runs on your Mac and talks to your own AI provider accounts
    (Anthropic, OpenAI, ElevenLabs, Simli). We never see prompts.
  - Voice defaults to OpenAI (~$4/mo typical use). Switch any time.

Your purchase receipt was sent separately by Stripe.
Lost this email? Recover at https://api.heyselam.app/recover.

If the first task doesn't land, reply to this email — I want to know why.

— The Selam team
sent ${sentAtIso}
sku ${productSku}
`;

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#fafbfc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1d24;">
  <div style="max-width:560px;margin:24px auto;padding:24px 28px;background:#fff;border-radius:14px;border:1px solid #e3e5ea;">

    <div style="font-size:11px;font-weight:700;letter-spacing:0.18em;color:#3070f0;text-transform:uppercase;margin-bottom:18px;">${PRODUCT_NAME}</div>

    <h1 style="font-size:22px;font-weight:700;letter-spacing:-0.01em;margin:0 0 6px;">Welcome.</h1>
    <p style="font-size:14px;color:#3a3f48;line-height:1.55;margin:0 0 22px;">
      You'll have ${PRODUCT_NAME} running in 90 seconds. The harder thing — the thing
      most people skip and regret — is the first task.
    </p>

    <div style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.1em;color:#777;text-transform:uppercase;">Give them the first task</div>
    <div style="margin:0 0 22px;padding:18px 20px;background:#0e0e14;color:#f2f2f2;border-radius:9px;line-height:1.5;">
      <div style="font-size:11px;color:#7ec4ff;letter-spacing:0.08em;margin-bottom:8px;">AFTER INSTALL — CLICK THE MIC AND SAY</div>
      <div style="font-size:15px;font-style:italic;color:#f2f2f2;line-height:1.45;">
        “Look at my screen and tell me one thing I should do about it.”
      </div>
      <div style="font-size:12px;color:rgba(255,255,255,0.55);margin-top:10px;line-height:1.5;">
        Watch what they do. That moment — when a real worker starts looking, thinking, and acting — is what you bought.
      </div>
    </div>

    <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;color:#777;text-transform:uppercase;margin-bottom:6px;">Your license key</div>
    <div style="margin:0 0 22px;padding:14px 16px;background:#f5f6f8;color:#1a1d24;border:1px solid #e3e5ea;border-radius:9px;font-family:'SF Mono','Menlo',monospace;font-size:14px;letter-spacing:0.05em;text-align:center;">
      ${escapeHtml(key)}
    </div>

    <div style="font-size:14px;color:#3a3f48;line-height:1.55;">
      <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;color:#777;text-transform:uppercase;margin-bottom:8px;">Install (90 seconds)</div>
      <ol style="margin:0 0 18px;padding-left:20px;">
        <li style="margin-bottom:4px;">Download from <a href="${escapeHtml(downloadUrl)}" style="color:#3070f0;">${escapeHtml(downloadUrl)}</a></li>
        <li style="margin-bottom:4px;">Drag Selam to your Applications folder</li>
        <li style="margin-bottom:4px;">Open Selam — paste your license key</li>
        <li>Connect your AI provider keys (we'll walk you through it)</li>
      </ol>

      <div style="margin:18px 0;padding:13px 14px;background:#f5f6f8;border:1px solid #e3e5ea;border-radius:8px;font-size:12.5px;color:#555;line-height:1.55;">
        <strong>It asks before doing anything risky.</strong> You set the trust scopes — what Selam can do without checking, what always needs your OK. It runs on your Mac and uses your own AI provider accounts (Anthropic, OpenAI, ElevenLabs, Simli) — we never see prompts. Voice defaults to OpenAI (~$4/mo).
      </div>

      <p style="font-size:13px;color:#555;line-height:1.55;margin:0 0 14px;">
        Receipt was sent separately by Stripe. Lost this email? <a href="https://api.heyselam.app/recover" style="color:#3070f0;">Recover your key →</a>
      </p>
    </div>

    <div style="margin-top:24px;padding-top:18px;border-top:1px solid #eef0f3;font-size:13px;color:#555;line-height:1.6;">
      If the first task doesn't land, reply to this email — I want to know why.
    </div>
    <div style="margin-top:8px;font-size:12px;color:#777;line-height:1.55;">
      Or write to <a href="mailto:${SUPPORT_EMAIL}" style="color:#3070f0;">${SUPPORT_EMAIL}</a>.
    </div>
    <div style="margin-top:10px;font-size:10.5px;color:#9aa0a8;line-height:1.55;">
      Sent ${escapeHtml(sentAtIso)} · ${escapeHtml(productSku)}
    </div>

  </div>
</body></html>`;

  return { from, to, subject, html, text };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

module.exports = { buildPurchaseEmailB, FROM_DEFAULT, SUPPORT_EMAIL, DOWNLOAD_URL };
