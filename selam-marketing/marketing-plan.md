# Selam — Digital Marketing Plan
*Drafted 2026-08-01 · owner: Mikael · working doc, revise weekly*

## 0 · Situation

- **Product**: private, local-first AI operator for macOS. $199 one-time founder license (96 of 100 remaining), then $299 + update pass.
- **Reality**: product is buyer-ready (1.0.3 pending); distribution is the bottleneck. Solo founder — every tactic must survive one person's week.
- **Structural advantages**: genuinely differentiated privacy architecture; visually demo-able product (a face that talks, pauses when you leave, presents your PDFs); one-time pricing in a subscription-fatigued market; an honest-technical voice that HN-type audiences reward.
- **Structural constraints**: BYOK setup friction filters out non-technical buyers for now; macOS-only; no audience, no email list, no analytics yet.

## 1 · Goal & north star

**Sell out the 96 remaining founder licenses.** North-star metric: **founder licenses per week**. Everything below is judged by whether it moves that number. Secondary metrics: buy-page visits, demo-video completion rate, email captures.

## 2 · Positioning & message pillars

Category to own: **"AI operator"** (we define it before someone else does).

1. **Yours, not rented** — one price, your keys, plain-Markdown memory, one-click export. *"Priced like software, not like rent."*
2. **Private by architecture** — traffic doesn't route through us; local avatar, local speech, local vision. Falsifiable claims + the /security page, never vibes.
3. **Presence** — she has a face, a voice that matches her mood, and she notices you. This is the emotional differentiator no API wrapper has; it's also the most *clippable*.

One-line test: every piece of content should ladder to one of these three or get cut.

## 3 · Audiences (in priority order)

| # | Who | Where they live | Which pillar lands |
|---|---|---|---|
| 1 | Privacy-conscious developers & indie hackers | HN, Lobsters, r/LocalLLaMA, X | Private by architecture |
| 2 | Solo founders / operators drowning in ops | X, indie-hacker circles, newsletters | Yours + does real work |
| 3 | Local-AI / AI-companion enthusiasts | r/LocalLLaMA, r/macapps, YouTube | Presence + local-first |

Mainstream consumers are **out of scope** until BYOK friction drops (managed-key tier is a product decision for later).

## 4 · Channels, ranked by expected ROI for a solo founder

### Tier 1 — do these, in order (weeks 0–3)
1. **Launch moments**: Show HN → Product Hunt (+2 days) → r/macapps + r/LocalLLaMA (tailored posts, not crossposts — each community smells reposts). Drafts exist in `launch-posts.md`.
2. **The demo video** (2 min): the walkthrough IS the script — activate → pick a face → hear her voice change → walk away mid-deck and watch her pause → hand her a PDF → get a narrated deck. Posted to YouTube (searchable), embedded on landing, cut into 4–6 vertical clips.
3. **Build-in-public on X**: 3–5 posts/week. Clips > text. The founder counter is a narrative engine ("11 of 100 left" writes itself). Reply-guy strategy in AI/privacy threads costs nothing and compounds.

### Tier 2 — cheap, compounding (weeks 2–6)
4. **SEO content cluster** (technical layer already shipped): comparison pages (*Selam vs ChatGPT desktop*, *cloud vs local AI assistants*), use-case pages, and an "AI operator" category-definition page. I draft; Mikael approves claims.
5. **Directories & listings**: AlternativeTo, There's An AI For That, MacUpdate, Uneed, betalist-style sites. One afternoon, permanent backlinks (helps SEO too).
6. **Podcast guesting**: pitch 5 indie-dev/privacy podcasts with the "I removed the cloud from the AI companion" story. 1 booking/month is a win.

### Tier 3 — paid, only after organic signal (week 6+)
7. **Newsletter sponsorships**: TLDR, Ben's Bites, The Neuron ($500–2k/slot). Test ONE after we know landing conversion; paid traffic into an unmeasured funnel is burning money.
8. **Founder referrals**: give the 100 founders a code (license server work); their audiences are exactly audience #1.

**Explicitly not doing**: Google/Meta ads (CAC will exceed $199 at this scale), TikTok-first strategy (wrong audience for BYOK), cold outreach.

## 5 · Funnel & instrumentation (prerequisite — week 0)

```
clip/post → heyselam.app → demo video → /buy → license
```

- **Analytics**: add privacy-friendly analytics (Plausible or Fathom, ~$15/mo) to landing + buy page. Cookieless — consistent with our own pitch, and we can say so. *Currently we are flying blind; this blocks all optimization.*
- **Search Console + Bing Webmaster**: verify domain, submit sitemap (Mikael, ~10 min).
- **Email capture**: add a low-key "watch the launch" email field to the landing for visitors not ready to buy — the list is the asset that survives algorithm changes. (Resend key already exists in the stack.)
- **UTM discipline**: every posted link tagged, so license sales trace to channels.

## 6 · Calendar — first four weeks

**Week 0 (prep)** — EULA confirm → ship 1.0.3 → analytics + Search Console + email capture → screenshot set for PH gallery.
**Week 1** — record + edit demo video → publish to YouTube + landing → 3 vertical clips on X → finalize launch posts.
**Week 2 (launch)** — Tue: Show HN (reply all day) → same day: X thread → Thu: Product Hunt → Fri: r/macapps + r/LocalLLaMA posts.
**Week 3–4** — directory listings → first two comparison pages → podcast pitches → weekly X clip cadence → first weekly metrics review; decide newsletter test.

## 7 · Weekly review ritual (30 min, Mondays)

Licenses sold · visits by source · video completion · email signups · what shipped last week · ONE experiment for next week. Kill anything that produced nothing for two consecutive weeks.

## 8 · Budget

| Phase | Monthly | Goes to |
|---|---|---|
| Now → launch | ~$15 | Analytics |
| Post-launch | ~$50 | Analytics + video tooling/stock |
| After conversion is known | $500–1k test | One newsletter slot, judged on tracked sales |

## 9 · Risks & honesty notes

- **BYOK friction is the conversion killer** — the first-run walkthrough polish directly IS marketing; every setup papercut costs sales at $199.
- **Comp/test keys inflate the founder counter** (known issue) — fix before the counter becomes a public narrative device.
- **Solo-founder bandwidth**: this plan assumes ~1 day/week on marketing after launch week. If a tier-1 item slips, cut tier-2 — never the weekly review.
- **Claims hygiene**: every public claim must be true of the shipping build. The landing already got one correction (Graphite); the review step in every content piece is Mikael reading it against the product.
