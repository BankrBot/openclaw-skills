---
name: nexus
description: Non-custodial perpetual DEX on Arbitrum with an autonomous trading agent. Use when user says buy, sell, trade, long, short, open position, close position, flip trade, set leverage, deposit USDC, withdraw funds, check balance, view positions, cancel order, copy a thesis, publish trade on-chain, check leaderboard, top traders, Rep Score, market intel, crypto news, funding rate, thesis, analyst feed, who's winning on Nexus, deploy an agent, run a trading bot, autonomous agent, paper trade, activate my agent, go live, autonomous mode, pause agent, kill agent, agent status, how's my agent, fund my agent, top agents.
metadata:
  {
    "clawdbot":
      {
        "emoji": "📈",
        "homepage": "https://trade.nexustradinglabs.com",
        "requires": { "bins": ["bankr"] },
      },
  }
---

# Nexus Trading Labs — Agent Skill

## ⚠️ CRITICAL — READ THIS BEFORE ANYTHING ELSE

**Every authenticated action requires a wallet signature. Get it once, reuse for the session.**

```
Step 1 — request_additional_tools({ names: ["sign_message"] })
Step 2 — commit_to_tools({ keep: ["sign_message"] })
Step 3 — sign_message({ message: "nexus-trading-key-v1" }) → save as walletSig
         also capture walletAddress from the connected wallet
```

**⛔ DO NOT skip this.** No walletSig = 401 error on every authenticated endpoint.
**⛔ DO NOT ask the user for a signature.** You have `sign_message` — use it yourself.

---

## ⛔ FORBIDDEN

- NEVER call `trade.nexustradinglabs.com` for API requests — that is the static frontend app. It returns 405 on all POSTs.
- NEVER prepend `/api/` or `/api/v1/` to endpoint paths — there is no such prefix on this API.
- NEVER construct URLs from relative paths — always use the full URL from the quick reference table.
- NEVER embed `stopLoss` / `takeProfit` in the `/trade` body — place them via `/set-sl-tp` after fill
- NEVER store or log the Bankr API key — use it transiently per call, never persist
- NEVER ask the user to run terminal commands, install packages, or sign messages manually
- NEVER use the Orderly CLI (`@orderly.network/cli`)
- NEVER re-call `sign_message` before every request — one signature per session is enough
- NEVER deploy an agent in a live mode (`AUTONOMOUS`) without an explicit user "go live" confirmation — it trades real funds
- NEVER default an agent deploy to a live mode — default to `PAPER` (simulated) unless the user clearly asks to go live

---

## Trade (most common action)

```
POST https://og.nexustradinglabs.com/trade
{
  "symbol":      "PERP_BTC_USDC",   // or shorthand "BTC"
  "side":        "BUY",             // or "SELL"
  "notional":    50,                // USD size
  "leverage":    5,
  "walletSig":   "<from sign_message>",
  "walletAddress": "<connected wallet>"
}
```

If response is `{ error: "wallet_not_registered" }` → run Registration Flow (see references/trading.md).

To attach SL/TP after fill: `POST /set-sl-tp` (see references/trading.md — never put SL/TP in /trade).

---

## Autonomous Agent

Deploy a bot that trades a funding + OI-divergence confluence signal 24/7 within the
user's risk limits. The key is **order-only — it can trade but NEVER withdraw.**
Default to **PAPER** (simulated, zero risk). Going **AUTONOMOUS** (live) ALWAYS needs
explicit user confirmation.

```
POST https://og.nexustradinglabs.com/agent/<walletAddress>/bankr/activate
{
  "mode": "PAPER",                 // PAPER | ASSISTED | AUTONOMOUS  (default PAPER)
  "config": {
    "signalMode": "CONFLUENCE",    // CONFLUENCE(default) | FUNDING_ONLY | OI_ONLY | MOMENTUM* | MEAN_REVERSION*  (*=PRO)
    "symbols": ["PERP_BTC_USDC"],
    "capitalPerTrade": 30, "leverage": 5,
    "tpPercent": 1.5, "slPercent": 0.75, "maxHoldHours": 4,
    "maxTradesPerDay": 10, "maxDailyLossUsdc": 5,
    "fundingThreshold": 0.01,      // % — signal sensitivity
    "oiChangeThreshold": 0,        // % min OI move to count
    "priceChangeThreshold": 0.5    // % move for MOMENTUM / MEAN_REVERSION
  },
  "walletSig": "<required for ASSISTED/AUTONOMOUS>",
  "confirm": "GO LIVE"             // REQUIRED only when mode is AUTONOMOUS
}
```

- **PAPER** needs no walletSig (simulated). **ASSISTED / AUTONOMOUS** derive the
  order-only key from `walletSig` — pass the session signature.
- **Strategy:** the user picks `signalMode`. `MOMENTUM` / `MEAN_REVERSION` require
  **Nexus PRO** — if the user isn't PRO, say so and default to `CONFLUENCE`. The free
  strategies are `CONFLUENCE`, `FUNDING_ONLY`, `OI_ONLY`. All thresholds are user-tunable.
- AUTONOMOUS without `confirm:"GO LIVE"` → `409 confirm_required`. Confirm with the
  user FIRST, then resend with `confirm:"GO LIVE"`.
