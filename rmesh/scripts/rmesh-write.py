#!/usr/bin/env python3
"""
rmesh-write.py — Write operations for RMESH

Usage:
  python rmesh-write.py dm --from-key <key> --to <addr> --message <text>
  python rmesh-write.py broadcast --from-key <key> --topic <topic> --message <text>
  python rmesh-write.py broadcast-bankr --topic <topic> --message <text>
"""

import sys
import os
import json
import time
import subprocess
import urllib.request
from typing import Optional, Dict, Any

SIGNA_BASE = "https://www.signaagent.xyz"
NET_CONTRACT = "0x00000000B24D62781dB359b07880a105cD0b64e6"
BASE_RPC = os.environ.get("BASE_RPC_URL", "https://mainnet.base.org")


def get_address(private_key: str) -> Optional[str]:
    """Get wallet address from private key"""
    try:
        result = subprocess.run(
            ["cast", "wallet", "address", "--private-key", private_key],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            return result.stdout.strip()
        return None
    except:
        return None


def sign_message(private_key: str, message: str) -> Optional[str]:
    """Sign a message with EIP-191 personal_sign"""
    try:
        result = subprocess.run(
            ["cast", "wallet", "sign", "--private-key", private_key, message],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            return result.stdout.strip()
        return None
    except:
        return None


def send_signa_dm(from_key: str, to_addr: str, message: str) -> Dict[str, Any]:
    """Send a DM via Signa"""
    # Get sender address
    from_addr = get_address(from_key)
    if not from_addr:
        return {"ok": False, "error": "Could not derive address from private key"}
    
    # Build canonical envelope
    ts = int(time.time() * 1000)  # milliseconds (JavaScript Date.now() format)
    preimage = f"SIGNA agent dm v1\nts:{ts}\nfrom:{from_addr.lower()}\nto:{to_addr.lower()}\nbody:{message}"
    
    # Sign
    signature = sign_message(from_key, preimage)
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
                "signature": signature[:20] + "...",
                "raw": result
            }
    except Exception as e:
        return {"ok": False, "error": str(e)}


def broadcast_net(private_key: str, topic: str, message: str) -> Dict[str, Any]:
    """Broadcast via Net Protocol (needs gas)"""
    # Encode calldata
    try:
        calldata_result = subprocess.run(
            ["cast", "calldata", "sendMessage(string,string,bytes)", message, topic, "0x"],
            capture_output=True, text=True, timeout=10
        )
        if calldata_result.returncode != 0:
            return {"ok": False, "error": "Could not encode calldata"}
        calldata = calldata_result.stdout.strip()
    except Exception as e:
        return {"ok": False, "error": f"Calldata encoding failed: {e}"}
    
    # Send transaction
    try:
        result = subprocess.run(
            ["cast", "send", NET_CONTRACT, calldata, 
             "--rpc-url", BASE_RPC, "--private-key", private_key],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0:
            # Extract tx hash from output
            tx_hash = None
            for line in result.stdout.split("\n"):
                line = line.strip()
                if line.startswith("transactionHash"):
                    parts = line.split()
                    if len(parts) >= 2:
                        tx_hash = parts[1]
                        break
                elif line.startswith("0x") and len(line) == 66:
                    tx_hash = line
                    break
            
            return {
                "ok": True,
                "channel": "net_protocol",
                "topic": topic,
                "message": message[:50],
                "contract": NET_CONTRACT,
                "tx_hash": tx_hash,
                "explorer": f"https://basescan.org/tx/{tx_hash}" if tx_hash else None,
                "raw": result.stdout
            }
        else:
            return {"ok": False, "error": result.stderr or result.stdout}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def broadcast_bankr(topic: str, message: str) -> Dict[str, Any]:
    """Get Bankr command for broadcasting (user executes manually)"""
    calldata_result = subprocess.run(
        ["cast", "calldata", "sendMessage(string,string,bytes)", message, topic, "0x"],
        capture_output=True, text=True, timeout=10
    )
    
    if calldata_result.returncode != 0:
        return {"ok": False, "error": "Could not encode calldata"}
    
    calldata = calldata_result.stdout.strip()
    
    return {
        "ok": True,
        "channel": "net_protocol_via_bankr",
        "topic": topic,
        "message": message[:50],
        "contract": NET_CONTRACT,
        "chain": "8453",
        "calldata": calldata,
        "bankr_command": f"@bankr submit transaction to {NET_CONTRACT} with data {calldata} on chain 8453",
        "note": "Execute the bankr_command to broadcast"
    }


def print_dm_result(result: Dict):
    """Pretty print DM result"""
    if result.get("ok"):
        print(f"✅ DM sent via Signa")
        print(f"  From: {result.get('from', '?')}")
        print(f"  To: {result.get('to', '?')}")
        print(f"  Message: {result.get('message', '?')}")
        print(f"  Timestamp: {result.get('ts', '?')}")
        print(f"  Signature: {result.get('signature', '?')}")
    else:
        print(f"❌ DM failed: {result.get('error', 'unknown')}")


def print_broadcast_result(result: Dict):
    """Pretty print broadcast result"""
    if result.get("ok"):
        print(f"✅ Broadcast via Net Protocol")
        print(f"  Topic: {result.get('topic', '?')}")
        print(f"  Message: {result.get('message', '?')}")
        print(f"  Contract: {result.get('contract', '?')}")
        if result.get("tx_hash"):
            print(f"  TX: {result['tx_hash']}")
        if result.get("bankr_command"):
            print(f"\n  Bankr command:")
            print(f"  {result['bankr_command']}")
    else:
        print(f"❌ Broadcast failed: {result.get('error', 'unknown')}")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    
    cmd = sys.argv[1]
    
    if cmd == "dm":
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
            print("Usage: rmesh-write.py dm --from-key <key> --to <addr> --message <text>")
            sys.exit(1)
        
        # Ensure to is a full address
        if not to.startswith("0x"):
            print(f"❌ --to must be a full 0x address, got: {to}")
            print("  Use rmesh.py resolve to convert handles to addresses first")
            sys.exit(1)
        
        result = send_signa_dm(from_key, to, message)
        print_dm_result(result)
    
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
            print("Usage: rmesh-write.py broadcast --from-key <key> --topic <topic> --message <text>")
            sys.exit(1)
        
        result = broadcast_net(from_key, topic, message)
        print_broadcast_result(result)
    
    elif cmd == "broadcast-bankr":
        topic = "general"
        message = None
        i = 2
        while i < len(sys.argv):
            if sys.argv[i] == "--topic" and i + 1 < len(sys.argv):
                topic = sys.argv[i + 1]
                i += 2
            elif sys.argv[i] == "--message" and i + 1 < len(sys.argv):
                message = sys.argv[i + 1]
                i += 2
            else:
                i += 1
        
        if not message:
            print("Usage: rmesh-write.py broadcast-bankr --topic <topic> --message <text>")
            sys.exit(1)
        
        result = broadcast_bankr(topic, message)
        print_broadcast_result(result)
    
    else:
        print(f"Unknown command: {cmd}")
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
