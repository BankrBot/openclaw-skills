#!/usr/bin/env python3
"""
rmesh.py — RMESH CLI: Universal agent router for Bankr ecosystem

Usage:
  python rmesh.py resolve <identifier>
  python rmesh.py ask <question>
  python rmesh.py send --to <id> --message <text> [--type dm|broadcast|question]
  python rmesh.py broadcast --topic <topic> --message <text>
  python rmesh.py inbox <wallet> [--limit N]
  python rmesh.py feed <topic> [--limit N]
  python rmesh.py capabilities [name]
  python rmesh.py status
"""

import sys
import os
import json
import time
import subprocess
import urllib.request
import urllib.parse
import urllib.error
from typing import Optional, Dict, Any, List

# === CONFIG ===
SIGNA_BASE = "https://www.signaagent.xyz"
NET_CONTRACT = "0x00000000B24D62781dB359b07880a105cD0b64e6"
NULL_ADDR = "0x0000000000000000000000000000000000000000"
BASE_RPC = os.environ.get("BASE_RPC_URL", "https://mainnet.base.org")

# === HELPERS ===

def api_get(url: str) -> Dict[str, Any]:
    """GET request to Signa API"""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "RMESH/0.1"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except Exception as e:
        return {"ok": False, "error": str(e)}


def api_post(url: str, data: Dict) -> Dict[str, Any]:
    """POST request to Signa API"""
    try:
        body = json.dumps(data).encode()
        req = urllib.request.Request(url, data=body, headers={
            "Content-Type": "application/json",
            "User-Agent": "RMESH/0.1"
        })
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except Exception as e:
        return {"ok": False, "error": str(e)}


def cast_call(contract: str, sig: str, args: List[str]) -> Optional[str]:
    """Make a cast call to Base"""
    try:
        cmd = ["cast", "call", contract, sig, *args, "--rpc-url", BASE_RPC]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        if result.returncode == 0:
            return result.stdout.strip()
        return None
    except Exception:
        return None


def short_addr(addr: str) -> str:
    """Shorten address for display"""
    if not addr or len(addr) < 10:
        return addr
    return f"{addr[:10]}...{addr[-6:]}"


def ts_to_time(ts: int) -> str:
    """Convert unix timestamp to readable time"""
    if ts > 1e12:
        ts = ts // 1000
    try:
        return time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime(ts))
    except:
        return str(ts)


# === RESOLVER ===

def resolve_identity(identifier: str) -> Dict[str, Any]:
    """Resolve any identity to wallet + presence"""
    # Normalize
    query = identifier.strip()
    if query.startswith("@"):
        query = query  # keep @ for Signa
    
    # Try Signa resolve
    encoded = urllib.parse.quote(query)
    result = api_get(f"{SIGNA_BASE}/api/resolve?id={encoded}")
    
    if not result.get("ok"):
        return {
            "ok": False,
            "query": identifier,
            "error": result.get("error", "unresolvable"),
            "message": result.get("message", "Could not resolve identity")
        }
    
    address = result.get("address", "")
    
    # Check Net Protocol presence
    net_count = cast_call(
        NET_CONTRACT,
        "getTotalMessagesForAppUserCount(address,address)(uint256)",
        [NULL_ADDR, address]
    )
    
    on_net = False
    net_messages = 0
    if net_count:
        try:
            net_messages = int(net_count.split()[0])
            on_net = net_messages > 0
        except:
            pass
    
    return {
        "ok": True,
        "query": identifier,
        "address": address,
        "caip10": result.get("caip10", ""),
        "source": result.get("source", ""),
        "on_signa": result.get("on_signa", False),
        "on_net": on_net,
        "net_messages": net_messages,
        "display": result.get("display", {}),
        "routes": result.get("routes", {}),
        "presence": {
            "signa_dm": True,  # any wallet can receive
            "signa_brain": True,
            "signa_capabilities": True,
            "net_protocol": on_net
        }
    }


# === ROUTER ===

# Message type detection keywords
DM_KEYWORDS = ["hey", "hello", "hi", "dear", "thanks", "thank you", "please", "could you", "can you"]
QUESTION_KEYWORDS = ["?", "what", "how", "why", "when", "where", "who", "which", "is there", "are there", "should"]
BROADCAST_KEYWORDS = ["announce", "shipped", "launched", "new release", "update:", "breaking", "alert"]

