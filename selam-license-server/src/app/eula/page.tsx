// EULA — published copy.
// Source of truth: electron-shell/EULA.md (bundled in the desktop app).
// If you change EULA.md, mirror the change here. The Terms of Service
// references heyselam.app/eula → this page.
//
// We render statically — no client interactivity needed.

import type { Metadata } from 'next';
import styles from '../legal/legal.module.css';

export const metadata: Metadata = {
  title: 'End-User License Agreement — Selam',
  description: 'Software license terms for the Selam macOS application.',
};

export default function EulaPage() {
  return (
    <main className={styles.shell}>
      <div className={styles.container}>
        <a href="https://heyselam.app" className={styles.brand}>Selam</a>
        <h1 className={styles.h1}>End-User License Agreement</h1>
        <p className={styles.effective}>Effective: May 2026 · Deribe Labs</p>

        <div className={styles.body}>
          <p>
            This End-User License Agreement (the &ldquo;Agreement&rdquo;) is a binding contract between you (the &ldquo;User&rdquo;) and <strong>Deribe Labs</strong> (&ldquo;Deribe,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) governing your use of the Selam application, including the desktop client, hosted services, documentation, and any updates thereto (collectively, the &ldquo;Software&rdquo;). By installing, copying, or otherwise using the Software, you agree to be bound by this Agreement. If you do not agree, do not install or use the Software.
          </p>

          <h2>1. License Grant</h2>
          <p>Subject to your continued compliance with this Agreement and timely payment of any applicable fees, Deribe grants you a non-exclusive, non-transferable, revocable license to install and use one (1) copy of the Software on a Mac computer that you personally own or control, solely for your personal, non-commercial purposes (or, if purchased under a business license, the licensed seat count).</p>

          <h2>2. Ownership</h2>
          <p>The Software is licensed, not sold. Deribe retains all right, title, and interest in and to the Software, including all intellectual property rights therein, except for the limited rights granted to you above. You acquire no ownership interest in the Software by installing or using it. The Software incorporates third-party open-source components, each governed by their respective licenses; nothing in this Agreement modifies those licenses.</p>

          <h2>3. Restrictions</h2>
          <p>You shall not, and shall not permit any third party to:</p>
          <p>(a) <strong>Reverse-engineer, decompile, disassemble, or otherwise attempt to derive the source code, system prompts, prompt-engineering structure, or trade secrets of the Software</strong>, except to the extent such restriction is expressly prohibited by applicable law;</p>
          <p>(b) <strong>Modify, adapt, translate, or create derivative works of the Software</strong>, including but not limited to altering or removing the Selam brand, &ldquo;Powered by&rdquo; attributions, or any embedded brand-discipline rules;</p>
          <p>(c) <strong>Copy, redistribute, sublicense, lease, rent, sell, or otherwise transfer</strong> the Software or any portion thereof, including the embedded prompts, configuration templates, persona files, or workspace defaults;</p>
          <p>(d) <strong>Use the Software, its prompts, or any portion of its design to develop, train, or improve a competing product</strong> or service that materially replicates the Software&apos;s user-facing experience, system architecture, or persona-engineering approach;</p>
          <p>(e) Remove, alter, or obscure any proprietary notices, labels, marks, or attributions in or on the Software, including the &ldquo;Selam&rdquo; wordmark, the heyselam.app reference, or the &ldquo;powered by openclaw&rdquo; attribution;</p>
          <p>(f) Use the Software in violation of applicable laws, including export control, privacy, and consumer-protection laws, or to violate the rights of any third party;</p>
          <p>(g) Use the Software to send unsolicited messages, abuse messaging-channel terms of service (including WhatsApp, Telegram, iMessage), or operate the agent for harassment, fraud, or any unlawful purpose.</p>

          <h2>4. Bring-Your-Own-Keys (BYOK)</h2>
          <p>The Software is designed for you to provide your own credentials with third-party providers (Anthropic, ElevenLabs, Simli, DeepSeek, Google, etc.). You are solely responsible for those provider accounts, fees, terms of service, and use compliance. Deribe does not custody, view, or transmit your provider keys to any Deribe-controlled service except as needed to validate them at setup.</p>

          <h2>5. Privacy</h2>
          <p>Your conversations, voice data, and generated content remain on your device or in your provider accounts. Deribe collects only minimal telemetry needed to operate the license and update systems (license validation, version-update checks). Full details: <a href="/privacy">heyselam.app/privacy</a>.</p>

          <h2>6. Updates</h2>
          <p>Deribe may release updates or new versions of the Software. Updates are delivered via new DMG releases. You agree that Deribe has no obligation to maintain compatibility with prior versions, and that this Agreement governs all updates unless explicitly superseded.</p>

          <h2>7. Termination</h2>
          <p>This Agreement and your license terminate automatically if you breach any term, including the restrictions in Section 3. Deribe may also terminate by revoking your license key in cases of suspected abuse, payment default, or violation. Upon termination, you must uninstall and destroy all copies of the Software in your possession.</p>

          <h2>8. Disclaimer of Warranties</h2>
          <p>THE SOFTWARE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE,&rdquo; WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR ACCURACY. The Software relies on third-party AI models, voice services, and messaging platforms whose outputs may be incorrect, biased, or otherwise unsuitable. You assume all risk arising from your use of the Software and from any reliance on its outputs.</p>

          <h2>9. Limitation of Liability</h2>
          <p>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT WILL Deribe BE LIABLE FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL, OR EXEMPLARY DAMAGES, OR FOR LOST PROFITS, REVENUE, DATA, OR GOODWILL, ARISING OUT OF OR RELATED TO THE SOFTWARE, EVEN IF Deribe HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. Deribe&apos;S AGGREGATE LIABILITY UNDER THIS AGREEMENT WILL NOT EXCEED THE AMOUNT YOU PAID FOR THE SOFTWARE IN THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM.</p>

          <h2>10. Governing Law</h2>
          <p>This Agreement is governed by the laws of the State of Delaware, USA, without regard to its conflict-of-laws principles. Any dispute arising under this Agreement will be resolved exclusively in the state or federal courts of Delaware, and you consent to personal jurisdiction in those courts.</p>

          <h2>11. Entire Agreement</h2>
          <p>This Agreement constitutes the entire agreement between you and Deribe regarding the Software, superseding any prior or contemporaneous communications. If any provision is held unenforceable, the remaining provisions remain in full force.</p>

          <h2>12. Contact</h2>
          <p>Questions about this Agreement: <a href="mailto:support@heyselam.app">support@heyselam.app</a></p>

          <hr style={{ border: 0, borderTop: '1px solid rgba(255,255,255,0.06)', margin: '32px 0' }} />

          <p style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.45)' }}>
            By clicking &ldquo;I Accept&rdquo; in the application you confirm that you have read, understood, and agreed to be bound by this Agreement.
          </p>
        </div>

        <div className={styles.footer}>
          See also: <a href="/privacy" style={{ color: '#50b4ff' }}>Privacy Policy</a> · <a href="/terms" style={{ color: '#50b4ff' }}>Terms of Service</a>
        </div>
      </div>
    </main>
  );
}
