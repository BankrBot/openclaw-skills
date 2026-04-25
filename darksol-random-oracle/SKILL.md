---
name: darksol-random-oracle
description: Bankr-compatible skill for DARKSOL Random Oracle, an on-chain verifiable RNG API on Base. Use when an agent needs random numbers, coin flips, dice rolls, random sequences, shuffles, raffles, loot drops, games, simulations, casino mechanics, or auditable randomness. Supports DARKSOL holder free access and x402 USDC payments on Base.
metadata:
  bankr:
    category: oracle
    chains: [base]
    homepage: https://acp.darksol.net/oracle
    apiBase: https://acp.darksol.net/oracle
    payment: x402-usdc-base
  openclaw:
    emoji: "dice"
---

# DARKSOL Random Oracle

On-chain verifiable randomness for agents, games, raffles, simulations, and apps.

Bankr can use this skill when a user asks for fair random numbers, coin flips, dice rolls, shuffles, giveaway winners, loot outcomes, or any randomness that should be publicly auditable.

## Service

- UI: `https://acp.darksol.net/oracle`
- API base: `https://acp.darksol.net/oracle`
- Chain: Base `8453`
- Oracle contract: `0x4d2f471ae67b129bAda9cfC6224f0343c5C8fB5D`
- DARKSOL token: `0x00cb1fbca324d51325a7264d54072bc073c28ba3`
- x402 payment token: USDC on Base `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- x402 pay-to: `0x8f9fa2bfd50079c1767d63effbfe642216bfcb01`

## When To Use

Use this skill for:

- coin flips
- dice rolls
- random integers
- random sequences
- shuffling a list
- raffle or giveaway winner selection
- loot tables and game outcomes
- simulation seeds
- casino/game mechanics that need verifiable RNG
- agent workflows that need proof-backed randomness with a Base transaction receipt

Do not use this skill for private key generation, wallet seed generation, passwords, cryptographic nonces, or secrets. The oracle returns public verifiable randomness, not private entropy.

## Access Model

### DARKSOL Holder Free Access

If the caller controls a wallet holding at least `1,000,000 DARKSOL` on Base, calls are free.

The caller signs this exact message, replacing the wallet address:

```text
DARKSOL Oracle free access
Wallet: 0xYourAgentWallet
Chain: Base (8453)
Purpose: prove token-holder access without payment
```

Send the proof headers:

```http
x-darksol-wallet: 0xYourAgentWallet
x-darksol-signature: 0xSignature
```

### x402 Paid Access

Without a valid holder proof, oracle endpoints require x402 payment:

- basic endpoints: `$0.05` USDC on Base
- premium endpoints: `$0.25` USDC on Base

A normal unauthenticated request returns HTTP 402 with payment requirements. Pay using an x402-compatible client, then retry with the x402 payment header.

## Endpoints

### Health

```http
GET https://acp.darksol.net/oracle/health
```

Returns health, contract, block number, pricing, and free-access details.

### Random Number

```http
GET https://acp.darksol.net/oracle/random/number?min=1&max=100
```

Params:
- `min`: integer, default `1`
- `max`: integer, default `10`

Price: `$0.05` or free for eligible DARKSOL holders.

### Coin Flip

```http
GET https://acp.darksol.net/oracle/random/coin
```

Returns `heads` or `tails`.

Price: `$0.05` or free for eligible DARKSOL holders.

### Dice Roll

```http
GET https://acp.darksol.net/oracle/random/dice?sides=20&count=3
```

Params:
- `sides`: integer `2..1000`, default `6`
- `count`: integer `1..100`, default `2`

Price: `$0.05` or free for eligible DARKSOL holders.

### Random Sequence

```http
GET https://acp.darksol.net/oracle/random/sequence?count=6&min=1&max=49
```

Params:
- `count`: integer `1..100`, default `5`
- `min`: integer, default `1`
- `max`: integer, default `50`

Price: `$0.25` or free for eligible DARKSOL holders.

### Shuffle

```http
GET https://acp.darksol.net/oracle/random/shuffle?items=alice,bob,carol,dave
```

Params:
- `items`: comma-separated list with at least 2 items

Price: `$0.25` or free for eligible DARKSOL holders.

## Response Shape

```json
{
  "result": 77,
  "access": {
    "mode": "x402_verified",
    "paymentRequired": false
  },
  "proof": {
    "txHash": "0x...",
    "blockNumber": 45168397,
    "contract": "0x4d2f471ae67b129bAda9cfC6224f0343c5C8fB5D",
    "chain": "base",
    "chainId": 8453
  },
  "timestamp": "2026-04-25T14:09:01.905Z"
}
```

Always surface the `proof.txHash` when reporting results to a user. That is the audit trail.

## Bankr Prompt Examples

```text
Use DARKSOL Random Oracle to roll 3 d20 dice and show me the Base proof tx.
```

```text
Use DARKSOL Random Oracle to pick a giveaway winner from alice,bob,carol,dave. Return the shuffled list and proof hash.
```

```text
Use DARKSOL Random Oracle to generate 6 lottery numbers from 1 to 49 and include the on-chain verification link.
```

```text
Flip a verifiable coin using DARKSOL Random Oracle.
```

## Agent Procedure

1. Parse the user request into one endpoint and query params.
2. Prefer holder-free access if the user provides a wallet and signature.
3. Otherwise use x402 USDC payment on Base.
4. Call the endpoint.
5. Return the result plus the proof transaction link:
   `https://basescan.org/tx/<txHash>`
6. If the endpoint returns HTTP 402, complete the x402 payment flow and retry.

## Curl Examples

```bash
curl https://acp.darksol.net/oracle/health
```

```bash
curl "https://acp.darksol.net/oracle/random/number?min=1&max=100"
```

```bash
curl "https://acp.darksol.net/oracle/random/dice?sides=20&count=3"
```

```bash
curl "https://acp.darksol.net/oracle/random/shuffle?items=alice,bob,carol,dave"
```

## Safety Notes

- Results are public and verifiable. Do not use for secrets.
- For regulated gambling, check jurisdictional requirements before use.
- For fairness-sensitive apps, store the returned proof tx with the application record.

---
Built with teeth.