def detect_message_type(message: str, to: str) -> str:
    """Auto-detect message type based on content and recipient"""
    lower = message.lower().strip()
    
    # Check for question marks (strongest signal)
    if lower.endswith("?"):
        return "question"
    
    # Check for question keywords
    for kw in QUESTION_KEYWORDS:
        if lower.startswith(kw) or f" {kw} " in lower:
            return "question"
    
    # Check for broadcast keywords
    for kw in BROADCAST_KEYWORDS:
        if kw in lower:
            return "broadcast"
    
    # Check for DM keywords
    for kw in DM_KEYWORDS:
        if lower.startswith(kw):
            return "dm"
    
    # Default: if to is a specific address/handle, it's a DM
    if to.startswith("@") or to.startswith("0x"):
        return "dm"
    
    # If to is a topic name, it's a broadcast
    return "broadcast"


def route_message(to: str, message: str, msg_type: str = "auto", topic: str = "general") -> Dict[str, Any]:
    """Route a message through the best channel"""
    
    # Auto-detect type if needed
    if msg_type == "auto":
        msg_type = detect_message_type(message, to)
    
    # Resolve target (skip for broadcast)
    address = None
    if msg_type != "broadcast":
        target = resolve_identity(to)
        if not target.get("ok"):
            return {"ok": False, "error": f"Could not resolve: {to}", "details": target}
        address = target["address"]
    
    # Route based on type
    if msg_type == "question":
        # Use Signa Brain
        brain_result = api_post(f"{SIGNA_BASE}/api/brain", {"goal": message})
        return {
            "ok": brain_result.get("ok", False),
            "channel": "signa_brain",
            "type": "question",
            "target": to,
            "answer": brain_result.get("answer", ""),
            "plan": brain_result.get("plan", []),
            "tools": brain_result.get("tools", []),
            "signature": brain_result.get("signature", ""),
            "brain": brain_result.get("brain", "")
        }
    
    elif msg_type == "dm":
        # Route to Signa DM
        return {
            "ok": True,
            "channel": "signa_dm",
            "type": "dm",
            "target": address,
            "target_display": to,
            "dm_url": f"{SIGNA_BASE}/api/agents/{address}/dm",
            "instructions": {
                "method": "wallet_signature",
                "preimage_format": "SIGNA agent dm v1\nts:{timestamp}\nfrom:{your_addr}\nto:{target_addr}\nbody:{message}",
                "note": "Sign with EIP-191 personal_sign, then POST to dm_url"
            }
        }
    
    elif msg_type == "broadcast":
        # Route to Net Protocol
        calldata_fn = f'sendMessage(string,string,bytes)'
        return {
            "ok": True,
            "channel": "net_protocol",
            "type": "broadcast",
            "topic": topic,
            "contract": NET_CONTRACT,
            "chain": "base (8453)",
            "instructions": {
                "cast_command": f'cast send {NET_CONTRACT} "{calldata_fn}" "{message}" "{topic}" 0x --rpc-url {BASE_RPC} --private-key <key>',
                "bankr_command": f'@bankr submit transaction to {NET_CONTRACT} with data $(cast calldata "{calldata_fn}" "{message}" "{topic}" 0x) on chain 8453'
            }
        }
    
    else:
        return {"ok": False, "error": f"Unknown type: {msg_type}"}


# === READERS ===

def read_brain(question: str) -> Dict[str, Any]:
    """Ask Signa Brain"""
    result = api_post(f"{SIGNA_BASE}/api/brain", {"goal": question})
    return result


