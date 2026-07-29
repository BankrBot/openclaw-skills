# StockWaves API Reference

Base URL `https://stockwaves.net`. All endpoints return English fields alongside originals; stocks are identified by language-neutral `symbol` (ticker). Prices are USDC per call. Canonical machine spec: `/openapi.json`.

## China-market intelligence
| Endpoint | Price | Query | Returns |
|---|---|---|---|
| `GET /api/cn/trending` | $0.03 | `platform=all\|weibo\|baidu\|douyin`, `limit=1-50`, `category=` | per-platform hot-search rows: `rank`, `term`, `category`, `heat` (native scale, NOT cross-platform comparable), `marker`/`is_rising` (Weibo). |
| `GET /api/cn/news` | $0.04 | `limit=1-50`, `ticker=` | events `{ticker, event, event_en, sentiment, count, sources}`; risks `{detected_at, ticker, severity, kind, keywords}`. Derived structure only — no article text. |
| `GET /api/cn/themes` | $0.06 | — | per industrial theme (AI compute/semis/robotics/defense/new energy): agg rotation-strength; per board: rot_score, rank, trend, lifecycle. |
| `GET /api/cn/brief` | $0.08 | `top=1-10` | one-call synthesized China daily: social_pulse + market_events + risk_alerts + industrial_themes + sector_rotation_top. |

## Quant signals
| Endpoint | Price | Query | Returns |
|---|---|---|---|
| `GET /api/recommend` | $0.50 | `market=A\|US`, `limit=1-100` | Top-N picks (4-factor resonance) + take-profit / stop-loss. |
| `GET /api/dealer` | $0.08 | `top_n=1-1000`, `limit=1-500` | dealer (smart-money) 6-signal scan across A-shares. |
| `GET /api/rotation` | $0.05 | `limit=1-100` | sector rotation forecast: strength + momentum + catalyst. |
| `GET /api/anomalies/insight` | $0.05 | `days=1-90` | blind-spot / anomaly setups the system keeps missing. |
| `GET /api/btc/signal` | $0.03 | — | BTC/USDT RL signal: position lean [-1,1], direction, conviction, risk flags. |
| `GET /api/macro/allocation` | $0.10 | `symbols=` (CSV) | cross-asset ETF allocation (QQQ/IWM/SPY/TLT/DBC/GLD): signal, position, confidence, regime. |
| `GET /api/crypto/microstructure` | $0.01 | `symbol=BTCUSDT` ({BTC,ETH,SOL,BNB,XRP,DOGE}USDT) | live perp microstructure: funding, premium/basis, OI (+USD), taker buy/sell ratio, 24h realized vol. |

## Compute
| Endpoint | Price | Body | Returns |
|---|---|---|---|
| `POST /api/portfolio/optimize` | $0.05 | `{assets:[{symbol,target,confidence?,vol?,regime?}], config?}` | risk-constrained weights (inverse-vol, conviction scaling, correlation penalty, gross/net + per-symbol caps, regime haircut). |

## Tokenized US stocks — pre-trade safety gate
| Endpoint | Price | Query | Returns |
|---|---|---|---|
| `GET /api/xstock/health` | $0.03 | `symbol=AAPLx\|AAPLon\|TSLAr\|SPCX` OR `address=<solana mint \| 0x evm>` | `decision` (ok/review/avoid) + signals: `authenticity` (verified vs issuer registry — Backed/Ondo/Remora/Backpack; off-allowlist = COPYCAT), `depeg_bps` (DEX vs Pyth equity oracle), `market_status`, `liquidity_usd`, `trading_halted`, `freeze_authority`, `onchain_supply`. Multi-chain (Solana + EVM incl. BNB). |

## Free (no payment)
| Endpoint | Query | Returns |
|---|---|---|
| `GET /api/track-record` | — | walk-forward backtest (Sharpe, return, max drawdown, WF score). Proof before you buy. |
| `GET /api/xstock/health/preview` | `symbol=` or `address=` | rate-limited: the safety `decision` + `authenticity` only (full numeric signals stay behind the paid gate). |

Informational data, NOT investment advice. Terms: `https://stockwaves.net/terms`.
