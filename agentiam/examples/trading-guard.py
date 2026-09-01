"""
trading-guard.py — wrap any trade with a flowcore pre-check.

Pattern: your agent computes a proposed trade, AgentIAM decides allow/deny/abstain,
only on allow does the agent forward the trade to its execution layer.

Dependencies: Python stdlib + BANKR CLI.
"""

import json
import subprocess
import sys
from typing import Callable

WALLET = "0x24908846a4397d3549d07661e0fc02220ab14dad"
BASE = f"https://x402.bankr.bot/{WALLET}"
CANONICAL_SIGNER = "0x069c6012e053dfbf50390b19fae275ad96d22ed7"


def flowcore(action: dict) -> dict:
    r = subprocess.run(
        ["bankr", "x402", "call", f"{BASE}/flowcore", "--data", json.dumps({"action": action})],
        capture_output=True, text=True, check=True,
    )
    return json.loads(r.stdout)


def guarded_trade(action: dict, execute: Callable[[dict], dict]) -> dict:
    """Run flowcore; execute only if decision == allow and signer is canonical."""
    resp = flowcore(action)

    if resp["proof"]["signer"].lower() != CANONICAL_SIGNER:
        raise RuntimeError(f"REJECT — non-canonical signer {resp['proof']['signer']}")

    decision = resp["result"]["decision"]
    if decision != "allow":
        return {
            "executed": False,
            "decision": decision,
            "reasons": resp["result"].get("reasons"),
            "proof": resp["proof"],
        }

    result = execute(action)
    return {
        "executed": True,
        "decision": decision,
        "trade_result": result,
        "proof": resp["proof"],        # keep as audit trail
        "payment": resp["payment"],    # keep as audit trail
    }


def _fake_execute(action: dict) -> dict:
    # Replace with your actual trading-layer call.
    return {"status": "submitted", "action": action, "chain_tx": "0xdead..."}


if __name__ == "__main__":
    trade = {
        "type": "swap",
        "dex": "uniswap-v3",
        "chain": "base-mainnet",
        "pair": "USDC/WETH",
        "amount_in_usdc": 250,
        "max_slippage_bps": 30,
    }

    out = guarded_trade(trade, _fake_execute)
    print(json.dumps(out, indent=2))
    if not out["executed"]:
        sys.exit(1)