def read_feed(topic: str, limit: int = 5) -> Dict[str, Any]:
    """Read messages from a Net Protocol feed"""
    # Get total count
    total_str = cast_call(
        NET_CONTRACT,
        "getTotalMessagesForAppTopicCount(address,string)(uint256)",
        [NULL_ADDR, topic]
    )
    
    if not total_str:
        return {"ok": False, "error": "Could not read feed count"}
    
    try:
        total = int(total_str.split()[0])
    except:
        return {"ok": False, "error": "Invalid count"}
    
    if total == 0:
        return {"ok": True, "topic": topic, "total": 0, "messages": []}
    
    messages = []
    start = max(0, total - limit)
    
    for i in range(start, total):
        result = cast_call(
            NET_CONTRACT,
            "getMessageForAppTopic(uint256,address,string)((address,address,uint256,bytes,string,string))",
            [str(i), NULL_ADDR, topic]
        )
        if result:
            # Parse the tuple
            try:
                # Extract values from the tuple
                parts = result.strip("()").split(", ")
                if len(parts) >= 6:
                    app = parts[0].strip()
                    sender = parts[1].strip()
                    ts_str = parts[2].strip().split()[0]
                    text = parts[4].strip().strip('"')
                    
                    messages.append({
                        "index": i,
                        "sender": sender,
                        "sender_short": short_addr(sender),
                        "timestamp": int(ts_str) if ts_str.isdigit() else 0,
                        "time": ts_to_time(int(ts_str)) if ts_str.isdigit() else "unknown",
                        "text": text,
                        "topic": topic
                    })
            except:
                pass
    
    return {
        "ok": True,
        "topic": topic,
        "total": total,
        "messages": messages
    }


def read_inbox(wallet: str, limit: int = 5) -> Dict[str, Any]:
    """Read inbox from Signa + Net Protocol"""
    result = {"ok": True, "wallet": wallet, "signa": [], "net": []}
    
    # Signa inbox
    signa = api_get(f"{SIGNA_BASE}/api/agents/{wallet}/inbox?limit={limit}")
    if signa.get("ok"):
        result["signa_count"] = signa.get("count", 0)
        result["signa"] = signa.get("dms", [])
    
    # Net Protocol messages
    net_count_str = cast_call(
        NET_CONTRACT,
        "getTotalMessagesForAppUserCount(address,address)(uint256)",
        [NULL_ADDR, wallet]
    )
    
    if net_count_str:
        try:
            net_count = int(net_count_str.split()[0])
            result["net_count"] = net_count
            
            if net_count > 0:
                start = max(0, net_count - limit)
                for i in range(start, net_count):
                    r = cast_call(
                        NET_CONTRACT,
                        "getMessageForAppUser(uint256,address,address)((address,address,uint256,bytes,string,string))",
                        [str(i), NULL_ADDR, wallet]
                    )
                    if r:
                        try:
                            parts = r.strip("()").split(", ")
                            if len(parts) >= 6:
                                sender = parts[1].strip()
                                ts_str = parts[2].strip().split()[0]
                                text = parts[4].strip().strip('"')
                                result["net"].append({
                                    "sender": sender,
                                    "sender_short": short_addr(sender),
                                    "timestamp": int(ts_str) if ts_str.isdigit() else 0,
                                    "time": ts_to_time(int(ts_str)) if ts_str.isdigit() else "unknown",
                                    "text": text
                                })
                        except:
                            pass
        except:
            pass
    
    return result


def list_capabilities(invoke: Optional[str] = None) -> Dict[str, Any]:
    """List or invoke Signa capabilities"""
    if invoke:
        result = api_get(f"{SIGNA_BASE}/api/capabilities/invoke?cap={invoke}")
        return result
    return api_get(f"{SIGNA_BASE}/api/capabilities")


# === CLI ===

def print_resolve(result: Dict):
    """Pretty print resolve result"""
    if not result.get("ok"):
        print(f"❌ {result.get('error', 'Failed')}: {result.get('message', '')}")
        return
    
    print(f"🔍 {result['query']}")
    print(f"  Wallet: {result['address']}")
    print(f"  Source: {result.get('source', '?')}")
    
    if result.get("display", {}).get("label"):
        print(f"  Label: {result['display']['label']}")
    
    print(f"\n  Presence:")
    p = result.get("presence", {})
    for k, v in p.items():
        icon = "✅" if v else "⚪"
        print(f"    {icon} {k}")
    
    if result.get("net_messages", 0) > 0:
        print(f"\n  Net Protocol: {result['net_messages']} messages")


