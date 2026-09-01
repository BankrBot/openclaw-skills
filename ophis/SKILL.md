---
name: ophis
description: MEV-protected same-chain token swaps via Ophis (CoW Protocol intent settlement). Use when the user wants to swap one token for another ON THE SAME CHAIN with best execution — no sandwiching/front-running, price improvement (surplus) returned to the trader, and gasless signing (solvers pay gas). Supports Base, Optimism, Unichain, Arbitrum, Polygon, Gnosis, and Ethereum mainnet. Executes on-chain via the Bankr Submit API (token approval + on-chain order authorization); the order settles in a CoW batch auction. NOT for cross-chain bridging — use a bridging skill for that.
metadata:
  {
    "clawdbot":
      {
        "emoji": "🐮",
        "homepage": "https://ophis.fi",
        "requires": { "bins": ["python3", "bankr"] },
      },
  }
---

# Ophis

MEV-protected, same-chain token swaps through **Ophis**, an intent-settlement layer built on **CoW Protocol**. Instead of routing a swap straight through an AMM (where it can be sandwiched and pays the pool price), Ophis submits a signed *intent* that solvers compete to fill in a **batch auction**: the user gets a uniform clearing price, surplus (price improvement) is returned to them, and the trade is settled MEV-protected. Solvers pay the settlement gas, so the user's wallet only signs — it never spends gas on the swap itself.

## When To Use

Use Ophis when the user wants to:
- **Swap two tokens on the SAME chain** (e.g. USDC → WETH on Base) and cares about getting the best price without being front-run/sandwiched.
- Get **price improvement / surplus** beyond the AMM quote (CoW's coincidence-of-wants + solver competition).
- **Swap gaslessly** — the user's wallet signs/authorizes; solvers pay the on-chain gas.

Do NOT use Ophis for:
- **Cross-chain swaps or bridging** (token on chain A → token on chain B). Ophis is same-chain only; use a bridging skill (e.g. `symbiosis`, `trails`) for that.
- Chains Ophis/CoW does not support (see the Supported Chains table below).

## How It Works (the CoW intent flow)

A CoW swap is an **off-chain signed order**, not a normal swap transaction. This skill drives that flow using the Bankr wallet:

1. **Quote** — ask the Ophis/CoW quote endpoint how much `buyToken` the user gets for their `sellToken` amount (or vice-versa). The quote also returns the fee and a `validTo`.
2. **Build the order** — construct the CoW order with Ophis `appData` attached (this carries the Ophis integrator/partner fee + optional referral code; it is what routes the order through Ophis and credits the integrator).
3. **Approve** — submit an `approve(VaultRelayer, amount)` transaction, sent to the ERC-20 **sell token** (spender = the CoW **VaultRelayer**), **via the Bankr Submit API** (`POST /wallet/submit`).
4. **Post the order** — `POST` the order (with `signingScheme: "presign"`, empty signature) to the CoW/Ophis orderbook, which returns the order **UID**.
5. **Authorize the order on-chain** — submit a `setPreSignature(orderUid, true)` transaction to the CoW **Settlement** contract **via the Bankr Submit API**. This "presign" scheme authorizes the order with an on-chain transaction instead of an EIP-712 signature — a clean fit for Bankr's transaction-submission model (no raw message-signing needed). Once mined, solvers settle it in the next batch.
6. **Track** — poll the order status / link the user to `explorer.cow.fi` for the fill.

> Native-token (ETH) sells use CoW's eth-flow path instead of approve+presign. See `references/api.md`.

## Quick Start

### Get a quote

```
How much WETH will I get for 100 USDC on Base via Ophis?
```

```bash
python3 scripts/ophis-quote.py <chain_id> <sell_token> <sell_decimals> <amount> <buy_token> <buy_decimals>
# e.g. 100 USDC -> WETH on Base (8453):
python3 scripts/ophis-quote.py 8453 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 6 100 0x4200000000000000000000000000000000000006 18
```

### Execute a swap

```
Swap 100 USDC for WETH on Base using Ophis (MEV-protected).
```

```bash
python3 scripts/ophis-swap.py <chain_id> <sell_token> <sell_decimals> <amount> <buy_token> <buy_decimals> [slippage_bps]
```

The swap script: gets an Ophis/CoW quote, builds the order with Ophis `appData`, submits the ERC-20 approval to the VaultRelayer (if needed) and the `setPreSignature` authorization — both **via the Bankr Submit API** — then posts the order to the orderbook and prints the order UID + a tracking link.

## Script Usage

### ophis-quote.py — quote only, no execution
```
python3 scripts/ophis-quote.py <chain_id> <sell_token> <sell_decimals> <amount> <buy_token> <buy_decimals>
```
- `amount` — human-readable sell amount (e.g. "100" for 100 USDC, "0.1" for 0.1 WETH).
- Prints the expected `buyAmount`, the fee, and the quote validity.

### ophis-swap.py — full swap via Bankr Submit
```
python3 scripts/ophis-swap.py <chain_id> <sell_token> <sell_decimals> <amount> <buy_token> <buy_decimals> [slippage_bps]
```
- `slippage_bps` — optional, basis points (default 50 = 0.5%). Sets the minimum `buyAmount` (`buyAmount * (1 - slippage)`).
- Reads the Bankr API key from `BANKR_API_KEY` (or `~/.bankr/config.json`).
- Auto-resolves the Bankr wallet address (`GET /wallet/me`) as the order owner/receiver.
- Prints the order UID and an `explorer.cow.fi` tracking link.

## Supported Chains

See `references/chains-and-tokens.md` for chain IDs, the CoW Settlement + VaultRelayer addresses per chain, and common token addresses. Ophis is same-chain best-execution on the CoW-supported networks; Optimism (10) and Unichain (130) are Ophis-sovereign (100% of price improvement returned to the trader).

## Notes

- **Same-chain only.** For cross-chain, use a bridging skill.
- **Gasless for the user**, but the two authorization steps (approve + `setPreSignature`) ARE on-chain transactions the Bankr wallet pays gas for; the *swap settlement itself* is gasless (solvers pay it).
- **Integrator fee / referral** is carried in `appData` — see `references/api.md`. This is how a swap is attributed to Ophis and how an integrator earns the rebate.
