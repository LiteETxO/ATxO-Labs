// ─── Recovery email template ─────────────────────────────────────────
//
// Pure template — returns { subject, html, text }. The mailer adapter
// (Resend / Postmark / SES / etc) is responsible for actually sending.
//
// Two versions of the body so plain-text clients render properly. Keep
// the styles minimal — most email clients ignore <head> CSS anyway.

const FROM_DEFAULT       = 'Selam <support@heyselam.app>';
const SUPPORT_EMAIL      = 'support@heyselam.app';
const DOWNLOAD_URL       = 'https://api.heyselam.app/download';
const PRODUCT_NAME       = 'Selam';

function buildRecoveryEmail({ to, keys, sentAt = new Date(), from = FROM_DEFAULT }) {
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new Error('buildRecoveryEmail requires at least one key');
  }
  const sentAtIso = sentAt instanceof Date ? sentAt.toISOString() : new Date(sentAt).toISOString();

  // Single key — most common case. Multi-key (rare — a buyer with two
  // purchases) keeps the template clean by listing all of them.
  const isMulti = keys.length > 1;
  const subject = isMulti
    ? `Your ${PRODUCT_NAME} license keys`
    : `Your ${PRODUCT_NAME} license key`;

  const keyLinesText = keys.map((k, i) => {
    const label = isMulti ? `Key ${i + 1}: ` : '';
    return `${label}${k.key}`;
  }).join('\n');

  const keyLinesHtml = keys.map((k, i) => {
    const label = isMulti ? `<div style="font-size:12px;color:#777;margin-bottom:4px;">Key ${i + 1}</div>` : '';
    return `
      <div style="margin:14px 0;padding:14px 16px;background:#f5f6f8;border:1px solid #e3e5ea;border-radius:8px;font-family:'SF Mono','Menlo',monospace;font-size:14px;letter-spacing:0.04em;">
        ${label}${escapeHtml(k.key)}
      </div>
    `.trim();
  }).join('\n');

  const text = `Hi,

You requested your ${PRODUCT_NAME} license ${isMulti ? 'keys' : 'key'}. Here ${isMulti ? 'they are' : 'it is'}:

${keyLinesText}

To activate:
  1. Download Selam from ${DOWNLOAD_URL}
  2. Open the app and paste your license key when prompted

If you didn't request this, you can ignore this email — your key hasn't changed.

Need help? Reply to this email or write to ${SUPPORT_EMAIL}.

— The Selam team
sent ${sentAtIso}
`;

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#fafbfc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1d24;">
  <div style="max-width:560px;margin:24px auto;padding:24px 28px;background:#fff;border-radius:14px;border:1px solid #e3e5ea;">
    <div style="font-size:20px;font-weight:700;letter-spacing:-0.01em;margin-bottom:16px;">${PRODUCT_NAME}</div>
    <div style="font-size:14px;line-height:1.55;color:#3a3f48;">
      <p>You requested your ${PRODUCT_NAME} license ${isMulti ? 'keys' : 'key'}. Here ${isMulti ? 'they are' : 'it is'}:</p>
      ${keyLinesHtml}
      <p style="margin-top:18px;">To activate:</p>
      <ol style="margin:8px 0;padding-left:20px;">
        <li>Download Selam from <a href="${DOWNLOAD_URL}" style="color:#3070f0;">${DOWNLOAD_URL}</a></li>
        <li>Open the app and paste your license key when prompted</li>
      </ol>
      <p style="color:#777;font-size:12.5px;margin-top:18px;">If you didn't request this, you can ignore this email — your key hasn't changed.</p>
      <p style="color:#777;font-size:12.5px;">Need help? Reply to this email or write to <a href="mailto:${SUPPORT_EMAIL}" style="color:#3070f0;">${SUPPORT_EMAIL}</a>.</p>
    </div>
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #eef0f3;font-size:11px;color:#9aa0a8;">
      Sent ${escapeHtml(sentAtIso)}.
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

module.exports = { buildRecoveryEmail, FROM_DEFAULT, SUPPORT_EMAIL };
