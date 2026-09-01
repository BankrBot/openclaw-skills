#!/usr/bin/env python3
"""Shared helpers for the Thor Exchange Bankr skill.

Pure Python 3 standard library — no third-party dependencies (mirrors the
symbiosis reference skill so it runs unmodified inside the Bankr agent runtime).

Everything here is chain-read + ABI-encode + off-chain quoting. Transaction
submission lives in thor-trade.py via the Bankr Wallet Submit API. The
bonding-curve quote mirrors the on-chain (Blockscout-verified) BondingCurve
contract and has been verified to reproduce live `buy()` output to the wei.
"""

import json
import os
import time
import urllib.request

# --------------------------------------------------------------------------
# Thor Exchange — Robinhood Chain (chainId 4663) deployment.
# All contracts are verified on Blockscout (see references/contracts-and-chain.md).
# --------------------------------------------------------------------------
CHAIN_ID = 4663
DEFAULT_RPC = "https://rpc.mainnet.chain.robinhood.com"
EXPLORER = "https://robinhoodchain.blockscout.com"

LAUNCHPAD_FACTORY = "0x7A5f1e159E441c5D769b903643E23E5e13967CDc"
SWAP_ROUTER = "0x2754d2E19c6283617206d4dAD35A70061065A206"
QUOTER_V2 = "0x8fA3aeC8E5D5F4B63c3b1F625ddBA2a7E9E713D0"
WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73"

# Graduation pool fee tier (0.30%).
V3_FEE_TIER = 3000

# Public trading fee: 1% on the ETH side of every bonding-curve trade.
# (All other curve parameters are read live from the chain — nothing about the
# curve's internal calibration is embedded here.)
TRADING_FEE_BPS = 100
BPS_DENOMINATOR = 10_000

BANKR_API = "https://api.bankr.bot"

# --------------------------------------------------------------------------
# Function selectors (cast sig; validated against the live contracts).
# --------------------------------------------------------------------------
SEL = {
    "bondingCurveOf":        "d9905b6c",  # bondingCurveOf(address)
    "isThorToken":           "5a207646",  # isThorToken(address)
    "graduated":             "e7c2b772",  # graduated()
    "virtualEthReserve":     "52b86d2b",  # virtualEthReserve()
    "virtualTokenReserve":   "343ee3b7",  # virtualTokenReserve()
    "buy":                   "d96a094a",  # buy(uint256)
    "sell":                  "d79875eb",  # sell(uint256,uint256)
    "balanceOf":             "70a08231",  # balanceOf(address)
    "allowance":             "dd62ed3e",  # allowance(address,address)
    "approve":               "095ea7b3",  # approve(address,uint256)
    "decimals":              "313ce567",  # decimals()
    "symbol":                "95d89b41",  # symbol()
    "exactInputSingle":      "414bf389",  # exactInputSingle((...))
    "unwrapWETH9":           "49404b7c",  # unwrapWETH9(uint256,address)
    "multicall":             "ac9650d8",  # multicall(bytes[])
    "quoteExactInputSingle": "c6a5026a",  # quoteExactInputSingle((...))
}

MAX_UINT256 = (1 << 256) - 1
ZERO_ADDR = "0x0000000000000000000000000000000000000000"


# --------------------------------------------------------------------------
# ABI encoding (hand-rolled; every value we encode is static — no dynamic
# heads/tails except the multicall bytes[] wrapper, handled explicitly).
# --------------------------------------------------------------------------
def w_uint(x: int) -> str:
    """Encode a uint as a 32-byte word (64 hex chars)."""
    if x < 0 or x > MAX_UINT256:
        raise ValueError(f"uint out of range: {x}")
    return f"{x:064x}"


def w_addr(a: str) -> str:
    """Encode an address as a 32-byte word."""
    a = a.lower().replace("0x", "")
    if len(a) != 40:
        raise ValueError(f"bad address: {a}")
    return a.rjust(64, "0")


def encode_call(selector: str, *words: str) -> str:
    """selector + concatenated 32-byte words -> 0x-prefixed calldata."""
    return "0x" + selector + "".join(words)


def encode_bytes_array(calls: list) -> str:
    """ABI-encode a bytes[] argument (used for Router.multicall).

    `calls` is a list of 0x-prefixed calldata strings. Returns the fully
    encoded argument region (offset + length + per-element offsets + data),
    ready to be appended after the multicall selector.
    """
    raw = [bytes.fromhex(c[2:] if c.startswith("0x") else c) for c in calls]
    n = len(raw)
    # head: n element offsets, each relative to the start of the head region.
    head_words = n
    offsets = []
    running = head_words * 32
    tails = []
    for b in raw:
        offsets.append(running)
        length_word = w_uint(len(b))
        padded = b.hex()
        if len(padded) % 64:
            padded += "0" * (64 - (len(padded) % 64))
        tail = length_word + padded
        tails.append(tail)
        running += len(tail) // 2
    body = w_uint(n) + "".join(w_uint(o) for o in offsets) + "".join(tails)
    # outer: one word pointing at the array (0x20), then the array body.
    return w_uint(0x20) + body


# --------------------------------------------------------------------------
# JSON-RPC (read-only) against the Robinhood Chain node.
# --------------------------------------------------------------------------
def rpc_url() -> str:
    return os.environ.get("THOR_RPC_URL", DEFAULT_RPC)


