---
name: berry-juicer
description: Single-sided token-supply yield on Base, paid as AI inference. Use when an agent or user wants to deposit a portion of an ERC-20 token's supply into a Berry Juicer vault to earn trading fees, check a Juicer position or inference balance, spend harvested yield as AI inference across 140+ models, or withdraw. The Bankr wallet is the creator wallet: it signs the spend authorization and holds the position. Built on Base. Inference provided through Surplus, wallet security through Privy.
metadata:
  emoji: "🫐"
  homepage: https://berryfi.org/juicer
  requires:
    bins:
      - bankr
---

# Berry Juicer

Berry Juicer turns idle token supply into a working, yield-generating position, and pays that yield as AI inference. A creator deposits a portion of an ERC-20 token's supply into a vault; the supply is deployed as a single-sided Uniswap V4 concentrated-liquidity position; the trading fees it earns are harvested to USDC and credited to the creator's own isolated inference wallet, where they can be spent across 140+ language models.

This skill lets a Bankr agent operate Berry Juicer end to end using the wallet Bankr already controls. There is no browser wallet connection: the agent's Bankr wallet is the creator wallet. It authorizes inference spending by signing a short message with `bankr wallet sign`, and the Berry backend verifies that signature against the same wallet address.

- **API base:** `https://juicerapi.berryfi.org`
- **App:** `https://berryfi.org/juicer`
- **Chain:** Base (8453)
- **Docs:** `https://docs.berryfi.org`

## How authentication works

Every spend or account call is authorized by a wallet signature, not an API key. The agent signs the exact message:

```
berry-inference:{address}:{timestamp}
```

where `{address}` is the agent's Bankr EVM wallet address **in lowercase**, and `{timestamp}` is the current time in milliseconds. The signature and its inputs are sent as request headers:

| Header              | Value                                              |
| ------------------- | -------------------------------------------------- |
| `x-berry-address`   | the agent's wallet address (lowercase)             |
| `x-berry-timestamp` | the millisecond timestamp used in the message      |
| `x-berry-sig`       | the signature returned by `bankr wallet sign`      |

The backend recovers the signer from the signature and confirms it matches `x-berry-address`. Because the Bankr wallet that signs is the same wallet that created the pool, the signature always resolves to the correct creator. Signatures are single-use and time-bound, so a fresh timestamp and signature are generated for every request.

### Producing the signature with Bankr

```
# 1. Get the agent's wallet address (lowercase it for the message)
ADDR=$(bankr wallet me --json | jq -r '.address' | tr 'A-Z' 'a-z')

# 2. Current millisecond timestamp
TS=$(($(date +%s) * 1000))

# 3. Sign the exact message with the Bankr wallet
SIG=$(bankr wallet sign --json \
  --message "berry-inference:${ADDR}:${TS}" \
  | jq -r '.signature')
```

`bankr wallet sign` uses `signatureType: personal_sign`, which is what the Berry backend expects. The same can be done through the REST API with `POST https://api.bankr.bot/wallet/sign`.

## Creating a Juicer position

A creator deposits a portion of a token's supply. The deposit transaction is an on-chain call to the Berry Juicer factory and can be executed by the Bankr wallet. Read the current parameters and the factory address from the config endpoint first:

```
curl -s https://juicerapi.berryfi.org/api/config | jq
```

This returns the chain id, the deposit factory address, the quote asset (USDC), the creator/protocol split, and the list of supported tokens. To create a position, the agent submits the factory's deposit call with its chosen token and amount through `bankr wallet submit` (raw transaction) or the Berry dapp. After the deposit confirms, the vault is live and begins accruing fees as the token trades.

Provisioning of the creator's isolated inference wallet happens automatically the first time inference is used; no separate setup call is required.

## Checking a position and balance

All reads are public and need no signature.

```
# Inference balance: the USDC harvested into this creator's inference wallet
curl -s "https://juicerapi.berryfi.org/api/creators/${ADDR}/balance" | jq

# This creator's vaults, split into open and closed
curl -s "https://juicerapi.berryfi.org/api/creators/${ADDR}/vaults" | jq

# Harvest / credit history for this creator
curl -s "https://juicerapi.berryfi.org/api/creators/${ADDR}/inference" | jq
```

