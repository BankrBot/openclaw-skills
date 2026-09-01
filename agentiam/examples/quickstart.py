"""
quickstart.py — minimal AgentIAM composition.

Calls `flowcore` on a proposed transfer action. On allow, prints the signed
decision; on deny, exits non-zero.

Dependencies: Python stdlib only + the BANKR CLI (npm-installed,
hash-verified by the npm registry).
"""

import json
import subprocess
import sys

WALLET = "0x24908846a4397d3549d07661e0fc02220ab14dad"
BASE = f"https://x402.bankr.bot/{WALLET}"


def call(service: str, payload: dict) -> dict:
    """Call an AgentIAM service via the BANKR CLI, which handles 402 payment."""
    r = subprocess.run(
        ["bankr", "x402", "call", f"{BASE}/{service}", "--data", json.dumps(payload)],
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(r.stdout)


if __name__ == "__main__":
    proposed = {
        "type": "transfer",
        "token": "USDC",
        "amount": 500,
        "to": "0xBeef000000000000000000000000000000000000",
        "chain": "base-mainnet",
    }

    print("[flowcore] verifying proposed action ...")
    resp = call("flowcore", {"action": proposed})

    decision = resp["result"]["decision"]
    risk = resp["result"].get("risk_score")
    signer = resp["proof"]["signer"]
    sig = resp["proof"]["signature"]
    tx = resp["payment"]["tx_hash"]

    print(f"  decision   : {decision}")
    print(f"  risk_score : {risk}")
    print(f"  signer     : {signer}")
    print(f"  tx_hash    : {tx}")

    # Always verify the signer is the canonical wallet before trusting the decision.
    # See scripts/verify-signature.js for the full verification path.
    if signer.lower() != "0x069c6012e053dfbf50390b19fae275ad96d22ed7":
        sys.exit(f"REJECT — signer {signer} is not the canonical wallet")

    if decision != "allow":
        sys.exit(f"agentiam denied: {resp['result'].get('reasons', '(no reasons field)')}")

    print("OK — proceed with the action. Keep the signed proof as audit trail.")
