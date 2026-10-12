# Live-Broadcast Retargeting — Setup Guide

The point: a cold viewer who watches Selam host live is **warm**. Retarget them with a conversion ad ("Start free") instead of paying cold-traffic prices again. This is where live pays off twice.

The funnel: **Cold ad → watches the live → retargeted with "Start free" → converts.** All UTM-tagged so HQ shows the ROAS.

---

## A · YouTube (Google Ads) — remarket to channel/video viewers

**One-time link (required):**
1. **Google Ads → Tools → Linked accounts → YouTube** → link the channel that streams the live. (Needs admin on both.)
2. **Tools → Audience Manager → Your data sources** → confirm "YouTube users" is active.

**Build the audience:**
3. **Audience Manager → Segments → ＋ → YouTube users.**
4. Pick events that signal a live-viewer:
   - *Viewed any video (or specific videos) from a channel* → select your channel (or the specific live/premiere videos).
   - Also useful: *Subscribed*, *Visited channel page*.
5. Membership duration: **30–90 days**. Name it `live-viewers-yt`.

**Run the conversion ad to them:**
6. New **Demand Gen** or **Video** campaign, objective **Sales/Leads**.
7. **Audiences → Your data → `live-viewers-yt`.**
8. Creative: the **:15 "Start free" video** (or the static units) — lead with the offer, not the intro (they already met her).
9. Final URL: `https://heyselam.ai/?utm_source=youtube&utm_medium=retarget&utm_campaign=rt-yt-live`.

> Note: remarketing lists need a **minimum size** (~1,000 for Video/Display) before they'll serve. Run the "watch live" promo first to fill the list.

---

## B · Meta (Facebook/Instagram) — custom audience from live viewers

**Build the audience:**
1. **Business Settings → confirm the Facebook Page + Instagram account** are connected and the ad account can use them.
2. **Ads Manager → Audiences → Create audience → Custom audience.**
3. Source options (use both):
   - **Video** → people who viewed your videos → pick the live videos → *ViewedThruComplete / 25% / 50%* (50%+ = strong intent).
   - **Facebook Page** → *everyone who engaged* or *visited the Page*, last 90 days.
   - (Instagram account → people who engaged, if you cross-post the live to IG.)
4. Name it `live-viewers-meta`. Retention: **30–90 days**.

**Run the conversion ad to them:**
5. New campaign, objective **Sales** (or Traffic if the pixel isn't set up).
6. Ad set → **Audience → Custom audiences → `live-viewers-meta`**. Exclude existing customers if you have that list.
7. Creative: "Start free" video + static. Website URL: `https://heyselam.ai/?utm_source=facebook&utm_medium=retarget&utm_campaign=rt-fb-live`.
8. If you have the **Meta Pixel** on heyselam.ai, add a "Purchase" custom conversion so Meta optimizes to buyers (and you can build a lookalike of buyers later).

---

## C · The attribution loop (already wired)

- In-show / description CTAs use the vanity links **heyselam.ai/yt** and **/fb**, which 307 → `utm_campaign=live-yt` / `live-fb`.
- Retargeting ads use `utm_campaign=rt-yt-live` / `rt-fb-live`.
- The landing carries `utm_campaign` into Stripe checkout metadata → the **HQ Ads tab** shows spend (once you enter/auto-pull it) against revenue for each of these campaign names.
- So in HQ you'll see four live-related rows build up: `live-yt`, `live-fb`, `rt-yt-live`, `rt-fb-live` — direct vs retargeted, by platform.

## D · Sequence to actually run it
1. Launch the **"Watch her live"** promo ads (cold) → drives first viewers, fills the remarketing lists.
2. Go live on a cadence (same time weekly builds a habit + audience).
3. Once lists pass minimum size, turn on the **retargeting conversion** campaigns.
4. Watch HQ: if `rt-*-live` ROAS beats `live-*` and cold search/Meta, shift budget there.

## Lookalikes (next step, once you have buyers)
- Meta: build a **1% Lookalike** of your Purchase custom audience (or `live-viewers-meta`) → cheap new reach that resembles converters.
- Google: **Similar segments** are automatic from your data segments — use `live-viewers-yt` as the seed.
