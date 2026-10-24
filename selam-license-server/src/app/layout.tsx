import type { Metadata } from 'next';
import Script from 'next/script';

// Site-wide defaults. Per-page metadata exports override these.
export const metadata: Metadata = {
  metadataBase: new URL('https://api.heyselam.app'),
  title: {
    default: 'Selam',
    template: '%s — Selam',
  },
  description: 'Selam — an AI worker that lives on your Mac. Reads your screen, drafts your messages, handles your inbox. Asks before doing anything risky. heyselam.app',
  applicationName: 'Selam',
  keywords: ['Selam', 'AI worker', 'AI agent', 'Mac', 'autonomous AI', 'AI assistant', 'BYOK'],
  authors: [{ name: 'Deribe Labs' }],
  creator: 'Deribe Labs',
  publisher: 'Deribe Labs',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    type: 'website',
    siteName: 'Selam',
    title: 'Selam — an AI worker that lives on your Mac',
    description: 'Reads your screen, drafts your messages, handles your inbox — across WhatsApp, Telegram, and iMessage. With a face, voice, and name you choose. Asks before doing anything risky.',
    url: 'https://heyselam.app',
    locale: 'en_US',
    // images: [{ url: '/og-default.png', width: 1200, height: 630, alt: 'Selam' }],
    // ^ Add a 1200x630 PNG to public/ when you have one. Falls through cleanly without it.
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Selam — an AI worker that lives on your Mac',
    description: 'Reads your screen, drafts your messages, handles your inbox. Asks before doing anything risky.',
  },
  alternates: {
    canonical: 'https://heyselam.app',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0e0e14' }}>
        {/* Google tag (gtag.js) — Google Ads AW-18504105411 + cross-domain linking */}
        <Script src="https://www.googletagmanager.com/gtag/js?id=AW-18504105411" strategy="afterInteractive" />
        <Script id="gtag-init" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'AW-18504105411', { 'linker': { 'domains': ['heyselam.ai','heyselam.app','api.heyselam.app'] } });
        `}</Script>
        {children}
      </body>
    </html>
  );
}
