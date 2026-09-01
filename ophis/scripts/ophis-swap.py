#!/usr/bin/env python3
"""Ophis (CoW Protocol) MEV-protected SAME-CHAIN swap, executed via the Bankr wallet.

Usage:
  ophis-swap.py <chain_id> <sell_token> <sell_decimals> <amount> <buy_token> <buy_decimals> [slippage_bps] [referral_code]

Example (100 USDC -> WETH on Base, 0.5% slippage):
  ophis-swap.py 8453 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 6 100 \\
                0x4200000000000000000000000000000000000006 18 50

Flow (a CoW swap is an off-chain signed order, authorized here with the `presign`
scheme so the Bankr wallet only sends transactions, never signs a raw message):
  1. quote            POST {orderbook}/api/v1/quote            (price, post-fee)
  2. appData          build Ophis partner-fee appData + hash   (routes fee to Ophis)
  3. put app_data     PUT  {orderbook}/api/v1/app_data/{hash}  (solvers read the fee)
  4. approve          Bankr Submit: approve(VaultRelayer, amount)   [on-chain tx]
  5. post order       POST {orderbook}/api/v1/orders  signingScheme=presign -> uid
  6. authorize        Bankr Submit: Settlement.setPreSignature(uid, true) [on-chain]
  -> the order settles gaslessly (solvers pay gas) in the next CoW batch auction.

Requires: BANKR_API_KEY (bankr.bot/api-keys) and a keccak lib (see ophis_common).
Bankr's Submit API must support the target chain — the reliable overlap with Ophis
is Base, Unichain, Arbitrum, Polygon, BNB, and Ethereum (see references/api.md).
"""
import sys
import time
from decimal import Decimal

sys.path.insert(0, __import__("os").path.dirname(__file__))
import ophis_common as oc  # noqa: E402

ZERO = "0x0000000000000000000000000000000000000000"


