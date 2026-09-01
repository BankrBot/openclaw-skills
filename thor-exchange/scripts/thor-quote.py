#!/usr/bin/env python3
"""Quote a Thor Exchange buy or sell on Robinhood Chain (chainId 4663).

Read-only: hits the public Robinhood Chain RPC, never submits anything and
needs no Bankr key. Automatically routes a pre-graduation token through the
bonding-curve math and a graduated token through the Thor V3 QuoterV2.

Usage:
  thor-quote.py buy  <token_address> <eth_amount>      # ETH  -> token
  thor-quote.py sell <token_address> <token_amount>    # token -> ETH

Examples:
  thor-quote.py buy  0x5e798Dd12eDbcD5566cd3772aE5CE682e700750e 0.01
  thor-quote.py sell 0x5e798Dd12eDbcD5566cd3772aE5CE682e700750e 1000000
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import thorlib as t  # noqa: E402


def main():
    if len(sys.argv) < 4 or sys.argv[1] not in ("buy", "sell"):
        print(__doc__.strip())
        sys.exit(1)

    action, token, amount = sys.argv[1], sys.argv[2], sys.argv[3]
    info = t.resolve_token(token)
    sym = info["symbol"]
    venue = "Thor V3 pool (graduated)" if info["graduated"] else "bonding curve"
    print(f"Token:  {sym}  ({token})")
    print(f"Venue:  {venue}")

    if action == "buy":
        eth_wei = t.to_wei(amount, 18)
        if info["graduated"]:
            out = t.v3_quote(t.WETH, token, eth_wei)
        else:
            out = t.curve_quote_buy(info["vEth"], info["vTok"], eth_wei)
        print(f"\nBuy {amount} ETH  ->  ~{t.from_wei(out, 18)} {sym}")
        if not info["graduated"]:
            spot = info["vEth"] / info["vTok"]
            print(f"Curve spot price: {spot:.3e} ETH per {sym}")
    else:  # sell
        tok_wei = t.to_wei(amount, 18)
        if info["graduated"]:
            out = t.v3_quote(token, t.WETH, tok_wei)
        else:
            out = t.curve_quote_sell(info["vEth"], info["vTok"], tok_wei)
        print(f"\nSell {amount} {sym}  ->  ~{t.from_wei(out, 18)} ETH")

    print("\n(Estimate only — run thor-trade.py to execute with slippage protection.)")


if __name__ == "__main__":
    main()
