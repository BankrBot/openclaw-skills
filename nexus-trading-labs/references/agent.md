# Bankr Skill — Agent Module (drop-in)

> Add this to the Nexus Bankr skill. It lets a user deploy, fund, control, and kill
> a non-custodial autonomous trading agent by chat. LIVE on `https://og.nexustradinglabs.com`.
> All endpoints shipped + smoke-tested (2026-06-02). Companion to `bankr-agent-spec.md`.

## What it is (tell the user)
"Nexus can run an autonomous trading bot on your account. It hunts funding-rate +
open-interest edges 24/7 inside hard limits you set. It uses an **order-only key —
it can trade but never withdraw your funds.** Starts in risk-free PAPER mode; you
flip it live when you trust it."

## Auth model
- **Every mutation requires `walletSig`** from `sign_message('nexus-trading-key-v1')` — including PAPER.
  Agent control (activate, mode, config, deactivate, kill) changes account state, so the server ecrecovers
  the signature and requires it to resolve to the agent's own wallet; otherwise `401 walletSig_required`.
  Pass it in the JSON body, never a query string. Only `GET /agent/{addr}` is public (read-only).
- **ASSISTED / AUTONOMOUS** (live) use that same `walletSig` to ALSO derive the order-only key. The wallet
  must already be registered (`/proxy/bankr-register`); if not, register first then retry.
- **AUTONOMOUS** also needs `confirm: "GO LIVE"` — ALWAYS get an explicit yes from the user before sending it.
- The signature is deterministic; reuse the session sig you already hold rather than re-prompting per call.

## Config — the full control surface (all of this is user-set)

Pass any of these in the `config` object on `activate`; omitted fields use the
default. Everything is tunable later via the same call or `/bankr/mode`.

**Strategy — `signalMode`** (how funding + OI combine):
| Mode | Behavior | Tier |
|---|---|---|
| `CONFLUENCE` *(default)* | funding extreme **AND** OI-divergence must agree — strictest, best trades | free |
| `FUNDING_ONLY` | fade funding extremes only | free |
| `OI_ONLY` | OI-divergence only | free |
| `MOMENTUM` | trade **with** a price move > threshold (trend-follow) | **PRO** |
| `MEAN_REVERSION` | **fade** a price move > threshold (buy dip / sell rip) | **PRO** |

> `MOMENTUM` / `MEAN_REVERSION` require **Nexus PRO**. If the user isn't PRO, tell
> them those are PRO strategies and default to `CONFLUENCE`. Don't push a PRO mode
> as if it's free.

**Signal sensitivity:** `fundingThreshold` (%, default 0.01), `oiChangeThreshold`
(% min OI move to count, default 0), `priceChangeThreshold` (% move for
MOMENTUM/MEAN_REVERSION, default 0.5).

**Market regime filter — `respectRegime`** (boolean, default `false`, opt-in): when
`true`, the agent skips NEW entries that fight a strong market tape — it won't go
**LONG in a broad RISK-OFF** regime or **SHORT in a broad RISK-ON** regime. It never
flips direction or touches an open position; it only suppresses a fresh entry. Good
for users who don't want to fade a strong trend. Set via config, e.g.
`{respectRegime:true}`. Suggest testing in PAPER first.
> Example: "only trade with the market, skip counter-trend entries" → `{respectRegime:true}`.

**Risk & execution:** `symbols` (watchlist, e.g. `["PERP_BTC_USDC","PERP_ETH_USDC"]`),
`leverage`, `capitalPerTrade` (margin per trade), `tpPercent`, `slPercent`,
`maxHoldHours`, `maxTradesPerDay`, `maxDailyLossUsdc`.

**Example prompts → config:**
- "run my agent in mean-reversion mode on ETH, $40/trade at 3x" →
  `{signalMode:"MEAN_REVERSION", symbols:["PERP_ETH_USDC"], capitalPerTrade:40, leverage:3}` *(PRO)*
