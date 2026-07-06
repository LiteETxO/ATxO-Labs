import type { Metadata } from 'next';
import { Fraunces, Hanken_Grotesk, JetBrains_Mono } from 'next/font/google';

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
});
const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-sans',
  display: 'swap',
});
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Buy Selam — $199',
  description:
    'Selam — an autonomous AI operator for your Mac. $199 one-time, lifetime updates. Runs ops overnight, reaches people across WhatsApp, Telegram & iMessage. Bring your own AI keys.',
  openGraph: {
    title: 'Buy Selam — $199',
    description: 'One-time. Lifetime updates. Bring your own AI keys.',
    url: 'https://api.heyselam.app/buy',
  },
  twitter: {
    title: 'Buy Selam — $199',
    description: 'One-time. Lifetime updates. Bring your own AI keys.',
  },
};

export default function BuyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${fraunces.variable} ${hanken.variable} ${jetbrains.variable}`}>
      {children}
    </div>
  );
}