def print_route(result: Dict):
    """Pretty print route result"""
    if not result.get("ok"):
        print(f"❌ {result.get('error', 'Failed')}")
        return
    
    ch = result.get("channel", "?")
    t = result.get("type", "?")
    
    print(f"📡 Channel: {ch} ({t})")
    
    if ch == "signa_brain":
        print(f"\n📝 Answer:\n  {result.get('answer', 'no answer')}")
        tools = result.get("tools", [])
        if tools:
            print(f"\n📊 Sources:")
            for tool in tools:
                print(f"  • {tool.get('cap', '?')}: {str(tool.get('output', {}).get('summary', ''))[:80]}")
        if result.get("signature"):
            print(f"\n🔐 Signed: {result['signature'][:40]}...")
    
    elif ch == "signa_dm":
        print(f"  To: {result.get('target_display', '?')} → {short_addr(result.get('target', ''))}")
        print(f"  DM URL: {result.get('dm_url', '?')}")
        inst = result.get("instructions", {})
        print(f"\n  To send, sign with your wallet:")
        print(f"  Format: {inst.get('preimage_format', '?')}")
    
    elif ch == "net_protocol":
        print(f"  Topic: {result.get('topic', '?')}")
        print(f"  Contract: {result.get('contract', '?')}")
        inst = result.get("instructions", {})
        print(f"\n  Cast: {inst.get('cast_command', '?')[:100]}...")


def print_feed(result: Dict):
    """Pretty print feed messages"""
    if not result.get("ok"):
        print(f"❌ {result.get('error', 'Failed')}")
        return
    
    print(f"📖 Feed: {result['topic']} ({result['total']} messages)")
    for msg in result.get("messages", []):
        print(f"\n  [{msg.get('time', '?')}] {msg.get('sender_short', '?')}")
        text = msg.get("text", "")
        if len(text) > 150:
            text = text[:150] + "..."
        print(f"  {text}")


def print_inbox(result: Dict):
    """Pretty print inbox"""
    if not result.get("ok"):
        print(f"❌ Failed")
        return
    
    print(f"📬 Inbox: {short_addr(result['wallet'])}")
    
    signa = result.get("signa", [])
    print(f"\n  Signa DMs: {result.get('signa_count', len(signa))}")
    for dm in signa[:3]:
        sender = dm.get("from", "?")
        body = dm.get("body", "")[:80]
        print(f"    [{short_addr(sender)}] {body}")
    
    net = result.get("net", [])
    print(f"\n  Net Protocol: {result.get('net_count', len(net))}")
    for msg in net[:3]:
        print(f"    [{msg.get('time', '?')}] {msg.get('sender_short', '?')}")
        text = msg.get("text", "")[:80]
        print(f"    {text}")


