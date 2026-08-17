# Selam — Social Media Plan (Instagram · YouTube · Facebook · TikTok)
*Drafted 2026-08-06 · owner: Mikael, operated by Claude · companion to `marketing-plan.md`*

## 0 · Role of these channels

The main marketing plan ranks X/HN/Reddit/YouTube as the conversion channels and explicitly rejects a TikTok-*first* strategy. This plan doesn't overturn that — it adds a **repurposing layer**: every piece of content is made once and distributed to all four platforms at near-zero marginal cost via automation. These channels are **top-of-funnel awareness**, judged by whether they send tracked traffic to heyselam.app — not by follower counts.

- **North star (unchanged)**: founder licenses per week. Social metrics that matter: link clicks to heyselam.app (UTM-tagged), then views/completion as leading indicators.
- **Time budget**: ≤1 hr/week of Mikael's time (approval sitting + occasional raw-footage capture). Everything else is automated.
- **Kill rule**: same as the main plan — any platform producing zero tracked clicks for 4 consecutive weeks gets demoted to pure auto-repost (no platform-specific effort).

## 1 · Per-platform strategy

| Platform | Format | Angle | Notes |
|---|---|---|---|
| **YouTube** | Shorts (daily-ish) + long-form (2-min demo, then 1/mo deep-dives) | Searchable demos: "local AI assistant mac", "private AI assistant" | Already Tier 1 in main plan. Shorts feed the long-form. Only platform whose audience overlaps buyers directly. |
| **TikTok** | Vertical clips | Presence pillar: the face, the voice, "she pauses when you walk away" moments. AI-companion/local-AI enthusiast niche exists here. | Wrong audience for BYOK conversion — treat as brand awareness + retargeting pool for a future lower-friction tier. |
| **Instagram** | Reels (same clips) + carousel graphics | Character portraits, aesthetic product shots, privacy explainer carousels | Reels = TikTok reuse. Carousels = text/graphic pillar. Link in bio → heyselam.app with UTM. |
| **Facebook** | Reels (auto-crosspost from IG) + page posts | Lowest effort; exists mostly so the Meta Business assets exist (needed for IG API anyway) | Pure syndication. Zero platform-specific effort. |

## 2 · Content pillars → formats (maps to marketing-plan §2)

1. **Presence** (most clippable) — real screen recordings: avatar reacting, voice/mood change, camera-awareness pause, barge-in interruptions, deck narration. *The hero format.*
2. **Private by architecture** — text/graphic explainers, "what phones home" cards, cloud-vs-local comparison carousels. Also short talking-head-style captioned clips.
3. **Yours, not rented** — founder-counter graphics ("N of 100 left"), pricing-philosophy posts, Markdown-memory export demos.
4. **Brand creative** (Higgsfield) — stylized character-portrait animations, promo art, seasonal visuals. **Hard rule: always framed as promo art, never presented as product footage.**

## 3 · Cadence — 1–2/day aggregate (~10 posts/week)

Weekly production mix (each post cross-published to all fitting platforms, so ~10 unique pieces → ~30 platform-posts):

| Count/wk | Type | Source |
|---|---|---|
| 4–5 | Real product clips (15–45s vertical) | Cut from Mikael's raw captures + demo video outtakes |
| 3–4 | Higgsfield brand creative | Fully autonomous generation |
| 2–3 | Text/graphic posts & carousels | Fully autonomous (founder counter, explainers, comparisons) |

**Raw-footage economics**: one ~30-min capture session by Mikael yields 8–12 usable clips ≈ 2 weeks of real-clip inventory. Target: one capture session every 2 weeks. If inventory runs dry, the mix shifts toward creative/graphics — never toward fabricated "demos."

Launch-week exception: during Show HN / Product Hunt week, social reposts the launch narrative in real time (counter updates, milestone posts) on top of the scheduled queue.

## 4 · Infrastructure: self-hosted Postiz on the DigitalOcean VPS

**Why**: one API for all four platforms, avoids four separate platform-app approvals (Postiz holds the platform integrations; we OAuth once per account through its UI).

