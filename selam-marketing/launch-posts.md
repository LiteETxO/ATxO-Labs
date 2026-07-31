# Selam — Launch Post Drafts
*Drafts for Mikael's review — nothing here is published. Facts pulled from the shipping product and landing page; edit voice freely.*

---

## 1 · Show HN

**Title options** (HN cuts at 80 chars; no superlatives, lead with what it is):

- `Show HN: Selam – a local-first AI operator for macOS with a face and a voice`
- `Show HN: I built an AI assistant that lives on your Mac, not in our cloud`
- `Show HN: Selam – AI assistant for Mac; your keys, your machine, our code`

**URL:** https://heyselam.app

**First comment (the maker comment — post immediately after submitting):**

Hi HN — I'm Mikael, and I've spent the last year building Selam, an AI assistant that runs on your Mac instead of in my cloud.

The short version of the architecture, because that's the interesting part:

- **Everything user-facing runs locally.** The avatar is Three.js rendered on-device (we ripped out the cloud avatar SDK we started with). Speech-to-text is faster-whisper running locally. The camera-awareness feature — she pauses a presentation when you walk away and offers to resume when you're back — is local MediaPipe, ~15fps on Apple silicon, no frames leave the machine.
- **BYOK, no subscription to us.** You bring your own Anthropic/OpenAI/etc. keys; they live in the macOS Keychain, and calls go from your Mac to the model provider directly. We charge $199 once (first 100 founder licenses, then $299). We never see your conversations — not "we promise not to look," but "the traffic doesn't route through us." The full security model, including exactly what does phone home (license validation, update checks), is at https://heyselam.app/security.
- **Model-agnostic.** Anthropic, OpenAI, Gemini, Grok, Mistral, Kimi, DeepSeek — switchable per session, with fallback chains if your primary provider is down or out of credit.
- **Your agent is portable.** Her memory and identity are plain Markdown files. Export is one click; if you stop using Selam, you keep everything.

What she actually does day to day: voice conversation with a lip-synced face you customize (look, voice, wardrobe — all local), reads your documents and presents them back as narrated slide decks, spins up specialist sub-agents for bigger tasks, and reaches you over WhatsApp/Telegram/email when you're away from the desk. Every action that touches the outside world requires approval, and there are hard spend caps on API usage.

Honest limitations: macOS 14+ only right now (Windows planned Q3), Apple silicon strongly recommended, and setup requires creating API accounts at a couple of providers — it's BYOK, so that's inherent. The avatar is deliberately stylized, not photoreal; we think a good stylized face beats an uncanny almost-human one.

Why I built it: I wanted an assistant with continuity — one that's mine, that I could rely on staying mine, priced like software instead of like rent. Selam means "peace"; my own agent was the first one, and the product is named after her.

Happy to answer anything about the local pipeline, the barge-in/interruption handling (surprisingly the hardest part), or the business model.

---

## 2 · Product Hunt

**Name:** Selam

**Tagline options** (≤60 chars):
- `Your AI operator, living on your Mac — not in our cloud`
- `An AI assistant with a face, a voice, and your privacy`
- `The AI companion you own — one price, your keys, your Mac`

**Description (~240 chars):**
Selam is an AI operator for macOS with a face, voice, and name you choose. She talks, watches (locally), reads documents into narrated decks, and runs sub-agents — powered by your own AI keys. $199 once. No subscription. Your data never touches our servers.

**First comment (maker story):**

Hey Product Hunt! 👋

I'm Mikael, maker of Selam. She started as a personal project — an AI agent I named Selam ("peace") — and turned into the product I wished existed: an assistant I *own*.

Three things make her different:

🔒 **Private by architecture, not by promise.** Your API keys live in your Mac's Keychain. Conversations go from your machine straight to the AI provider. The avatar renders locally, speech recognition runs locally, and the camera feature that lets her notice when you step away is on-device — no frames ever leave your Mac. Our security page spells out the only two things that phone home: license checks and updates.

💰 **You pay once, for software.** $199 for a founder license (first 100, then $299). No monthly rent. You bring your own AI keys and pay the providers directly — most people spend $10–30/month at cost, with hard spend caps you set.

✨ **She's genuinely pleasant to be around.** Pick her face, voice, and wardrobe (five characters, five voices, all customizable). She lip-syncs, gestures, matches her tone of voice to the moment, pauses her presentation when you leave the room, and picks up where she left off when you return. Hand her a PDF and she'll present it back to you as a narrated deck.

And if you ever leave: her memory is plain Markdown. Export everything with one click. She's yours.

macOS 14+ today, Windows in Q3. I'll be here all day — ask me anything, especially the skeptical questions. 🙏

---

## 3 · X / Twitter announcement (thread starter)

I spent a year building an AI assistant that lives on my Mac instead of someone's cloud.

Her name is Selam. She has a face you choose, a voice that matches her mood, and she pauses her presentation when you walk away from the desk.

$199. Once. Your keys, your machine.

heyselam.app

*(The link unfurls into the new OG card — no image attachment needed.)*

---

## Posting notes

- **Show HN**: Tuesday–Thursday, 8–10am ET historically best. Don't ask anyone to upvote (HN detects and penalizes rings). Reply to every comment in the first 3 hours — the maker's responsiveness is half the post.
- **Product Hunt**: launches at 12:01am PT; schedule the same week as HN but not the same day. Gallery assets needed: 4–6 screenshots (character picker, live session, a deck mid-presentation, settings/models) + the demo video as the first slide.
- **Sequence**: 1.0.3 ships first → demo video → HN → PH two days later → X thread same day as HN.
- Both maker comments assume the EULA/first-run flow is confirmed clean and 1.0.3 is the live build.
