---
name: pulsenetwork-crypto
description: "Crypto intelligence and pre-trade safety for agents, paid per call in USDC on Base via x402 — no API keys, no signup. Scan any token before you swap or snipe (Solana memecoins by mint, EVM tokens by contract on Base/Ethereum/BSC/Arbitrum/Polygon/Optimism/Avalanche) for one deterministic CLEAR/CAUTION/AVOID honeypot & rug verdict (~$0.015). Plus live DeFi yield/APY (DeFiLlama), crypto security & wallet-risk, drainer/phishing threat intel, crypto tax by country, cross-market arbitrage (DEX/CEX spreads, perp funding, ETF/NAV, sports surebets), RWA/tokenization & onchain-regulation reads, and vetted signal/copy-trading/EA provider discovery. Call any endpoint with `bankr x402 call <url>`; inspect with `bankr x402 schema <url>`."
license: MIT
compatibility: Requires network access and an x402 wallet funded with USDC on Base. Works with the Bankr CLI (`bankr x402 call`) or any x402 client (`@x402/fetch`). No API key or account. Two flagship token-safety scanners are hosted natively on Bankr x402 Cloud; the wider crypto catalog runs on Vercel and advertises the same Base-USDC x402 scheme.
metadata:
  author: PulseNetwork
  version: "1.0"
  homepage: "https://mcp-pulsenetwork.vercel.app"
---

# PulseNetwork Crypto — pre-trade safety & paid crypto intelligence for agents

Four x402-native crypto verticals — **onchainpulse, cryptopulse, arbipulse, alphapulse** — plus two Bankr-hosted flagship token scanners. Your agent pays per call in USDC on Base straight from its own wallet: no API keys, no accounts, no subscription. Every call returns structured JSON grounded in real sources (RugCheck, GoPlus, DexScreener, DeFiLlama, Hyperliquid, Deribit, CoinGecko).

**The wedge for a trading agent: never buy a token you haven't scanned.** The flagship scanners turn a contract or mint address into a deterministic `CLEAR` / `CAUTION` / `AVOID` verdict in one paid call (~$0.015), so your agent can gate every buy on a fresh honeypot/rug check for a fraction of a cent.

## When to use this skill

- **Before any token buy, swap, or snipe** — scan the token first: honeypot simulation, buy/sell tax, mint/freeze/blacklist authority, upgradeable-proxy/pausable, LP lock/burn, holder & dev concentration. *This is the primary use.*
- **DeFi yield** — live TVL/APY by chain and risk band, and a personalized capital-allocation strategy.
- **Crypto security & threats** — custody/wallet-risk framework, active drainer/phishing/sim-swap/rug-pull threat intel.
- **Crypto ops by country** — crypto tax rules, exchange choice, first-time onboarding, spending, crypto-friendly banking, merchant acceptance.
- **Arbitrage** — DEX/CEX price spreads, perp funding-rate carry, ETF/NAV premium-discount, sports surebets, commodity regional gaps, stat-arb pairs.
- **Onchain finance & RWA** — legislation/regulation decoding, RWA tokenization market data, tokenized T-bill/stablecoin yields, compliance frameworks (US, MiCA, GENIUS Act).
- **Alpha discovery** — vet and compare signal providers, copy-trading leaders, MT4/MT5 expert advisors (EAs), managed accounts, and DeFi vaults.

## Recommended agent workflow (pre-trade guardrail)

When the user asks to **buy, swap into, or snipe a token** you don't already trust, scan it *before* building the trade:

1. Extract the token's mint (Solana) or contract + chain (EVM) from the request.
2. Call the matching scanner (`memecoin` or `evmtoken`, ~$0.015) and read `verdict` + `red_flags`.
3. Gate the trade:
   - `CLEAR` → proceed with the swap.
   - `CAUTION` → surface the specific `red_flags` and ask the user to confirm.
   - `AVOID` → do **not** auto-execute; report why (honeypot / mint authority / unlocked LP / tax) and let the user override explicitly.

This turns a one-cent call into a rug/honeypot firewall in front of every buy. The scan is advisory — always let the user make the final call — but never route funds into an `AVOID` token silently.

## How to call

Every endpoint is a standard x402 GET. With the Bankr CLI, pay and call in one line from your wallet:

```bash
# Scan a Solana memecoin before buying (BONK shown)
bankr x402 call "https://x402.bankr.bot/0x7132eb021647675076fdf37f333d8a015770f095/memecoin?mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"

# Scan an EVM token before buying (contract + chain)
bankr x402 call "https://x402.bankr.bot/0x7132eb021647675076fdf37f333d8a015770f095/evmtoken?address=0x532f27101965dd16442E59d40670FaF5eBB142E4&chain=base"

# Live DeFi yield on Base, conservative risk band
bankr x402 call "https://cryptopulse-xi-five.vercel.app/api/yield?chain=base&risk=conservative"

# Inspect any endpoint's schema first
bankr x402 schema "https://cryptopulse-xi-five.vercel.app/api/yield"
```

