// ─── Beta tester invitation email ───────────────────────────────────
//
// Sent by scripts/send-beta-build.ts when handing out comp keys to the
// pre-launch tester pool (LAUNCH item S3). Pure template — returns
// { from, to, subject, html, text }.
//
// Different from purchase.js in three ways:
//   1. Acknowledges this is a beta and asks for feedback
//   2. Sets expectations: bugs welcome, reply with what breaks
//   3. Lists the specific build version they're testing so reports are
//      attributable to a build
//
// Keep concise — beta testers are doing us a favor; long emails feel
// like homework.

const FROM_DEFAULT  = 'Selam <support@heyselam.app>';
const SUPPORT_EMAIL = 'support@heyselam.app';
const PRODUCT_NAME  = 'Selam';

function buildBetaInviteEmail({
  to,
  key,
  buildVersion,
  downloadUrl,
  testerName = null,
  feedbackUrl = null,
  sentAt = new Date(),
  from = FROM_DEFAULT,
}) {
  if (!to)           throw new Error('buildBetaInviteEmail requires a recipient email');
  if (!key)          throw new Error('buildBetaInviteEmail requires a license key');
  if (!buildVersion) throw new Error('buildBetaInviteEmail requires a buildVersion (e.g. "1.0.0-beta.3")');
  if (!downloadUrl)  throw new Error('buildBetaInviteEmail requires a downloadUrl (signed DMG)');

  const sentAtIso = sentAt instanceof Date ? sentAt.toISOString() : new Date(sentAt).toISOString();
  const greeting  = testerName ? `Hey ${testerName},` : 'Hey,';
  const subject   = `${PRODUCT_NAME} ${buildVersion} — your beta build is ready`;

  const text = `${greeting}

You're on the ${PRODUCT_NAME} beta. Thanks for jumping in early.

Build:    ${buildVersion}
Download: ${downloadUrl}

Your license key:

  ${key}

To get started:
  1. Download the DMG above
  2. Drag Selam to your Applications folder
  3. Open Selam — paste your license key when prompted
  4. Connect your AI provider keys (we'll walk you through it)

What we want from you:

  - Try it for 15-20 minutes. Voice, vision, the full wizard.
  - When something breaks, reply to this email with what you saw and
    what build you're on (${buildVersion}).${feedbackUrl ? `
  - Or drop notes in: ${feedbackUrl}` : ''}

This is a pre-release — bugs are expected and reports are gold. Your
key works through launch, so anything you find now is a fix that ships
to real buyers later.

— The Selam team
sent ${sentAtIso}
build ${buildVersion}
`;

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#fafbfc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1d24;">
  <div style="max-width:560px;margin:24px auto;padding:24px 28px;background:#fff;border-radius:14px;border:1px solid #e3e5ea;">

    <div style="font-size:11px;font-weight:700;letter-spacing:0.18em;color:#3070f0;text-transform:uppercase;margin-bottom:18px;">${PRODUCT_NAME} BETA</div>

    <h1 style="font-size:22px;font-weight:700;letter-spacing:-0.01em;margin:0 0 6px;">${escapeHtml(greeting)}</h1>
    <p style="font-size:14px;color:#3a3f48;line-height:1.55;margin:0 0 22px;">
      You're on the ${PRODUCT_NAME} beta. Thanks for jumping in early.
    </p>

    <div style="margin:0 0 18px;padding:13px 14px;background:#f5f6f8;border:1px solid #e3e5ea;border-radius:8px;font-size:13px;color:#3a3f48;line-height:1.7;">
      <div><strong>Build:</strong> <span style="font-family:'SF Mono','Menlo',monospace;">${escapeHtml(buildVersion)}</span></div>
      <div><strong>Download:</strong> <a href="${escapeHtml(downloadUrl)}" style="color:#3070f0;word-break:break-all;">${escapeHtml(downloadUrl)}</a></div>
    </div>

    <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;color:#777;text-transform:uppercase;margin-bottom:6px;">Your license key</div>
    <div style="margin:0 0 22px;padding:14px 16px;background:#0e0e14;color:#f2f2f2;border-radius:9px;font-family:'SF Mono','Menlo',monospace;font-size:15px;letter-spacing:0.05em;text-align:center;">
      ${escapeHtml(key)}
    </div>

    <div style="font-size:14px;color:#3a3f48;line-height:1.55;">
      <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;color:#777;text-transform:uppercase;margin-bottom:8px;">Activate</div>
      <ol style="margin:0 0 18px;padding-left:20px;">
        <li style="margin-bottom:4px;">Download the DMG above</li>
        <li style="margin-bottom:4px;">Drag Selam to your Applications folder</li>
        <li style="margin-bottom:4px;">Open Selam — paste your license key when prompted</li>
        <li>Connect your AI provider keys (we'll walk you through it)</li>
      </ol>

      <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;color:#777;text-transform:uppercase;margin-bottom:8px;">What we want from you</div>
      <ul style="margin:0 0 18px;padding-left:20px;">
        <li style="margin-bottom:4px;">Try it for 15-20 minutes. Voice, vision, the full wizard.</li>
        <li style="margin-bottom:4px;">Reply to this email when something breaks — include build <code style="font-family:'SF Mono','Menlo',monospace;background:#eef0f3;padding:1px 5px;border-radius:4px;font-size:12px;">${escapeHtml(buildVersion)}</code>${feedbackUrl ? `</li>
        <li>Or drop notes in <a href="${escapeHtml(feedbackUrl)}" style="color:#3070f0;">our feedback doc</a>` : ''}</li>
      </ul>

      <div style="margin:18px 0;padding:13px 14px;background:#fff7e6;border:1px solid #f0d9a3;border-radius:8px;font-size:12.5px;color:#5a4a20;line-height:1.55;">
        <strong>This is a pre-release.</strong> Bugs are expected and reports are gold. Your key works through launch, so anything you find now is a fix that ships to real buyers later.
      </div>
    </div>

    <div style="margin-top:24px;padding-top:18px;border-top:1px solid #eef0f3;font-size:12px;color:#777;line-height:1.55;">
      Questions? Reply to this email or write to <a href="mailto:${SUPPORT_EMAIL}" style="color:#3070f0;">${SUPPORT_EMAIL}</a>.
    </div>
    <div style="margin-top:10px;font-size:10.5px;color:#9aa0a8;line-height:1.55;">
      Sent ${escapeHtml(sentAtIso)} · build ${escapeHtml(buildVersion)}
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

module.exports = { buildBetaInviteEmail, FROM_DEFAULT, SUPPORT_EMAIL };