- Change mode later: `POST /agent/<wallet>/bankr/mode { "mode", "walletSig", "confirm"? }`
- Pause new entries: mode → `ASSISTED` (still manages an open position). Back to sim: mode → `PAPER`.
- Status: `GET /agent/<wallet>` (public read). Stop: `DELETE /agent/<wallet>` (⚠️ leaves an open position
  unmanaged — offer KILL instead if a position is open). Kill (close + stop): `POST /agent/<wallet>/kill`.
- **⚠️ AUTH — every agent MUTATION requires `walletSig`** (`sign_message('nexus-trading-key-v1')`): activate
  (ALL modes, incl. PAPER), mode change, config update, deactivate, and kill. These are account-control
  actions — the server ecrecovers the sig and rejects (`401 walletSig_required`) unless it resolves to the
  agent's own wallet. Pass `walletSig` in the JSON body (NEVER a query string). Only `GET /agent/<wallet>` is
  public. Reuse the session signature you already hold — no need to re-sign per call.
- **Capital guardrail:** keep `capitalPerTrade` ≤ ~60% of free collateral, or live entries
  margin-reject (Orderly -1101). Read balance first and suggest a safe size.
- Always tell the user: the agent's key is **order-only — it cannot withdraw funds.**

See references/agent.md for the full intent map, status formatting, and safety rules.

---

## Quick Reference

⚠️ **ALWAYS use the full URL: `https://og.nexustradinglabs.com`**

| Action | Full URL | Auth |
|---|---|---|
| Place trade | `POST https://og.nexustradinglabs.com/trade` | walletSig |
| Close position | `POST https://og.nexustradinglabs.com/close-position` | walletSig |
| Attach SL/TP | `POST https://og.nexustradinglabs.com/set-sl-tp` | walletSig |
| Cancel order | `POST https://og.nexustradinglabs.com/cancel` | walletSig |
| Order status | `POST https://og.nexustradinglabs.com/order-status` | walletSig |
| Order history | `POST https://og.nexustradinglabs.com/order-history` | walletSig |
| Positions | `POST https://og.nexustradinglabs.com/positions` | walletSig |
| Balance | `POST https://og.nexustradinglabs.com/balance` | walletSig |
| Set leverage | `POST https://og.nexustradinglabs.com/set-leverage` | walletSig |
| Deposit USDC | `POST https://og.nexustradinglabs.com/proxy/bankr-deposit` | Bankr API key |
| Withdraw USDC | `POST https://og.nexustradinglabs.com/proxy/bankr-withdraw` | Bankr API key + walletSig |
| Settle PnL | `POST https://og.nexustradinglabs.com/settle-pnl` | walletSig |
| Register wallet | `POST https://og.nexustradinglabs.com/proxy/bankr-register` | Bankr API key |
| Publish thesis on-chain | `POST https://og.nexustradinglabs.com/proxy/thesis-register` | Bankr API key |
| **Deploy / arm agent** | `POST https://og.nexustradinglabs.com/agent/:wallet/bankr/activate` | walletSig (all modes) |
| **Change agent mode** | `POST https://og.nexustradinglabs.com/agent/:wallet/bankr/mode` | walletSig |
| **Update agent config** | `PUT https://og.nexustradinglabs.com/agent/:wallet/config` | walletSig |
| **Agent status** | `GET https://og.nexustradinglabs.com/agent/:wallet` | public read |
| **Deactivate agent** | `DELETE https://og.nexustradinglabs.com/agent/:wallet` | walletSig (in body) |
| **Kill agent (close + stop)** | `POST https://og.nexustradinglabs.com/agent/:wallet/kill` | walletSig (in body) |
| **Top agents** | `GET https://og.nexustradinglabs.com/agents/leaderboard` | public |
| **Agent ledger (proof)** | `GET https://og.nexustradinglabs.com/agents/ledger` | public |
| Mark price | `GET https://og.nexustradinglabs.com/mark-price?symbol=BTC` | public |
| Funding rate | `GET https://og.nexustradinglabs.com/funding-rate?symbol=BTC` | public |
| 24h stats | `GET https://og.nexustradinglabs.com/24h-stats?symbol=BTC` | public |
| Public feed | `GET https://og.nexustradinglabs.com/feed` | public |
| Trader lab | `GET https://og.nexustradinglabs.com/lab/:wallet` | public read |
| Trader profile | `GET https://og.nexustradinglabs.com/profile/:wallet` | public read |
| Leaderboard | derive from `GET https://og.nexustradinglabs.com/feed` + `getTraderStats()` | public |
| Market intel | `GET https://api-evm.orderly.org/v1/public/futures` | public |
| Crypto news | rss2json proxy (see references/news.md) | public |

---

## Load References As Needed

- **references/trading.md** — full trade flow, registration, SL/TP, close, cancel, order-status, order-history, positions, leverage
- **references/deposit-withdraw.md** — deposit USDC, withdraw, settle PnL, balance
- **references/agent.md** — deploy/arm/fund/kill the autonomous agent, mode flips (PAPER/ASSISTED/AUTONOMOUS), status formatting, safety gates
- **references/feed-leaderboard.md** — public feed, thesis copy flow, on-chain registry, Rep Score, leaderboard build, notifications, comments
- **references/market-data.md** — mark price, funding rate, 24h stats, error codes, retry logic, rate limits, testnet
- **references/intel.md** — market intelligence: pull live OI, funding rates, regime signals from Orderly public API
- **references/news.md** — pull latest crypto/macro news via RSS feeds before framing a trade or answering market questions