- "deploy paper, confluence, BTC + SOL, tighter funding threshold 0.02%" →
  `{signalMode:"CONFLUENCE", symbols:["PERP_BTC_USDC","PERP_SOL_USDC"], fundingThreshold:0.02}`
- "make it funding-only and cap me at 5 trades a day" →
  `{signalMode:"FUNDING_ONLY", maxTradesPerDay:5}`
- "switch my agent to momentum" → PRO check first, else CONFLUENCE.
- "only trade with the regime" → `{respectRegime:true}`.

## Strategy presets (one-line deploys)

Curated configs the user can name directly. Apply the preset's `config` on
`activate`/`mode`, keeping the user's chosen mode (default PAPER — presets do NOT set
mode). PRO presets need Nexus PRO (PRO-check first; else suggest a free preset).
Scale `capitalPerTrade` down if free collateral is low (capital guardrail below).

| Preset | `config` | Tier |
|---|---|---|
| **Funding Harvester** *(conservative)* | `{signalMode:"CONFLUENCE", symbols:["PERP_BTC_USDC"], leverage:3, capitalPerTrade:30, tpPercent:1.2, slPercent:0.6, maxHoldHours:6, maxTradesPerDay:6, maxDailyLossUsdc:10, fundingThreshold:0.015}` | free |
| **Blue-Chip Confluence** *(balanced)* | `{signalMode:"CONFLUENCE", symbols:["PERP_BTC_USDC","PERP_ETH_USDC"], leverage:5, capitalPerTrade:40, tpPercent:1.5, slPercent:0.75, maxHoldHours:4, maxTradesPerDay:8, maxDailyLossUsdc:12}` | free |
| **OI Divergence Hunter** *(balanced)* | `{signalMode:"OI_ONLY", symbols:["PERP_BTC_USDC","PERP_ETH_USDC"], leverage:5, capitalPerTrade:40, tpPercent:1.5, slPercent:0.8, maxHoldHours:4, maxTradesPerDay:8, maxDailyLossUsdc:12, oiChangeThreshold:0.5}` | free |
| **Funding Scalper** *(aggressive)* | `{signalMode:"FUNDING_ONLY", symbols:["PERP_BTC_USDC","PERP_ETH_USDC","PERP_SOL_USDC"], leverage:8, capitalPerTrade:30, tpPercent:0.8, slPercent:0.5, maxHoldHours:2, maxTradesPerDay:14, maxDailyLossUsdc:12, fundingThreshold:0.008}` | free |
| **Momentum Rider** *(PRO · trend)* | `{signalMode:"MOMENTUM", symbols:["PERP_BTC_USDC","PERP_ETH_USDC","PERP_SOL_USDC"], leverage:8, capitalPerTrade:40, tpPercent:2, slPercent:1, maxHoldHours:4, maxTradesPerDay:10, maxDailyLossUsdc:15, priceChangeThreshold:0.6}` | **PRO** |
| **Mean Reversion Fade** *(PRO · fade)* | `{signalMode:"MEAN_REVERSION", symbols:["PERP_BTC_USDC","PERP_ETH_USDC"], leverage:6, capitalPerTrade:30, tpPercent:1.5, slPercent:1, maxHoldHours:3, maxTradesPerDay:10, maxDailyLossUsdc:12, priceChangeThreshold:0.7}` | **PRO** |

> "deploy the Funding Scalper preset in paper" → `activate {mode:"PAPER", config:{…Funding Scalper…}}`.
> "load Mean Reversion Fade and go live" → PRO-check → confirm GO LIVE → `mode {mode:"AUTONOMOUS", confirm:"GO LIVE", walletSig, …}` after applying the preset config. Combine a preset with `respectRegime:true` for a trend-aware version.

## Intents → calls

**⚠️ AUTH: every agent MUTATION below requires `walletSig` = `sign_message('nexus-trading-key-v1')` in the
JSON body** — including PAPER activate/mode and config changes. The server ecrecovers it and rejects
(`401 walletSig_required`) unless it resolves to the agent's own wallet. NEVER pass it in a query string. Only
`GET /agent/{addr}` is public. Reuse the session signature you already hold.

