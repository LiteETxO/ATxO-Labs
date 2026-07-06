// Minimal landing — api.heyselam.app/ should redirect to the marketing site.
// We render this so a stray visitor doesn't see a Next.js 404.

import { redirect } from 'next/navigation';

export default function Home() {
  redirect('https://heyselam.app');
}
