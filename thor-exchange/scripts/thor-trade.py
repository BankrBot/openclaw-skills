#!/usr/bin/env python3
"""Buy or sell a Thor Exchange token on Robinhood Chain via the Bankr Submit API.

Routes automatically:
  - pre-graduation  -> the token's BondingCurve (buy/sell, 1% ETH-side fee)
  - graduated       -> the Thor V3 0.30% pool (exactInputSingle / multicall-unwrap)

Every trade is slippage-protected: the minimum output is computed from a live
quote and the on-chain call reverts if the market moves past your tolerance.

Usage:
  thor-trade.py buy  <token_address> <eth_amount>   [slippage_bps]   # ETH  -> token
  thor-trade.py sell <token_address> <token_amount> [slippage_bps]   # token -> ETH

  slippage_bps defaults to 200 (2%).

Auth: reads the Bankr API key from $BANKR_API_KEY, else ~/.bankr/config.json
      ({"apiKey": "..."}), exactly like the other Bankr skills.

NOTE: Bankr already lists Robinhood Chain as a supported EVM chain
      (GET https://api.bankr.bot/chains -> "robinhood"). The final validation is
      one real submit with a Bankr API key. See references/how-it-works.md.
"""

import json
import os
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import thorlib as t  # noqa: E402


# --------------------------------------------------------------------------
# Bankr Submit API.
# --------------------------------------------------------------------------
def load_bankr_key() -> str:
    key = os.environ.get("BANKR_API_KEY")
    if key:
        return key
    path = os.environ.get("BANKR_CONFIG", os.path.expanduser("~/.bankr/config.json"))
    if not os.path.exists(path):
        print(f"ERROR: no BANKR_API_KEY env and no Bankr config at {path}", file=sys.stderr)
        sys.exit(1)
    with open(path) as f:
        return json.load(f)["apiKey"]


def _post(url: str, payload: dict, headers: dict) -> dict:
    hdrs = {"Content-Type": "application/json", "User-Agent": "thor-bankr-skill/1.0"}
    hdrs.update(headers)
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=hdrs)
    with urllib.request.urlopen(req, timeout=90) as resp:
        return json.loads(resp.read())


def _get(url: str, headers: dict) -> dict:
    hdrs = {"User-Agent": "thor-bankr-skill/1.0"}
    hdrs.update(headers)
    req = urllib.request.Request(url, headers=hdrs)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def get_wallet(key: str) -> str:
    res = _get(f"{t.BANKR_API}/wallet/me", {"X-API-Key": key})
    for w in res.get("wallets", []):
        if w.get("chain") == "evm":
            return w["address"]
    raise SystemExit("ERROR: this Bankr key has no associated EVM wallet.")


def submit(key: str, to: str, value: int, data: str, description: str) -> dict:
    res = _post(
        f"{t.BANKR_API}/wallet/submit",
        {
            "transaction": {"to": to, "chainId": t.CHAIN_ID, "value": str(value), "data": data},
            "description": description,
            "waitForConfirmation": True,
        },
        {"X-API-Key": key},
    )
    if not res.get("success"):
        print(f"ERROR: submit failed: {json.dumps(res)}", file=sys.stderr)
        sys.exit(1)
    return res


def ensure_approval(key: str, token: str, owner: str, spender: str, need: int, label: str):
    allowance = t.call_uint(token, t.encode_call(t.SEL["allowance"], t.w_addr(owner), t.w_addr(spender)))
    if allowance >= need:
        return
    print(f"=== Approving {label} to spend token ===")
    data = t.encode_call(t.SEL["approve"], t.w_addr(spender), t.w_uint(t.MAX_UINT256))
    res = submit(key, token, 0, data, f"Approve {label} for Thor Exchange trade")
    print(f"Approve tx: {res.get('transactionHash')}")


# --------------------------------------------------------------------------
# Calldata builders.
# --------------------------------------------------------------------------
def curve_buy_data(min_tokens_out: int) -> str:
    return t.encode_call(t.SEL["buy"], t.w_uint(min_tokens_out))


def curve_sell_data(tokens_in: int, min_eth_out: int) -> str:
    return t.encode_call(t.SEL["sell"], t.w_uint(tokens_in), t.w_uint(min_eth_out))


