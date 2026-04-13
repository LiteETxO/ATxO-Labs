"""Mission Control backend prototype.

FastAPI app that serves aggregated state for the dashboard. Currently reads
placeholder JSON data from `data/state.json`. Later iterations will replace this
with live collectors for finance, OpenClaw automation, and external telemetry.
"""
from __future__ import annotations

import os
import smtplib
import ssl
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Any

import stripe
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
import json
import urllib.request
import urllib.error

# Stripe config
STRIPE_RESTRICTED_KEY = os.environ.get(
    "STRIPE_RESTRICTED_KEY",
    open("/Users/michaelderibe/.openclaw/secrets/stripe_key").read().strip()
    if os.path.exists("/Users/michaelderibe/.openclaw/secrets/stripe_key") else ""
)
stripe.api_key = STRIPE_RESTRICTED_KEY

# Zoho SMTP config
ZOHO_HOST = "smtp.zoho.com"
ZOHO_PORT = 465
ZOHO_USER = "selam@atxo.me"

# WhatsApp notification config
WHATSAPP_TARGET = "+16172308368"  # Mikael's number

def _send_whatsapp_notification(message: str) -> None:
    """Send WhatsApp notification via OpenClaw gateway."""
    try:
        # Use the OpenClaw messaging API
        import urllib.request as _ur
        payload = json.dumps({
            "channel": "whatsapp",
            "to": WHATSAPP_TARGET,
            "text": message
        }).encode()
        
        req = _ur.Request(
            "http://localhost:18789/message",  # OpenClaw gateway
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        _ur.urlopen(req, timeout=10)
    except Exception as e:
        print(f"[WhatsApp] Failed to send: {e}")

def _segment_buyer(email: str, product_key: str, amount: int) -> dict:
    """Segment buyer and enroll in nurture sequence."""
    segments = {
        "agent-security-toolkit": {"segment": "security_buyer", "sequence": "security_nurture", "priority": "high"},
        "agent-security-core": {"segment": "security_buyer", "sequence": "security_nurture", "priority": "medium"},
        "ai-sdr-system": {"segment": "sales_buyer", "sequence": "sdr_nurture", "priority": "high"},
        "lead-lists": {"segment": "data_buyer", "sequence": "lead_list_nurture", "priority": "medium", "recurring": True},
        "cold-email-starter-kit": {"segment": "starter_buyer", "sequence": "starter_nurture", "priority": "low"},
        "90-day-revenue-roadmap": {"segment": "strategy_buyer", "sequence": "roadmap_nurture", "priority": "medium"},
        "founders-growth-os": {"segment": "vip_buyer", "sequence": "vip_nurture", "priority": "high"},
    }
    
    segment_info = segments.get(product_key, {"segment": "general", "sequence": "general_nurture", "priority": "medium"})
    
    buyer_record = {
        "email": email,
        "product_key": product_key,
        "amount": amount,
        "segment": segment_info["segment"],
        "sequence": segment_info["sequence"],
        "priority": segment_info["priority"],
        "purchased_at": datetime.utcnow().isoformat(),
        "next_touch": (datetime.utcnow().timestamp() + 2 * 24 * 3600),  # 2 days
        "touch_count": 0,
        "lifetime_value": amount,
    }
    
    # Save to buyer segments
    segments_path = BASE_DIR / "data" / "buyer_segments.jsonl"
    segments_data = []
    if segments_path.exists():
        with open(segments_path) as f:
            segments_data = [json.loads(line) for line in f if line.strip()]
    
    # Update if exists, else append
    existing = next((s for s in segments_data if s["email"] == email), None)
    if existing:
        existing["lifetime_value"] += amount
        existing["touch_count"] += 1
        existing["last_purchase"] = buyer_record["purchased_at"]
        existing["product_key"] = product_key  # Track latest purchase
    else:
        segments_data.append(buyer_record)
    
    with open(segments_path, "w") as f:
        for s in segments_data:
            f.write(json.dumps(s) + "\n")
    
    return buyer_record

def _get_zoho_password() -> str:
    pw = os.environ.get("ZOHO_PASSWORD")
    if pw:
        return pw
    secret_path = Path("/Users/michaelderibe/.openclaw/secrets/zoho_app_password")
    if secret_path.exists():
        return secret_path.read_text().strip()
    raise RuntimeError("ZOHO_PASSWORD not set and secret file not found")

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data" / "state.json"
DOCUMENTS_PATH = BASE_DIR / "data" / "documents.json"
CONVENTIONS_PATH = BASE_DIR / "data" / "conventions.json"

# Tsega trading dashboard state (local trading agent)
TSEGA_STATE_PATH = Path("/Users/michaelderibe/Downloads/trading-agent/data/dashboard-state.json")

def load_tsega_live() -> dict[str, Any]:
    """Read live trading state from Tsega's dashboard and return a summary dict."""
    try:
        if not TSEGA_STATE_PATH.exists():
            return {}
        raw = json.loads(TSEGA_STATE_PATH.read_text())
        trades     = raw.get("trades", [])
        positions  = raw.get("positions", [])
        metrics    = raw.get("metrics", {})
        equity_pts = raw.get("equity", [])
        open_pos   = [p for p in positions if p.get("status") == "open"]
        closed     = [t for t in trades if t.get("closedAt")]
        wins       = [t for t in closed if (t.get("pnl") or 0) > 0]
        win_rate   = round(len(wins) / len(closed) * 100, 1) if closed else 0
        total_pnl  = round(sum(t.get("pnl", 0) for t in closed), 2)
        equity     = metrics.get("equity", 0)
        # Today P&L
        from datetime import datetime, timezone
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_pnl = round(sum(
            t.get("pnl", 0) for t in closed
            if t.get("closedAt") and datetime.fromisoformat(t["closedAt"].replace("Z","+00:00")) >= today
        ), 2)
        return {
            "status": raw.get("status", "unknown"),
            "equity": equity,
            "totalPnl": total_pnl,
            "todayPnl": today_pnl,
            "winRate": win_rate,
            "totalTrades": len(closed),
            "openPositions": len(open_pos),
            "openPositionList": [
                {"symbol": p.get("symbol"), "side": p.get("side"), "entry": p.get("entryPrice"),
                 "stop": p.get("stopPrice"), "tp": p.get("tpPrice"), "size": p.get("sizeUsd")}
                for p in open_pos
            ],
            "recentTrades": [
                {"symbol": t.get("symbol"), "side": t.get("side"), "pnl": t.get("pnl"),
                 "exitReason": t.get("exitReason"), "closedAt": t.get("closedAt")}
                for t in closed[-5:]
            ],
            "milestone": f"{len(closed)}/20 trades toward mainnet",
            "dashboard": "http://161.35.220.149:3001",
        }
    except Exception as e:
        return {"error": str(e)}

app = FastAPI(title="Mission Control Backend", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DIST_PATH = BASE_DIR.parent / "frontend" / "dist"

# Serve static assets
if DIST_PATH.exists():
    app.mount("/assets", StaticFiles(directory=str(DIST_PATH / "assets")), name="assets")
    avatars_dir = DIST_PATH / "avatars"
    if avatars_dir.exists():
        app.mount("/avatars", StaticFiles(directory=str(avatars_dir)), name="avatars")

# Serve coordination files
COORDINATION_PATH = BASE_DIR / "static" / "coordination"
if COORDINATION_PATH.exists():
    app.mount("/coordination", StaticFiles(directory=str(COORDINATION_PATH)), name="coordination")

@app.get("/", response_class=HTMLResponse)
def serve_root():
    index = DIST_PATH / "index.html"
    if index.exists():
        content = index.read_text()
        return HTMLResponse(
            content,
            headers={
                "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
                "Pragma": "no-cache",
                "Expires": "0",
                "Surrogate-Control": "no-store",
            },
        )
    return HTMLResponse("<h1>dist not found — run npm run build</h1>", status_code=404)


@app.get("/index.html", response_class=HTMLResponse)
def serve_index():
    return serve_root()


def load_state() -> dict[str, Any]:
    if not DATA_PATH.exists():
        raise HTTPException(status_code=500, detail="state.json not found")
    try:
        return json.loads(DATA_PATH.read_text())
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail=f"Invalid state JSON: {exc}") from exc


def load_documents() -> list[dict[str, Any]]:
    if not DOCUMENTS_PATH.exists():
        return []
    try:
        return json.loads(DOCUMENTS_PATH.read_text())
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail=f"Invalid documents JSON: {exc}") from exc


def get_document_by_slug(slug: str) -> dict[str, Any]:
    documents = load_documents()
    for doc in documents:
        if doc.get("slug") == slug:
            return doc
    raise HTTPException(status_code=404, detail="Document not found")


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/tsega")
def get_tsega() -> dict[str, Any]:
    """Live Tsega trading status endpoint."""
    return load_tsega_live()

@app.get("/state")
def get_state() -> dict[str, Any]:
    state = load_state()
    # Inject live Tsega trading data
    tsega_live = load_tsega_live()
    if tsega_live:
        state["trading"] = {**state.get("trading", {}), **tsega_live}
        # Update agentStatus with live numbers
        pnl_str = f"+${tsega_live['totalPnl']:.2f}" if tsega_live.get("totalPnl", 0) >= 0 else f"-${abs(tsega_live['totalPnl']):.2f}"
        state["agentStatus"]["Tsega"] = (
            f"ONLINE — {tsega_live.get('status','?')} — "
            f"equity ${tsega_live.get('equity',0):.2f} — "
            f"P&L {pnl_str} — "
            f"{tsega_live.get('totalTrades',0)} trades — "
            f"win rate {tsega_live.get('winRate',0)}% — "
            f"{tsega_live.get('openPositions',0)} open"
        )
    return state


@app.get("/docs/{slug}")
def get_document(slug: str) -> FileResponse:
    doc = get_document_by_slug(slug)
    path = Path(doc["path"])
    if not path.exists():
        raise HTTPException(status_code=404, detail="Document file missing")
    return FileResponse(path, filename=path.name, media_type="application/octet-stream")


# --- Conversation Transcript Endpoints ---

BULCHA_SESSIONS_PATH = Path("/Users/michaelderibe/.openclaw/agents/bulcha/sessions")
SELAM_SESSIONS_PATH = Path("/Users/michaelderibe/.openclaw/agents/main/sessions")


