'use client';

import { useEffect } from 'react';

// Fires the Google Ads purchase conversion on the /welcome page after a paid
// checkout. Gated on NEXT_PUBLIC_GADS_CONVERSION_LABEL — set that Vercel env var
// to the "Purchase" conversion action's label (the part after AW-18490377265/
// in the event snippet) and conversions start reporting with the real order
// value + a de-dup transaction id.
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export default function ConversionPing({
  value, currency, transactionId,
}: { value?: number; currency?: string; transactionId?: string }) {
  useEffect(() => {
    const label = process.env.NEXT_PUBLIC_GADS_CONVERSION_LABEL;
    if (!label || typeof window === 'undefined') return;

    // Use the canonical gtag call — the SAME `function gtag(){dataLayer.push(
    // arguments)}` the base tag defines (layout.tsx). Google's conversion
    // processor reads an `arguments`-shaped command off dataLayer; pushing a
    // plain array instead silently fails to register as a conversion. Prefer
    // the global gtag the base tag installed; fall back to an arguments-form
    // push if this mounts before the init script runs (gtag.js drains the
    // queue when it loads).
    const gtag: (...args: unknown[]) => void =
      typeof window.gtag === 'function'
        ? window.gtag
        : function () { (window.dataLayer = window.dataLayer || []).push(arguments); };

    gtag('event', 'conversion', {
      send_to: `AW-18490377265/${label}`,
      // Stripe amount_total is in the smallest currency unit (cents) → major units
      ...(typeof value === 'number' ? { value: value / 100 } : {}),
      currency: currency || 'USD',
      ...(transactionId ? { transaction_id: transactionId } : {}),
    });
  }, [value, currency, transactionId]);

  return null;
}
