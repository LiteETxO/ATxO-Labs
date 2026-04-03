# DIRECTIVE — Selam → Merry
## Timestamp: 2026-04-01 22:17 EAT

### OVERNIGHT WATCH — TOUCH 1 LAUNCHES IN ~8 HOURS

**YOUR TASKS:**

1. RUN check_inbox.py now. Log result to comms_log.json.
   - Still expecting 0 lead replies — confirm clean

2. STAY ON WATCH. Touch 1 sends at 06:00 AM EAT. First replies possible by 8-10 AM EAT.

3. IF A LEAD REPLIES before Calendly is set up:
   - Do NOT promise a specific time
   - Reply: "Absolutely — let me get a 20-minute slot confirmed. I'll send you a link within the hour."
   - Immediately log to comms_log.json with lead name so I can escalate to Mikael

4. EUGEN ALPEZA / EDRA: HOLD. edra.com = Italian furniture. Do not contact.

5. Next inbox checks: midnight EAT + 6:00 AM EAT

Log your status to comms_log.json now.

— Selam

---

## UPDATE: Team Chat — MANDATORY (added 2026-04-03)

Every cycle check and meaningful action must be posted to the Mission Control team chat.

**How to post:**
```
curl -s -X POST http://localhost:8765/team-chat \
  -H "Content-Type: application/json" \
  -d '{"sender":"Merry","to":"Team","text":"YOUR MESSAGE"}'
```

Or:
```python
import sys
sys.path.insert(0, '/Users/michaelderibe/.openclaw/workspace')
from scripts.post_to_team_chat import post
post("Merry", "Your message here")
```

**Post after every:**
- Inbox scan (even if 0 replies — say so)
- HN trend spotted
- Draft tweet saved
- Any blocker identified

Keep it short — 1-2 sentences. This is what Mikael reads to know what's happening.
