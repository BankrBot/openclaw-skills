---
name: cryptolab
description: Crypto market analysis that returns one readable trade plan per coin — entry, stop, target and position size in the user's own money, with fees already deducted. Use when the user asks what the setup is on a coin, where to enter or where a stop belongs, how big a position should be for a given risk, what today's signals are, how past signals actually performed, or what the model says about a pair. Read-only: it analyses and never places orders, never holds funds, and never gives investment advice. Covers all Binance USDT spot pairs and Hyperliquid perpetuals.
metadata:
  clawdbot:
    emoji: "🧪"
    homepage: "https://cryptolabhq.com"
---

# CryptoLab

CryptoLab turns market statistics into a finished plan: what price to enter at,
where to get out if it goes wrong, where to take profit, and how much money to
put in — sized backwards from what the user is willing to lose.

**This skill is read-only.** It answers questions. It does not place orders, move
funds, or hold anything. If the user wants to act on what it says, they do that
themselves, with whatever tool they choose.

---

## Setup

The user needs a CryptoLab account and an API key.

1. Register at <https://cryptolabhq.com/register>
2. Open **Account → API keys**, name a key, press **Create a key**
3. Copy it immediately — it is shown once and never again

Pass the key on every request as a header. Both forms work:

```
X-API-Key: clab_…
Authorization: Bearer clab_…
```

The key carries the account's plan. A free account watches 3 pairs; paid tiers
watch more and unlock the scanner, on-chain data and sourced research. A request
never returns more than the plan allows, so an empty or short answer may simply
mean the plan is small — not that nothing was found.

Base URL: `https://cryptolabhq.com`

---

## Endpoints

All are `GET`. All return JSON.

### `/api/today` — the day's plans

The main one. Returns a card per watched pair.

```bash
curl -s -H "X-API-Key: $CRYPTOLAB_KEY" \
  "https://cryptolabhq.com/api/today"
```

```jsonc
{
  "headline": "2 opportunities today. The rest are waiting.",
  "counts": { "actionable": 2, "waiting": 22, "checked": 24 },
  "cards": [
    {
      "symbol": "SOLUSDT",
      "action": "BUY",              // BUY | SELL | WAIT
      "strength": 2,                // 1..3 — how clear the case is, NOT a probability
      "quality": "measured",        // measured | unproven
      "price": 118.42,
      "venue": "binance",
      "kind": "spot",
      "levels": {
        "entry": 118.19,
        "stop": 116.33,
        "target": 121.91,
        "stop_pct": 0.0148,
        "target_pct": 0.0325
      },
      "money": {
        "size": 675.00,             // in USD — what the exchange expects
        "loss_if_wrong": 11.99,     // in the user's currency, fees included
        "gain_if_right": 25.61,
        "fees": 0.75,
        "capital": 2700.00,
        "risk_pct": 0.01
      },
      "reasons":  ["The price has been rising and has come back to its average line"],
      "warnings": ["Volume is low. Quiet moves often come straight back."],
      "steps":    ["Open Binance and find SOLUSDT.", "…"]
    }
  ]
}
```

`levels` and `money` are `null` when the action is `WAIT` — there is no plan to
state. That is a normal, frequent answer.

### `/api/predict` — the model's view on one pair

```bash
curl -s -H "X-API-Key: $CRYPTOLAB_KEY" \
  "https://cryptolabhq.com/api/predict?symbol=BTCUSDT&timeframe=1h"
```

Returns `{symbol, direction, confidence, reason}`. `direction` is `UP`, `DOWN`
or `FLAT`. If no model has been trained for that pair, `reason` says so — report
that rather than treating `FLAT` as a finding.

### `/api/signals/performance` — how past signals actually did

```bash
curl -s -H "X-API-Key: $CRYPTOLAB_KEY" \
  "https://cryptolabhq.com/api/signals/performance"
```

Every signal closes itself at its target, its stop or its expiry, and counts
towards these numbers whichever way it went. This is the honest record — quote
it when the user asks whether the thing works.

### `/api/signals/feed` — recent signals

```bash
curl -s -H "X-API-Key: $CRYPTOLAB_KEY" \
  "https://cryptolabhq.com/api/signals/feed?limit=20"
```

### `/api/scanner` — what is moving

New listings, unusual volume, and breakouts, plus an honest `coverage` report of
how much of the market was actually checked.

### `/api/health` — status and the watchlist

Returns which venues are answering, the user's watched pairs, all available
symbols, and the plan. Useful for grounding an answer before making requests.

### `/api/markets` — prices across venues

Supports `?q=`, `?venue=`, `?limit=`, `?offset=`.

---

## How to report what comes back

These rules exist because the platform's whole value is that its numbers are not
inflated. An agent that paraphrases them loosely destroys that in one sentence.

**Carry the warnings with the numbers.** Each card has a `warnings` array. If you
state the entry and target, state the warnings in the same answer — not as a
footnote afterwards. They are the part that stops someone acting on a thin
market.

**`WAIT` is an answer, not a failure.** On most days, for most coins, there is no
good entry. Report that plainly. Do not go hunting for a different endpoint that
will produce something more exciting.

**Never present this as advice.** It is a calculation from public data by rules
the user can inspect. Phrase it as what the platform computes, not as what the
user should do.

**`strength` is not a probability.** One to three dots mean how far the situation
is from the middle of the model's uncertainty. A three-dot signal still loses
sometimes. Never convert it into a percentage chance of profit.

**`quality: "unproven"` means the model showed no measured edge on that pair.**
Say so when it appears. It is the difference between a statistic and a guess.

**Do not place orders.** Not through this skill, and not by chaining into a
trading skill on the user's behalf. If the user decides to trade, that is a
separate, explicit instruction from them.

---

## Common patterns

**"What should I do today?"**
Call `/api/today`. Report the actionable cards with their numbers and warnings,
and say how many are waiting.

**"What's the setup on SOL?"**
Call `/api/today` and find the card, since it carries the full plan. Fall back to
`/api/predict?symbol=SOLUSDT` if the pair is not on the user's watchlist.

**"How much should I buy?"**
The `money.size` field already answers this — it is derived from the user's
capital and risk setting, not from confidence. Explain that if asked.

**"Does this actually work?"**
Call `/api/signals/performance`. Quote it as-is, including the losses.

**"What's moving right now?"**
Call `/api/scanner`. Treat results as questions to investigate, not answers.

---

## Errors

| Status | Meaning |
|---|---|
| `401` | Missing, wrong or revoked key. Tell the user to check **Account → API keys**. |
| `402` | The plan does not include this. Say which plan unlocks it; do not retry. |
| `429` | Rate limited. Wait and retry once; do not loop. |
| `503` | A data source is down. `/api/health` says which one. |

---

## What CryptoLab does not do

It does not hold funds, accept deposits, trade on anyone's behalf, or give
investment advice. There is no route from an account to live trading — that is a
property of the code, not a setting. Any claim otherwise is wrong.