def print_capabilities(result: Dict):
    """Pretty print capabilities"""
    # Check if this is an invoke result
    if "output" in result or "cap" in result:
        if result.get("ok"):
            print(f"📊 {result.get('cap', '?')}")
            output = result.get("output", {})
            if isinstance(output, dict):
                for k, v in output.items():
                    print(f"  {k}: {v}")
            else:
                print(f"  {output}")
            if result.get("signature"):
                print(f"\n🔐 Signed: {result['signature'][:40]}...")
        else:
            print(f"❌ {result.get('error', 'Failed')}")
        return
    
    if not result.get("ok"):
        print(f"❌ {result.get('error', 'Failed')}")
        return
    
    builtins = result.get("builtins", [])
    registered = result.get("registered", [])
    
    print(f"🔧 Capabilities ({len(builtins)} built-in, {len(registered)} registered)")
    for cap in builtins:
        print(f"\n  • {cap.get('name', '?')}")
        print(f"    {cap.get('description', '')[:70]}")
        print(f"    Provider: {cap.get('provider', '?')}")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    
    cmd = sys.argv[1]
    
    if cmd == "resolve":
        if len(sys.argv) < 3:
            print("Usage: rmesh.py resolve <identifier>")
            sys.exit(1)
        result = resolve_identity(sys.argv[2])
        print_resolve(result)
    
    elif cmd == "ask":
        if len(sys.argv) < 3:
            print("Usage: rmesh.py ask <question>")
            sys.exit(1)
        question = " ".join(sys.argv[2:])
        result = read_brain(question)
        if result.get("ok"):
            print(f"🧠 {question}\n")
            print(f"📝 {result.get('answer', 'no answer')}")
            tools = result.get("tools", [])
            if tools:
                print(f"\n📊 Sources: {', '.join(t.get('cap','') for t in tools)}")
        else:
            print(f"❌ {result.get('error', 'Failed')}")
    
    elif cmd == "send":
        # Parse args
        to = None
        message = None
        msg_type = "auto"
        topic = "general"
        i = 2
        while i < len(sys.argv):
            if sys.argv[i] == "--to" and i + 1 < len(sys.argv):
                to = sys.argv[i + 1]
                i += 2
            elif sys.argv[i] == "--message" and i + 1 < len(sys.argv):
                message = sys.argv[i + 1]
                i += 2
            elif sys.argv[i] == "--type" and i + 1 < len(sys.argv):
                msg_type = sys.argv[i + 1]
                i += 2
            elif sys.argv[i] == "--topic" and i + 1 < len(sys.argv):
                topic = sys.argv[i + 1]
                i += 2
            else:
                i += 1
        
        if not to or not message:
            print("Usage: rmesh.py send --to <id> --message <text> [--type dm|broadcast|question]")
            sys.exit(1)
        
        result = route_message(to, message, msg_type, topic)
        print_route(result)
    
    elif cmd == "inbox":
        wallet = sys.argv[2] if len(sys.argv) > 2 else None
        limit = 5
        if not wallet:
            print("Usage: rmesh.py inbox <wallet> [--limit N]")
            sys.exit(1)
        if "--limit" in sys.argv:
            idx = sys.argv.index("--limit")
            if idx + 1 < len(sys.argv):
                limit = int(sys.argv[idx + 1])
        result = read_inbox(wallet, limit)
        print_inbox(result)
    
    elif cmd == "feed":
        topic = sys.argv[2] if len(sys.argv) > 2 else "feed-general"
        limit = 5
        if "--limit" in sys.argv:
            idx = sys.argv.index("--limit")
            if idx + 1 < len(sys.argv):
                limit = int(sys.argv[idx + 1])
        result = read_feed(topic, limit)
        print_feed(result)
    
    elif cmd == "capabilities":
        cap = sys.argv[2] if len(sys.argv) > 2 else None
        result = list_capabilities(cap)
        print_capabilities(result)
    
    elif cmd == "status":
        # Quick status check
        print("🕸️  RMESH Status")
        print(f"  Signa: {SIGNA_BASE}")
        print(f"  Net: {NET_CONTRACT} (Base)")
        
        # Check Signa
        s = api_get(f"{SIGNA_BASE}/api/capabilities")
        print(f"  Signa API: {'✅' if s.get('ok') else '❌'}")
        
        # Check Net
        n = cast_call(NET_CONTRACT, "getTotalMessagesCount()(uint256)", [])
        if n:
            count = n.split()[0]
            print(f"  Net Protocol: ✅ ({count} messages)")
        else:
            print(f"  Net Protocol: ❌")
    
    elif cmd == "dm":
        # Parse args
        from_key = None
        to = None
        message = None
        i = 2
        while i < len(sys.argv):
            if sys.argv[i] == "--from-key" and i + 1 < len(sys.argv):
                from_key = sys.argv[i + 1]
                i += 2
            elif sys.argv[i] == "--to" and i + 1 < len(sys.argv):
                to = sys.argv[i + 1]
                i += 2
            elif sys.argv[i] == "--message" and i + 1 < len(sys.argv):
                message = sys.argv[i + 1]
                i += 2
            else:
                i += 1
        
        if not from_key or not to or not message:
            print("Usage: rmesh.py dm --from-key <key> --to <addr> --message <text>")
            sys.exit(1)
        
        if not to.startswith("0x"):
            print(f"❌ --to must be a full 0x address")
            print("  Use: rmesh.py resolve <handle> first")
            sys.exit(1)
        
        result = send_dm(from_key, to, message)
        if result.get("ok"):
            print(f"✅ DM sent via Signa")
            print(f"  From: {result['from']}")
            print(f"  To: {result['to']}")
            print(f"  Message: {result['message']}")
            if result.get("dm_id"):
                print(f"  ID: {result['dm_id']}")
        else:
            print(f"❌ DM failed: {result.get('error')}")
    
    elif cmd == "broadcast":
        from_key = None
        topic = "general"
        message = None
        i = 2
        while i < len(sys.argv):
            if sys.argv[i] == "--from-key" and i + 1 < len(sys.argv):
                from_key = sys.argv[i + 1]
                i += 2
            elif sys.argv[i] == "--topic" and i + 1 < len(sys.argv):
                topic = sys.argv[i + 1]
                i += 2
            elif sys.argv[i] == "--message" and i + 1 < len(sys.argv):
                message = sys.argv[i + 1]
                i += 2
            else:
                i += 1
        
        if not from_key or not message:
            print("Usage: rmesh.py broadcast --from-key <key> --topic <topic> --message <text>")
            sys.exit(1)
        
        result = broadcast_net(from_key, topic, message)
        if result.get("ok"):
            print(f"✅ Broadcast via Net Protocol")
            print(f"  Topic: {result['topic']}")
            print(f"  Message: {result['message']}")
            if result.get("tx_hash"):
                print(f"  TX: {result['tx_hash']}")
            if result.get("explorer"):
                print(f"  Explorer: {result['explorer']}")
        else:
            print(f"❌ Broadcast failed: {result.get('error')}")
    
    else:
        print(f"Unknown command: {cmd}")
        print(__doc__)
        sys.exit(1)