| User says | Call |
|---|---|
| "Deploy my agent (paper) on BTC, $30/trade 5x" | `POST /agent/{addr}/bankr/activate` `{mode:"PAPER", config:{symbols:["PERP_BTC_USDC"],capitalPerTrade:30,leverage:5}, walletSig}` |
| "Arm it in assisted mode" | `POST /agent/{addr}/bankr/activate` `{mode:"ASSISTED", walletSig}` |
| "Make it live / go autonomous" | confirm first → `POST /agent/{addr}/bankr/mode` `{mode:"AUTONOMOUS", confirm:"GO LIVE", walletSig}` |
| "Pause my agent" | `POST /agent/{addr}/bankr/mode` `{mode:"ASSISTED", walletSig}` |
| "Set it back to paper" | `POST /agent/{addr}/bankr/mode` `{mode:"PAPER", walletSig}` |
| "Change to $20/trade at 3x" | `POST /agent/{addr}/bankr/activate` `{mode:<current>, config:{capitalPerTrade:20,leverage:3}, walletSig}` |
| "Deploy the Blue-Chip Confluence preset (paper)" | `POST /agent/{addr}/bankr/activate` `{mode:"PAPER", config:{…preset…}, walletSig}` (see Strategy presets) |
| "Turn on the market regime filter" | `POST /agent/{addr}/bankr/activate` `{mode:<current>, config:{respectRegime:true}, walletSig}` |
| "How's my agent?" | `GET /agent/{addr}` → format `state` (public read, no sig) |
| "Fund my agent $50" | `POST /deposit/prepare` `{wallet, amount:50, accountId}` → sign+submit, then suggest capital (below) |
| "Stop my agent" | `DELETE /agent/{addr}` `{walletSig}` (⚠️ warn: leaves an open position unmanaged — offer KILL) |
| "Kill it / close everything" | `POST /agent/{addr}/kill` `{walletSig}` |
| "Top Nexus agents" | `GET /agents/leaderboard` |
| "Is the record real?" | `GET /agents/ledger` (SHA-256 root + on-chain anchor) |

## Capital guardrail (avoid Orderly −1101 "margin insufficient")
`capitalPerTrade` is the margin per trade. Keep a buffer below free collateral:
```
suggestedCapital = floor(freeCollateral * 0.6)
```
Read balance via `POST /balance` `{walletAddress, walletSig}` (never put the signature in a query string — it's
a replayable credential that can leak into logs/proxies). Never set `capitalPerTrade` above
~60% of free collateral, or live entries will margin-reject. State it:
"With $52 free, I'd run ~$30/trade so margin keeps a buffer."

## Status formatter (from `GET /agent/{addr}` → `state`)
```
🟢 {mode} · {active ? "ON" : "OFF"}
{current_position ? "in {dir} {symbol} @ {entry}, {pnl_percent}%" : "flat — waiting on a confluence signal"}
{trades_today}/{maxTradesPerDay} trades today · daily P&L {daily_pnl}
```

## Response copy
- **Activated (paper):** "✅ Agent deployed in PAPER on {symbols} — ${cap}/trade, {lev}x,
  TP +{tp}% / SL −{sl}%. Simulated, zero risk. Say 'go live' when you're convinced."
- **Before live:** "⚠️ This trades real funds within your limits. The key is order-only —
  it can never withdraw. Reply GO LIVE to confirm." → then send `confirm:"GO LIVE"`.
- **Killed:** "🛑 Agent killed — position closed, key removed, deactivated. Re-deploy anytime."

## Safety rules (non-negotiable)
1. Never send `mode:"AUTONOMOUS"` without an explicit user "go live".
2. Default every deploy to PAPER unless the user clearly asks for live.
3. KILL always works and needs no confirmation — it's the safety verb.
4. If `DELETE` (stop) is requested while a position is open, warn it leaves the
   position unmanaged and offer KILL instead.
5. Always remind: the agent's key is **order-only — it cannot withdraw funds.**
