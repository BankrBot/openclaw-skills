---
name: stockwaves-api
description: Pay-per-call China & global market data, quant signals, and a tokenized-stock pre-trade safety gate over x402. Use when an agent needs Chinese-market intelligence (Weibo/Baidu/Douyin pulse, structured CN news/events, sector momentum), cross-asset quant signals (A-share/HK/US equities, crypto, macro), or a pre-buy safety check on an on-chain tokenized US stock (real token vs copycat, depeg, liquidity, market-hours).
---

# StockWaves API Skill

Use this skill when an agent needs market data Western APIs can't reach (real-time Chinese internet pulse + structured CN market intelligence), quant trading signals across China/HK/US equities, crypto and cross-asset macro, OR a pre-trade safety verdict on a tokenized US stock before buying it on-chain.

Every endpoint is **x402 pay-per-call** — no signup, no API key. The skill's job is to execute the x402 flow correctly and pick the right endpoint.

## Base URL

- `STOCKWAVES_BASE_URL`: `https://stockwaves.net`
- Single origin for runtime requests AND discovery docs (`/.well-known/x402`, `/openapi.json`, `/llms.txt`).

## Access Model

- **x402 only** — there is no API-key path. Unpaid requests return HTTP `402`.
- The 402 challenge offers **two rails — Base (`eip155:8453`) and Solana (`solana:…`)**. Pay on either; asset is USDC; scheme is standard x402 `exact` (EIP-3009 on Base / signed tx on Solana), settled via the Coinbase/CDP facilitator.
- Prefer **Bankr wallet signing** (`/agent/sign`) when available — set a Bankr API key via `X-API-Key` with Agent API access + signing permissions (not read-only).
- Otherwise use any vanilla x402 client (SIWE/SIWX) with a USDC-funded wallet.

## x402 API Call Checklist

1. Send the request to the StockWaves endpoint without payment headers.
2. If the response is `402`, parse the base64 `PAYMENT-REQUIRED` header (it carries scheme, both networks, USDC asset, amount, payTo).
3. Sign the payment and retry with the `PAYMENT-SIGNATURE` header.
4. On success, read the data and the `PAYMENT-RESPONSE` settle receipt.
5. Apply retry/backoff for `402` re-challenges and transient `5xx`; a `4xx` from the handler means you were NOT charged (settlement only occurs on status < 400).

## Required Preflight (Deterministic)

Before the first call in a session, fetch the discovery docs (all free, no payment):

- `GET /.well-known/x402` — the list of paid resources.
- `GET /openapi.json` — canonical route + query-param metadata (treat as authoritative for invocation).
- `GET /llms.txt` — human/agent-readable catalog with prices and how-to-pay.
- Treat the runtime `402` challenge as authoritative for price/network/payTo.

## Core Endpoints (price = USDC per call)

China-market intelligence (data Western agents can't reach):
- `GET /api/cn/trending` — $0.03 — live Weibo + Baidu + Douyin hot-search, structured (per-platform rank, heat, category). Query: `?platform=all|weibo|baidu|douyin&limit=1-50&category=`
- `GET /api/cn/news` — $0.04 — structured CN market news & risk feed: per-event-type sentiment, mention counts, ticker mapping, risk keywords + severity (English labels; derived structure, no article text). Query: `?limit=1-50&ticker=`
- `GET /api/cn/themes` — $0.06 — China industrial-theme momentum (AI compute / semis / robotics / defense / new energy): per-theme rotation-strength + per-board rank/trend/lifecycle.
- `GET /api/cn/brief` — $0.08 — ONE-call synthesized China daily brief: social pulse + market events + risk alerts + hot themes + top sector rotation. Query: `?top=5`

Quant signals (A-share / HK / US equities, crypto, macro):
- `GET /api/recommend` — $0.50 — Top-N stock picks (4-factor resonance) with take-profit / stop-loss. Query: `?market=A|US&limit=1-100`
- `GET /api/dealer` — $0.08 — dealer (smart-money) 6-signal scan across A-shares. Query: `?top_n=1-1000&limit=1-500`
- `GET /api/rotation` — $0.05 — sector rotation forecast (strength + momentum + catalyst). Query: `?limit=1-100`
- `GET /api/anomalies/insight` — $0.05 — blind-spot / anomaly insight: setups the system keeps missing. Query: `?days=1-90`
- `GET /api/btc/signal` — $0.03 — real-time BTC/USDT directional signal (RL model): position lean [-1,1], direction, conviction, risk flags.
- `GET /api/macro/allocation` — $0.10 — cross-asset ETF tactical allocation (QQQ/IWM/SPY/TLT/DBC/GLD): per-ETF signal, position, confidence, regime.
- `GET /api/crypto/microstructure` — $0.01 — live crypto perp microstructure (Binance public): funding, premium/basis, OI (+USD), taker buy/sell ratio, 24h realized vol. Query: `?symbol=BTCUSDT`

Compute (bring your own signals):
- `POST /api/portfolio/optimize` — $0.05 — stateless portfolio optimizer. POST `{assets:[{symbol,target,confidence?,vol?,regime?}], config?}` → risk-constrained weights (inverse-vol, conviction scaling, correlation penalty, gross/net + per-symbol caps, regime haircut).

Tokenized US stocks — pre-trade safety gate (any issuer, multi-chain):
- `GET /api/xstock/health` — $0.03 — before an agent BUYS an on-chain US stock, check it's the REAL token and safe right now. Multi-issuer (Backed/xStocks, Ondo, Remora/rStocks, Backpack Securities), multi-chain (Solana + EVM incl. BNB). `?symbol=AAPLx|AAPLon|TSLAr|SPCX` OR `?address=<solana mint | 0x evm>` → `decision` (ok/review/avoid) + signals: **authenticity** (verified vs the issuer's own registry — a token claiming a ticker but not on the allowlist is flagged a COPYCAT), **depeg_bps** (DEX price vs Pyth equity oracle), **market_status**, **liquidity_usd**, **trading_halted**, **freeze_authority**, supply. Diligence support — NOT investment/legal advice.

Free (no payment):
- `GET /api/track-record` — FREE — walk-forward backtest performance (Sharpe, return, max drawdown) of the systematic strategy behind the paid signals. Proof before you buy.
- `GET /api/xstock/health/preview` — FREE (rate-limited) — the safety verdict + authenticity for one token at zero cost (the full numeric signals stay behind the paid `/api/xstock/health`). `?symbol=` or `?address=`.

## Notes

- All endpoints return English fields (`event_en`, `board_en`, `signals_en`, …) alongside the originals; stocks are identified by language-neutral `symbol` (ticker).
- Derived structured output only — no third-party article text (copyright-safe).
- Informational data, NOT investment advice. Terms: `https://stockwaves.net/terms`.

## References
- API reference (all endpoints, params, response fields): `/skill/references/api-reference.md`
- x402 payment flow (Bankr signing + verified vanilla recipe): `/skill/references/x402-flow.md`
- Error handling (402 / 429 / 4xx / 5xx, retry rules): `/skill/references/error-handling.md`
