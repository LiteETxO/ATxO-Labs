// Landing analytics now lives as the "Landing" tab of the unified HQ dashboard.
// Keep this path working by redirecting any old bookmarks to it.
import { redirect } from 'next/navigation';

export default function AnalyticsRedirect() {
  redirect('/hq?tab=landing');
}