Both scanners return e.g. `{ "verdict": "CLEAR"|"CAUTION"|"AVOID", "risk_score": 0-100, "one_liner": "...", "red_flags": [...], "green_flags": [...] }`. Gate the trade on `verdict === "CLEAR"` (or your own tolerance on `risk_score`).

Any x402 client works too — e.g. `wrapFetchWithPayment` from `@x402/fetch` with a viem account registered on `eip155:8453`.

## Flagship endpoints (hosted on Bankr x402 Cloud)

Native Bankr rail, Base USDC — `bankr x402 call` just works:

| Capability | URL | Price | Key params |
|---|---|---|---|
| Solana memecoin safety scan | `x402.bankr.bot/0x7132eb021647675076fdf37f333d8a015770f095/memecoin` | $0.015 | `mint` (SPL base58, required) |
| EVM token safety scan | `x402.bankr.bot/0x7132eb021647675076fdf37f333d8a015770f095/evmtoken` | $0.015 | `address` (0x…, required), `chain` (base default; ethereum/bsc/polygon/arbitrum/optimism/avalanche) |

Both are also mirrored on Vercel (`onchainpulse-nine.vercel.app/api/memecoin` and `/api/evmtoken`) on the same x402 scheme.

## Menu — top endpoints across the crypto cluster

All $0.10 unless noted. Base URLs: onchainpulse `onchainpulse-nine.vercel.app`, cryptopulse `cryptopulse-xi-five.vercel.app`, arbipulse `arbipulse.vercel.app`, alphapulse `alphapulse-omega.vercel.app`.

| Capability | URL | Price | Key params |
|---|---|---|---|
| Solana memecoin honeypot/rug scan | `x402.bankr.bot/0x7132…/memecoin` | $0.015 | `mint` (req) |
| EVM token honeypot/rug scan | `x402.bankr.bot/0x7132…/evmtoken` | $0.015 | `address` (req), `chain` |
| Live DeFi yield / APY | `cryptopulse-xi-five.vercel.app/api/yield` | $0.10 | `chain`, `risk` |
| Personalized DeFi strategy | `cryptopulse-xi-five.vercel.app/api/strategy` | $0.10 | `capital`, `risk`, `chain`, `goal` |
| Crypto security / custody framework | `cryptopulse-xi-five.vercel.app/api/security` | $0.10 | `value_tier`, `setup` |
| Active threat intel (drainers/phishing) | `cryptopulse-xi-five.vercel.app/api/threats` | $0.10 | `category` |
| Crypto tax by country | `cryptopulse-xi-five.vercel.app/api/tax` | $0.10 | `country`, `activities`, `tax_year` |
| Unified arbitrage scanner | `arbipulse.vercel.app/api/scanner` | $0.10 | `category`, `min_profit_usd`, `chain` |
| Perp funding-rate carry | `arbipulse.vercel.app/api/perps` | $0.10 | `asset`, `min_apy` |
| DEX price arbitrage | `arbipulse.vercel.app/api/dex` | $0.10 | `token`, `amount_usd`, `chains` |
| Sports surebet scanner | `arbipulse.vercel.app/api/sports` | $0.10 | `sport`, `region`, `min_profit_pct` |
| RWA / tokenization market intel | `onchainpulse-nine.vercel.app/api/rwa` | $0.10 | `action`, `asset_class` |
| Onchain legislation decoder | `onchainpulse-nine.vercel.app/api/legislation` | $0.10 | `q`, `jurisdiction` |
| Vet a signal/copy/EA provider | `alphapulse-omega.vercel.app/api/alpha/vet` | $0.10 | `provider` (req), `platform` |
| Discover copy-trading leaders | `alphapulse-omega.vercel.app/api/alpha/copy` | $0.10 | `instrument`, `max_drawdown` |

## Full catalog (43 endpoints)

Every endpoint — path, price, optimized description, category, trigger phrases, required params — is split by vertical:

- **onchainpulse** (onchain finance, RWA, tokenization, regulation) → [`references/onchainpulse.md`](references/onchainpulse.md)
- **cryptopulse** (DeFi yield, security, threats, tax, onboarding) → [`references/cryptopulse.md`](references/cryptopulse.md)
- **arbipulse** (cross-market arbitrage & execution) → [`references/arbipulse.md`](references/arbipulse.md)
- **alphapulse** (signal/copy/EA/managed provider discovery & vetting) → [`references/alphapulse.md`](references/alphapulse.md)

The live hub at **https://mcp-pulsenetwork.vercel.app** and each vertical's `/openapi.json` + `/.well-known/agent.json` are the always-current source of paths, params, and prices.

## Pricing

Per call, in USDC on Base, paid from your wallet: token-safety scanners **$0.015**; all other crypto intelligence **$0.10**. No subscription, no minimums — pay only for what you call.
