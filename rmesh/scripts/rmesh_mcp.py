#!/usr/bin/env python3
"""
RMESH MCP Server — Universal agent router for Bankr ecosystem

Exposes RMESH capabilities as MCP tools for AI agents.
"""

import os
import sys
import json
import time
import subprocess
import urllib.request
import urllib.parse
from typing import Any, Dict, List, Optional

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

# === CONFIG ===
SIGNA_BASE = "https://www.signaagent.xyz"
NET_CONTRACT = "0x00000000B24D62781dB359b07880a105cD0b64e6"
NULL_ADDR = "0x0000000000000000000000000000000000000000"
BASE_RPC = os.environ.get("BASE_RPC_URL", "https://mainnet.base.org")

# === HELPERS ===

def api_get(url: str) -> Dict[str, Any]:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "RMESH-MCP/0.1"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except Exception as e:
        return {"ok": False, "error": str(e)}


def api_post(url: str, data: Dict) -> Dict[str, Any]:
    try:
        body = json.dumps(data).encode()
        req = urllib.request.Request(url, data=body, headers={
            "Content-Type": "application/json",
            "User-Agent": "RMESH-MCP/0.1"
        })
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except Exception as e:
        return {"ok": False, "error": str(e)}


def cast_call(contract: str, sig: str, args: List[str]) -> Optional[str]:
    try:
        cmd = ["cast", "call", contract, sig, *args, "--rpc-url", BASE_RPC]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        return result.stdout.strip() if result.returncode == 0 else None
    except:
        return None


def short_addr(addr: str) -> str:
    return f"{addr[:10]}...{addr[-6:]}" if addr and len(addr) > 10 else addr


def ts_to_time(ts: int) -> str:
    if ts > 1e12:
        ts = ts // 1000
    try:
        return time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime(ts))
    except:
        return str(ts)


# === CORE FUNCTIONS ===

def resolve_identity(identifier: str) -> Dict[str, Any]:
    """Resolve any identity to wallet + presence"""
    encoded = urllib.parse.quote(identifier.strip())
    result = api_get(f"{SIGNA_BASE}/api/resolve?id={encoded}")
    
    if not result.get("ok"):
        return {"ok": False, "error": result.get("error", "unresolvable")}
    
    address = result.get("address", "")
    net_count = cast_call(
        NET_CONTRACT,
        "getTotalMessagesForAppUserCount(address,address)(uint256)",
        [NULL_ADDR, address]
    )
    
    net_messages = 0
    if net_count:
        try:
            net_messages = int(net_count.split()[0])
        except:
            pass
    
    return {
        "ok": True,
        "query": identifier,
        "address": address,
        "source": result.get("source", ""),
        "on_signa": result.get("on_signa", False),
        "net_messages": net_messages,
        "routes": result.get("routes", {})
    }


def ask_brain(question: str) -> Dict[str, Any]:
    """Ask Signa Brain"""
    result = api_post(f"{SIGNA_BASE}/api/brain", {"goal": question})
    return result


def read_feed(topic: str, limit: int = 5) -> Dict[str, Any]:
    """Read on-chain messages from a feed"""
    total_str = cast_call(
        NET_CONTRACT,
        "getTotalMessagesForAppTopicCount(address,string)(uint256)",
        [NULL_ADDR, topic]
    )
    
    if not total_str:
        return {"ok": False, "error": "Could not read feed"}
    
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
            try:
                parts = result.strip("()").split(", ")
                if len(parts) >= 6:
                    sender = parts[1].strip()
                    ts_str = parts[2].strip().split()[0]
                    text = parts[4].strip().strip('"')
                    messages.append({
                        "sender": short_addr(sender),
                        "time": ts_to_time(int(ts_str)) if ts_str.isdigit() else "?",
                        "text": text[:200]
                    })
            except:
                pass
    
    return {"ok": True, "topic": topic, "total": total, "messages": messages}


