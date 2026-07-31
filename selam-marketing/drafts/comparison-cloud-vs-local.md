# DRAFT — Cloud AI Assistants vs. Local-First: What Actually Runs Where
*Target queries: "local ai assistant mac", "private ai assistant", "ai assistant that doesn't share data". Category-education page — positions "AI operator" and links to /security. Build at /local-ai-assistant after approval.*

## The question nobody answers plainly

Every AI assistant says it's "private." Almost none tell you *what runs where*. Here's the honest version.

## The three architectures

**1. Pure cloud (ChatGPT, Copilot, Gemini).** Everything — your words, your files, your usage patterns — lives on the provider's servers, governed by their policies, which change. You are a tenant.

**2. Pure local (Ollama + open models).** Everything on your machine. Genuinely private — but you trade away frontier-model quality, and you're assembling plumbing, not using a product. You are a hobbyist (respect).

**3. Local-first with your own keys (Selam's lane).** The *application* — interface, avatar, speech recognition, camera awareness, memory, files — runs on your Mac. Only the model calls leave, going directly from your machine to the AI provider *you* chose, on *your* API key. The vendor in the middle (us) never sees the traffic. You are an owner.

## What "local" means in Selam, concretely

- Speech-to-text: **local** (faster-whisper on your Mac)
- The avatar and lip-sync: **local** (Three.js, on-device)
- Camera awareness (she pauses when you step away): **local** (MediaPipe; no frame ever leaves the machine)
- Your memory files: **local** (plain Markdown, exportable in one click)
- API keys: **local** (macOS Keychain)
- Model inference: **your chosen provider**, direct — Anthropic, OpenAI, Gemini, Grok, Mistral, Kimi, DeepSeek
- What touches our servers: **license validation and update checks. That's the list.** [Full security model →](/security)

## The cost math nobody shows

| | Year 1 | Year 3 |
|---|---|---|
| Cloud assistant at $20/mo | $240 | $720 |
| Selam founder license + API usage at cost (~$15/mo typical) | ~$379 | ~$739* |

*\*But: with Selam the marginal dollars went to raw model usage you control (caps included), the license never renews, and if prices drop or you switch providers, you benefit — not us. And when you stop paying a subscription, you lose everything; when you stop using Selam, you keep the software and every memory file.*

## When cloud is genuinely the right choice
You want mobile, zero setup, or you're inside a company that already standardized on one. No shame in it — but call it renting, because that's what it is.

## When local-first is the right choice
You talk to your assistant about things that are nobody else's business. You want the best frontier models without marrying one vendor. You want an agent that accumulates years of context you *own*.

That's what an **AI operator** is: not a chat tab — a private colleague on your machine.

*[CTA: Hire Selam — $199 founder license → /buy]*

---
**Claims needing Mikael's eyes**: the ~$15/mo typical usage figure, Year-3 math, "that's the list" phone-home claim (must match /security exactly).
