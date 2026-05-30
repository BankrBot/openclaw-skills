---
name: nexus
description: Non-custodial perpetual DEX on Arbitrum. Use when user says buy, sell, trade, long, short, open position, close position, flip trade, set leverage, deposit USDC, withdraw funds, check balance, view positions, cancel order, copy a thesis, publish trade on-chain, check leaderboard, top traders, Rep Score, market intel, crypto news, funding rate, thesis, analyst feed, who's winning on Nexus.
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
- **references/feed-leaderboard.md** — public feed, thesis copy flow, on-chain registry, Rep Score, leaderboard build, notifications, comments
- **references/market-data.md** — mark price, funding rate, 24h stats, error codes, retry logic, rate limits, testnet
- **references/intel.md** — market intelligence: pull live OI, funding rates, regime signals from Orderly public API
- **references/news.md** — pull latest crypto/macro news via RSS feeds before framing a trade or answering market questions