def send_dm(private_key: str, to_addr: str, message: str) -> Dict[str, Any]:
    """Send a DM via Signa"""
    import subprocess
    
    # Get sender address
    try:
        result = subprocess.run(
            ["cast", "wallet", "address", "--private-key", private_key],
            capture_output=True, text=True, timeout=10
        )
        from_addr = result.stdout.strip() if result.returncode == 0 else None
    except:
        from_addr = None
    
    if not from_addr:
        return {"ok": False, "error": "Could not derive address from private key"}
    
    # Build canonical envelope (MILLISECONDS!)
    ts = int(time.time() * 1000)
    preimage = f"SIGNA agent dm v1\nts:{ts}\nfrom:{from_addr.lower()}\nto:{to_addr.lower()}\nbody:{message}"
    
    # Sign
    try:
        result = subprocess.run(
            ["cast", "wallet", "sign", "--private-key", private_key, preimage],
            capture_output=True, text=True, timeout=10
        )
        signature = result.stdout.strip() if result.returncode == 0 else None
    except:
        signature = None
    
    if not signature:
        return {"ok": False, "error": "Could not sign message"}
    
    # Send DM
    payload = json.dumps({
        "from": from_addr.lower(),
        "to": to_addr.lower(),
        "body": message,
        "ts": ts,
        "signature": signature
    }).encode()
    
    try:
        url = f"{SIGNA_BASE}/api/agents/{from_addr}/dm"
        req = urllib.request.Request(url, data=payload, headers={
            "Content-Type": "application/json",
            "User-Agent": "RMESH/0.1"
        })
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read())
            return {
                "ok": result.get("ok", False),
                "channel": "signa_dm",
                "from": from_addr,
                "to": to_addr,
                "message": message[:50],
                "ts": ts,
                "dm_id": result.get("dm", {}).get("id"),
                "thread_id": result.get("thread_id")
            }
    except Exception as e:
        return {"ok": False, "error": str(e)}


def broadcast_net(private_key: str, topic: str, message: str) -> Dict[str, Any]:
    """Broadcast via Net Protocol"""
    import subprocess
    
    # Encode calldata
    try:
        result = subprocess.run(
            ["cast", "calldata", "sendMessage(string,string,bytes)", message, topic, "0x"],
            capture_output=True, text=True, timeout=10
        )
        calldata = result.stdout.strip() if result.returncode == 0 else None
    except:
        calldata = None
    
    if not calldata:
        return {"ok": False, "error": "Could not encode calldata"}
    
    # Send transaction
    try:
        result = subprocess.run(
            ["cast", "send", NET_CONTRACT, calldata, 
             "--rpc-url", BASE_RPC, "--private-key", private_key],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0:
            tx_hash = None
            for line in result.stdout.split("\n"):
                line = line.strip()
                if line.startswith("transactionHash"):
                    parts = line.split()
                    if len(parts) >= 2:
                        tx_hash = parts[1]
                        break
            
            return {
                "ok": True,
                "channel": "net_protocol",
                "topic": topic,
                "message": message[:50],
                "contract": NET_CONTRACT,
                "tx_hash": tx_hash,
                "explorer": f"https://basescan.org/tx/{tx_hash}" if tx_hash else None
            }
        else:
            return {"ok": False, "error": result.stderr or result.stdout}
    except Exception as e:
        return {"ok": False, "error": str(e)}


if __name__ == "__main__":
    main()