The `balance` response reports `remaining6dp`, the USDC available to spend on inference, in 6-decimal units (1,000,000 = $1.00). Balance accrues only as the vault harvests fees, which depends on trading volume in the token; a fresh vault with no volume yet will show a zero balance, and that is expected.

## Listing available models

The set of models and their live per-token pricing comes from the models endpoint:

```
# Text/chat models (the default)
curl -s "https://juicerapi.berryfi.org/api/models" | jq '.count, .models[0:5]'

# All models including image, video, and audio
curl -s "https://juicerapi.berryfi.org/api/models?all=true" | jq '.count'
```

Each model entry includes its `id` (the exact string to send when running inference), a display name, context length, and pricing as per-token USD amounts. Multiply by 1,000,000 to express price per million tokens.

## Running inference (spending yield)

Inference is an authenticated call. The harvested USDC in the creator's inference wallet pays for it directly at the chosen model's live rate; there is no separate credit purchase or conversion step.

```
ADDR=$(bankr wallet me --json | jq -r '.address' | tr 'A-Z' 'a-z')
TS=$(($(date +%s) * 1000))
SIG=$(bankr wallet sign --json --message "berry-inference:${ADDR}:${TS}" | jq -r '.signature')

curl -s -X POST "https://juicerapi.berryfi.org/api/inference/chat" \
  -H "Content-Type: application/json" \
  -H "x-berry-address: ${ADDR}" \
  -H "x-berry-timestamp: ${TS}" \
  -H "x-berry-sig: ${SIG}" \
  -d '{
    "model": "llama-3.3-70b-instruct",
    "messages": [{"role": "user", "content": "Hello from my Berry Juicer yield"}]
  }' | jq
```

The body is OpenAI-compatible: a `model` id from the models endpoint and a `messages` array. On success the response contains the model output and a `billing` object describing the spend. Always send a model `id` that appears in `/api/models`; an unrecognized id is rejected with a clear error.

## Withdrawing

A creator may exit at any time, reclaiming the remaining token balance, any quote asset, and accrued fees. Withdrawal is an on-chain call to the vault, executed by the same Bankr wallet that created it, through `bankr wallet submit` or the Berry dapp. Only the creator wallet can withdraw its own vault.

## Error handling

Every error from the inference endpoint has a consistent shape:

```
{ "error": { "code": "...", "message": "...", "support": true|false } }
```

| Code              | Meaning                                                                 | What to do                                                        |
| ----------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `auth_failed`     | Signature missing, invalid, or expired                                  | Regenerate a fresh timestamp and signature, then retry once       |
| `unknown_model`   | The `model` id is not in the catalog                                    | Pick an id from `/api/models`                                     |
| `no_balance`      | The inference wallet holds no USDC yet                                   | Wait for the vault to harvest fees; balance accrues with volume   |
| `provider_error`  | The inference provider returned an error                                | Retry shortly; if it persists, contact support                    |
| `internal_error`  | A server-side problem unrelated to the request                          | Retry; if it persists, contact support                            |

When `support` is `true`, the issue is on the Berry side and can be raised at `support@berryfi.org`. When `support` is `false`, it is resolved by the agent (sign again, pick a valid model, or wait for balance).

## Notes and safety

- The Bankr wallet that signs is the spending identity. Keep that wallet's key managed by Bankr; the Berry backend never sees or holds it.
- Balance is real USDC in an isolated, per-creator wallet. Only the creator wallet can authorize spending it, and there is no operator path that can move it elsewhere.
- Reads are public and unauthenticated; only spending, and on-chain deposit and withdrawal, require the wallet.
- Use a fresh timestamp and signature for every authenticated request. Reused signatures are rejected.

## Reference

For the full API surface, request and response schemas, and the on-chain deposit and withdrawal call data, see [references/api.md](references/api.md).