def eth_call(to: str, data: str, value: int = 0, sender: str = None) -> str:
    call_obj = {"to": to, "data": data}
    if value:
        call_obj["value"] = hex(value)
    if sender:
        call_obj["from"] = sender
    payload = {"jsonrpc": "2.0", "id": 1, "method": "eth_call", "params": [call_obj, "latest"]}
    req = urllib.request.Request(
        rpc_url(),
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "User-Agent": "thor-bankr-skill/1.0"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        out = json.loads(resp.read())
    if "error" in out:
        raise RuntimeError(f"eth_call reverted: {out['error']}")
    return out["result"]


def call_uint(to: str, data: str, sender: str = None, value: int = 0) -> int:
    return int(eth_call(to, data, value=value, sender=sender), 16)


def call_addr(to: str, data: str) -> str:
    return "0x" + eth_call(to, data)[-40:]


def call_bool(to: str, data: str) -> bool:
    return int(eth_call(to, data), 16) == 1


def read_symbol(token: str) -> str:
    """Best-effort ERC20 symbol (string). Falls back to a short address."""
    try:
        raw = eth_call(token, encode_call(SEL["symbol"]))[2:]
        # dynamic string: [offset][len][data]
        length = int(raw[64:128], 16)
        data = raw[128:128 + length * 2]
        return bytes.fromhex(data).decode("utf-8", "replace")
    except Exception:
        return token[:8] + "…"


# --------------------------------------------------------------------------
# Amount helpers.
# --------------------------------------------------------------------------
def to_wei(amount: str, decimals: int = 18) -> int:
    parts = str(amount).split(".")
    integer = parts[0] or "0"
    frac = (parts[1] if len(parts) > 1 else "")[:decimals]
    frac = frac + "0" * (decimals - len(frac))
    return int(integer) * (10 ** decimals) + (int(frac) if frac else 0)


def from_wei(amount_raw: int, decimals: int = 18) -> str:
    s = str(amount_raw).zfill(decimals + 1)
    int_part = s[: len(s) - decimals]
    frac_part = s[len(s) - decimals:].rstrip("0")
    return f"{int_part}.{frac_part}" if frac_part else int_part


def min_out(expected: int, slippage_bps: int) -> int:
    return expected * (BPS_DENOMINATOR - slippage_bps) // BPS_DENOMINATOR


# --------------------------------------------------------------------------
# Token resolution: token -> (curve, graduated, reserves).
# --------------------------------------------------------------------------
def resolve_token(token: str) -> dict:
    if not call_bool(LAUNCHPAD_FACTORY, encode_call(SEL["isThorToken"], w_addr(token))):
        raise SystemExit(f"ERROR: {token} is not a Thor Exchange token on Robinhood Chain (4663).")
    curve = call_addr(LAUNCHPAD_FACTORY, encode_call(SEL["bondingCurveOf"], w_addr(token)))
    graduated = call_bool(curve, encode_call(SEL["graduated"]))
    info = {"token": token, "curve": curve, "graduated": graduated, "symbol": read_symbol(token)}
    if not graduated:
        info["vEth"] = call_uint(curve, encode_call(SEL["virtualEthReserve"]))
        info["vTok"] = call_uint(curve, encode_call(SEL["virtualTokenReserve"]))
    return info


# --------------------------------------------------------------------------
# Bonding-curve math — constant-product (x*y=k) with the public 1% ETH-side fee,
# driven entirely by the live on-chain reserves. Matches the on-chain contract
# to the wei for ordinary trades. (The single buy that graduates the curve is a
# rare edge that the on-chain call clamps + refunds; slippage protection covers
# it — see references/how-it-works.md.)
# --------------------------------------------------------------------------
def curve_quote_buy(vEth: int, vTok: int, eth_in_wei: int) -> int:
    """tokens out for `eth_in_wei` of ETH on the curve."""
    if eth_in_wei == 0:
        return 0
    k = vEth * vTok
    fee = eth_in_wei * TRADING_FEE_BPS // BPS_DENOMINATOR
    eth_after = eth_in_wei - fee
    new_v_eth = vEth + eth_after
    new_v_tok = (k + new_v_eth - 1) // new_v_eth
    return vTok - new_v_tok


def curve_quote_sell(vEth: int, vTok: int, tokens_in_wei: int) -> int:
    """ETH out (net of 1% fee) for selling `tokens_in_wei` on the curve."""
    if tokens_in_wei == 0:
        return 0
    k = vEth * vTok
    new_v_tok = vTok + tokens_in_wei
    new_v_eth = (k + new_v_tok - 1) // new_v_tok
    eth_out_gross = vEth - new_v_eth
    fee = eth_out_gross * TRADING_FEE_BPS // BPS_DENOMINATOR
    return eth_out_gross - fee


def v3_quote(token_in: str, token_out: str, amount_in_wei: int) -> int:
    """Post-graduation quote via QuoterV2.quoteExactInputSingle (eth_call)."""
    data = encode_call(
        SEL["quoteExactInputSingle"],
        w_addr(token_in), w_addr(token_out), w_uint(amount_in_wei),
        w_uint(V3_FEE_TIER), w_uint(0),
    )
    raw = eth_call(QUOTER_V2, data)[2:]
    return int(raw[0:64], 16)   # first return word = amountOut


def deadline(seconds: int = 1200) -> int:
    return int(time.time()) + seconds
