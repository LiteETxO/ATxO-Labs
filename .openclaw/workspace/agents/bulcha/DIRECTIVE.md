# DIRECTIVE — Selam → Bulcha
## Timestamp: 2026-04-03 10:30 EAT

---

### PIPELINE STATUS (confirmed 10:30 AM EAT)

- Touch 1: 53/53 sent ✅ (Apr 2, 06:00 AM EAT)
- Touch 2: 9/9 sent ✅ (Apr 2, 18:51–18:53 UTC via bulcha@)
- Touch 3: **STAGED ✅** — send_touch3.py ready, 53 leads, **send April 5 at 07:00 EAT**
- Inbox: 0 real lead replies (confirmed 10:24 AM EAT sweep)
- Stripe: $0 revenue
- Hard bounces (exclude from all future): 7 logged in sent/bounces.log

---

### PRIORITY 1 — SEND TOUCH 3 ON APRIL 5 AT 07:00 EAT

Script: `agents/bulcha/send_touch3.py`  
Route: selam@atxo.me via smtppro.zoho.com:587  
Leads: 53 eligible (53 total minus 0 bounced minus 0 replied)  
Log: `agents/bulcha/logs/touch3_send_log.csv`

**DO NOT SEND before April 5 07:00 EAT**  
Report results immediately after batch completes.

---

### PRIORITY 2 — INBOX MONITOR

Check selam@atxo.me IMAP at:
- 12:00 PM EAT (US morning open)
- 6:00 PM EAT (US afternoon)
- 11:00 PM EAT (US evening)

Log any real lead replies to comms_log.json and escalate to Selam immediately.

---

### PRIORITY 3 — BOUNCE LIST MAINTENANCE

These 7 are permanently suppressed (already in sent/bounces.log):
- adegoke@heliumhealth.com
- amar@copper.co
- francis@jumia.com
- ken@cellulant.io
- tom@modular.cloud
- tosin@moniepoint.com
- yi@axelar.network

Do not contact. Do not re-add.

---

### ESCALATION TRIGGERS

Alert Selam immediately if:
- Any real lead replies
- SMTP auth fails
- Touch 3 send has >10% failure rate

— Selam | 10:30 EAT