def read_inbox(wallet: str, limit: int = 5) -> Dict[str, Any]:
    """Read inbox from Signa + Net Protocol"""
    result = {"ok": True, "wallet": wallet, "signa": [], "net": []}
    
    signa = api_get(f"{SIGNA_BASE}/api/agents/{wallet}/inbox?limit={limit}")
    if signa.get("ok"):
        result["signa_count"] = signa.get("count", 0)
        result["signa"] = [
            {"from": short_addr(dm.get("from", "")), "body": dm.get("body", "")[:100]}
            for dm in signa.get("dms", [])
        ]
    
    net_count_str = cast_call(
        NET_CONTRACT,
        "getTotalMessagesForAppUserCount(address,address)(uint256)",
        [NULL_ADDR, wallet]
    )
    
    if net_count_str:
        try:
            result["net_count"] = int(net_count_str.split()[0])
        except:
            pass
    
    return result


def invoke_capability(cap_name: str) -> Dict[str, Any]:
    """Invoke a Signa capability"""
    return api_get(f"{SIGNA_BASE}/api/capabilities/invoke?cap={cap_name}")


def send_dm(private_key: str, to_addr: str, message: str) -> Dict[str, Any]:
    """Send a DM via Signa"""
    try:
        r = subprocess.run(
            ["cast", "wallet", "address", "--private-key", private_key],
            capture_output=True, text=True, timeout=10
        )
        from_addr = r.stdout.strip() if r.returncode == 0 else None
    except:
        from_addr = None
    
    if not from_addr:
        return {"ok": False, "error": "Invalid private key"}
    
    ts = int(time.time() * 1000)  # MILLISECONDS!
    preimage = f"SIGNA agent dm v1\nts:{ts}\nfrom:{from_addr.lower()}\nto:{to_addr.lower()}\nbody:{message}"
    
    try:
        r = subprocess.run(
            ["cast", "wallet", "sign", "--private-key", private_key, preimage],
            capture_output=True, text=True, timeout=10
        )
        signature = r.stdout.strip() if r.returncode == 0 else None
    except:
        signature = None
    
    if not signature:
        return {"ok": False, "error": "Could not sign"}
    
    payload = json.dumps({
        "from": from_addr.lower(), "to": to_addr.lower(),
        "body": message, "ts": ts, "signature": signature
    }).encode()
    
    try:
        url = f"{SIGNA_BASE}/api/agents/{from_addr}/dm"
        req = urllib.request.Request(url, data=payload, headers={
            "Content-Type": "application/json", "User-Agent": "RMESH-MCP/0.1"
        })
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read())
            return {"ok": True, "dm_id": result.get("dm", {}).get("id"), "from": from_addr, "to": to_addr}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def broadcast(private_key: str, topic: str, message: str) -> Dict[str, Any]:
    """Broadcast via Net Protocol"""
    try:
        r = subprocess.run(
            ["cast", "calldata", "sendMessage(string,string,bytes)", message, topic, "0x"],
            capture_output=True, text=True, timeout=10
        )
        calldata = r.stdout.strip() if r.returncode == 0 else None
    except:
        calldata = None
    
    if not calldata:
        return {"ok": False, "error": "Could not encode calldata"}
    
    try:
        r = subprocess.run(
            ["cast", "send", NET_CONTRACT, calldata,
             "--rpc-url", BASE_RPC, "--private-key", private_key],
            capture_output=True, text=True, timeout=30
        )
        if r.returncode == 0:
            tx_hash = None
            for line in r.stdout.split("\n"):
                line = line.strip()
                if line.startswith("transactionHash"):
                    parts = line.split()
                    if len(parts) >= 2:
                        tx_hash = parts[1]
                        break
            return {"ok": True, "tx_hash": tx_hash, "topic": topic, "explorer": f"https://basescan.org/tx/{tx_hash}" if tx_hash else None}
        else:
            return {"ok": False, "error": r.stderr or r.stdout}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# === MCP SERVER ===

app = Server("rmesh")


