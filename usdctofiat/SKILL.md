---
name: usdctofiat
description: Cash out Base USDC to fiat payment apps through USDCtoFiat by Galleon. Fast is 0% spread. Best delegates pricing (10 bps). Use when a Bankr user asks to convert Base USDC to fiat, estimate fiat received, create or inspect a cash-out, withdraw unmatched funds, or add funds to a live Fast order.
metadata:
  homepage: https://usdctofiat.xyz
  requires:
    env:
      - BANKR_API_KEY
---

# USDCtoFiat

USDCtoFiat by Galleon turns Base USDC into a non-custodial cash-out. The user is the maker: USDC stays in escrow until a buyer proves payment, or the user withdraws unmatched funds.

Call the published package, do not vendor it:

```ts
import { cashout, createOfframp } from "@usdctofiat/offramp";

await cashout({
  mode: "fast", // or "best"
  signer,       // Bankr-backed WalletClient; never a private key
  amount: "100",
  currency: "EUR",
  platform: "revolut",
  payee: "alice",
});
```

Attribution is handled by `@usdctofiat/offramp`.

## Modes

| Mode | Rate | What Galleon earns | Resume key |
| --- | --- | --- | --- |
| `fast` | Live market, **0% spread** | TOFIAT integration share | Composite deposit id for `createOfframp().watch()` / `.withdraw()` |
| `best` | Delegate strategy | **10 bps** on fill, taken from USDC released to the taker | Numeric EscrowV2 id for `deposits()` / `close()` |

Mode is required. Do not default it or describe Fast as "free"; it uses 0% spread.

## Hard rules

1. Run `capabilities` before naming supported platforms or currencies. Never hardcode the catalog.
2. An estimate is not a locked quote. Say `approximately`.
3. Before every `cashout`, `withdraw`, or `top-up`, show the exact action, mode, amount, destination/payee, and consequence. Wait for an explicit confirmation in a later user turn. Only then add `--confirm`.
4. Never retry an unknown or failed transaction blindly. Inspect the returned hash and Base wallet activity first.
5. Persist the `depositId` returned by `cashout`. It is the resume key for status, withdrawal, and top-up.
6. Never ask for or handle a private key. Writes use the user's Bankr wallet through `BANKR_API_KEY` and `/wallet/submit`.
7. Do not offer Wise while its published P2P crypto-sale prohibition holds. `PLATFORMS.*` is technical support, not provider permission.
8. Do not import `@zkp2p/cash`. Depend on `@usdctofiat/offramp@7.0.1` only.

## Setup

```bash
cd usdctofiat
npm install
export BANKR_API_KEY=<write-enabled-bankr-key>
```

The Bankr key must have Wallet API access and must not be read-only. The wallet needs Base USDC plus a small Base ETH balance for gas.

## Commands

```bash
# Live platform and currency catalog. No wallet access.
node scripts/usdctofiat.mjs capabilities

# Oracle estimate plus recent-fill ETA. No wallet access.
node scripts/usdctofiat.mjs estimate 100 USD

# Preview first: omit --confirm and relay the exact preview to the user.
node scripts/usdctofiat.mjs cashout \
  --mode fast --amount 100 --platform revolut --currency EUR --payee alice

# Only after the user confirms in a later turn.
node scripts/usdctofiat.mjs cashout \
  --mode fast --amount 100 --platform revolut --currency EUR --payee alice --confirm

node scripts/usdctofiat.mjs cashout \
  --mode best --amount 100 --platform monzo --currency GBP --payee alice --confirm

node scripts/usdctofiat.mjs status <depositId>
node scripts/usdctofiat.mjs orders

# Preview, then rerun with --confirm after a later-turn confirmation.
node scripts/usdctofiat.mjs withdraw <depositId>
node scripts/usdctofiat.mjs withdraw <depositId> --confirm

node scripts/usdctofiat.mjs top-up <depositId> --amount 25
node scripts/usdctofiat.mjs top-up <depositId> --amount 25 --confirm
```

`cashout` builds a Bankr-backed viem `WalletClient` and calls `cashout({ mode })`. Fast and Best both submit Base transactions through `/wallet/submit`.

## Conversation flow

1. Discover with `capabilities`.
2. Ask the user to choose **Fast** or **Best**. Do not pick a mode for them.
3. Estimate with `estimate` and label the result approximate.
4. Run the requested write without `--confirm` to generate a deterministic preview.
5. Ask the user to confirm that exact preview. Do not treat the original request as confirmation.
6. After a later-turn yes, rerun the unchanged command with `--confirm`.
7. Return the `depositId`, every transaction hash, the mode, the initial order state, and the next action.
8. Use `status` or `orders`; do not infer state from elapsed time.

## Platform caveats

- Technical catalog support is not payment-provider permission.
- Do not create a Wise cash-out while Wise prohibits receiving P2P crypto-sale payments.
- PayPal may require preapproval for cryptocurrency-related payments and a verified-payee handshake.
- Venmo, Revolut, Cash App, and Monzo validate that the handle exists.
- `ORDER_NOT_FOUND` immediately after creation is usually indexer lag. Retry the read, never the deposit transaction.
- A live buyer intent can temporarily block a full withdrawal. Surface the remediation and retry only after the intent expires.

## Failure boundaries

The script emits structured error fields: `code`, `retryable`, `remediation`, and recovery evidence. Follow them exactly.

- `TRANSACTION_SUBMISSION_UNKNOWN` or a Bankr success response without a hash: inspect Base activity and existing orders before any resubmission.
- `TRANSACTION_STATUS_UNKNOWN`: inspect the named transaction hash first.
- `ACCESS_POLICY_CONFIGURATION_FAILED`: the Fast deposit already exists. Never create another order; repair only the missing policy step.
- `EXTENSION_REGISTRATION_REQUIRED` / `PAYEE_VERIFICATION_REQUIRED`: stop. Direct the user to finish verified-payee setup; do not submit another cash-out.
- `INDEXER_UNAVAILABLE` or `ORACLE_READ_FAILED`: retry only the read.
- Bankr `untrusted_address`: stop. Do not route around the wallet scanner or suggest another submission path.

## References

- Product: https://usdctofiat.xyz
- Developers: https://usdctofiat.xyz/developers
- Agents: https://usdctofiat.xyz/developers/agents/
- Package: https://www.npmjs.com/package/@usdctofiat/offramp
- Machine reference: https://usdctofiat.xyz/llms.txt
