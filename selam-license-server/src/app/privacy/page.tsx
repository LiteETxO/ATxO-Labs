// Privacy Policy — published copy.
// Source of truth: companion/v2/legal/privacy.md
// If you edit this file, mirror the change to the markdown — and vice versa.

import type { Metadata } from 'next';
import styles from '../legal/legal.module.css';

export const metadata: Metadata = {
  title: 'Privacy Policy — Selam',
  description: 'How Deribe Labs handles data for heyselam.app and the Selam application.',
};

export default function PrivacyPage() {
  return (
    <main className={styles.shell}>
      <div className={styles.container}>
        <a href="https://heyselam.app" className={styles.brand}>Selam</a>
        <h1 className={styles.h1}>Privacy Policy</h1>
        <p className={styles.effective}>Effective: May 2026 · Deribe Labs</p>

        <div className={styles.body}>
          <h2>1. Who we are</h2>
          <p>
            <strong>Deribe Labs</strong> (&ldquo;Deribe,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) is the developer of Selam, a personal AI companion for macOS distributed at heyselam.app. This Privacy Policy explains what data we collect when you visit heyselam.app, purchase a license, or use the Selam application.
          </p>
          <p>If you have questions, contact <a href="mailto:support@heyselam.app">support@heyselam.app</a>.</p>

          <h2>2. What this Policy covers</h2>
          <p>This Policy applies to:</p>
          <ul>
            <li>the marketing website at <strong>heyselam.app</strong></li>
            <li>the license services at <strong>api.heyselam.app</strong> (validation, recovery, purchase)</li>
            <li>the <strong>Selam desktop application</strong> for macOS</li>
          </ul>
          <p>It does <em>not</em> cover the third-party AI providers your copy of Selam connects to with your own API keys — those are governed by their own privacy policies (see Section 6).</p>

          <h2>3. Information we collect</h2>
          <h3>3.1 Information you give us</h3>
          <ul>
            <li><strong>Purchase information</strong> (when you buy a license): your email address, billing address, country, and Stripe-issued tax identifiers. Payment card details go directly to Stripe — we never see or store them.</li>
            <li><strong>Support correspondence</strong>: any email you send to support@heyselam.app.</li>
          </ul>

          <h3>3.2 Information collected automatically</h3>
          <ul>
            <li><strong>License validation</strong>: when the Selam app launches, it makes an HTTPS request to api.heyselam.app/validate carrying your license key so we can confirm the key is active. We log the request timestamp and source IP for fraud prevention; we do <strong>not</strong> store the IP long-term.</li>
            <li><strong>Update checks</strong>: when the Selam app checks for updates, it makes an HTTPS request to updates.heyselam.app for a manifest. Server logs capture standard request metadata (URL, IP, user-agent) for ~30 days.</li>
          </ul>

          <h3>3.3 Information we deliberately do NOT collect</h3>
          <ul>
            <li><strong>Your conversations.</strong> Voice input, transcripts, and AI responses remain on your device or in your own AI provider accounts (Anthropic, OpenAI, ElevenLabs, Simli, etc.). Selam does not transmit them to Deribe.</li>
            <li><strong>Your screen captures or webcam frames.</strong> Vision features process these locally and send them only to the AI provider you&apos;ve configured.</li>
            <li><strong>Behavioural analytics.</strong> We do not embed any client-side analytics trackers (no Google Analytics, no Mixpanel, no Segment, no fingerprinting libraries).</li>
          </ul>

          <h2>4. How we use information</h2>
          <p>We process the data above to:</p>
          <ul>
            <li>deliver the licenses you purchase,</li>
            <li>validate your active license at app launch,</li>
            <li>recover your license key when you ask via heyselam.app/recover,</li>
            <li>fulfil tax and accounting obligations on the sale (invoices, VAT/GST),</li>
            <li>respond to your support requests,</li>
            <li>detect and respond to fraud or abuse,</li>
            <li>comply with applicable laws.</li>
          </ul>
          <p>Under GDPR Article 6, our legal bases are:</p>
          <ul>
            <li><strong>Contractual necessity</strong> for license issuance, validation, and recovery</li>
            <li><strong>Legal obligation</strong> for tax records and invoice retention</li>
            <li><strong>Legitimate interest</strong> for fraud prevention and security logging</li>
          </ul>

          <h2>5. How long we keep it</h2>
          <ul>
            <li><strong>License records</strong> (key, email, status, Stripe session ID): kept for the lifetime of the license and for <strong>7 years</strong> after revocation or refund, to satisfy tax/accounting record-keeping requirements.</li>
            <li><strong>Server access logs</strong> (IPs, timestamps): <strong>30 days</strong>, then deleted.</li>
            <li><strong>Support email</strong>: <strong>2 years</strong> from the last reply, then deleted.</li>
          </ul>

          <h2>6. Third parties (sub-processors)</h2>
          <p>We use the following third parties to deliver the service. None of them have access to your conversations or device data.</p>
          <table>
            <thead>
              <tr><th>Vendor</th><th>Purpose</th><th>Region</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>Stripe, Inc.</strong></td><td>Payment processing, tax invoicing</td><td>US (with EU presence)</td></tr>
              <tr><td><strong>Resend, Inc.</strong></td><td>Transactional email (purchase, recovery)</td><td>US</td></tr>
              <tr><td><strong>Vercel, Inc.</strong></td><td>Web + API hosting</td><td>Global edge</td></tr>
              <tr><td><strong>Cloudflare, Inc.</strong></td><td>DMG and update file delivery (CDN)</td><td>Global edge</td></tr>
            </tbody>
          </table>
          <p>Your local copy of Selam connects directly to AI providers using API keys you provide (Anthropic, OpenAI, ElevenLabs, Simli, DeepSeek, Google Gemini). Their privacy policies govern those interactions.</p>

          <h2>7. International transfers</h2>
          <p>Our servers and sub-processors are based primarily in the United States. If you access Selam from the EU/EEA or UK, your data is transferred to the US under Standard Contractual Clauses (SCCs) and, where applicable, the EU-US Data Privacy Framework.</p>

          <h2>8. Your rights</h2>
          <p>Depending on where you live, you may have the right to:</p>
          <ul>
            <li><strong>Access</strong> the personal data we hold about you</li>
            <li><strong>Correct</strong> inaccurate personal data</li>
            <li><strong>Delete</strong> your personal data (subject to our legal retention obligations)</li>
            <li><strong>Restrict</strong> or <strong>object</strong> to certain processing</li>
            <li><strong>Receive a copy</strong> of your data in a portable format</li>
            <li><strong>Withdraw consent</strong> where processing is based on consent</li>
            <li><strong>Lodge a complaint</strong> with your local data-protection authority</li>
          </ul>
          <p>If you&apos;re in California, the CCPA/CPRA grants additional rights including the right to know what personal information is sold or shared (we don&apos;t sell personal information).</p>
          <p>To exercise any of these rights, email <a href="mailto:support@heyselam.app">support@heyselam.app</a>. We respond within 30 days.</p>

          <h2>9. Cookies</h2>
          <p>heyselam.app and api.heyselam.app use only the minimal cookies required to keep the site working (session, CSRF). We do not use advertising or tracking cookies. The Selam desktop application does not use cookies.</p>

          <h2>10. Children</h2>
          <p>Selam is not intended for children under 16, and we do not knowingly collect personal data from children. If you believe a child has provided us with personal data, contact us and we&apos;ll delete it.</p>

          <h2>11. Changes to this Policy</h2>
          <p>We may update this Policy from time to time. Material changes will be announced on heyselam.app and via email to active license holders at least 30 days before they take effect.</p>

          <h2>12. Contact</h2>
          <p>
            Deribe Labs<br />
            <a href="mailto:support@heyselam.app">support@heyselam.app</a>
          </p>
        </div>

        <div className={styles.footer}>
          See also: <a href="/terms" style={{ color: '#50b4ff' }}>Terms of Service</a> · <a href="https://heyselam.app/eula" style={{ color: '#50b4ff' }}>EULA</a>
        </div>
      </div>
    </main>
  );
}
