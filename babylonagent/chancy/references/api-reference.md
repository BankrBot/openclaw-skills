# Chancy API Reference

Base URL: `https://chancy.cash`

## x402 Endpoints (pay-per-action)

These endpoints require x402 payment. See `x402-payment.md` for the
full payment flow.

### POST /v2/x402/sessions/create

Create a new game session. Host funds the prize pot.

**Request:**
```json
{
  "host": "0x1234...5678",
  "mode": "Easy",
  "prizePot": "5000000"
}
```

**Response (200):**
```json
{
  "sessionId": 42,
  "mode": "Easy",
  "board": 25,
  "bombs": 3,
  "host": "0x1234...5678",
  "status": "open"
}
```

**Cost:** Value of `prizePot` in USDC.

---

### POST /v2/x402/sessions/:id/join

Join an open game session as a player. Pays entrance fee.

**Request:**
```json
{
  "player": "0x1234...5678"
}
```

**Response (200):**
```json
{
  "sessionId": 42,
  "mode": "Easy",
  "board": 25,
  "bombs": 3,
  "status": "active"
}
```

**Cost:** $0.05 (50000 USDC units).

---

### POST /v2/x402/sessions/:id/reveal

Reveal fairness entropy seed. Free — must be called once before clicking tiles.

**Request:**
```json
{
  "player": "0x1234...5678"
}
```

**Response (200):**
```json
{
  "sessionId": 42,
  "revealed": true
}
```

---

### POST /v2/x402/sessions/:id/click

Reveal a tile. Each click costs USDC via x402.

**Request:**
```json
{
  "player": "0x1234...5678",
  "tile": 7
}
```

**Response — safe (200):**
```json
{
  "result": "safe",
  "tile": 7,
  "prize": "10000",
  "bombCount": 0,
  "tilesRevealed": 1,
  "credits": "10000"
}
```

**Response — bomb (200):**
```json
{
  "result": "bomb",
  "tile": 7,
  "bombCount": 1,
  "message": "Bomb hit! 2 lives remaining."
}
```

**Response — game over (200):**
```json
{
  "result": "gameover",
  "bombCount": 3,
  "message": "Game over. 3 bombs hit.",
  "creditsLost": "50000"
}
```

**Cost:** Mode-dependent (read from 402 envelope).

---

### POST /v2/x402/sessions/:id/quit

Quit the game and cash out accumulated winnings to credits.

**Request:**
```json
{
  "player": "0x1234...5678"
}
```

**Response (200):**
```json
{
  "sessionId": 42,
  "status": "closed",
  "creditsEarned": "30000",
  "message": "Cashed out $0.03"
}
```

---

## Free Endpoints

### GET /v2/x402/sessions

List open game sessions.

**Response:**
```json
[
  {
    "sessionId": 42,
    "mode": "Easy",
    "host": "0xabcd...1234",
    "prizePot": "5000000",
    "status": "open",
    "createdAt": "2026-06-25T14:00:00Z"
  }
]
```

---

### GET /v2/x402/credits/:wallet

Check credits (winnings) for a wallet address.

**Response:**
```json
{
  "wallet": "0x1234...5678",
  "credits": "30000",
  "creditsUSD": "0.03"
}
```

---

## Game Modes

| Mode | Board | Bombs | Prize Pot | Tile Cost |
|---|---|---|---|---|
| Easy | 5×5 (25 tiles) | 3 | $5.00 (5000000) | $0.05 |
| Normal | 7×7 (49 tiles) | 2 | $10.00 (10000000) | $0.05 |
| Hardcore | 10×10 (100 tiles) |1 | $20.00 (20000000) | $0.10 |

## Commit-Reveal Fairness

Chancy uses Pyth Entropy for provably fair bomb placement:

1. When a session starts, the host and server each generate a secret
2. Both secrets are committed on-chain (hash committed)
3. When the player reveals entropy, the combined seeds are revealed
4. Bomb positions are deterministic from the combined seed
5. Neither host nor server can manipulate placement alone

This means the game is provably fair — no party can front-run or
manipulate bomb positions.

## Rate Limits

- Free endpoints: 60 requests/minute
- Paid endpoints: No rate limit (payment is the rate limiter)