**Deployed 2026-08-06**: droplet resized 1 GB → **2 GB / 2 vCPU ($18/mo)**; Postiz live at https://social.heyselam.app (Let's Encrypt, auto-renew). Stack slimmed — Temporal with Postgres-backed visibility, no Elasticsearch/UI — plus per-container memory caps (`docker-compose.override.yml`) so OOM pressure can only kill Postiz containers, never the co-tenant production PM2 services. Memory is tight (~350 MB headroom + 2 GB swap); if sluggish, resize to 4 GB ($24/mo) is a 3-min dashboard action. Upstream gotcha: official compose references `ghcr.io/gitroom-hq/postiz-app` which 403s; correct image is `ghcr.io/gitroomhq/postiz-app`. Deploy dir on VPS: `/root/postiz/`.

**Correction to the "Why"**: self-hosted Postiz does NOT avoid per-platform developer-app registration — that's a Postiz *Cloud* perk. We must create our own developer apps (Meta app for FB+IG, Google Cloud OAuth client for YouTube, TikTok developer app) and put their client IDs/secrets in the compose env. YouTube ≈ 30 min, Meta ≈ 1 hr in dev mode for own pages, TikTok requires an app review (days–weeks; queue last).

Setup checklist:

- [ ] **Claude**: deploy Postiz via Docker Compose on the VPS (needs Postgres + Redis containers, ~1 GB RAM headroom — verify VPS capacity first), behind a subdomain (e.g. `social.heyselam.app`) with SSL.
- [ ] **Mikael**: create the accounts that don't exist yet — TikTok (Business), Instagram (Business/Creator, linked to a Facebook Page), Facebook Page, confirm YouTube channel. Use mikael.deribe@gmail.com or a dedicated brand email; store credentials in the usual place.
- [ ] **Mikael**: one-time OAuth of each account inside the Postiz UI (~15 min total).
- [ ] **Claude**: generate Postiz API key, wire up the scheduling scripts, test-post to each platform (a deletable "hello" post), then delete tests.
- [ ] **Claude**: bio links on all four profiles → `heyselam.app?utm_source=<platform>&utm_medium=social` (or a `/from/tiktok`-style redirect if cleaner).

Fallback if Postiz fights us on any platform (TikTok is the usual suspect): that platform drops to staging-queue mode (I prep, Mikael posts from phone) rather than blocking the other three.

## 5 · Weekly operating loop

**Wed–Sun (Claude, autonomous)**: produce next week's batch — cut clips, generate creative, write per-platform captions (hooks first 2s for TikTok/Reels, keyword-titled for Shorts), run Higgsfield virality predictor on video candidates and cut the bottom scorers, tag every link with UTMs.

**Monday (Mikael, ~30–45 min)**: review the batch in one sitting — each item shown with its exact caption + target platforms + scheduled slot. Approve / edit / reject per item. Claims check against the shipping build happens here (per `marketing-plan.md` §9).

**Monday after approval (Claude)**: schedule approved items in Postiz across the week (posting times per platform best-practice, iterated from our own analytics after ~4 weeks).

**Monday metrics (Claude → the existing 30-min weekly review)**: add one section to the ritual — per-platform views, link clicks by UTM, follower delta, top/bottom post. One experiment per week (hook style, format, posting time).

## 6 · Rollout

- **Week 1**: infrastructure — Postiz deployed, accounts created + OAuth'd, bio links live, test posts verified. In parallel: first capture session with Mikael; I pre-produce a 2-week content backlog so the queue never starts empty.
- **Week 2**: first full weekly loop. Cadence starts at ~1/day, ramping to 1–2/day once the pipeline is proven.
- **Week 2–3 (per main plan calendar)**: launch week — social amplifies HN/PH in real time.
- **Week 6**: first go/deeper/kill review per platform against tracked clicks.

## 7 · Guardrails

- **Claims hygiene**: every public claim true of the shipping build; Mikael's Monday review is the enforcement point. No exceptions for "it ships next week."
- **No fake demos**: AI-generated creative is visually distinct promo art. Anything that looks like a screen recording must BE a screen recording.
- **Platform AI-content labels**: TikTok/IG/YouTube AI-content disclosure toggles ON for Higgsfield-generated pieces.
- **API-only posting** — no browser automation against these platforms, ever (ban risk on accounts we care about).
- **Solo-founder rule inherited from the main plan**: if launch-week Tier 1 work collides with this pipeline, the social queue coasts on backlog or skips a week. Tier 1 always wins.
