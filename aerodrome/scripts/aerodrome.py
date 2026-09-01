#!/usr/bin/env python3
"""Aerodrome Finance interactions via Sugar SDK CLI and Bankr Submit API.

Wraps the Sugar SDK CLI (velodrome-finance/sugar-sdk) to build unsigned Aerodrome
calldata on Base, then submits transactions through the Bankr Submit API.

Usage:
  aerodrome.py <command> [sugar-args...]

Commands:
  positions       List current LP positions (read-only)
  pools           Discover pools for a token pair (read-only)
  swap            Swap tokens via Aerodrome Universal Router
  deposit         Add liquidity to an Aerodrome pool
  withdraw        Remove liquidity from an Aerodrome pool
  stake           Stake LP tokens in an Aerodrome gauge
  unstake         Unstake LP tokens from an Aerodrome gauge
  claim-emissions Claim AERO gauge emissions
  claim-fees      Claim accumulated trading fees (unstake first)

Examples:
  aerodrome.py swap --from-token=ETH --to-token=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --amount=0.01 --use-decimals
  aerodrome.py positions
  aerodrome.py pools --token0=0x4200000000000000000000000000000000000006 --token1=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --limit=5
  aerodrome.py deposit --pool=0xcDAC0d6c6C59727a65F871236188350531885C43 --amount0=0.001 --use-decimals
  aerodrome.py withdraw --pool=0xcDAC0d6c6C59727a65F871236188350531885C43 --fraction=0.5
  aerodrome.py stake --pool=0xcDAC0d6c6C59727a65F871236188350531885C43
  aerodrome.py claim-emissions --pool=0xcDAC0d6c6C59727a65F871236188350531885C43
"""

import json
import os
import subprocess
import sys
import urllib.request
import urllib.error

BANKR_API = "https://api.bankr.bot"
SUGAR_SDK_REF = os.environ.get("SUGAR_SDK_REF", "v0.4.0")
SUGAR_SPEC = f"git+https://github.com/velodrome-finance/sugar-sdk.git@{SUGAR_SDK_REF}"
DEFAULT_RPC = "https://mainnet.base.org"
CHAIN_ID = 8453

COMMAND_MAP = {
    "swap": "swap",
    "positions": "positions",
    "pools": "pools",
    "deposit": "deposit",
    "withdraw": "withdraw",
    "stake": "stake",
    "unstake": "unstake",
    "claim-emissions": "claim_emissions",
    "claim-fees": "claim_fees",
}

READ_ONLY = {"positions", "pools"}

TX_DESCRIPTIONS = {
    "swap": "Aerodrome swap",
    "deposit": "Aerodrome add liquidity",
    "withdraw": "Aerodrome remove liquidity",
    "stake": "Aerodrome stake LP tokens",
    "unstake": "Aerodrome unstake LP tokens",
    "claim-emissions": "Claim AERO emissions",
    "claim-fees": "Claim Aerodrome trading fees",
}


def load_bankr_key():
    config_path = os.environ.get("BANKR_CONFIG", os.path.expanduser("~/.bankr/config.json"))
    if not os.path.exists(config_path):
        print(f"ERROR: Bankr config not found at {config_path}", file=sys.stderr)
        print("Run `bankr login` to authenticate.", file=sys.stderr)
        sys.exit(1)
    with open(config_path) as f:
        return json.load(f)["apiKey"]


def api_request(method, url, payload=None, headers=None):
    hdrs = {"User-Agent": "aerodrome-bankr-skill/1.0"}
    if headers:
        hdrs.update(headers)
    data = None
    if payload is not None:
        hdrs["Content-Type"] = "application/json"
        data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        print(f"ERROR: HTTP {e.code} from {url}: {body}", file=sys.stderr)
        sys.exit(1)


def get_wallet(bankr_key):
    result = api_request("GET", f"{BANKR_API}/agent/balances?chains=base", headers={"X-API-Key": bankr_key})
    return result["evmAddress"]


def bankr_submit(bankr_key, tx, description):
    return api_request(
        "POST",
        f"{BANKR_API}/agent/submit",
        payload={"transaction": tx, "description": description, "waitForConfirmation": True},
        headers={"X-API-Key": bankr_key},
    )


def build_sugar_env():
    env = os.environ.copy()
    env["SUGAR_RPC_URI_8453"] = env.get("SUGAR_RPC_URI_8453", DEFAULT_RPC)
    env.setdefault("UV_TOOL_DIR", "/tmp/uv-tools")
    env.setdefault("UV_CACHE_DIR", "/tmp/uv-cache")
    return env


