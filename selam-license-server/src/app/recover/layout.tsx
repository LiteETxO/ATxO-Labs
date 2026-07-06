import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Recover your license',
  description: "Lost your Selam license key? Enter your purchase email and we'll resend it.",
  openGraph: {
    title: 'Recover your Selam license',
    description: "Enter your purchase email and we'll resend your license key.",
    url: 'https://api.heyselam.app/recover',
  },
  // Recovery flow is private — discourage indexing this URL specifically
  robots: { index: false, follow: false },
};

export default function RecoverLayout({ children }: { children: React.ReactNode }) {
  return children;
}
