#!/usr/bin/env python3
"""Ophis (CoW Protocol) same-chain swap QUOTE — no execution.

Usage:
  ophis-quote.py <chain_id> <sell_token> <sell_decimals> <amount> <buy_token> <buy_decimals> [referral_code] [trader_address]

Example (100 USDC -> WETH on Base):
  ophis-quote.py 8453 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 6 100 \\
                 0x4200000000000000000000000000000000000006 18

Prints the expected buy amount, fee, and quote validity. The quote already
carries the Ophis partner fee in appData, so the price shown is post-fee.
"""
import sys
from decimal import Decimal

sys.path.insert(0, __import__("os").path.dirname(__file__))
import ophis_common as oc  # noqa: E402


def main() -> None:
    if len(sys.argv) < 7:
        print(__doc__.strip())
        sys.exit(1)
    chain_id = int(sys.argv[1])
    sell_token, sell_dec = sys.argv[2], int(sys.argv[3])
    amount = sys.argv[4]
    buy_token, buy_dec = sys.argv[5], int(sys.argv[6])
    referral = sys.argv[7] if len(sys.argv) > 7 else None
    # CoW's /quote has a ZERO-address deny-list, so a price-only query needs a non-zero `from`.
    # Default to a burn placeholder (fine for pricing); pass a real trader address to override.
    trader = sys.argv[8] if len(sys.argv) > 8 else "0x000000000000000000000000000000000000dEaD"

    sell_wei = oc.to_wei(amount, sell_dec)
    full_app_data, app_hash = oc.build_app_data(referral_code=referral)
    quote = oc.get_quote(chain_id, sell_token, buy_token, sell_wei, trader, full_app_data, app_hash)

    buy_wei = int(quote.get("buyAmount", "0"))
    fee_wei = int(quote.get("feeAmount", "0"))
    valid_to = quote.get("validTo")
    buy_human = Decimal(buy_wei) / (Decimal(10) ** buy_dec)

    print(f"=== Ophis quote (chain {chain_id}) ===")
    print(f"sell:  {amount} (token {sell_token})")
    print(f"buy:  ~{buy_human} (token {buy_token})")
    print(f"buyAmount (wei):  {buy_wei}")
    print(f"feeAmount (wei):  {fee_wei}")
    print(f"validTo:          {valid_to}")
    print(f"partner fee:      {oc.OPHIS_VOLUME_FEE_BPS} bps (in appData; MEV-protected, surplus returned)")


if __name__ == "__main__":
    main()