def run_sugar(sugar_cmd, wallet, extra_args):
    """Run Sugar SDK CLI and return parsed JSON from stdout."""
    env = build_sugar_env()
    cmd = [
        "uvx", "--from", SUGAR_SPEC,
        "sugar", sugar_cmd,
        "--chain=8453",
        f"--wallet={wallet}",
    ] + extra_args

    print(f"[sugar] {' '.join(cmd)}", file=sys.stderr)

    result = subprocess.run(cmd, capture_output=True, text=True, env=env, timeout=180)

    if result.stderr.strip():
        for line in result.stderr.strip().splitlines():
            print(f"[sugar] {line}", file=sys.stderr)

    if result.returncode != 0:
        print(f"ERROR: Sugar CLI exited {result.returncode}. See stderr above.", file=sys.stderr)
        sys.exit(result.returncode)

    stdout = result.stdout.strip()
    if not stdout:
        print("ERROR: Sugar CLI produced no output.", file=sys.stderr)
        sys.exit(1)

    try:
        return json.loads(stdout)
    except json.JSONDecodeError:
        print(f"ERROR: Sugar CLI output is not valid JSON:\n{stdout[:500]}", file=sys.stderr)
        sys.exit(1)


def hex_value(v):
    if v is None:
        return "0"
    if isinstance(v, str) and v.startswith("0x"):
        return str(int(v, 16))
    return str(int(float(v)))


def normalize_calls(txs):
    """Convert Sugar [{from,to,data,value}] to Bankr submit format."""
    return [
        {
            "to": t["to"],
            "data": t.get("data") or "0x",
            "chainId": CHAIN_ID,
            "value": hex_value(t.get("value", 0)),
        }
        for t in txs
    ]


def check_slippage(args):
    for arg in args:
        if arg.startswith("--slippage="):
            try:
                pct = float(arg.split("=", 1)[1]) * 100
            except ValueError:
                continue
            if pct > 20:
                print(
                    f"WARN: Slippage {pct:.1f}% is very high. "
                    "Re-enter the exact slippage value to confirm:",
                    file=sys.stderr,
                )
                confirm = input(f"Type the slippage value to confirm ({pct:.1f}%): ").strip()
                if confirm != f"{pct:.1f}" and confirm != str(pct):
                    print("Aborted.", file=sys.stderr)
                    sys.exit(1)
            elif pct > 5:
                print(
                    f"WARN: Slippage {pct:.1f}% is high — execution may be materially worse than the quote.",
                    file=sys.stderr,
                )
                confirm = input("Type 'yes' to continue: ").strip().lower()
                if confirm != "yes":
                    print("Aborted.", file=sys.stderr)
                    sys.exit(1)
            elif pct > 1:
                print(f"INFO: Slippage is {pct:.1f}% (elevated).", file=sys.stderr)


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__.strip())
        sys.exit(0)

    command = sys.argv[1]
    sugar_cmd = COMMAND_MAP.get(command)
    if not sugar_cmd:
        print(
            f"ERROR: Unknown command '{command}'.\n"
            f"Valid commands: {', '.join(COMMAND_MAP)}",
            file=sys.stderr,
        )
        sys.exit(1)

    extra_args = sys.argv[2:]
    check_slippage(extra_args)

    bankr_key = load_bankr_key()
    wallet = get_wallet(bankr_key)
    print(f"Wallet: {wallet}", file=sys.stderr)

    output = run_sugar(sugar_cmd, wallet, extra_args)

    if command in READ_ONLY:
        print(json.dumps(output, indent=2))
        return

    if not isinstance(output, list):
        print(f"ERROR: Expected a transaction list, got: {type(output).__name__}", file=sys.stderr)
        sys.exit(1)

    if not output:
        print("No transactions to submit.", file=sys.stderr)
        return

    calls = normalize_calls(output)
    base_desc = TX_DESCRIPTIONS.get(command, f"Aerodrome {command}")
    total = len(calls)
    print(f"Submitting {total} transaction(s)...", file=sys.stderr)

    hashes = []
    for i, call in enumerate(calls, 1):
        step_desc = f"{base_desc} ({i}/{total})" if total > 1 else base_desc
        print(f"  tx {i}/{total} → {call['to']}", file=sys.stderr)
        result = bankr_submit(bankr_key, call, step_desc)
        if not result.get("success"):
            print(f"ERROR: tx {i} failed: {json.dumps(result)}", file=sys.stderr)
            sys.exit(1)
        tx_hash = result["transactionHash"]
        hashes.append(tx_hash)
        print(f"  tx {i}: {tx_hash}")

    print(f"\n=== SUCCESS: {command} ===")
    for h in hashes:
        print(f"  https://basescan.org/tx/{h}")


if __name__ == "__main__":
    main()
