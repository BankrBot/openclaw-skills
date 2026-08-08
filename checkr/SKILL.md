---
name: checkr
description: |
  Access real-time X/Twitter attention intelligence for Base chain tokens via the checkr API.
  Use when you need to know what is trending on CT, which tokens are spiking in social attention,
  get attention/price divergence signals, or fetch narrative summaries for specific Base tokens.
  Triggers: "what's trending on Base", "check attention for $TOKEN", "what's spiking right now",
  "social signal for X", any token research needing CT attention data.
  Payments via x402 — USDC on Base, no API key or account needed.
---

# checkr

Real-time X/Twitter attention intelligence for Base chain tokens.

**Base URL:** `https://api.checkr.social`  
**Docs:** `https://api.checkr.social/docs`  
**Payment:** x402 — USDC on Base mainnet, pay-per-call, no account needed.

## Endpoints

| Endpoint | Price | What it returns |
|---|---|---|
| `GET /v1/leaderboard` | $0.02 | Top Base tokens ranked by social attention share |
| `GET /v1/spikes` | $0.05 | Tokens currently velocity-spiking (the radar sweep) |
| `GET /v1/token/{symbol}` | $0.50 | Deep dive: ATT deltas, price, divergence, narrative |
| `GET /v1/bankr` | $0.02 | Attention leaderboard for the bankr agent ecosystem |

Full response schemas and field definitions: `https://api.checkr.social/docs`

## How to Call (x402)

x402 is pay-per-call. No API key or account. Wallet + USDC on Base is all you need.

**Python:**
```python
from x402.client import x402_client

client = x402_client(wallet=YOUR_WALLET)

# What's spiking right now — $0.05
spikes = client.get("https://api.checkr.social/v1/spikes").json()

# Top tokens by attention — $0.02
leaderboard = client.get("https://api.checkr.social/v1/leaderboard").json()

# Deep dive on a token — $0.50
token = client.get("https://api.checkr.social/v1/token/BNKR").json()
```

**TypeScript:**
```typescript
import { withPaymentInterceptor } from "x402-axios";
import axios from "axios";

const client = withPaymentInterceptor(axios.create(), walletClient);

const { data } = await client.get("https://api.checkr.social/v1/spikes");
```

Payment is handled automatically by the x402 client — it intercepts the 402, signs and sends payment, then retries with the receipt.

## Practical Flow

Use spikes as your radar. Drill into token for context.

```python
# 1. What's moving?
spikes = client.get("https://api.checkr.social/v1/spikes").json()
# → [{ symbol: "TIBBIR", velocity: 3.9, ATT_pct: 11.4, divergence: false, hawkes: {...} }]

# 2. Deep dive on the top spike
top = spikes["spikes"][0]["symbol"]
detail = client.get(f"https://api.checkr.social/v1/token/{top}").json()
# → full price, divergence, spike history, narrative
```

## Key Fields

**On every response:**
- `data_age_minutes` — how fresh the data is. Use before acting.

**On spikes:**
- `velocity` — momentum multiplier vs baseline. 3.0+ = meaningful spike.
- `divergence` — `true` = attention up, price flat/down. The alpha pattern.
- `hawkes.viral_class` — `BUILDING` / `SUSTAINED` / `FADING`. Is this self-reinforcing?
- `rotating_from` — tokens losing attention as this one gains.
- `narrative_summary` — AI-generated 180-char brief. `null` if signal below confidence threshold.

**On token deep dive:**
- `ATT_delta_1h` / `ATT_delta_4h` — attention share movement over time.
- `spike_history.hit_rate` — % of past spikes with confirmed price follow-through.
- `narrative.type` — `infrastructure` / `ecosystem` / `fud_defense` / `meme` / `launch_hype`.

## Query Params

```
GET /v1/leaderboard?limit=10&sort_by=ATT_pct&min_mentions=5
GET /v1/spikes?min_velocity=3.0&min_mentions=10&divergence_only=false
```

## Requirements

- USDC on Base mainnet
- Python: `pip install x402`
- TypeScript: `npm install x402-axios`
- Base gas for payment (~$0.01)
