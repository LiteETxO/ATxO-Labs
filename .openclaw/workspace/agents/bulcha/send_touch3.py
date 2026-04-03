#!/usr/bin/env python3
"""
Touch 3 — April 5 AM EAT
Final touch for 9-lead Touch 2 cohort + all other eligible leads (no reply, not bounced)
Angle: closing the loop — short, direct, binary CTA
"""
import smtplib
import time
import csv
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone

SMTP_HOST = "smtppro.zoho.com"
SMTP_PORT = 587
FROM_EMAIL = "selam@atxo.me"
FROM_NAME = "Merry, ATXO Labs"
SMTP_USER = "selam@atxo.me"
LOG_PATH = os.path.join(os.path.dirname(__file__), "logs/touch3_send_log.csv")
BATCH_PATH = os.path.join(os.path.dirname(__file__), "batches/touch2_batch.csv")
BOUNCE_PATH = os.path.join(os.path.dirname(__file__), "sent/bounces.log")

def load_password():
    with open("/Users/michaelderibe/.openclaw/secrets/zoho_app_password") as f:
        return f.read().strip()

def load_bounced():
    bounced = set()
    try:
        with open(BOUNCE_PATH) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    email = line.split(',')[0].lower().strip()
                    if email:
                        bounced.add(email)
    except FileNotFoundError:
        pass
    return bounced

def load_leads():
    bounced = load_bounced()
    leads = []
    with open(BATCH_PATH) as f:
        r = csv.DictReader(f)
        for row in r:
            email = row['email'].lower().strip()
            if email in bounced:
                print(f"  [SKIP bounced] {row['name']} <{email}>")
                continue
            if row.get('replied', '').strip().lower() not in ('', 'no', 'false', '0'):
                print(f"  [SKIP replied] {row['name']} <{email}>")
                continue
            # Extract first name
            first = row['name'].split()[0] if row['name'] else 'there'
            leads.append({
                'first': first,
                'full_name': row['name'],
                'email': email,
                'company': row['company'],
                'hook': row.get('notes', '').replace('Hook: ', '').strip(),
            })
    return leads

def build_email(lead):
    """Touch 3 — closing the loop, short, binary CTA"""
    first = lead['first']
    company = lead['company']

    subject = f"Re: {company} — closing the loop"

    body = f"""Hi {first},

I've reached out a couple of times now — just wanted to close the loop rather than keep following up.

If automating ops at {company} is on the radar, happy to share exactly what we'd do and why it works for teams your size.

If the timing is off or it's not a fit — totally fine to let me know.

Either way, appreciate you reading.

— Merry
ATXO Labs"""

    return subject, body

def send_email(lead, password):
    subject, body = build_email(lead)
    msg = MIMEMultipart()
    msg['From'] = f"{FROM_NAME} <{FROM_EMAIL}>"
    msg['To'] = lead['email']
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain'))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(SMTP_USER, password)
        server.sendmail(FROM_EMAIL, lead['email'], msg.as_string())

def log_send(lead, status, error=""):
    with open(LOG_PATH, 'a', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            datetime.now(timezone.utc).isoformat(),
            lead['full_name'],
            lead['company'],
            lead['email'],
            status,
            error
        ])

def ensure_log():
    if not os.path.exists(LOG_PATH):
        with open(LOG_PATH, 'w', newline='') as f:
            csv.writer(f).writerow(['sent_at', 'name', 'company', 'email', 'status', 'error'])

def main():
    print(f"=== TOUCH 3 SEND — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} ===")
    password = load_password()
    leads = load_leads()
    print(f"Eligible leads: {len(leads)}")
    ensure_log()

    sent = 0
    failed = 0
    for i, lead in enumerate(leads):
        if i > 0:
            delay = 65
            print(f"  Waiting {delay}s...")
            time.sleep(delay)

        print(f"[{i+1}/{len(leads)}] {lead['full_name']} <{lead['email']}>...", end=' ', flush=True)
        try:
            send_email(lead, password)
            log_send(lead, 'sent')
            sent += 1
            print("✓ SENT")
        except Exception as e:
            log_send(lead, 'failed', str(e))
            failed += 1
            print(f"✗ FAILED: {e}")

    print(f"\n=== DONE: {sent} sent, {failed} failed ===")

if __name__ == '__main__':
    main()
