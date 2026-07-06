// Terms of Service — published copy.
// Source of truth: companion/v2/legal/terms.md
// If you edit this file, mirror the change to the markdown — and vice versa.

import type { Metadata } from 'next';
import styles from '../legal/legal.module.css';

export const metadata: Metadata = {
  title: 'Terms of Service — Selam',
  description: 'Terms governing heyselam.app, api.heyselam.app, and Selam license purchases.',
};

export default function TermsPage() {
  return (
    <main className={styles.shell}>
      <div className={styles.container}>
        <a href="https://heyselam.app" className={styles.brand}>Selam</a>
        <h1 className={styles.h1}>Terms of Service</h1>
        <p className={styles.effective}>Effective: May 2026 · Deribe Labs</p>

        <div className={styles.body}>
          <p>
            These Terms of Service (&ldquo;Terms&rdquo;) govern your use of the website at <strong>heyselam.app</strong>, the API services at <strong>api.heyselam.app</strong>, and the purchase flow for the Selam application. The desktop application itself is governed by the separate <strong>End-User License Agreement</strong> (&ldquo;EULA&rdquo;) shown to you when you first install Selam.
          </p>
          <p>
            By using heyselam.app or purchasing a Selam license, you agree to these Terms. If you do not agree, do not use the site or buy the product.
          </p>

          <h2>1. Who we are</h2>
          <p><strong>Deribe Labs</strong> (&ldquo;Deribe,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;). Contact: <a href="mailto:support@heyselam.app">support@heyselam.app</a>.</p>

          <h2>2. The Service</h2>
          <p>heyselam.app is a marketing website where you can read about Selam and purchase a license. api.heyselam.app provides license validation, license-key recovery, and post-purchase email delivery.</p>
          <p>The Selam desktop application is licensed separately under the EULA visible at <a href="https://heyselam.app/eula">https://heyselam.app/eula</a> and shown in the app on first launch.</p>

          <h2>3. License purchases</h2>
          <p>When you purchase a Selam license:</p>
          <ul>
            <li><strong>One license = one Mac you personally own or control</strong> (or, for business purchases, the seat count you bought).</li>
            <li>Payment is processed by Stripe. We do not store payment card details.</li>
            <li>Your license key is delivered by email to the address you used at checkout. You can recover it later at heyselam.app/recover.</li>
            <li>The license is governed by the EULA.</li>
          </ul>

          <h2>4. Pricing and tax</h2>
          <p>Prices are shown at heyselam.app/buy and include applicable VAT/GST/sales tax based on your billing location. Tax is calculated and collected by Stripe on our behalf in jurisdictions where we are registered.</p>

          <h2>5. Refund policy</h2>
          <p>You can request a full refund within <strong>14 days</strong> of purchase by writing to <a href="mailto:support@heyselam.app">support@heyselam.app</a> from the email address you used at checkout. Refunds are processed within 7 business days; your license key will be revoked at the time of refund.</p>
          <p>If you are an EU/EEA/UK consumer purchasing for personal use, this 14-day window also satisfies your statutory right of withdrawal.</p>
          <p>After 14 days, refunds are at our discretion.</p>

          <h2>6. Acceptable use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>use Selam for any illegal purpose,</li>
            <li>redistribute, resell, or sublicense your license key,</li>
            <li>use Selam to send unsolicited messages, spam, or violate the terms of any messaging platform (WhatsApp, Telegram, iMessage, Signal, etc.),</li>
            <li>use Selam for fraud, harassment, or to impersonate a person,</li>
            <li>attempt to reverse-engineer the application beyond what applicable law expressly permits, or</li>
            <li>circumvent our license validation, update mechanism, or fraud prevention systems.</li>
          </ul>
          <p>The full restrictions are set out in Section 3 of the EULA.</p>

          <h2>7. Termination</h2>
          <p>We may suspend or terminate your access to heyselam.app or revoke your license key if you breach these Terms or the EULA. We may also revoke a license key in cases of payment chargebacks or confirmed fraud.</p>
          <p>You may stop using Selam at any time by uninstalling the application.</p>

          <h2>8. Bring-your-own-keys (BYOK)</h2>
          <p>Selam connects to third-party AI providers (Anthropic, OpenAI, ElevenLabs, Simli, DeepSeek, Google Gemini, etc.) using API keys you provide. You are responsible for those provider accounts, fees, and their respective terms of service. Deribe is not a party to those contracts and is not liable for charges or actions taken under your provider accounts.</p>

          <h2>9. Disclaimer of warranties</h2>
          <p>heyselam.app and api.heyselam.app are provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranty of any kind, express or implied.</p>
          <p>The Selam desktop application is provided under the warranty terms of the EULA (Section 8).</p>
          <p>We do not warrant that the AI outputs produced via Selam will be accurate, complete, appropriate, or fit for any particular purpose. You assume all risk arising from your use of the application and your reliance on its outputs.</p>

          <h2>10. Limitation of liability</h2>
          <p>To the maximum extent permitted by law, Deribe will not be liable for any indirect, incidental, consequential, special, or exemplary damages, or for lost profits, revenue, data, or goodwill, arising out of or related to your use of heyselam.app or the Service. Deribe&apos;s aggregate liability will not exceed the amount you paid us in the twelve (12) months preceding the event giving rise to the claim.</p>
          <p>Some jurisdictions do not allow the exclusion of certain warranties or the limitation or exclusion of liability for incidental or consequential damages, so the above limitations may not apply in full.</p>

          <h2>11. Indemnification</h2>
          <p>You agree to indemnify and hold Deribe harmless from any claims, damages, or expenses (including reasonable legal fees) arising out of your violation of these Terms, your misuse of the Service, or your infringement of any third party&apos;s rights.</p>

          <h2>12. Changes to these Terms</h2>
          <p>We may update these Terms from time to time. Material changes will be announced on heyselam.app at least 30 days before they take effect. Continued use after the effective date constitutes acceptance.</p>

          <h2>13. Privacy</h2>
          <p>Your privacy is governed by our <a href="/privacy">Privacy Policy</a>.</p>

          <h2>14. Governing law</h2>
          <p>These Terms are governed by the laws of the State of Delaware, USA, without regard to its conflict-of-laws principles. Any dispute arising under these Terms will be resolved exclusively in the state or federal courts of Delaware, and you consent to personal jurisdiction in those courts.</p>
          <p>If you are a consumer in the EU/EEA/UK, this choice of law does not deprive you of the protections afforded by mandatory provisions of your country of residence.</p>

          <h2>15. Entire agreement</h2>
          <p>These Terms (together with the EULA and Privacy Policy) constitute the entire agreement between you and Deribe regarding heyselam.app and the Service. If any provision is held unenforceable, the remaining provisions remain in full force.</p>

          <h2>16. Contact</h2>
          <p>
            Deribe Labs<br />
            <a href="mailto:support@heyselam.app">support@heyselam.app</a>
          </p>
        </div>

        <div className={styles.footer}>
          See also: <a href="/privacy" style={{ color: '#50b4ff' }}>Privacy Policy</a> · <a href="https://heyselam.app/eula" style={{ color: '#50b4ff' }}>EULA</a>
        </div>
      </div>
    </main>
  );
}
