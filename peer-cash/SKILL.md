---
name: peer-cash
description: Cash out Base USDC to fiat payment apps through Peer, including Venmo, Revolut, Wise, Zelle, Cash App, and more. Use when a Bankr user asks to convert Base USDC to fiat, estimate fiat received, create or inspect a cash-out order, withdraw an unmatched order, or add funds to a live order.
metadata:
  homepage: https://peer.xyz/cash-sdk
  requires:
    env:
      - BANKR_API_KEY
---

# Peer Cash

Peer Cash turns Base USDC into a protocol-held order that a buyer fills by paying the user through a supported fiat payment app. The user is the maker: their USDC remains in the Peer escrow until a buyer proves payment, or the user withdraws unmatched funds.

## Hard rules

1. Run `capabilities` before naming supported platforms or currencies. Never hardcode the catalog.
2. An estimate is not a locked quote. Say `approximately`; the binding Chainlink rate resolves when a buyer fills.
3. Before every `cashout`, `withdraw`, or `top-up`, show the exact action, amount, destination/payee, and consequence. Wait for an explicit confirmation in a later user turn. Only then add `--confirm`.
4. Never retry an unknown or failed transaction blindly. Inspect the returned hash and Base wallet activity first.
5. Persist the `depositId` returned by `cashout`. It is the resume key for status, withdrawal, and top-up.
6. Never ask for or handle a private key. Writes use the user's Bankr wallet through `BANKR_API_KEY`.

## Setup

```bash
cd peer-cash
npm install
export BANKR_API_KEY=<write-enabled-bankr-key>
```

The Bankr key must have Wallet API access and must not be read-only. The wallet needs Base USDC plus a small Base ETH balance for gas.

## Commands

```bash
# Live platform and currency catalog. No wallet access.
node scripts/peer-cash.mjs capabilities

# Oracle estimate plus recent-fill ETA. No wallet access.
node scripts/peer-cash.mjs estimate 100 USD

# Preview first: omit --confirm and relay the exact preview to the user.
node scripts/peer-cash.mjs cashout \
  --amount 100 --platform venmo --currency USD --payee @handle

# Only after the user confirms in a later turn.
node scripts/peer-cash.mjs cashout \
  --amount 100 --platform venmo --currency USD --payee @handle --confirm

node scripts/peer-cash.mjs status <depositId>
node scripts/peer-cash.mjs orders

# Preview, then rerun with --confirm after a later-turn confirmation.
node scripts/peer-cash.mjs withdraw <depositId>
node scripts/peer-cash.mjs withdraw <depositId> --confirm

node scripts/peer-cash.mjs top-up <depositId> --amount 25
node scripts/peer-cash.mjs top-up <depositId> --amount 25 --confirm
```

`cashout` submits Base USDC approval and deposit creation in order. For Venmo, Cash App, and PayPal, it also attaches the required verified-buyer access policy after the deposit confirms.

## Conversation flow

1. Discover with `capabilities`.
2. Estimate with `estimate` and label the result approximate.
3. Run the requested write without `--confirm` to generate a deterministic preview.
4. Ask the user to confirm that exact preview. Do not treat the original request as confirmation.
5. After a later-turn yes, rerun the unchanged command with `--confirm`.
6. Return the `depositId`, every transaction hash, the initial order state, and the next action.
7. Use `status` or `orders`; do not infer state from elapsed time.

## Platform caveats

- Wise and PayPal may require a Peer identity attestation when registering a new payee. An already registered handle can be reused. If the SDK returns `PAYEE_VERIFICATION_REQUIRED`, direct the user to register that handle through Peer web; do not submit another cash-out.
- Venmo, Revolut, Cash App, and Monzo validate that the handle exists.
- `ORDER_NOT_FOUND` immediately after creation is usually indexer lag. Retry the read, never the deposit transaction.
- A live buyer intent can temporarily block a full withdrawal. Surface the SDK remediation and retry only after the intent expires.

## Failure boundaries

The script emits structured `CashError` fields: `code`, `retryable`, `remediation`, and recovery evidence. Follow them exactly.

- `TRANSACTION_SUBMISSION_UNKNOWN` or a Bankr success response without a hash: inspect Base activity and existing orders before any resubmission.
- `TRANSACTION_STATUS_UNKNOWN`: inspect the named transaction hash first.
- `ACCESS_POLICY_CONFIGURATION_FAILED`: the deposit already exists. Never create another order; repair only the missing policy step.
- `INDEXER_UNAVAILABLE` or `ORACLE_READ_FAILED`: retry only the read.
- Bankr `untrusted_address`: stop. Do not route around the wallet scanner or suggest another submission path.

## Attribution

The integration emits the analytics marker `bankr`. A user may optionally set `PEER_CASH_REFERRAL_CODE` to the six-character code from their Peer app. Peer then applies that code's deposit-level integration share when the order fills.

## References

- SDK: https://www.npmjs.com/package/@zkp2p/cash
- Developer docs: https://docs.peer.xyz/developer/peer-cash
- Source and recovery manual: https://github.com/zkp2p/peer-cash
- Builder support: https://t.me/zk_p2p/167174
