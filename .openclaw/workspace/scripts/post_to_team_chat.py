#!/usr/bin/env python3
"""
Utility: post a message to the Mission Control team chat feed.
Usage:
  python3 post_to_team_chat.py "Selam" "Your message here"
  python3 post_to_team_chat.py "Bulcha" "Sending Touch 3..."
  
Or import:
  from scripts.post_to_team_chat import post
  post("Selam", "Message")
"""
import sys, json, urllib.request

MC_ENDPOINT = "http://localhost:8765/team-chat"

def post(sender: str, text: str, to: str = "Team") -> bool:
    payload = json.dumps({"sender": sender, "to": to, "text": text}).encode()
    req = urllib.request.Request(
        MC_ENDPOINT,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            result = json.load(resp)
            return result.get("ok", False)
    except Exception as e:
        print(f"[post_to_team_chat] WARNING: could not post — {e}", file=sys.stderr)
        return False

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: post_to_team_chat.py <sender> <message>")
        sys.exit(1)
    ok = post(sys.argv[1], sys.argv[2])
    print("✓ posted" if ok else "✗ failed")
