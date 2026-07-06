# Redirect setup

The marketing site at heyselam.app references several URLs that live on
api.heyselam.app — set up these redirects on the heyselam.app side
(esat-web's `next.config.ts` or Vercel project settings) so the buyer-
facing URLs match what the EULA and emails advertise.

## Redirects to configure on heyselam.app

| Source (heyselam.app) | Destination (api.heyselam.app) | Type |
|---|---|---|
| `/recover`        | `/recover` | 308 permanent |
| `/buy`            | `/buy`     | 308 permanent |
| `/welcome`        | `/welcome` | 307 temporary (preserves query) |
| `/privacy`        | `/privacy` | 308 permanent |
| `/terms`          | `/terms`   | 308 permanent |
| `/eula`           | `/eula`    | 308 permanent |

## Snippet for `esat-web/next.config.ts`

Add this to the existing config (alongside the `withNextIntl` wrapper):

```ts
const nextConfig: NextConfig = {
  // ... existing config

  async redirects() {
    return [
      // Selam buyer flow lives on api.heyselam.app — preserve the
      // public URLs the EULA + emails reference.
      { source: '/recover', destination: 'https://api.heyselam.app/recover', permanent: true },
      { source: '/buy',     destination: 'https://api.heyselam.app/buy',     permanent: true },
      { source: '/welcome', destination: 'https://api.heyselam.app/welcome', permanent: false }, // preserves query
      { source: '/privacy', destination: 'https://api.heyselam.app/privacy', permanent: true },
      { source: '/terms',   destination: 'https://api.heyselam.app/terms',   permanent: true },
      { source: '/eula',    destination: 'https://api.heyselam.app/eula',    permanent: true },
    ];
  },
};
```

## Why this way (rather than serving the pages on heyselam.app directly)

- **Cleaner separation**: license/payment surface stays in its own Vercel
  project with its own deploy cycle, secrets, and access control.
- **Cross-origin avoided**: the recovery form's POST → `/api/recover`
  is same-origin since both live on `api.heyselam.app`. Saves CORS plumbing.
- **One canonical URL** per page: search engines see a single `/privacy`
  and `/terms` URL after the redirects resolve.

## If you later decide to host the buyer flow ON heyselam.app

The pure handlers (`recover.js`, `webhook-logic.js`, `validate-logic.js`,
`email-templates/*.js`) have no Vercel-specific dependencies. They can
be vendored into `esat-web/src/lib/` and wrapped in Route Handlers
there. The `src/app/...` pages in this project would also port over
with minor tweaks (path imports, the legal CSS module).
