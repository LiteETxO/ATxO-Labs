// ─── Purchase confirmation email ─────────────────────────────────────
//
// Sent by /api/stripe/webhook on checkout.session.completed.
// Mirrors the shape and tone of email-templates/recovery.js.
//
// Pure template — returns { from, to, subject, html, text }. The mailer
// (Resend) is responsible for delivery.
//
// Design intent:
//   - First impression of the product. Clean, confident, brief.
//   - License key prominent — what the buyer is here for.
//   - Activation steps numbered, friction-free.
//   - Receipt info noted (Stripe email is separate; we mention so they
//     don't think they're missing one).
//   - Support contact at the bottom — visible but not loud.

const FROM_DEFAULT  = 'Selam <support@heyselam.app>';
const SUPPORT_EMAIL = 'support@heyselam.app';
const DOWNLOAD_URL  = 'https://api.heyselam.app/download';
const PRODUCT_NAME  = 'Selam';

function buildPurchaseEmail({
  to,
  key,
  productSku = 'selam-v1',
  downloadUrl = DOWNLOAD_URL,
  sentAt = new Date(),
  from = FROM_DEFAULT,
}) {
  if (!to)  throw new Error('buildPurchaseEmail requires a recipient email');
  if (!key) throw new Error('buildPurchaseEmail requires a license key');

  const sentAtIso = sentAt instanceof Date ? sentAt.toISOString() : new Date(sentAt).toISOString();
  const subject = `${PRODUCT_NAME} is ready — your AI worker for Mac`;

  const text = `Welcome to ${PRODUCT_NAME} — your AI worker for Mac.

Your license key:

  ${key}

To get them working:
  1. Download Selam from ${downloadUrl}
  2. Drag Selam to your Applications folder
  3. Open Selam — paste your license key when prompted
  4. Connect your AI provider keys (we'll walk you through it)
  5. Ask them: "Look at my screen and tell me one thing I should do about it."

Your purchase receipt was sent separately by Stripe. If you don't see it,
check your spam folder or write to ${SUPPORT_EMAIL}.

A couple of things worth knowing:
  - Selam runs on your Mac. It talks to your own AI provider accounts
    (Anthropic, OpenAI, ElevenLabs, Simli) — we never see your prompts
    or what they do.
  - It asks before doing anything risky. You set the trust scopes — what
    it can do without checking, what always needs your OK.
  - Voice defaults to OpenAI (~$4/month typical use). Switch any time
    in Settings.

If you ever lose this email, you can recover your key at:
  https://api.heyselam.app/recover

Need help? Reply to this email or write to ${SUPPORT_EMAIL}.

— The Selam team
sent ${sentAtIso}
sku ${productSku}
`;

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#fafbfc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1d24;">
  <div style="max-width:560px;margin:24px auto;padding:24px 28px;background:#fff;border-radius:14px;border:1px solid #e3e5ea;">

    <div style="font-size:11px;font-weight:700;letter-spacing:0.18em;color:#3070f0;text-transform:uppercase;margin-bottom:18px;">${PRODUCT_NAME}</div>

    <h1 style="font-size:22px;font-weight:700;letter-spacing:-0.01em;margin:0 0 6px;">Welcome to ${PRODUCT_NAME}.</h1>
    <p style="font-size:14px;color:#3a3f48;line-height:1.55;margin:0 0 22px;">
      Your AI worker for Mac is ready. Here's everything you need to put them to work.
    </p>

    <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;color:#777;text-transform:uppercase;margin-bottom:6px;">Your license key</div>
    <div style="margin:0 0 22px;padding:14px 16px;background:#0e0e14;color:#f2f2f2;border-radius:9px;font-family:'SF Mono','Menlo',monospace;font-size:15px;letter-spacing:0.05em;text-align:center;">
      ${escapeHtml(key)}
    </div>

    <div style="font-size:14px;color:#3a3f48;line-height:1.55;">
      <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;color:#777;text-transform:uppercase;margin-bottom:8px;">Get them working in 60 seconds</div>
      <ol style="margin:0 0 18px;padding-left:20px;">
        <li style="margin-bottom:5px;">Download <strong>${PRODUCT_NAME}</strong> from <a href="${escapeHtml(downloadUrl)}" style="color:#3070f0;">${escapeHtml(downloadUrl)}</a></li>
        <li style="margin-bottom:5px;">Drag Selam to your Applications folder</li>
        <li style="margin-bottom:5px;">Open Selam — paste your license key when prompted</li>
        <li style="margin-bottom:5px;">Connect your AI provider keys (we'll walk you through it)</li>
        <li>Ask: <em>"Look at my screen and tell me one thing I should do about it."</em></li>
      </ol>

      <div style="margin:18px 0;padding:13px 14px;background:#f5f6f8;border:1px solid #e3e5ea;border-radius:8px;font-size:12.5px;color:#555;line-height:1.55;">
        <strong>It asks before doing anything risky.</strong> You set the trust scopes — what Selam can do without checking, what always needs your OK. It runs on your Mac and talks to your own AI provider accounts; we never see your prompts or what it does.
      </div>

      <p style="font-size:13px;color:#555;line-height:1.55;margin:0 0 14px;">
        Your purchase receipt was sent separately by Stripe. If you don't see it, check your spam folder.
      </p>

      <p style="font-size:13px;color:#555;line-height:1.55;margin:0 0 14px;">
        Lost this email? Recover your key at <a href="https://api.heyselam.app/recover" style="color:#3070f0;">api.heyselam.app/recover</a>.
      </p>
    </div>

    <div style="margin-top:24px;padding-top:18px;border-top:1px solid #eef0f3;font-size:12px;color:#777;line-height:1.55;">
      Need help? Reply to this email or write to <a href="mailto:${SUPPORT_EMAIL}" style="color:#3070f0;">${SUPPORT_EMAIL}</a>.
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

module.exports = { buildPurchaseEmail, FROM_DEFAULT, SUPPORT_EMAIL, DOWNLOAD_URL };