def load_jsonl_transcript(session_path: Path) -> list[dict[str, Any]]:
    """Load and parse a JSONL transcript file."""
    if not session_path.exists():
        return []
    
    entries = []
    try:
        with open(session_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        entry = json.loads(line)
                        entries.append(entry)
                    except json.JSONDecodeError:
                        continue
    except Exception:
        return []
    return entries


def format_transcript_for_display(entries: list[dict]) -> list[dict]:
    """Format transcript entries for frontend display."""
    formatted = []
    for entry in entries:
        msg_type = entry.get("type", "")
        
        if msg_type == "message":
            msg = entry.get("message", {})
            role = msg.get("role", "")
            content = msg.get("content", [])
            
            # Extract text content
            text_parts = []
            for part in content:
                if isinstance(part, dict) and part.get("type") == "text":
                    text_parts.append(part.get("text", ""))
            
            text = "\n".join(text_parts)
            
            # Skip system/metadata messages
            if role in ["user", "assistant"] and text.strip():
                formatted.append({
                    "type": "message",
                    "role": role,
                    "content": text,
                    "timestamp": entry.get("timestamp", ""),
                    "id": entry.get("id", ""),
                })
        
        elif msg_type == "toolCall":
            tool_calls = entry.get("message", {}).get("toolCalls", [])
            for tc in tool_calls:
                formatted.append({
                    "type": "tool_call",
                    "tool": tc.get("name", ""),
                    "arguments": tc.get("arguments", {}),
                    "timestamp": entry.get("timestamp", ""),
                    "id": entry.get("id", ""),
                })
        
        elif msg_type == "toolResult":
            formatted.append({
                "type": "tool_result",
                "tool": entry.get("toolName", ""),
                "status": "success" if not entry.get("isError") else "error",
                "timestamp": entry.get("timestamp", ""),
                "id": entry.get("id", ""),
            })
    
    return formatted


@app.get("/conversations/bulcha")
def get_bulcha_conversations() -> dict[str, Any]:
    """Get Bulcha's recent conversation transcripts."""
    if not BULCHA_SESSIONS_PATH.exists():
        return {"sessions": [], "error": "Bulcha sessions directory not found"}
    
    # Get all JSONL files, sorted by modification time (newest first)
    session_files = sorted(
        BULCHA_SESSIONS_PATH.glob("*.jsonl"),
        key=lambda p: p.stat().st_mtime,
        reverse=True
    )
    
    sessions = []
    for session_file in session_files[:5]:  # Last 5 sessions
        entries = load_jsonl_transcript(session_file)
        formatted = format_transcript_for_display(entries)
        
        if formatted:
            sessions.append({
                "sessionId": session_file.stem,
                "filename": session_file.name,
                "entryCount": len(entries),
                "messages": formatted[-20:],  # Last 20 messages
                "lastModified": session_file.stat().st_mtime,
            })
    
    return {"sessions": sessions, "totalSessions": len(session_files)}


@app.get("/conversations/bulcha/{session_id}")
def get_bulcha_session(session_id: str) -> dict[str, Any]:
    """Get a specific Bulcha session transcript."""
    session_file = BULCHA_SESSIONS_PATH / f"{session_id}.jsonl"
    if not session_file.exists():
        raise HTTPException(status_code=404, detail="Session not found")
    
    entries = load_jsonl_transcript(session_file)
    formatted = format_transcript_for_display(entries)
    
    return {
        "sessionId": session_id,
        "entryCount": len(entries),
        "messages": formatted,
        "lastModified": session_file.stat().st_mtime,
    }


@app.get("/conversations/selam")
def get_selam_conversations() -> dict[str, Any]:
    """Get Selam's recent conversation transcripts (with Bulcha)."""
    if not SELAM_SESSIONS_PATH.exists():
        return {"sessions": [], "error": "Selam sessions directory not found"}
    
    # Get all JSONL files, sorted by modification time
    session_files = sorted(
        SELAM_SESSIONS_PATH.glob("*.jsonl"),
        key=lambda p: p.stat().st_mtime,
        reverse=True
    )
    
    sessions = []
    for session_file in session_files[:5]:
        entries = load_jsonl_transcript(session_file)
        formatted = format_transcript_for_display(entries)
        
        if formatted:
            sessions.append({
                "sessionId": session_file.stem,
                "filename": session_file.name,
                "entryCount": len(entries),
                "messages": formatted[-20:],
                "lastModified": session_file.stat().st_mtime,
            })
    
    return {"sessions": sessions, "totalSessions": len(session_files)}


@app.get("/conventions")
def get_conventions() -> dict[str, Any]:
    """Get communication conventions for agent interactions."""
    if not CONVENTIONS_PATH.exists():
        raise HTTPException(status_code=404, detail="Conventions not found")
    try:
        return json.loads(CONVENTIONS_PATH.read_text())
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail=f"Invalid conventions JSON: {exc}") from exc


# --- Agent Chat Endpoint ---

CHAT_FILE_PATH = Path("/Users/michaelderibe/.openclaw/workspace/shared/bulcha-selam-chat.md")