def v3_exact_input_single(token_in, token_out, recipient, dl, amount_in, min_out) -> str:
    # struct is fully static -> 8 inline words after the selector.
    return t.encode_call(
        t.SEL["exactInputSingle"],
        t.w_addr(token_in), t.w_addr(token_out), t.w_uint(t.V3_FEE_TIER),
        t.w_addr(recipient), t.w_uint(dl), t.w_uint(amount_in),
        t.w_uint(min_out), t.w_uint(0),   # sqrtPriceLimitX96 = 0 (no limit)
    )


def v3_sell_multicall(token, wallet, dl, tokens_in, min_eth_out) -> str:
    # 1) swap token -> WETH, keeping WETH in the router (recipient = address(0) -> router)
    swap = v3_exact_input_single(token, t.WETH, t.ZERO_ADDR, dl, tokens_in, min_eth_out)
    # 2) unwrap the router's WETH to ETH and forward to the wallet
    unwrap = t.encode_call(t.SEL["unwrapWETH9"], t.w_uint(min_eth_out), t.w_addr(wallet))
    return "0x" + t.SEL["multicall"] + t.encode_bytes_array([swap, unwrap])


# --------------------------------------------------------------------------
# Main.
# --------------------------------------------------------------------------
def main():
    if len(sys.argv) < 4 or sys.argv[1] not in ("buy", "sell"):
        print(__doc__.strip())
        sys.exit(1)

    action, token, amount = sys.argv[1], sys.argv[2], sys.argv[3]
    slippage = int(sys.argv[4]) if len(sys.argv) > 4 else 200

    key = load_bankr_key()
    wallet = get_wallet(key)
    info = t.resolve_token(token)
    sym = info["symbol"]
    dl = t.deadline()
    print(f"Wallet:    {wallet}")
    print(f"Token:     {sym} ({token})")
    print(f"Venue:     {'Thor V3 pool (graduated)' if info['graduated'] else 'bonding curve'}")
    print(f"Slippage:  {slippage} bps\n")

    if action == "buy":
        eth_wei = t.to_wei(amount, 18)
        expected = (t.v3_quote(t.WETH, token, eth_wei) if info["graduated"]
                    else t.curve_quote_buy(info["vEth"], info["vTok"], eth_wei))
        m = t.min_out(expected, slippage)
        print(f"Buy {amount} ETH -> ~{t.from_wei(expected, 18)} {sym} (min {t.from_wei(m, 18)})")
        if info["graduated"]:
            data = v3_exact_input_single(t.WETH, token, wallet, dl, eth_wei, m)
            res = submit(key, t.SWAP_ROUTER, eth_wei, data, f"Buy {sym} on Thor V3")
        else:
            data = curve_buy_data(m)
            res = submit(key, info["curve"], eth_wei, data, f"Buy {sym} on Thor bonding curve")

    else:  # sell
        tok_wei = t.to_wei(amount, 18)
        expected = (t.v3_quote(token, t.WETH, tok_wei) if info["graduated"]
                    else t.curve_quote_sell(info["vEth"], info["vTok"], tok_wei))
        m = t.min_out(expected, slippage)
        print(f"Sell {amount} {sym} -> ~{t.from_wei(expected, 18)} ETH (min {t.from_wei(m, 18)})")
        spender = t.SWAP_ROUTER if info["graduated"] else info["curve"]
        ensure_approval(key, token, wallet, spender, tok_wei,
                        "Thor V3 router" if info["graduated"] else "bonding curve")
        if info["graduated"]:
            data = v3_sell_multicall(token, wallet, dl, tok_wei, m)
            res = submit(key, t.SWAP_ROUTER, 0, data, f"Sell {sym} on Thor V3")
        else:
            data = curve_sell_data(tok_wei, m)
            res = submit(key, info["curve"], 0, data, f"Sell {sym} on Thor bonding curve")

    tx = res.get("transactionHash", "")
    print("\n=== SUCCESS ===")
    print(f"Status: {res.get('status', 'submitted')}")
    print(f"Tx:     {tx}")
    print(f"Track:  {t.EXPLORER}/tx/{tx}")


if __name__ == "__main__":
    main()
