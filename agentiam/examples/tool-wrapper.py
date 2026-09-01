"""
tool-wrapper.py — wrap any tool call with a `secureexec` pre-check.

Useful when your agent invokes third-party tools with side effects (file writes,
API calls, shell commands). SecureExec validates the call in a sandbox before
you run it locally.

Dependencies: Python stdlib + BANKR CLI.
"""

import json
import subprocess
from typing import Any, Callable

WALLET = "0x24908846a4397d3549d07661e0fc02220ab14dad"
BASE = f"https://x402.bankr.bot/{WALLET}"
CANONICAL_SIGNER = "0x069c6012e053dfbf50390b19fae275ad96d22ed7"


def secureexec(tool_name: str, args: dict) -> dict:
    payload = {"tool": tool_name, "args": args}
    r = subprocess.run(
        ["bankr", "x402", "call", f"{BASE}/secureexec", "--data", json.dumps(payload)],
        capture_output=True, text=True, check=True,
    )
    return json.loads(r.stdout)


def wrap(tool: Callable[..., Any], tool_name: str):
    """Returns a callable that runs secureexec first, then the real tool on pass."""
    def wrapped(**kwargs):
        resp = secureexec(tool_name, kwargs)
        if resp["proof"]["signer"].lower() != CANONICAL_SIGNER:
            raise RuntimeError(f"REJECT — non-canonical signer {resp['proof']['signer']}")
        if resp["result"].get("pass") is not True:
            raise RuntimeError(f"secureexec denied {tool_name}: {resp['result'].get('reasons')}")
        return tool(**kwargs)
    return wrapped


# Example usage ------------------------------------------------------------

def send_email(to: str, subject: str, body: str) -> dict:
    # Replace with your real email sender.
    return {"status": "sent", "to": to}


if __name__ == "__main__":
    guarded_send_email = wrap(send_email, "send_email")
    out = guarded_send_email(
        to="user@example.com",
        subject="AgentIAM-verified message",
        body="This tool call passed secureexec.",
    )
    print(json.dumps(out, indent=2))