@app.get("/chat")
def get_agent_chat(hours: int = 1) -> dict[str, Any]:
    """Get recent agent-to-agent chat messages."""
    if not CHAT_FILE_PATH.exists():
        return {"messages": [], "error": "Chat file not found"}
    
    try:
        content = CHAT_FILE_PATH.read_text()
        messages = parse_chat_messages(content, hours)
        return {"messages": messages, "count": len(messages)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to parse chat: {exc}") from exc


def parse_chat_messages(content: str, hours: int = 12) -> list[dict[str, Any]]:
    """Parse chat messages from markdown format, filtering to recent hours."""
    import re
    from datetime import datetime, timedelta
    
    messages = []
    cutoff = datetime.now() - timedelta(hours=hours)
    
    # Pattern: [YYYY-MM-DD HH:MM] Sender: Message
    pattern = r'\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\] ([^:]+): (.+?)(?=\n\[|\Z)'
    
    for match in re.finditer(pattern, content, re.DOTALL):
        timestamp_str, sender, message = match.groups()
        try:
            timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M")
            if timestamp >= cutoff:
                # Skip cron job check-in messages (they contain "cron job checked in")
                msg_content = message.strip()
                if "cron job checked in" in msg_content.lower():
                    continue
                messages.append({
                    "timestamp": timestamp.isoformat(),
                    "sender": sender.strip(),
                    "content": msg_content,
                })
        except ValueError:
            continue
    
    # Sort by timestamp descending (most recent first)
    messages.sort(key=lambda x: x["timestamp"], reverse=True)
    return messages



# --- Live Agent Comms Endpoint ---

BULCHA_SESSION_DIR = Path("/Users/michaelderibe/.openclaw/agents/bulcha/sessions")
SELAM_SESSION_DIR = Path("/Users/michaelderibe/.openclaw/agents/main/sessions")
MERRY_SESSION_DIR = Path("/Users/michaelderibe/.openclaw/agents/closer/sessions")

@app.get("/agent-comms")
def get_agent_comms() -> dict[str, Any]:
    """
    Pull real operational messages across all agent sessions.
    - Bulcha sessions: user=Selam task, assistant=Bulcha reply
    - Merry sessions: user=Selam task, assistant=Merry reply
    No fabricated content. No cron noise.
    """
    from datetime import datetime, timedelta

    cutoff = datetime.utcnow() - timedelta(hours=12)
    messages = []

    SKIP = [
        "[cron:", "HEARTBEAT_OK", "Read HEARTBEAT.md", "bulcha-chat-monitor",
        "Return your summary as plain text", "Conversation info (untrusted",
        "message_id", "sender_id", "No new message from Selam",
        "Post status update to #mission-control", "bulcha-proactive",
        "Current time:", "will be delivered automatically",
        "Agent-to-agent announce step", "ANNOUNCE_SKIP",
        "Heartbeat Summary", "heartbeat state", "heartbeat-state",
        "The skill requires a channel ID", "Slack channel ID",
        "Subagent Context", "subagent", "merry-inbox-monitor",
        "Here's my run summary", "run summary for this cycle",
        "INBOX CHECK", "inbox check", "20 emails processed",
        "Merry — Closer Agent", "**1.", "**2.", "MANAGEMENT CHECK",
    ]

    def extract_from_dir(session_dir: Path, agent_name: str, files_limit: int = 5):
        if not session_dir.exists():
            return
        files = sorted(session_dir.glob("*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True)
        for fpath in files[:files_limit]:
            try:
                with open(fpath) as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        entry = json.loads(line)
                        if entry.get("type") != "message":
                            continue
                        msg = entry.get("message", {})
                        role = msg.get("role", "")
                        if role not in ("user", "assistant"):
                            continue
                        parts = msg.get("content", [])
                        text = " ".join(
                            p.get("text", "") for p in parts
                            if isinstance(p, dict) and p.get("type") == "text"
                        ).strip()
                        if not text or any(s.lower() in text.lower() for s in SKIP):
                            continue
                        ts_str = entry.get("timestamp", "")
                        try:
                            ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00")).replace(tzinfo=None)
                        except Exception:
                            continue
                        if ts < cutoff:
                            continue
                        sender = "Selam" if role == "user" else agent_name
                        messages.append({
                            "sender": sender,
                            "agent": agent_name,
                            "text": text[:500],
                            "timestamp": ts_str,
                        })
            except Exception:
                continue

    extract_from_dir(BULCHA_SESSION_DIR, "Bulcha")
    extract_from_dir(MERRY_SESSION_DIR, "Merry")

    # Remove any messages that are tagged as 'chat' in comms_log
    # (these appear in session logs too via sessions_send, but belong in /team-chat)
    comms_log_path = BASE_DIR / "data" / "comms_log.json"
    chat_snippets = set()
    if comms_log_path.exists():
        try:
            for entry in json.loads(comms_log_path.read_text()):
                if entry.get('type') == 'chat':
                    text = (entry.get('text') or '')[:60].lower().strip()
                    if text:
                        chat_snippets.add(text)
        except Exception:
            pass

    messages = [m for m in messages if m.get('text', '')[:60].lower().strip() not in chat_snippets]

    # Sort descending (latest first) — parse ISO timestamps properly
    def ts_key(m):
        try:
            return datetime.fromisoformat(m["timestamp"].replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception:
            return datetime.min
    messages.sort(key=ts_key, reverse=True)
    deduped = []
    seen = set()
    for m in messages:
        key = (m["sender"], m["text"][:80])
        if key not in seen:
            seen.add(key)
            deduped.append(m)

    return {"messages": deduped[:15], "count": len(deduped)}


@app.get("/team-chat")
def get_team_chat() -> dict[str, Any]:
    """
    Natural team communications — messages between agents and Mikael.
    Pulled from comms_log.json and team_chat.json.
    """
    from datetime import datetime, timedelta
    cutoff = datetime.utcnow() - timedelta(days=7)
    messages = []

    # Source 1: comms_log.json (agent cycle reports)
    comms_log_path = BASE_DIR / "data" / "comms_log.json"
    if comms_log_path.exists():
        try:
            logged = json.loads(comms_log_path.read_text())
            for entry in logged:
                ts_str = entry.get("timestamp", "")
                try:
                    ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00")).replace(tzinfo=None)
                except Exception:
                    continue
                if ts < cutoff:
                    continue
                sender = entry.get("sender", "")
                text = entry.get("text", "") or entry.get("inbox_status", "") or entry.get("event", "")
                if not sender or not text:
                    continue
                if entry.get('type', 'chat') != 'chat':
                    continue
                if len(text) > 500:
                    continue
                messages.append({
                    "sender": sender,
                    "to": entry.get("to", ""),
                    "text": text[:400],
                    "timestamp": ts_str,
                })
        except Exception:
            pass

    # Source 2: team_chat.json (direct agent messages)
    team_chat_path = Path("/Users/michaelderibe/.openclaw/workspace/agents/team_chat.json")
    if team_chat_path.exists():
        try:
            raw = json.loads(team_chat_path.read_text())
            entries = raw if isinstance(raw, list) else raw.get("messages", [])
            for entry in entries:
                ts_str = entry.get("timestamp", "")
                try:
                    ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00")).replace(tzinfo=None)
                except Exception:
                    continue
                if ts < cutoff:
                    continue
                sender = entry.get("sender", "")
                text = entry.get("text", "")
                if not sender or not text:
                    continue
                messages.append({
                    "sender": sender,
                    "to": entry.get("to", ""),
                    "text": text[:400],
                    "timestamp": ts_str,
                })
        except Exception:
            pass

    def ts_key(m):
        try:
            return datetime.fromisoformat(m["timestamp"].replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception:
            return datetime.min
    messages.sort(key=ts_key, reverse=True)
    return {"messages": messages[:30]}


@app.post("/team-chat")
def post_team_chat(payload: dict) -> dict[str, Any]:
    """
    Post a message to the team chat feed.
    Body: { "sender": "Selam", "text": "...", "to": "Team" }
    """
    from datetime import datetime, timezone

    sender = payload.get("sender", "").strip()
    text = payload.get("text", "").strip()
    to = payload.get("to", "Team").strip()

    if not sender or not text:
        raise HTTPException(status_code=400, detail="sender and text are required")

    team_chat_path = Path("/Users/michaelderibe/.openclaw/workspace/agents/team_chat.json")
    try:
        if team_chat_path.exists():
            entries = json.loads(team_chat_path.read_text())
            if not isinstance(entries, list):
                entries = entries.get("messages", [])
        else:
            entries = []
    except Exception:
        entries = []

    entry = {
        "sender": sender,
        "to": to,
        "text": text[:500],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "type": "chat",
    }
    entries.append(entry)
    team_chat_path.write_text(json.dumps(entries, indent=2))

    return {"ok": True, "entry": entry}


@app.get("/token-status")
def get_token_status() -> dict[str, Any]:
    """Return token usage from live session JSONL files."""
    import time

    AGENT_SESSIONS = {
        "Selam":  Path("/Users/michaelderibe/.openclaw/agents/main/sessions"),
        "Bulcha": Path("/Users/michaelderibe/.openclaw/agents/bulcha/sessions"),
        "Merry":  Path("/Users/michaelderibe/.openclaw/agents/closer/sessions"),
        "Tsega":  Path("/Users/michaelderibe/.openclaw/agents/tsega/sessions"),
    }
    cutoff = time.time() - 24 * 3600
    result = []

    for agent_name, session_dir in AGENT_SESSIONS.items():
        if not session_dir.exists():
            continue
        # Get most recent JSONL files
        jsonl_files = sorted(
            [f for f in session_dir.glob("*.jsonl") if not f.name.endswith(".deleted.jsonl")],
            key=lambda p: p.stat().st_mtime, reverse=True
        )
        for fpath in jsonl_files[:2]:
            try:
                if fpath.stat().st_mtime < cutoff:
                    continue
                input_t = output_t = 0
                last_ts = None
                model = "claude-sonnet-4-6"
                for line in fpath.read_text(errors='ignore').splitlines():
                    if not line.strip():
                        continue
                    try:
                        entry = json.loads(line)
                    except Exception:
                        continue
                    # Get usage from various locations
                    usage = (entry.get("usage")
                             or entry.get("message", {}).get("usage")
                             or {})
                    input_t += usage.get("input", 0) or usage.get("input_tokens", 0) or usage.get("inputTokens", 0)
                    output_t += usage.get("output", 0) or usage.get("output_tokens", 0) or usage.get("outputTokens", 0)
                    # Get model
                    m = entry.get("message", {}).get("model") or entry.get("model")
                    if m:
                        model = m
                    ts = entry.get("timestamp")
                    if ts:
                        last_ts = ts

                if input_t + output_t == 0:
                    continue

                total = input_t + output_t
                limit = 200_000
                pct = round((total / limit) * 100, 1)
                result.append({
                    "label": f"{agent_name}",
                    "model": model,
                    "contextTokens": total,
                    "contextLimit": limit,
                    "contextPct": min(pct, 100),
                    "inputTokens": input_t,
                    "outputTokens": output_t,
                    "totalTokens": total,
                    "updatedAt": last_ts,
                })
                break  # only show latest session per agent
            except Exception:
                continue

    result.sort(key=lambda x: x["contextPct"], reverse=True)
    return {"sessions": result, "count": len(result)}

    result = []
    for s in sessions:
        key = s.get("key", "")
        # Only show meaningful sessions
        if not key or "cron" in key:
            continue

        context_tokens = s.get("contextTokens") or 0
        input_tokens = s.get("inputTokens") or 0
        output_tokens = s.get("outputTokens") or 0
        total_tokens = s.get("totalTokens") or (input_tokens + output_tokens)

        # Infer session label
        if "whatsapp:direct:+16172308368" in key:
            label = "Selam ↔ Mikael (WhatsApp)"
        elif "whatsapp:direct" in key:
            label = "Selam ↔ Other (WhatsApp)"
        elif "whatsapp:group" in key:
            label = "Group Chat"
        elif key.endswith(":main"):
            label = "Selam Main Session"
        else:
            label = key.split(":")[-1][:30]

        model = s.get("model", "—")
        context_limit = 1_000_000 if context_tokens > 400_000 else 200_000
        context_pct = round((context_tokens / context_limit) * 100, 1) if context_limit else 0

        result.append({
            "label": label,
            "model": model,
            "contextTokens": context_tokens,
            "contextLimit": context_limit,
            "contextPct": context_pct,
            "inputTokens": input_tokens,
            "outputTokens": output_tokens,
            "totalTokens": total_tokens,
            "updatedAt": s.get("updatedAt"),
        })

    # Sort by context usage descending
    result.sort(key=lambda x: x["contextPct"], reverse=True)
    return {"sessions": result[:6], "count": len(result)}


@app.get("/live-activity")
def get_live_activity() -> dict[str, Any]:
    """Return the most recent real activity for each agent from their session logs."""
    from datetime import datetime

    AGENT_DIRS = {
        "Selam":  Path("/Users/michaelderibe/.openclaw/agents/main/sessions"),
        "Bulcha": Path("/Users/michaelderibe/.openclaw/agents/bulcha/sessions"),
        "Merry":  Path("/Users/michaelderibe/.openclaw/agents/closer/sessions"),
    }

    SKIP = [
        "HEARTBEAT_OK", "Read HEARTBEAT.md", "[cron:", "Conversation info (untrusted",
        "message_id", "Current time:", "bulcha-proactive", "Return your summary",
        "Subagent Context", "subagent_announce", "Auto-refreshes",
        "Build successful", "Let me rebuild", "Let me restart",
    ]

    result = {}
    for agent_name, session_dir in AGENT_DIRS.items():
        if not session_dir.exists():
            result[agent_name] = {"status": "idle", "lastMessage": None, "timestamp": None}
            continue
        files = sorted(session_dir.glob("*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True)
        last_msg = None
        last_ts = None
        for fpath in files[:3]:
            try:
                with open(fpath) as f:
                    lines = f.readlines()
                for line in reversed(lines):
                    try:
                        e = json.loads(line.strip())
                        if e.get("type") != "message":
                            continue
                        msg = e.get("message", {})
                        if msg.get("role") != "assistant":
                            continue
                        parts = msg.get("content", [])
                        text = " ".join(
                            p.get("text", "") for p in parts
                            if isinstance(p, dict) and p.get("type") == "text"
                        ).strip()
                        if not text or len(text) < 20:
                            continue
                        if any(s.lower() in text.lower() for s in SKIP):
                            continue
                        last_msg = text[:200]
                        last_ts = e.get("timestamp", "")
                        break
                    except Exception:
                        continue
                if last_msg:
                    break
            except Exception:
                continue

        result[agent_name] = {
            "status": "active" if last_msg else "idle",
            "lastMessage": last_msg,
            "timestamp": last_ts,
        }

    return {"agents": result}


@app.get("/task-sync")
def sync_tasks() -> dict[str, Any]:
    """
    Derive real task status from agent log files.
    Updates state.json automatically with live progress.
    """
    from datetime import datetime
    import csv

    OUTREACH_LOG = Path("/Users/michaelderibe/.openclaw/workspace/agents/bulcha/logs/outreach_2026-03-30.csv")
    CLOSER_LOG = Path("/Users/michaelderibe/.openclaw/workspace/agents/closer/logs/closer_log.csv")
    INBOX_REPLIES = Path("/Users/michaelderibe/.openclaw/workspace/agents/closer/logs/inbox_replies.json")

    stats = {
        "emails_sent": 0,
        "leads_total": 54,
        "replies": 0,
        "calls_booked": 0,
        "deals_closed": 0,
        "merry_active": False,
    }

    # Count emails sent
    if OUTREACH_LOG.exists():
        with open(OUTREACH_LOG) as f:
            reader = csv.DictReader(f)
            sent = [r for r in reader if r.get("status","").lower() == "sent"]
            stats["emails_sent"] = len(sent)

    # Count replies and calls from closer log
    if CLOSER_LOG.exists():
        with open(CLOSER_LOG) as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            real_rows = [r for r in rows if r.get("lead_name","") not in ("", "HEARTBEAT_CHECK")]
            stats["replies"] = len(real_rows)
            stats["calls_booked"] = len([r for r in real_rows if "call" in r.get("outcome","").lower() or "booked" in r.get("outcome","").lower()])
            stats["deals_closed"] = len([r for r in real_rows if "closed" in r.get("outcome","").lower() or "deal" in r.get("outcome","").lower()])
            stats["merry_active"] = True

    # Derive task statuses
    tasks = []

    # Selam tasks
    tasks.append({"title": "Unblock Email Outreach", "status": "complete" if stats["emails_sent"] > 0 else "in-progress", "owner": "Selam", "priority": "urgent", "progress": 100 if stats["emails_sent"] > 0 else 40})
    tasks.append({"title": "Permanent URL — mc.atxo.me", "status": "complete", "owner": "Selam", "priority": "high", "progress": 100})
    tasks.append({"title": "Activate Merry (Closer Agent)", "status": "complete", "owner": "Selam", "priority": "high", "progress": 100})
    tasks.append({"title": "Book First Discovery Call", "status": "complete" if stats["calls_booked"] > 0 else "pending", "owner": "Selam", "priority": "high", "progress": min(100, stats["calls_booked"] * 50)})
    tasks.append({"title": "Close First Pilot", "status": "complete" if stats["deals_closed"] > 0 else "pending", "owner": "Selam", "priority": "high", "progress": min(100, stats["deals_closed"] * 100)})

    # Bulcha tasks
    emails_pct = round((stats["emails_sent"] / stats["leads_total"]) * 100) if stats["leads_total"] > 0 else 0
    tasks.append({"title": f"Send batch_20260326 ({stats['emails_sent']}/54 sent)", "status": "complete" if stats["emails_sent"] >= 54 else "in-progress" if stats["emails_sent"] > 0 else "pending", "owner": "Bulcha", "priority": "urgent", "progress": emails_pct})
    tasks.append({"title": "Outreach Send Log Maintenance", "status": "active" if stats["emails_sent"] > 0 else "pending", "owner": "Bulcha", "priority": "high", "progress": emails_pct})

    # Merry tasks
    tasks.append({"title": "Monitor Inbox — selam@atxo.me", "status": "active", "owner": "Merry", "priority": "high", "progress": 10})
    tasks.append({"title": f"Book 2 Discovery Calls ({stats['calls_booked']}/2)", "status": "complete" if stats["calls_booked"] >= 2 else "in-progress" if stats["calls_booked"] > 0 else "pending", "owner": "Merry", "priority": "high", "progress": min(100, stats["calls_booked"] * 50)})
    tasks.append({"title": "Close First Pilot Deal", "status": "complete" if stats["deals_closed"] > 0 else "pending", "owner": "Merry", "priority": "high", "progress": min(100, stats["deals_closed"] * 100)})

    # Update state.json
    state = load_state()
    state["tasks"] = tasks
    state["pipeline"]["batch_20260326"] = {
        "total": stats["leads_total"],
        "aGrade": 36,
        "bGrade": 18,
        "status": "complete" if stats["emails_sent"] >= 54 else "sending" if stats["emails_sent"] > 0 else "ready_to_send",
        "emailsSent": stats["emails_sent"],
        "replies": stats["replies"],
        "callsBooked": stats["calls_booked"],
        "dealsClosed": stats["deals_closed"],
    }
    DATA_PATH.write_text(json.dumps(state, indent=2))

    return {"stats": stats, "tasks": tasks, "updatedAt": datetime.utcnow().isoformat()}


@app.post("/process-followups")
async def process_followups() -> dict:
    """Process any pending follow-up emails whose send_at time has passed."""
    from datetime import datetime
    followups_path = BASE_DIR / "data" / "pending_followups.json"
    followups = _load_json_file(followups_path, [])
    now = datetime.utcnow().isoformat()
    sent_count = 0
    for f in followups:
        if not f.get("sent") and f.get("send_at", "") <= now:
            try:
                _send_followup_email(f["email"], f["product_key"])
                f["sent"] = True
                f["sent_at"] = now
                sent_count += 1
            except Exception as exc:
                f["error"] = str(exc)
    _save_json_file(followups_path, followups)
    return {"processed": sent_count, "total_pending": len([x for x in followups if not x.get("sent")])}


@app.get("/roadmap")
def get_roadmap() -> dict[str, Any]:
    """Serve the roadmap.md as structured data."""
    roadmap_path = Path("/Users/michaelderibe/.openclaw/workspace/strategy/roadmap.md")
    if not roadmap_path.exists():
        raise HTTPException(status_code=404, detail="Roadmap not found")
    return {"content": roadmap_path.read_text(), "updatedAt": roadmap_path.stat().st_mtime}


# ─── Product configuration ────────────────────────────────────────────────────

# Map Stripe price IDs → product keys
PRICE_TO_PRODUCT: dict[str, str] = {
    # AI Outreach Playbook ($47)
    # price ID added at runtime from deliveries or hard-coded here if known
    # AI SDR System in a Box ($197)
    "price_1TGwbI1jFwbxx9lx7GlTBeWZ": "ai-sdr-system",
    # AI Agent Audit ($500) — KILLED, kept for legacy
    "price_1TGwbJ1jFwbxx9lxOq9iTvUy": "ai-agent-audit",
    # Lead Lists ($97/month)
    "price_1TGwbL1jFwbxx9lxtAwkJpU9": "lead-lists",
    # Agent Security Playbook — Full Toolkit ($197)
    "price_1THA1H1jFwbxx9lxHzFAI9lz": "agent-security-toolkit",
    # Agent Security Playbook — Core PDF ($97)
    "price_1THA1Y1jFwbxx9lxDe7ziAbn": "agent-security-core",
    # Cold Email Starter Kit ($27)
    "price_1THfqT1jFwbxx9lxl04wVYx4": "cold-email-starter-kit",
    # 90-Day Revenue Roadmap ($97)
    "price_1THfql1jFwbxx9lxJtMoNZeX": "90-day-revenue-roadmap",
    # Founder's Growth OS ($297)
    "price_1THfr31jFwbxx9lxKsWN7Ysf": "founders-growth-os",
}

# Map Stripe payment link IDs → product keys (fallback)
PAYMENT_LINK_TO_PRODUCT: dict[str, str] = {
    "plink_1THA1g1jFwbxx9lxeU6ZlICT": "agent-security-toolkit",
    "plink_1THA1h1jFwbxx9lx7PQqpI5F": "agent-security-core",
    "plink_1THfqa1jFwbxx9lxEBUihu0V": "cold-email-starter-kit",
    "plink_1THfqn1jFwbxx9lxGZsca5ly": "90-day-revenue-roadmap",
    "plink_1THfr41jFwbxx9lxe0WkjlyT": "founders-growth-os",
}

PRODUCT_CONFIG: dict[str, dict] = {
    "ai-outreach-playbook": {
        "name": "AI Outreach Playbook",
        "pdf_path": BASE_DIR / "static" / "ai-outreach-playbook.pdf",
        "filename": "ai-outreach-playbook.pdf",
        "download_endpoint": "download",
        "email_subject": "Your AI Outreach Playbook — Download Link",
        "email_heading": "Your AI Outreach Playbook is ready!",
        "email_cta": "Download Your Playbook →",
        "type": "pdf",
    },
    "ai-sdr-system": {
        "name": "AI SDR System in a Box",
        "pdf_path": BASE_DIR / "static" / "ai-sdr-system-in-a-box.pdf",
        "filename": "ai-sdr-system-in-a-box.pdf",
        "download_endpoint": "download/sdr",
        "email_subject": "Your AI SDR System in a Box — Download Link",
        "email_heading": "Your AI SDR System in a Box is ready!",
        "email_cta": "Download Your Guide →",
        "type": "pdf",
    },
    "ai-agent-audit": {
        "name": "AI Agent Audit",
        "email_subject": "Your AI Agent Audit — Booking Instructions",
        "type": "booking",
    },
    "lead-lists": {
        "name": "Crypto/Web3 Lead List",
        "csv_path": BASE_DIR / "static" / "crypto-web3-sample-list.csv",
        "filename": "crypto-web3-sample-list.csv",
        "download_endpoint": "download/leads",
        "email_subject": "Your Crypto/Web3 Lead List — Download + Monthly Delivery Info",
        "email_heading": "Your first lead list is ready!",
        "email_cta": "Download Your Lead List →",
        "type": "csv",
    },
    "agent-security-toolkit": {
        "name": "Agent Security Playbook — Full Toolkit",
        "download_url": "https://safeagent.build/product/agent-security-playbook.zip",
        "email_subject": "Your Agent Security Playbook is ready 🔐",
        "email_heading": "You're protected. Your toolkit is ready.",
        "email_cta": "Download the Full Toolkit →",
        "type": "external_url",
    },
    "agent-security-core": {
        "name": "Agent Security Playbook — Core PDF",
        "download_url": "https://safeagent.build/product/playbook.md",
        "email_subject": "Your Agent Security Playbook PDF is ready 🔐",
        "email_heading": "Your playbook is ready.",
        "email_cta": "Download the PDF →",
        "type": "external_url",
    },
    "cold-email-starter-kit": {
        "name": "Cold Email Starter Kit",
        "pdf_path": BASE_DIR / "static" / "cold-email-starter-kit.pdf",
        "filename": "cold-email-starter-kit.pdf",
        "download_endpoint": "download/cold-email-kit",
        "email_subject": "Your Cold Email Starter Kit — Download Inside",
        "email_heading": "Your Cold Email Starter Kit is ready!",
        "email_cta": "Download Your Kit →",
        "type": "pdf",
    },
    "90-day-revenue-roadmap": {
        "name": "90-Day Revenue Roadmap",
        "pdf_path": BASE_DIR / "static" / "90-day-revenue-roadmap.pdf",
        "filename": "90-day-revenue-roadmap.pdf",
        "download_endpoint": "download/revenue-roadmap",
        "email_subject": "Your 90-Day Revenue Roadmap — Download Inside",
        "email_heading": "Your 90-Day Revenue Roadmap is ready!",
        "email_cta": "Download Your Roadmap →",
        "type": "pdf",
    },
    "founders-growth-os": {
        "name": "Founder's Growth OS",
        "pdf_path": BASE_DIR / "static" / "founders-growth-os.pdf",
        "filename": "founders-growth-os.pdf",
        "download_endpoint": "download/founders-os",
        "email_subject": "Your Founder's Growth OS — Access Inside",
        "email_heading": "Your Founder's Growth OS is ready!",
        "email_cta": "Access Your OS →",
        "type": "pdf",
    },
}

PDF_PATH = BASE_DIR / "static" / "ai-outreach-playbook.pdf"
DELIVERIES_PATH = BASE_DIR / "data" / "deliveries.json"
VERIFIED_SESSIONS_PATH = BASE_DIR / "data" / "verified_sessions.json"


def _load_json_file(path: Path, default) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text())
    except Exception:
        return default


def _save_json_file(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2))


def _detect_product_key(session: dict) -> str:
    """Detect which product was purchased from a Stripe checkout session."""
    # Check session-level metadata first
    meta = session.get("metadata", {}) or {}
    if meta.get("product_key"):
        return meta["product_key"]

    # Try to resolve from line items (requires expand, may not be available in webhook)
    # Fall back to checking payment link metadata
    payment_link = session.get("payment_link", "")

    # Check payment link ID (most reliable for new products)
    payment_link = session.get("payment_link", "")
    if payment_link in PAYMENT_LINK_TO_PRODUCT:
        return PAYMENT_LINK_TO_PRODUCT[payment_link]

    # Check amount — use payment link context to disambiguate $197/$97 conflicts
    amount = session.get("amount_total", 0)
    if amount == 2700:
        return "cold-email-starter-kit"
    if amount == 4700:
        return "ai-outreach-playbook"
    if amount == 9700:
        return "lead-lists"  # default $97 = lead lists (security core + roadmap caught above by plink)
    if amount == 19700:
        return "ai-sdr-system"  # default $197 = SDR System (security toolkit caught above by plink)
    if amount == 29700:
        return "founders-growth-os"
    if amount == 50000:
        return "ai-agent-audit"

    # Default to playbook for backwards compatibility
    return "ai-outreach-playbook"


def _send_product_email(to_email: str, session_id: str, product_key: str) -> None:
    """Send the appropriate post-purchase email based on product type."""
    config = PRODUCT_CONFIG.get(product_key, PRODUCT_CONFIG["ai-outreach-playbook"])
    product_type = config.get("type", "pdf")

    if product_type == "booking":
        _send_audit_booking_email(to_email, session_id, config)
    elif product_type == "csv":
        _send_lead_list_email(to_email, session_id, config)
    elif product_type == "external_url":
        _send_external_download_email(to_email, config)
    else:
        _send_download_email(to_email, session_id, config)


def _send_download_email(to_email: str, session_id: str, config: dict) -> None:
    endpoint = config.get("download_endpoint", "download")
    download_url = f"https://mc.atxo.me/{endpoint}/{session_id}"
    subject = config["email_subject"]
    heading = config.get("email_heading", "Your purchase is ready!")
    cta = config.get("email_cta", "Download Now →")
    product_name = config["name"]

    body_html = f"""
<html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333">
<h2 style="color:#4fd1c5">{heading}</h2>
<p>Thanks for your purchase. Click the button below to download:</p>
<p style="text-align:center;margin:32px 0">
  <a href="{download_url}" style="background:linear-gradient(135deg,#4fd1c5,#6c63ff);color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:16px">
    {cta}
  </a>
</p>
<p style="color:#666;font-size:14px">Or copy this link: <a href="{download_url}">{download_url}</a></p>
<p style="color:#666;font-size:14px">Questions? Reply to this email or reach us at <a href="mailto:selam@atxo.me">selam@atxo.me</a></p>
<hr style="border:none;border-top:1px solid #eee;margin:32px 0">
<p style="color:#999;font-size:12px">ATXO Labs · <a href="https://atxo.me">atxo.me</a></p>
</body></html>
"""
    _send_email(to_email, subject, body_html)


def _schedule_followup_email(to_email: str, product_key: str, session_id: str) -> None:
    """Schedule a 48h follow-up email by writing to a pending followups file."""
    from datetime import datetime, timedelta
    followups_path = BASE_DIR / "data" / "pending_followups.json"
    followups = _load_json_file(followups_path, [])
    send_at = (datetime.utcnow() + timedelta(hours=48)).isoformat()
    followups.append({
        "email": to_email,
        "product_key": product_key,
        "session_id": session_id,
        "send_at": send_at,
        "sent": False,
    })
    _save_json_file(followups_path, followups)


def _send_followup_email(to_email: str, product_key: str) -> None:
    """Send the 48h follow-up / feedback request email."""
    is_security = product_key in ("agent-security-toolkit", "agent-security-core")
    if not is_security:
        return  # Only send follow-ups for Agent Security Playbook for now

    subject = "Quick check-in — how's the Agent Security Playbook?"
    body_html = f"""
<html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333;background:#0a0a0a;padding:32px">
<div style="background:#111;border:1px solid #222;border-radius:12px;padding:32px">
  <div style="color:#ff3a3a;font-size:20px;font-weight:700;margin-bottom:16px">48 hours in — how's it going?</div>
  <p style="color:#ccc">Hey,</p>
  <p style="color:#ccc">It's been 48 hours since you picked up the Agent Security Playbook. I wanted to check in.</p>
  <p style="color:#ccc">Have you had a chance to implement anything yet? The Pre-Flight Checklist is the fastest win — most operators get it done in under an hour.</p>
  <p style="color:#ccc">If you got stuck anywhere, I want to know. Every piece of feedback directly shapes the next version.</p>
  <p style="text-align:center;margin:28px 0">
    <a href="https://safeagent.build/feedback.html" style="background:#ff3a3a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">
      Share Feedback (60 seconds) →
    </a>
  </p>
  <p style="color:#666;font-size:13px">Or just reply to this email — I read every response personally.</p>
  <hr style="border:none;border-top:1px solid #222;margin:24px 0">
  <p style="color:#444;font-size:11px">Agent Security Playbook · <a href="https://safeagent.build" style="color:#666">safeagent.build</a> · <a href="mailto:support@atxo.me" style="color:#666">support@atxo.me</a></p>
</div>
</body></html>
"""
    _send_email(to_email, subject, body_html)


def _send_external_download_email(to_email: str, config: dict) -> None:
    """Send delivery email with a direct external download URL (e.g. Agent Security Playbook)."""
    download_url = config.get("download_url", "https://safeagent.build")
    subject = config["email_subject"]
    heading = config.get("email_heading", "Your purchase is ready!")
    cta = config.get("email_cta", "Download Now →")
    product_name = config["name"]

    body_html = f"""
<html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333;background:#0a0a0a;padding:32px">
<div style="background:#111;border:1px solid #222;border-radius:12px;padding:32px">
  <div style="color:#ff3a3a;font-size:24px;font-weight:700;margin-bottom:8px">🔐 {heading}</div>
  <p style="color:#ccc">Thanks for purchasing <strong style="color:#fff">{product_name}</strong>. Your download is ready.</p>
  <p style="text-align:center;margin:32px 0">
    <a href="{download_url}" style="background:#ff3a3a;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px">
      {cta}
    </a>
  </p>
  <p style="color:#888;font-size:14px">Direct link: <a href="{download_url}" style="color:#ff3a3a">{download_url}</a></p>
  <hr style="border:none;border-top:1px solid #222;margin:24px 0">
  <p style="color:#666;font-size:13px"><strong style="color:#ccc">Start here:</strong> Open the Pre-Flight Security Checklist first — it gives you the fastest wins. Then read the Playbook cover to cover.</p>
  <p style="color:#666;font-size:13px">Questions? Email <a href="mailto:support@atxo.me" style="color:#ff3a3a">support@atxo.me</a></p>
  <p style="color:#444;font-size:11px;margin-top:24px">Agent Security Playbook · A product by ATXO Labs · <a href="https://safeagent.build" style="color:#666">safeagent.build</a></p>
</div>
</body></html>
"""
    _send_email(to_email, subject, body_html)


def _send_audit_booking_email(to_email: str, session_id: str, config: dict) -> None:
    subject = config["email_subject"]
    body_html = f"""
<html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333">
<h2 style="color:#4fd1c5">Your AI Agent Audit is booked ✓</h2>
<p>Hi there,</p>
<p>Thank you for purchasing the <strong>AI Agent Audit — 60 Min + Action Plan</strong>. I'm looking forward to digging into your operations.</p>

<h3 style="color:#333">Next Step: Schedule Your Call</h3>
<p>Please reply to this email with <strong>3 available time slots</strong> that work for you (include your time zone).</p>
<p>I'll confirm within 24 hours.</p>

<h3 style="color:#333">What to Expect</h3>
<ul style="color:#555;line-height:1.8">
  <li><strong>Before the call:</strong> I'll send you a 10-question pre-call questionnaire. Takes ~10 minutes. Your answers shape the entire session.</li>
  <li><strong>On the call:</strong> 60 minutes of focused ops review — I'll identify your top 3 automation opportunities.</li>
  <li><strong>After the call:</strong> Written action plan delivered within 48 hours. Includes specific automation builds, recommended tools, estimated ROI, and a phased implementation roadmap.</li>
</ul>

<h3 style="color:#333">To prepare:</h3>
<p style="color:#555">Have a rough sense of your current tool stack and where you feel the most manual pain. That's it — I'll take it from there.</p>

<hr style="border:none;border-top:1px solid #eee;margin:32px 0">
<p style="color:#555">Reply to this email to schedule, or reach me directly at <a href="mailto:selam@atxo.me">selam@atxo.me</a></p>
<p style="color:#999;font-size:12px">ATXO Labs · <a href="https://atxo.me">atxo.me</a></p>
</body></html>
"""
    _send_email(to_email, subject, body_html)


def _send_lead_list_email(to_email: str, session_id: str, config: dict) -> None:
    download_url = f"https://mc.atxo.me/download/leads/{session_id}"
    subject = config["email_subject"]
    body_html = f"""
<html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333">
<h2 style="color:#4fd1c5">Your Crypto/Web3 Lead List is ready!</h2>
<p>Thanks for subscribing to the <strong>Crypto/Web3 Lead List — 50 Leads/Month</strong>.</p>

<h3 style="color:#333">Download Your First Batch</h3>
<p style="text-align:center;margin:24px 0">
  <a href="{download_url}" style="background:linear-gradient(135deg,#4fd1c5,#6c63ff);color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:16px">
    Download Your Lead List →
  </a>
</p>
<p style="color:#666;font-size:14px">Direct link: <a href="{download_url}">{download_url}</a></p>

<h3 style="color:#333">What's Included</h3>
<ul style="color:#555;line-height:1.8">
  <li><strong>20 sample leads</strong> from the March 2026 Crypto/Web3 batch</li>
  <li>Fields: company, contact_name, title, linkedin_url, email, fit_score, trigger_note</li>
  <li>A-grade leads: CEO/Co-Founder contacts at funded Crypto/Web3 infrastructure companies</li>
</ul>

<h3 style="color:#333">Monthly Delivery</h3>
<ul style="color:#555;line-height:1.8">
  <li>50 fresh leads delivered to this email address on the same date each month</li>
  <li>No duplicates within a 6-month window</li>
  <li>All leads MX-verified before delivery</li>
  <li>A/B graded + trigger notes included</li>
</ul>

<h3 style="color:#333">How to Use These Leads</h3>
<ol style="color:#555;line-height:1.8">
  <li>Import into Clay → run email verification (ZeroBounce or Hunter.io)</li>
  <li>Load into Instantly.ai → 3-step cold sequence</li>
  <li>Send A-grades first: Mon–Thu, 8–10 AM recipient time</li>
  <li>Expected open rate: 32–45% | Reply rate: 8–14%</li>
</ol>

<hr style="border:none;border-top:1px solid #eee;margin:32px 0">
<p style="color:#555">Need help setting up the outreach system? Reply to this email — or grab the <a href="https://buy.stripe.com/cNi28jfS21luca4fVh8IU03">AI SDR System in a Box ($197)</a> for the full playbook.</p>
<p style="color:#999;font-size:12px">ATXO Labs · <a href="https://atxo.me">atxo.me</a> · Cancel anytime: reply with "cancel"</p>
</body></html>
"""
    _send_email(to_email, subject, body_html)


def _send_lead_list_renewal_email(to_email: str) -> None:
    """Send the monthly renewal email for the Crypto/Web3 Lead List subscription."""
    from calendar import month_name
    month = month_name[datetime.utcnow().month]
    year = datetime.utcnow().year
    month_label = f"{month} {year}"

    # Use a stable token-free download link for renewal (subscriber already verified via Stripe)
    download_url = "https://mc.atxo.me/static/crypto-web3-sample-list.csv"

    subject = f"Your {month_label} Crypto/Web3 Lead List is ready"
    body_html = f"""
<html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333">
<h2 style="color:#4fd1c5">Your monthly Crypto/Web3 Lead List is ready 🚀</h2>
<p>Hi there,</p>
<p>Your <strong>{month_label} batch</strong> of the Crypto/Web3 Lead List is here.</p>
<p style="text-align:center;margin:28px 0">
  <a href="{download_url}" style="background:linear-gradient(135deg,#4fd1c5,#6c63ff);color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:16px">
    Download Your {month_label} Batch →
  </a>
</p>
<p style="color:#666;font-size:14px">Direct link: <a href="{download_url}">{download_url}</a></p>

<h3 style="color:#333">What's in this batch</h3>
<ul style="color:#555;line-height:1.8">
  <li>26 Crypto/Web3 infrastructure leads (CEOs, Co-Founders, VPs)</li>
  <li>Fields: company, contact_name, title, linkedin_url, email, fit_score, trigger_note</li>
  <li>A-grade leads: funded infrastructure companies — Blockdaemon, Alchemy, Polygon, Chainlink, Fireblocks, EigenLayer, Aptos, and more</li>
  <li>All A/B graded with trigger notes for personalized outreach</li>
</ul>

<h3 style="color:#333">Quick-start tips</h3>
<ol style="color:#555;line-height:1.8">
  <li>Import into Clay → run email verification</li>
  <li>Load into Instantly.ai → 3-step cold sequence</li>
  <li>A-grades first: Mon–Thu, 8–10 AM recipient time</li>
</ol>

<hr style="border:none;border-top:1px solid #eee;margin:32px 0">
<p style="color:#555">Questions? Reply to this email or reach us at <a href="mailto:selam@atxo.me">selam@atxo.me</a></p>
<p style="color:#999;font-size:12px">ATXO Labs · <a href="https://atxo.me">atxo.me</a> · Cancel anytime: reply with "cancel"</p>
</body></html>
"""
    _send_email(to_email, subject, body_html)


def _send_email(to_email: str, subject: str, body_html: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = ZOHO_USER
    msg["To"] = to_email
    msg.attach(MIMEText(body_html, "html"))
    password = _get_zoho_password()
    ctx = ssl.create_default_context()
    with smtplib.SMTP_SSL(ZOHO_HOST, ZOHO_PORT, context=ctx) as server:
        server.login(ZOHO_USER, password)
        server.sendmail(ZOHO_USER, to_email, msg.as_string())


def _get_stripe_webhook_secret() -> str:
    secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
    if secret:
        return secret
    secret_path = Path("/Users/michaelderibe/.openclaw/secrets/stripe_webhook_secret")
    if secret_path.exists():
        return secret_path.read_text().strip()
    return ""


@app.post("/stripe/webhook")
async def stripe_webhook(request: Request) -> dict[str, str]:
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    webhook_secret = _get_stripe_webhook_secret()

    if webhook_secret:
        try:
            stripe.WebhookSignature.verify_header(
                payload.decode("utf-8") if isinstance(payload, bytes) else payload,
                sig_header,
                webhook_secret,
            )
        except stripe.error.SignatureVerificationError:
            raise HTTPException(status_code=400, detail="Invalid webhook signature")
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid webhook signature")
    try:
        event = json.loads(payload)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    if event.get("type") == "checkout.session.completed":
        session = event["data"]["object"]
        session_id = session.get("id", "")
        customer_email = session.get("customer_details", {}).get("email") or session.get("customer_email", "")
        amount = session.get("amount_total", 0) // 100  # Convert cents to dollars
        product_key = _detect_product_key(session)

        email_status = "ok"
        if customer_email:
            try:
                _send_product_email(customer_email, session_id, product_key)
            except Exception as exc:
                email_status = f"error: {exc}"

            # Segment buyer and enroll in nurture sequence
            try:
                buyer_info = _segment_buyer(customer_email, product_key, amount)
                segment_msg = f"🎯 {buyer_info['segment']} | {buyer_info['sequence']}"
            except Exception as e:
                segment_msg = f"Segment error: {e}"

            # Schedule 48h follow-up for Agent Security Playbook buyers
            if product_key in ("agent-security-toolkit", "agent-security-core"):
                try:
                    _schedule_followup_email(customer_email, product_key, session_id)
                except Exception:
                    pass  # Non-critical — don't fail the webhook

            # WhatsApp notification for ALL sales
            try:
                product_name = PRODUCT_CONFIG.get(product_key, {}).get("name", product_key)
                emoji = "🎉" if amount >= 197 else "💰" if amount >= 97 else "✅"
                priority = "🔥 HIGH" if amount >= 197 else "📊 Medium" if amount >= 97 else "📝 Standard"
                
                wa_message = f"""{emoji} SALE: ${amount}

Product: {product_name}
Buyer: {customer_email}
Priority: {priority}
{segment_msg}

Time: {datetime.utcnow().strftime('%H:%M UTC')}"""
                
                _send_whatsapp_notification(wa_message)
            except Exception as e:
                print(f"[WhatsApp] Notification failed: {e}")

        # Log delivery
        deliveries = _load_json_file(DELIVERIES_PATH, [])
        deliveries.append({
            "session_id": session_id,
            "email": customer_email,
            "product_key": product_key,
            "amount": amount,
            "sent_at": datetime.utcnow().isoformat(),
            "email_status": email_status,
        })
        _save_json_file(DELIVERIES_PATH, deliveries)

    elif event.get("type") == "invoice.payment_succeeded":
        invoice = event["data"]["object"]
        # Only process subscription renewals (not the initial charge)
        subscription_id = invoice.get("subscription")
        if not subscription_id:
            return {"received": "ok"}

        # Check if this invoice is for the lead list price
        lines = invoice.get("lines", {}).get("data", [])
        is_lead_list = any(
            line.get("price", {}).get("id") == "price_1TGwbL1jFwbxx9lxtAwkJpU9"
            for line in lines
        )
        if not is_lead_list:
            return {"received": "ok"}

        customer_email = (
            invoice.get("customer_email")
            or invoice.get("customer_details", {}).get("email", "")
        )
        if not customer_email:
            # Try to fetch from Stripe customer object
            customer_id = invoice.get("customer")
            if customer_id:
                try:
                    cust = stripe.Customer.retrieve(customer_id)
                    customer_email = cust.get("email", "")
                except Exception:
                    pass

        renewal_status = "ok"
        if customer_email:
            try:
                _send_lead_list_renewal_email(customer_email)
            except Exception as exc:
                renewal_status = f"error: {exc}"

        # Log renewal delivery
        deliveries = _load_json_file(DELIVERIES_PATH, [])
        deliveries.append({
            "invoice_id": invoice.get("id", ""),
            "subscription_id": subscription_id,
            "email": customer_email,
            "product_key": "lead-lists",
            "event_type": "renewal",
            "sent_at": datetime.utcnow().isoformat(),
            "email_status": renewal_status,
        })
        _save_json_file(DELIVERIES_PATH, deliveries)

    return {"received": "ok"}


def _verify_stripe_session(session_id: str) -> bool:
    """Verify a Stripe session is paid. Returns True if valid."""
    verified = _load_json_file(VERIFIED_SESSIONS_PATH, {})
    if session_id in verified:
        return True
    try:
        session = stripe.checkout.Session.retrieve(session_id)
        if session.payment_status not in ("paid",) and session.status not in ("complete",):
            return False
    except stripe.error.InvalidRequestError:
        return False
    except stripe.error.StripeError:
        return False
    verified[session_id] = datetime.utcnow().isoformat()
    _save_json_file(VERIFIED_SESSIONS_PATH, verified)
    return True


@app.get("/download/{session_id}")
def download_playbook(session_id: str) -> FileResponse:
    """Legacy endpoint — AI Outreach Playbook."""
    if not PDF_PATH.exists():
        raise HTTPException(status_code=404, detail="PDF not found on server")
    if not _verify_stripe_session(session_id):
        raise HTTPException(status_code=403, detail="Invalid or unpaid session")
    return FileResponse(str(PDF_PATH), filename="ai-outreach-playbook.pdf", media_type="application/pdf")


@app.get("/download/sdr/{session_id}")
def download_sdr_system(session_id: str) -> FileResponse:
    """AI SDR System in a Box — PDF download."""
    pdf = BASE_DIR / "static" / "ai-sdr-system-in-a-box.pdf"
    if not pdf.exists():
        raise HTTPException(status_code=404, detail="PDF not found on server")
    if not _verify_stripe_session(session_id):
        raise HTTPException(status_code=403, detail="Invalid or unpaid session")
    return FileResponse(str(pdf), filename="ai-sdr-system-in-a-box.pdf", media_type="application/pdf")


@app.get("/download/leads/{session_id}")
def download_lead_list(session_id: str) -> FileResponse:
    """Crypto/Web3 Lead List — CSV download."""
    csv_path = BASE_DIR / "static" / "crypto-web3-sample-list.csv"
    if not csv_path.exists():
        raise HTTPException(status_code=404, detail="Lead list not found on server")
    if not _verify_stripe_session(session_id):
        raise HTTPException(status_code=403, detail="Invalid or unpaid session")
    return FileResponse(str(csv_path), filename="crypto-web3-sample-list.csv", media_type="text/csv")


@app.get("/download/cold-email-kit/{session_id}")
def download_cold_email_kit(session_id: str) -> FileResponse:
    """Cold Email Starter Kit — PDF download."""
    pdf = BASE_DIR / "static" / "cold-email-starter-kit.pdf"
    if not pdf.exists():
        raise HTTPException(status_code=404, detail="PDF not found on server")
    if not _verify_stripe_session(session_id):
        raise HTTPException(status_code=403, detail="Invalid or unpaid session")
    return FileResponse(str(pdf), filename="cold-email-starter-kit.pdf", media_type="application/pdf")


@app.get("/download/revenue-roadmap/{session_id}")
def download_revenue_roadmap(session_id: str) -> FileResponse:
    """90-Day Revenue Roadmap — PDF download."""
    pdf = BASE_DIR / "static" / "90-day-revenue-roadmap.pdf"
    if not pdf.exists():
        raise HTTPException(status_code=404, detail="PDF not found on server")
    if not _verify_stripe_session(session_id):
        raise HTTPException(status_code=403, detail="Invalid or unpaid session")
    return FileResponse(str(pdf), filename="90-day-revenue-roadmap.pdf", media_type="application/pdf")


@app.get("/download/founders-os/{session_id}")
def download_founders_os(session_id: str) -> FileResponse:
    """Founder's Growth OS — PDF download."""
    pdf = BASE_DIR / "static" / "founders-growth-os.pdf"
    if not pdf.exists():
        raise HTTPException(status_code=404, detail="PDF not found on server")
    if not _verify_stripe_session(session_id):
        raise HTTPException(status_code=403, detail="Invalid or unpaid session")
    return FileResponse(str(pdf), filename="founders-growth-os.pdf", media_type="application/pdf")


@app.get("/api/analytics/sales")
def get_sales_analytics() -> dict:
    """Sales analytics dashboard data."""
    deliveries = _load_json_file(DELIVERIES_PATH, [])
    segments = _load_json_file(BASE_DIR / "data" / "buyer_segments.jsonl", [])
    
    # Calculate metrics
    total_sales = len([d for d in deliveries if d.get("event_type") != "renewal"])
    total_revenue = sum(d.get("amount", 0) for d in deliveries if d.get("event_type") != "renewal")
    renewals = len([d for d in deliveries if d.get("event_type") == "renewal"])
    
    # Product breakdown
    product_sales = {}
    for d in deliveries:
        if d.get("event_type") == "renewal":
            continue
        pk = d.get("product_key", "unknown")
        if pk not in product_sales:
            product_sales[pk] = {"count": 0, "revenue": 0}
        product_sales[pk]["count"] += 1
        product_sales[pk]["revenue"] += d.get("amount", 0)
    
    # Segment breakdown
    segment_counts = {}
    for s in segments:
        seg = s.get("segment", "unknown")
        segment_counts[seg] = segment_counts.get(seg, 0) + 1
    
    # Recent sales (last 7 days)
    from datetime import datetime, timedelta
    week_ago = (datetime.utcnow() - timedelta(days=7)).isoformat()
    recent_sales = [d for d in deliveries if d.get("sent_at", "") > week_ago and d.get("event_type") != "renewal"]
    recent_revenue = sum(d.get("amount", 0) for d in recent_sales)
    
    return {
        "summary": {
            "total_sales": total_sales,
            "total_revenue": total_revenue,
            "renewals": renewals,
            "unique_buyers": len(segments),
            "recent_sales_7d": len(recent_sales),
            "recent_revenue_7d": recent_revenue,
        },
        "by_product": product_sales,
        "by_segment": segment_counts,
        "recent_transactions": sorted(
            [d for d in deliveries if d.get("event_type") != "renewal"],
            key=lambda x: x.get("sent_at", ""),
            reverse=True
        )[:10],  # Last 10 sales
    }


@app.get("/api/analytics/buyers")
def get_buyer_segments() -> dict:
    """Get all buyer segments with nurture status."""
    segments_path = BASE_DIR / "data" / "buyer_segments.jsonl"
    segments = []
    
    if segments_path.exists():
        with open(segments_path) as f:
            for line in f:
                if line.strip():
                    segments.append(json.loads(line))
    
    # Group by segment
    by_segment = {}
    for s in segments:
        seg = s.get("segment", "unknown")
        if seg not in by_segment:
            by_segment[seg] = []
        by_segment[seg].append(s)
    
    # Calculate nurture queue (who needs follow-up)
    now = datetime.utcnow().timestamp()
    nurture_queue = [s for s in segments if s.get("next_touch", 0) < now]
    
    return {
        "total_buyers": len(segments),
        "by_segment": {k: len(v) for k, v in by_segment.items()},
        "buyer_details": segments,
        "nurture_queue": {
            "count": len(nurture_queue),
            "buyers": nurture_queue[:20],  # Top 20 needing follow-up
        },
    }


@app.get("/os", response_class=HTMLResponse)
def serve_atxo_os():
    """Serve ATXO OS dashboard."""
    atxo_path = Path("/Users/michaelderibe/.openclaw/workspace/atxo-os/frontend/index.html")
    if atxo_path.exists():
        content = atxo_path.read_text()
        # Update API endpoints to use relative paths
        content = content.replace('fetch(\'/api/', 'fetch(\'/os/api/')
        return HTMLResponse(content)
    raise HTTPException(status_code=404, detail="ATXO OS not found")


@app.get("/os/api/health")
def atxo_health():
    """ATXO OS health check."""
    return {"status": "online", "station": "ATXO-1", "version": "1.0.0"}


@app.get("/os/api/revenue/dashboard")
def atxo_revenue():
    """ATXO OS revenue data."""
    # Reuse existing analytics
    sales_data = get_sales_analytics()
    return sales_data


@app.get("/os/api/crew/status")
def atxo_crew():
    """ATXO OS crew status."""
    return {
        "crew": [
            {"name": "Selam", "role": "CEO", "status": "active", "current_task": "Station Command", "efficiency": 98},
            {"name": "Bulcha", "role": "Operations", "status": "standby", "current_task": "Awaiting Orders", "efficiency": 85},
            {"name": "Merry", "role": "Sales", "status": "standby", "current_task": "Inbox Monitoring", "efficiency": 90},
        ],
        "tasks_queued": 0,
        "tasks_completed_today": 12,
    }


@app.get("/os/api/outreach/status")
def atxo_outreach():
    """ATXO OS outreach status."""
    return {
        "campaigns": {
            "active": True,
            "batch_size": 51,
            "emails_sent": 5,
            "emails_remaining": 46,
            "reply_rate": 0,
            "leads_generated": 0,
            "meetings_booked": 0,
        },
        "channels": {
            "email": {"status": "active", "volume": "5/day"},
            "x_twitter": {"status": "standby", "last_post": "2026-03-27"},
            "reddit": {"status": "monitoring", "karma": 5},
        },
    }


@app.get("/os/api/analytics/sales")
def atxo_analytics():
    """ATXO OS sales analytics."""
    return get_sales_analytics()


# ============================================================================
# TSEGA — CAPITAL DESK / TRADING API
# ============================================================================

TSEGA_DASHBOARD_URL = "http://161.35.220.149:3001"
MAINNET_MILESTONE   = 20   # net-positive trades required before mainnet brief


def _build_tsega_response(raw: dict) -> dict:
    """
    Build the canonical Tsega API response from raw dashboard-state.json.

    Returned shape (all fields always present, nulls on missing data):
    {
      agent        : { name, status, phase, venue, task }
      equity       : { current, peak, startOfDay, changeToday, changePct }
      performance  : { totalPnl, todayPnl, winRate, totalTrades, wins, losses }
      risk         : { stopPct, tpPct, threshold, maxPositions, dailyDrawdownLimit,
                       peakDrawdownLimit, dailyDrawdownUsed, peakDrawdownUsed }
      positions    : [ { id, symbol, side, entry, stop, tp, sizeUsd, venue,
                         openedAt, distToStop, distToTp } ]
      trades       : [ { symbol, side, pnl, exitReason, openedAt, closedAt,
                         durationMin } ]  ← last 20
      equityCurve  : [ { ts, value } ]    ← downsampled to ≤100 pts, last 24 h
      holdings     : [ { coin, qty, usdValue } ]
      milestone    : { wins, target, remaining, pct, label, nextStep }
      meta         : { lastUpdated, syncedAt, dataAge, live }
    }
    """
    from datetime import datetime, timezone

    now_utc   = datetime.now(timezone.utc)
    today_utc = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)

    trades    = raw.get("trades",    [])
    positions = raw.get("positions", [])
    metrics   = raw.get("metrics",  {})
    eq_curve  = raw.get("equity",   [])
    params    = raw.get("params",   {})
    holdings  = raw.get("holdings", [])

    # ── Closed trades ────────────────────────────────────────────────────────
    closed = [t for t in trades if t.get("closedAt")]
    wins   = [t for t in closed if (t.get("pnl") or 0) > 0]
    losses = [t for t in closed if (t.get("pnl") or 0) <= 0]

    total_pnl = round(sum(t.get("pnl", 0) for t in closed), 2)
    win_rate  = round(len(wins) / len(closed) * 100, 1) if closed else 0

    today_pnl = round(sum(
        t.get("pnl", 0) for t in closed
        if t.get("closedAt") and
        datetime.fromisoformat(t["closedAt"].replace("Z", "+00:00")) >= today_utc
    ), 2)

    # ── Open positions ───────────────────────────────────────────────────────
    # Filter: not explicitly closed AND sizeUsd >= 100 (excludes pre-sizing-fix ghost positions)
    open_pos = [p for p in positions if p.get("status") != "closed" and (p.get("sizeUsd") or 0) >= 100]

    def _dist_pct(entry, target):
        if not entry or not target: return None
        return round((target - entry) / entry * 100, 2)

    positions_out = [
        {
            "id":        p.get("id"),
            "symbol":    p.get("symbol"),
            "side":      p.get("side"),
            "entry":     p.get("entryPrice"),
            "stop":      p.get("stopPrice"),
            "tp":        p.get("tpPrice"),
            "sizeUsd":   p.get("sizeUsd"),
            "score":     p.get("score"),
            "venue":     p.get("venue", "bybit"),
            "openedAt":  p.get("openedAt"),
            "distToStop": _dist_pct(p.get("entryPrice"), p.get("stopPrice")),
            "distToTp":   _dist_pct(p.get("entryPrice"), p.get("tpPrice")),
        }
        for p in open_pos
    ]

    # ── Last 20 closed trades ────────────────────────────────────────────────
    def _dur(t):
        try:
            o = datetime.fromisoformat(t["openedAt"].replace("Z", "+00:00"))
            c = datetime.fromisoformat(t["closedAt"].replace("Z", "+00:00"))
            return round((c - o).total_seconds() / 60, 1)
        except Exception:
            return None

    trades_out = [
        {
            "symbol":     t.get("symbol"),
            "side":       t.get("side"),
            "pnl":        t.get("pnl"),
            "exitReason": t.get("exitReason"),
            "entry":      t.get("entryPrice"),
            "exit":       t.get("exitPrice"),
            "openedAt":   t.get("openedAt"),
            "closedAt":   t.get("closedAt"),
            "durationMin": _dur(t),
        }
        for t in closed[-20:]
    ]

    # ── Equity ───────────────────────────────────────────────────────────────
    current_equity = metrics.get("equity", 0)
    peak_equity    = max((pt["value"] for pt in eq_curve if pt.get("value")), default=current_equity)

    # Start-of-day equity: first curve point at/after today 00:00 UTC
    sod_equity = current_equity
    for pt in eq_curve:
        try:
            ts = datetime.fromisoformat(pt["ts"].replace("Z", "+00:00"))
            if ts >= today_utc:
                sod_equity = pt["value"]
                break
        except Exception:
            pass

    change_today  = round(current_equity - sod_equity, 2)
    change_pct    = round(change_today / sod_equity * 100, 2) if sod_equity else 0

    # ── Equity curve — last 24 h, downsampled to ≤100 points ────────────────
    cutoff_24h = now_utc.timestamp() - 86400
    recent_pts = [
        pt for pt in eq_curve
        if pt.get("ts") and _ts_epoch(pt["ts"]) >= cutoff_24h
    ]
    curve_out = _downsample(recent_pts, max_pts=100)

    # ── Risk metrics ─────────────────────────────────────────────────────────
    daily_dd_used = round((sod_equity - current_equity) / sod_equity * 100, 2) if sod_equity else 0
    peak_dd_used  = round((peak_equity - current_equity) / peak_equity * 100, 2) if peak_equity else 0

    # ── Milestone ────────────────────────────────────────────────────────────
    net_wins   = len(wins)
    remaining  = max(0, MAINNET_MILESTONE - net_wins)
    mile_pct   = round(min(100, net_wins / MAINNET_MILESTONE * 100), 1)

    # ── Data freshness ───────────────────────────────────────────────────────
    last_updated_str = raw.get("lastUpdated", "")
    data_age_min = None
    if last_updated_str:
        try:
            lu = datetime.fromisoformat(last_updated_str.replace("Z", "+00:00"))
            data_age_min = round((now_utc - lu).total_seconds() / 60, 1)
        except Exception:
            pass

    return {
        "agent": {
            "name":   "Tsega",
            "status": raw.get("status", "unknown"),
            "phase":  "testnet",
            "venue":  "Bybit",
            "task":   (raw.get("currentTask") or "")[:120] or None,
        },
        "equity": {
            "current":      current_equity,
            "peak":         round(peak_equity, 4),
            "startOfDay":   round(sod_equity, 4),
            "changeToday":  change_today,
            "changePct":    change_pct,
        },
        "performance": {
            "totalPnl":    total_pnl,
            "todayPnl":    today_pnl,
            "winRate":     win_rate,
            "totalTrades": len(closed),
            "wins":        len(wins),
            "losses":      len(losses),
        },
        "risk": {
            "stopPct":            params.get("stopPct", 3),
            "tpPct":              params.get("tpPct", 6),
            "threshold":          params.get("tradeThreshold", 60),
            "maxPositions":       3,
            "dailyDrawdownLimit": params.get("dailyDrawdownLimit", 8),
            "peakDrawdownLimit":  params.get("peakDrawdownLimit", 15),
            "dailyDrawdownUsed":  max(0, daily_dd_used),
            "peakDrawdownUsed":   max(0, peak_dd_used),
        },
        "positions":   positions_out,
        "trades":      trades_out,
        "equityCurve": curve_out,
        "holdings":    holdings,
        "milestone": {
            "wins":      net_wins,
            "target":    MAINNET_MILESTONE,
            "remaining": remaining,
            "pct":       mile_pct,
            "label":     f"{net_wins}/{MAINNET_MILESTONE} net-positive trades",
            "nextStep":  f"{remaining} more wins → mainnet brief to Selam" if remaining > 0 else "Ready for mainnet brief",
        },
        "meta": {
            "lastUpdated": last_updated_str,
            "syncedAt":    now_utc.isoformat(),
            "dataAgeMin":  data_age_min,
            "live":        (data_age_min is not None and data_age_min < 10),
        },
        "polymarket": raw.get("polymarket", {
            "bets": [],
            "balance": 0,
            "metrics": {"totalBets": 0, "wins": 0, "losses": 0, "pending": 0,
                        "winRate": 0, "roi": 0, "totalStaked": 0, "totalPnl": 0, "avgEdge": 0},
        }),
    }


def _ts_epoch(ts_str: str) -> float:
    """ISO timestamp string → Unix epoch float."""
    try:
        from datetime import datetime, timezone
        return datetime.fromisoformat(ts_str.replace("Z", "+00:00")).timestamp()
    except Exception:
        return 0.0


def _downsample(pts: list, max_pts: int = 100) -> list:
    """Return at most max_pts evenly-spaced entries from pts list."""
    if len(pts) <= max_pts:
        return pts
    step = len(pts) / max_pts
    return [pts[int(i * step)] for i in range(max_pts)]


@app.get("/api/tsega")
def get_tsega() -> dict:
    """
    Canonical Tsega trading data endpoint.

    Returns complete agent state: equity, positions, trades, equity curve,
    holdings, performance metrics, risk parameters, and milestone progress.

    Data is read from the locally-synced dashboard-state.json (updated every
    2 minutes by the LaunchAgent SCP sync from the VPS).

    Response shape:
      agent        — name, status, phase, venue, current task
      equity       — current, peak, start-of-day, today change
      performance  — totalPnl, todayPnl, winRate, totalTrades, wins, losses
      risk         — stop/TP %, threshold, drawdown usage
      positions    — all open positions with entry/stop/TP distances
      trades       — last 20 closed trades
      equityCurve  — last 24 h, downsampled to ≤100 pts (for charting)
      holdings     — spot portfolio breakdown
      milestone    — progress toward mainnet (target: 20 net-positive trades)
      meta         — lastUpdated, dataAgeMin, live flag
    """
    import urllib.request
    # Fetch live from VPS direct IP (no tunnel needed — port 3001 is publicly accessible)
    try:
        req = urllib.request.Request(
            f"{TSEGA_DASHBOARD_URL}/state",
            headers={"User-Agent": "mission-control/1.0"}
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            raw = json.loads(resp.read().decode())
        return _build_tsega_response(raw)
    except Exception:
        pass
    # Fallback: local synced file
    if not TSEGA_STATE_PATH.exists():
        return {
            "error": "no_data",
            "message": "VPS unreachable and local sync file not found.",
        }
    try:
        raw = json.loads(TSEGA_STATE_PATH.read_text())
        return _build_tsega_response(raw)
    except Exception as e:
        return {"error": "parse_error", "message": str(e)}


@app.get("/api/trading/summary")
def get_trading_summary() -> dict:
    """Backwards-compatible summary endpoint — proxies to /api/tsega."""
    if not TSEGA_STATE_PATH.exists():
        return {
            "status": "unavailable", "equity": None, "openPositions": 0,
            "todayPnl": None, "winRate": None, "totalTrades": 0,
            "live": False, "error": "state file not found"
        }
    try:
        raw  = json.loads(TSEGA_STATE_PATH.read_text())
        full = _build_tsega_response(raw)
        # Flatten to the shape the frontend currently expects
        wins_count = full["performance"]["wins"]
        return {
            "status":          full["agent"]["status"],
            "equity":          full["equity"]["current"],
            "totalPnl":        full["performance"]["totalPnl"],
            "todayPnl":        full["performance"]["todayPnl"],
            "winRate":         full["performance"]["winRate"],
            "totalTrades":     full["performance"]["totalTrades"],
            "openPositions":   len(full["positions"]),
            "openPositionList": full["positions"],
            "recentTrades":    full["trades"][-5:],
            "phase":           full["agent"]["phase"],
            "milestone":       full["milestone"]["label"],
            "nextMilestone":   full["milestone"]["nextStep"],
            "dashboardUrl":    TSEGA_DASHBOARD_URL,
            "live":            full["meta"]["live"],
            "lastUpdate":      full["meta"]["syncedAt"],
        }
    except Exception as e:
        return {"error": str(e), "live": False}


@app.get("/api/trading/live")
def get_trading_live() -> dict:
    """Backwards-compatible live endpoint — proxies to /api/tsega."""
    return get_tsega()


if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8765, reload=False)
