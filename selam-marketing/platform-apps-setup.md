# Postiz platform developer apps — setup guide
*Drafted 2026-08-07 · companion to `social-plan.md` · Postiz instance: https://social.heyselam.app*

Self-hosted Postiz needs our own developer app per platform. Order of attack: **YouTube first** (~30 min, no review), **Meta second** (~1 hr, FB+IG in one app), **TikTok last** (needs app review, days–weeks — don't let it block the other three).

Once you have each pair of credentials, tell Claude — the env vars go into `/root/postiz/docker-compose.yml` on the VPS followed by `docker compose up -d` (Claude does this part).

---

## 1 · YouTube (Google Cloud) — do first

Env vars: `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`

1. Go to https://console.cloud.google.com/apis/credentials — create a new project (e.g. "Selam Social").
2. Enable three APIs (APIs & Services → Library): **YouTube Data API v3**, **YouTube Analytics API**, **YouTube Reporting API**.
3. Configure the OAuth consent screen: type **External**, and add `mikael.deribe@gmail.com` (or whichever Google account owns the Selam channel) as a **test user**. Test-user mode is fine — only our own channel connects.
4. Create credentials → OAuth 2.0 Client ID → type **Web application**. Authorized redirect URI (exact):
   `https://social.heyselam.app/integrations/social/youtube`
5. Copy the client ID + secret → hand to Claude.

Gotcha: if the Selam channel is a **Brand Account**, Google can take ~5 hours to propagate test-user access — set it up, wait, then OAuth.

## 2 · Meta (Facebook + Instagram) — one app covers both

Env vars: `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`

Prereqs (accounts, not app): a **Facebook Page** for Selam, and an **Instagram Business/Creator account linked to that Page**. Create these first if they don't exist.

1. Go to https://developers.facebook.com/apps → Create App. Use case: **Other**, type: **Business**.
2. Add Facebook Login product; in its settings, set the valid OAuth redirect URI (exact):
   `https://social.heyselam.app/integrations/social/facebook`
3. Permissions needed: `pages_show_list`, `pages_manage_posts`, `business_management` (plus the Instagram content-publish scopes Postiz requests during OAuth).
4. Switch the app from **Development to Live mode** — in dev mode, posts with media are visible only to app developers. Live mode for these scopes on your *own* Page/IG generally works without full App Review; if Meta demands review for a scope, we do the screencast submission then.
5. Copy App ID + App Secret → hand to Claude.

## 3 · TikTok — queue last (has review)

Env vars: `TIKTOK_CLIENT_ID` (16 chars), `TIKTOK_CLIENT_SECRET` (32 chars)

Prereq: the Selam TikTok account (Business) must exist.

1. Register an app at https://developers.tiktok.com/apps, platform **Web**.
2. Redirect URI (exact): `https://social.heyselam.app/integrations/social/tiktok`
3. Terms of Service + Privacy Policy URLs are required, hosted on public HTTPS — use the heyselam.app ones (add pages if missing; Claude can draft them).
4. Add products: **Login Kit** and **Content Posting API** with **Direct Post** enabled.
5. Scopes: `user.info.basic`, `user.info.profile`, `video.upload`, `video.create`, `video.publish`.
6. Submit for review, then wait (days–weeks). Launch IG/FB/YT without it; TikTok joins when approved. Until then TikTok runs in staging-queue mode per `social-plan.md` §4 fallback.

---

## After each app: connect in Postiz

1. Claude adds the env vars to the compose file and restarts (`docker compose up -d` — a few seconds of downtime).
2. You open https://social.heyselam.app → Add Channel → pick the platform → OAuth with the Selam account.
3. Claude sends one deletable test post, verifies it landed via API, deletes it.
