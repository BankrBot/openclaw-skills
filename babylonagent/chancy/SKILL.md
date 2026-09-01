---
name: chancy
description: |
  Host and play onchain tile-reveal games on Base. Pay per action with
  x402 — no pre-funding, no accounts, no API keys. Sign EIP-3009 USDC
  transfers and call the endpoints directly.

  Triggers: "play chancy", "host a game", "create a chancy game",
  "list open chancy games", "join a chancy game", "play minesweeper onchain".
emoji: 💣
tags: [games, base, x402, usdc, onchain, mining, tiles]
version: 1
visibility: public
metadata:
  openclaw:
    requires:
      bins: [curl, jq]
---

# chancy

Onchain minesweeper on Base L2. Pay per action with x402 — no deposit,
no account, no API key. Every game action is a single paid HTTP call
settled on-chain via the Coinbase CDP facilitator.

**Live on Base mainnet. Real USDC. Real settlement.**

## What is Chancy?

A tile-reveal game. The board hides bombs and prizes. Reveal tiles to
win USDC. Hit 3 bombs → game over. Each tile costs a small amount of
USDC (paid via x402), and the prize pot grows with every safe reveal.

**Game modes:**

| Mode | Board | Bombs | Prize |
|---|---|---|---|
| Easy | 5×5 (25 tiles) | 3 | $5.00 |
| Normal | 7×7 (49 tiles) | 2 | $10.00 |
| Hardcore | 10×10 (100 tiles) | 1 | $20.00 |

## Base URL

```
https://chancy.cash
```

## Payment — x402 (EIP-3009 USDC)

All paid endpoints use the standard x402 flow:

1. Call the endpoint without payment → get `402` + `PAYMENT-REQUIRED` header
2. Decode the base64 header → read `accepts[]` for payment details
3. Sign an EIP-3009 `TransferWithAuthorization` for the USDC amount
4. Retry the request with `X-Payment: <base64-encoded payment payload>`
5. Facilitator verifies → settles on-chain → game action executes

**Bankr wallet layer handles signing automatically.** When calling via
the Bankr agent, the wallet layer intercepts the 402, signs the
appropriate primitive, and retries — no manual signing code needed.

If signing manually (non-Bankr), the EIP-712 typed data is:

```json
{
  "domain": {
    "name": "USD Coin",
    "version": "2",
    "chainId": 8453,
    "verifyingContract": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  },
  "types": {
    "TransferWithAuthorization": [
      { "name": "from", "type": "address" },
      { "name": "to", "type": "address" },
      { "name": "value", "type": "uint256" },
      { "name": "validAfter", "type": "uint256" },
      { "name": "validBefore", "type": "uint256" },
      { "name": "nonce", "type": "bytes32" }
    ]
  },
  "primaryType": "TransferWithAuthorization",
  "message": {
    "from": "<your_wallet>",
    "to": "0xbcd9b0ba388608598f9eaab43bfc7ba44324f860",
    "value": "<amount_from_402_envelope>",
    "validAfter": 0,
    "validBefore": "<now + 1 hour>",
    "nonce": "<random_bytes32>"
  }
}
```

## Endpoints

### Free endpoints (no payment)

```bash
# List open games — see what's available to join
curl -sS https://chancy.cash/v2/x402/sessions
```

```bash
# Check a wallet's credits (winnings)
curl -sS https://chancy.cash/v2/x402/credits/<wallet_address>
```

### Paid endpoints (x402)

#### Create a game (host)

```bash
curl -sS -X POST https://chancy.cash/v2/x402/sessions/create \
  -H "Content-Type: application/json" \
  -d '{"host":"<your_wallet>","mode":"Easy","prizePot":"5000000"}'
```

| Param | Type | Values |
|---|---|---|
| `host` | address | Your wallet address |
| `mode` | string | `"Easy"`, `"Normal"`, `"Hardcore"` |
| `prizePot` | string | USDC amount in units (6 decimals). Easy=5000000 ($5), Normal=10000000 ($10), Hardcore=20000000 ($20) |

**Cost:** `prizePot` amount in USDC (e.g., $5.00 for Easy).

#### Join a game

```bash
curl -sS -X POST https://chancy.cash/v2/x402/sessions/<id>/join \
  -H "Content-Type: application/json" \
  -d '{"player":"<your_wallet>"}'
```

**Cost:** $0.05 (50000 units USDC).

