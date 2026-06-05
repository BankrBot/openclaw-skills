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
- **PAPER** activation needs nothing but the wallet address — it's simulated, no key.
- **ASSISTED / AUTONOMOUS** (live) need `walletSig` from
  `sign_message('nexus-trading-key-v1')` (the existing skill step) — that signature
  IS the auth and derives the order-only key. The wallet must already be registered
  (`/proxy/bankr-register`); if not, register first then retry.
- **AUTONOMOUS** also needs `confirm: "GO LIVE"` — ALWAYS get an explicit yes from
  the user before sending it.

## Intents → calls

| User says | Call |
|---|---|
| "Deploy my agent (paper) on BTC, $30/trade 5x" | `POST /agent/{addr}/bankr/activate` `{mode:"PAPER", config:{symbols:["PERP_BTC_USDC"],capitalPerTrade:30,leverage:5}}` |
| "Arm it in assisted mode" | `POST /agent/{addr}/bankr/activate` `{mode:"ASSISTED", walletSig}` |
| "Make it live / go autonomous" | confirm first → `POST /agent/{addr}/bankr/mode` `{mode:"AUTONOMOUS", confirm:"GO LIVE", walletSig}` |
| "Pause my agent" | `POST /agent/{addr}/bankr/mode` `{mode:"ASSISTED"}` |
| "Set it back to paper" | `POST /agent/{addr}/bankr/mode` `{mode:"PAPER"}` |
| "Change to $20/trade at 3x" | `POST /agent/{addr}/bankr/activate` `{mode:<current>, config:{capitalPerTrade:20,leverage:3}, walletSig?}` |
| "How's my agent?" | `GET /agent/{addr}` → format `state` |
| "Fund my agent $50" | `POST /deposit/prepare` `{wallet, amount:50, accountId}` → sign+submit, then suggest capital (below) |
| "Stop my agent" | `DELETE /agent/{addr}` (⚠️ warn: leaves an open position unmanaged — offer KILL) |
| "Kill it / close everything" | `POST /agent/{addr}/kill` |
| "Top Nexus agents" | `GET /agents/leaderboard` |
| "Is the record real?" | `GET /agents/ledger` (SHA-256 root + on-chain anchor) |

## Capital guardrail (avoid Orderly −1101 "margin insufficient")
`capitalPerTrade` is the margin per trade. Keep a buffer below free collateral:
```
suggestedCapital = floor(freeCollateral * 0.6)
```
Read balance via `GET /balance?wallet=&sig=`. Never set `capitalPerTrade` above
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