def main() -> None:
    if len(sys.argv) < 7:
        print(__doc__.strip())
        sys.exit(1)
    chain_id = int(sys.argv[1])
    sell_token, sell_dec = sys.argv[2], int(sys.argv[3])
    amount = sys.argv[4]
    buy_token, buy_dec = sys.argv[5], int(sys.argv[6])
    slippage_bps = int(sys.argv[7]) if len(sys.argv) > 7 else 50
    referral = sys.argv[8] if len(sys.argv) > 8 else None

    NATIVE = (ZERO, "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee")
    if sell_token.lower() in NATIVE:
        sys.exit("Native-token sells use CoW's eth-flow path (not this script). Sell WETH instead, "
                 "or see references/api.md for the eth-flow contract call.")
    if buy_token.lower() in NATIVE:
        sys.exit("Native-token buys aren't supported here (SDK is ERC-20↔ERC-20). Buy WETH and "
                 "unwrap it yourself. See references/api.md.")
    if not (0 <= slippage_bps <= 5000):
        sys.exit("slippage_bps must be within [0, 5000] (0%..50%). A higher value floors the buy "
                 "amount toward 0 = an accept-any-price order (max-sandwich risk).")

    sell_wei = oc.to_wei(amount, sell_dec)
    key = oc.bankr_api_key()
    wallet = oc.bankr_wallet_address(key)
    print(f"Bankr wallet: {wallet}")

    # Enroll so the rebate indexer tracks this wallet's trades (idempotent).
    oc.enroll_wallet(wallet)

    # 1-2. appData (partner fee) + quote (post-fee price).
    full_app_data, app_hash = oc.build_app_data(referral_code=referral)
    quote = oc.get_quote(chain_id, sell_token, buy_token, sell_wei, wallet, full_app_data, app_hash)
    # Require the binding fields present (no silent default), then bind the GROSS to the request.
    # The order sells the gross amount with feeAmount 0: Ophis/CoW take the fee from surplus + the
    # appData partner fee, and the orderbook rejects a non-zero signed feeAmount. A sell quote splits
    # sellAmountBeforeFee into (sellAmount NET, feeAmount); their sum is the gross the caller asked for.
    for _f in ("sellAmount", "buyAmount", "feeAmount"):
        if _f not in quote:
            sys.exit(f"orderbook quote is missing required field {_f!r}: {quote}")
    quote_buy = int(quote["buyAmount"])
    quote_sell = int(quote["sellAmount"])
    quote_fee = int(quote["feeAmount"])
    gross = quote_sell + quote_fee
    if gross != sell_wei:
        sys.exit(f"quote gross (sellAmount+feeAmount = {gross}) != requested ({sell_wei}); refusing to sign a different amount.")
    valid_to = int(time.time()) + 1200  # self-set; do not trust the quote's expiry
    if quote_buy <= 0:
        sys.exit(f"quote returned no buyAmount: {quote}")

    # Slippage floor on the buy side. Refuse a zero floor (accept-any-price).
    min_buy = quote_buy * (10_000 - slippage_bps) // 10_000
    if min_buy <= 0:
        sys.exit("computed minimum buy amount is 0 — refusing an accept-any-price order.")
    print(f"Quote: ~{Decimal(quote_buy) / (Decimal(10) ** buy_dec)} buy token "
          f"(min after {slippage_bps}bps: {Decimal(min_buy) / (Decimal(10) ** buy_dec)})")

    # 3. Publish the full appData so solvers honor the partner fee for this hash.
    oc.put_app_data(chain_id, app_hash, full_app_data)

    # 4. Approve the sell TOKEN so the VaultRelayer can pull it, via Bankr Submit.
    # The transaction target is the ERC-20 sell token; the approve() spender is the
    # relayer. (Sending approve() to the relayer itself would revert / grant nothing.)
    relayer = oc.vault_relayer(chain_id)
    approve_amt = gross  # settlement pulls the gross (signed sellAmount + feeAmount 0)
    print("Approving sell token -> VaultRelayer via Bankr Submit ...")
    oc.bankr_submit(key, chain_id, sell_token, oc.encode_approve(relayer, approve_amt),
                    "Approve sell token to CoW VaultRelayer for Ophis swap")

    # 5. Post the order with signingScheme=presign (empty signature; authorized on-chain next).
    order = {
        "sellToken": sell_token,
        "buyToken": buy_token,
        "receiver": wallet,
        "sellAmount": str(gross),
        "buyAmount": str(min_buy),
        "validTo": valid_to,
        "feeAmount": "0",              # Ophis/CoW take the fee from surplus + the appData partner fee
        "kind": "sell",
        "partiallyFillable": False,
        "sellTokenBalance": "erc20",
        "buyTokenBalance": "erc20",
        "appData": full_app_data,      # FULL json string (not the hash) on submit
        "appDataHash": app_hash,
        "signingScheme": "presign",
        "signature": "0x",
        "from": wallet,
    }
    order_uid = oc.post_order(chain_id, order)
    print(f"Order posted (presignature pending): {order_uid}")

    # 6. Authorize the order on-chain via Bankr Submit -> setPreSignature(uid, true).
    settlement = oc.settlement_address(chain_id)
    print("Authorizing order on-chain (setPreSignature) via Bankr Submit ...")
    oc.bankr_submit(key, chain_id, settlement, oc.encode_set_presignature(order_uid, True),
                    "Authorize Ophis/CoW order (setPreSignature)")

    base = oc.orderbook_url(chain_id)
    print("\n=== SUCCESS — order authorized; solvers will settle it in the next batch ===")
    print(f"Order UID: {order_uid}")
    print(f"Status:    {base}/api/v1/orders/{order_uid}")
    print(f"Explorer:  https://explorer.cow.fi/orders/{order_uid}  (CoW-hosted chains)")


if __name__ == "__main__":
    main()