#### Reveal entropy (fairness seed — free)

```bash
curl -sS -X POST https://chancy.cash/v2/x402/sessions/<id>/reveal \
  -H "Content-Type: application/json" \
  -d '{"player":"<your_wallet>"}'
```

Must be called once before clicking tiles. Commits your fairness seed.

#### Click a tile (reveal)

```bash
curl -sS -X POST https://chancy.cash/v2/x402/sessions/<id>/click \
  -H "Content-Type: application/json" \
  -d '{"player":"<your_wallet>","tile":12}'
```

| Param | Type | Description |
|---|---|---|
| `tile` | number | Tile index (0 to board_size - 1) |

**Cost:** Dynamic — per-tile price based on mode. Read from the 402 envelope.

**Response:** `{ "result": "safe", "prize": "10000" }` or `{ "result": "bomb", "bombCount": 1 }`

#### Quit a game (cash out winnings — free)

```bash
curl -sS -X POST https://chancy.cash/v2/x402/sessions/<id>/quit \
  -H "Content-Type: application/json" \
  -d '{"player":"<your_wallet>"}'
```

Returns the player's accumulated winnings as credits.

## Full game flow

```bash
# 1. Check available games
curl -sS https://chancy.cash/v2/x402/sessions

# 2. Create a game (host pays prize pot)
curl -sS -X POST https://chancy.cash/v2/x402/sessions/create \
  -H "Content-Type: application/json" \
  -d '{"host":"0xYOUR_WALLET","mode":"Easy","prizePot":"5000000"}'
# → { "sessionId": 42, "mode": "Easy", "board": 25, "bombs": 3 }

# 3. Join the game (player pays entrance)
curl -sS -X POST https://chancy.cash/v2/x402/sessions/42/join \
  -H "Content-Type: application/json" \
  -d '{"player":"0xYOUR_WALLET"}'

# 4. Reveal entropy seed
curl -sS -X POST https://chancy.cash/v2/x402/sessions/42/reveal \
  -H "Content-Type: application/json" \
  -d '{"player":"0xYOUR_WALLET"}'

# 5. Click tiles (pay per click via x402)
curl -sS -X POST https://chancy.cash/v2/x402/sessions/42/click \
  -H "Content-Type: application/json" \
  -d '{"player":"0xYOUR_WALLET","tile":0}'

curl -sS -X POST https://chancy.cash/v2/x402/sessions/42/click \
  -H "Content-Type: application/json" \
  -d '{"player":"0xYOUR_WALLET","tile":1}'

# ... continue clicking safe tiles until you have enough or quit

# 6. Quit and cash out
curl -sS -X POST https://chancy.cash/v2/x402/sessions/42/quit \
  -H "Content-Type: application/json" \
  -d '{"player":"0xYOUR_WALLET"}'
```

## Strategy

- **Easy mode (25 tiles, 3 bombs):** 22 safe tiles. Bomb probability
  starts at 12% and drops with each safe reveal. Expected value is
  positive if you reveal 5+ tiles per game.
- **Quit early:** Each safe tile adds to your winnings. Quit before
  hitting 3 bombs to lock in credits.
- **Bomb counter:** Each bomb hit shows `bombCount` (1, 2, or 3). At
  3 bombs the game ends and you lose accumulated winnings from that
  session.

## Contract Addresses (Base Mainnet)

| Contract | Address |
|---|---|
| Vault | `0xbE81cE9d9909A31184D1878075f60bbbf8571612` |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Randomness | `0x705dF0f1667Ed82bB25E5a51273a9Ea6dE5C6e96` |
| Pyth Entropy | `0x6E7D74FA7d5c90FEF9F0512987605a6d546181Bb` |

## Natural Language Commands

When a user says any of these, load this skill and act:

- "host a $5 easy game" → create Easy mode, $5 pot
- "host a hardcore game" → create Hardcore mode, $20 pot
- "play chancy" → list games, join one, play autonomously
- "list open games" → GET /v2/x402/sessions
- "join game #42" → POST join endpoint
- "what's my chancy balance" → GET credits endpoint

## Rules

- 3 bombs = game over, lose session winnings
- Quit anytime to keep what you've earned
- Every tile click is a real on-chain USDC payment
- Provably fair via Pyth entropy commit-reveal

## Built by

Babylon Agent — autonomous onchain infrastructure on Base.
GitHub: github.com/babylonagent/chancy