@app.list_tools()
async def list_tools() -> List[Tool]:
    return [
        Tool(
            name="rmesh_resolve",
            description="Resolve any agent identity (@handle, 0x..., ENS, basename) to wallet address + presence across protocols",
            inputSchema={
                "type": "object",
                "properties": {
                    "identifier": {"type": "string", "description": "Identity to resolve: @handle, 0x address, ENS name, or basename"}
                },
                "required": ["identifier"]
            }
        ),
        Tool(
            name="rmesh_ask",
            description="Ask the Signa Brain a question. Returns a wallet-signed answer using decentralized inference and live data sources.",
            inputSchema={
                "type": "object",
                "properties": {
                    "question": {"type": "string", "description": "Question to ask the network"}
                },
                "required": ["question"]
            }
        ),
        Tool(
            name="rmesh_feed",
            description="Read on-chain messages from a Net Protocol feed (e.g. feed-general, feed-crypto, feed-rmesh)",
            inputSchema={
                "type": "object",
                "properties": {
                    "topic": {"type": "string", "description": "Feed topic name", "default": "feed-general"},
                    "limit": {"type": "integer", "description": "Number of messages to read", "default": 5}
                }
            }
        ),
        Tool(
            name="rmesh_inbox",
            description="Read an agent's inbox from Signa DMs + Net Protocol messages",
            inputSchema={
                "type": "object",
                "properties": {
                    "wallet": {"type": "string", "description": "Wallet address to check inbox for"},
                    "limit": {"type": "integer", "description": "Max messages per source", "default": 5}
                },
                "required": ["wallet"]
            }
        ),
        Tool(
            name="rmesh_invoke",
            description="Invoke a Signa capability (base.gas, token.price, bankr.launches, root.market, etc.)",
            inputSchema={
                "type": "object",
                "properties": {
                    "capability": {"type": "string", "description": "Capability name (e.g. base.gas, token.price, bankr.launches)"}
                },
                "required": ["capability"]
            }
        ),
        Tool(
            name="rmesh_dm",
            description="Send a wallet-signed DM to another agent via Signa",
            inputSchema={
                "type": "object",
                "properties": {
                    "private_key": {"type": "string", "description": "Sender's private key (0x...)"},
                    "to_address": {"type": "string", "description": "Recipient wallet address (0x...)"},
                    "message": {"type": "string", "description": "Message to send"}
                },
                "required": ["private_key", "to_address", "message"]
            }
        ),
        Tool(
            name="rmesh_broadcast",
            description="Broadcast an on-chain message via Net Protocol (permanent, public)",
            inputSchema={
                "type": "object",
                "properties": {
                    "private_key": {"type": "string", "description": "Sender's private key (0x...)"},
                    "topic": {"type": "string", "description": "Feed topic (e.g. feed-general, feed-rmesh)", "default": "feed-general"},
                    "message": {"type": "string", "description": "Message to broadcast"}
                },
                "required": ["private_key", "message"]
            }
        ),
        Tool(
            name="rmesh_status",
            description="Check RMESH system status (Signa API + Net Protocol health)",
            inputSchema={"type": "object", "properties": {}}
        )
    ]


@app.call_tool()
async def call_tool(name: str, arguments: dict) -> List[TextContent]:
    result = None
    
    if name == "rmesh_resolve":
        result = resolve_identity(arguments["identifier"])
    elif name == "rmesh_ask":
        result = ask_brain(arguments["question"])
    elif name == "rmesh_feed":
        result = read_feed(arguments.get("topic", "feed-general"), arguments.get("limit", 5))
    elif name == "rmesh_inbox":
        result = read_inbox(arguments["wallet"], arguments.get("limit", 5))
    elif name == "rmesh_invoke":
        result = invoke_capability(arguments["capability"])
    elif name == "rmesh_dm":
        result = send_dm(arguments["private_key"], arguments["to_address"], arguments["message"])
    elif name == "rmesh_broadcast":
        result = broadcast(arguments["private_key"], arguments.get("topic", "feed-general"), arguments["message"])
    elif name == "rmesh_status":
        signa_ok = api_get(f"{SIGNA_BASE}/api/capabilities").get("ok", False)
        net_count = cast_call(NET_CONTRACT, "getTotalMessagesCount()(uint256)", [])
        result = {
            "ok": True,
            "signa": "✅" if signa_ok else "❌",
            "net_protocol": f"✅ ({net_count.split()[0]} messages)" if net_count else "❌"
        }
    else:
        result = {"ok": False, "error": f"Unknown tool: {name}"}
    
    return [TextContent(type="text", text=json.dumps(result, indent=2))]


# === MAIN ===

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
