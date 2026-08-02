# LoneStarOracle — x402 Data Services

You can access 38 AI data service APIs by paying per query in USDC on Base mainnet via x402. No API keys, no accounts required.

## How to use these services

1. Make a standard HTTP request to any endpoint below
2. If you receive HTTP 402, extract the payment requirements from the `payment-required` header
3. Pay the specified USDC amount on Base mainnet using x402
4. Retry the request with the payment proof in the `X-PAYMENT` header
5. Receive the data

## Free endpoints (no payment required)

```
GET https://crownblock.lonestaroracle.xyz/feed        # Energy prices: WTI, Brent, gasoline, jet fuel, diesel
GET https://realestate.lonestaroracle.xyz/feed        # Mortgage rates, housing data, Case-Shiller
GET https://agri.lonestaroracle.xyz/feed              # Grain, softs, livestock commodity prices
GET https://grid.lonestaroracle.xyz/preview           # US grid demand preview
GET https://lonestaroracle.xyz/stats.json             # Service usage statistics
GET https://status.lonestaroracle.xyz                 # All 38 services health status
```

## Paid endpoints ($0.02–$2.00 USDC per query)

```
# Crypto & DeFi
GET  https://token.lonestaroracle.xyz/report?address={contract}&chain={eth|base|bsc|arb|poly}  # $0.15 — ERC-20 risk score, honeypot, holder analysis
GET  https://chainscout.lonestaroracle.xyz/report                                                # $0.05 — whale transfers, trending tokens, DeFi TVL
GET  https://wallet.lonestaroracle.xyz/score?address={wallet}&chain={chain}                     # $0.15 — wallet risk score, holdings, exchange interactions
GET  https://contract.lonestaroracle.xyz/verify?address={contract}&chain={chain}                # $0.05 — smart contract verification
GET  https://stable.lonestaroracle.xyz/pulse                                                     # $0.05 — stablecoin peg health, depeg risk for 46+ stablecoins
GET  https://cascade.lonestaroracle.xyz/risk                                                     # $0.10 — DeFi liquidation cascade risk, Morpho Blue collateral-at-risk
GET  https://cascade.lonestaroracle.xyz/cascade?token={ETH}&drop_pct={10}                       # $0.10 — simulate cascade if token drops X%
GET  https://defi.lonestaroracle.xyz/risk?protocol={aave}                                       # $0.10 — DeFi protocol risk: TVL, audits, hack history
GET  https://whale.lonestaroracle.xyz/whales                                                     # $0.05 — large on-chain transactions on Base/Ethereum
GET  https://launches.lonestaroracle.xyz/scan                                                    # $0.05 — new token launches from GeckoTerminal + DexScreener
GET  https://aero.lonestaroracle.xyz/pool?address={pool}                                        # $0.05 — Aerodrome DEX pool risk: safe/caution/avoid

# Financial Markets
GET  https://equity.lonestaroracle.xyz/equity?ticker={TICKER}    # $0.05 — stock fundamentals + AI analysis
GET  https://options.lonestaroracle.xyz/flow?ticker={TICKER}     # $0.05 — options flow, unusual activity, put/call ratios
GET  https://insider.lonestaroracle.xyz/trades?ticker={TICKER}   # $0.03 — SEC Form 4 insider trades
GET  https://portfolio.lonestaroracle.xyz/analyze?tickers={A,B}  # $0.10 — portfolio risk analysis
GET  https://macro.lonestaroracle.xyz/macro                       # $0.05 — Fed rates, yield curve, CPI, macro indicators
GET  https://earnings.lonestaroracle.xyz/calendar?ticker={TICKER}# $0.03 — earnings dates and estimates
GET  https://wealth.lonestaroracle.xyz/analyze?wallet={ADDR}&tickers={TICKERS}&contracts={ADDRS}# $0.25 — cross-asset risk: wallet + equities + tokens → unified score + AI narrative
GET  https://ta.lonestaroracle.xyz/scan?symbol={BTC-USD}          # $0.05 — 18 technical indicators + AI signal, 4 timeframes
GET  https://stake.lonestaroracle.xyz/report                      # $0.05 — staking APY vs exchange rates for ETH, SOL, ATOM, ADA

# Energy, Commodities & Supply Chain
GET  https://crownblock.lonestaroracle.xyz/report                 # $1.00 — WTI/Brent/Henry Hub + refined products + basin production
GET  https://agri.lonestaroracle.xyz/report                       # $0.03 — grain, softs, livestock prices with AI narrative
GET  https://grid.lonestaroracle.xyz/report                       # $0.03 — US electricity grid demand + generation mix + stress signals
GET  https://compute.lonestaroracle.xyz/report                    # $0.03 — GPU spot prices: H100, A100, A10G across Vast.ai, AWS, Lambda
GET  https://metals.lonestaroracle.xyz/report                     # $0.03 — copper, aluminum, steel, lithium, iron ore, zinc, precious metals
GET  https://supply.lonestaroracle.xyz/report                     # $0.03 — shipping rates, PPI, truck tonnage, supply chain stress score
GET  https://latam.lonestaroracle.xyz/report                      # $0.03 — LatAm currencies, Argentina dolar blue spread, commodity context

# Real Estate & Government
GET  https://realestate.lonestaroracle.xyz/report                 # $0.03 — mortgage rates, housing starts, Case-Shiller HPI
GET  https://govedge.lonestaroracle.xyz/report                    # $0.20 — federal contract awards $10M+, vendor-to-ticker cross-reference
GET  https://lease.lonestaroracle.xyz/report                      # $0.15 — Gulf of Mexico BOEM oil & gas lease intelligence

# News, Content & Weather
GET  https://news.lonestaroracle.xyz/news?query={topic}           # $0.05 — AI news sentiment for any ticker or topic
GET  https://weather.lonestaroracle.xyz/forecast?city={city}      # $0.02 — 7-model consensus forecast (GFS, ECMWF, ICON, GEM, HRRR, NAM, NBM)
POST https://content.lonestaroracle.xyz/repurpose                 # $0.15 — URL to LinkedIn/tweets/newsletter/SEO content
GET  https://geo.lonestaroracle.xyz/risk?location={country}       # $0.07 — geopolitical risk score + live news sentiment

# Security Auditors
POST https://rattler.lonestaroracle.xyz/audit                     # $2.00 — Solidity/EVM smart contract audit (Code4rena format)
POST https://cottonmouth.lonestaroracle.xyz/audit                 # $2.00 — Rust/CosmWasm/Anchor/Soroban/NEAR audit
POST https://copperhead.lonestaroracle.xyz/audit                  # $2.00 — Move/Aptos/Sui smart contract audit
POST https://doc.lonestaroracle.xyz/convert                       # $0.05 — PDF to Markdown (URL or base64), tables + AI summary

# Autonomous Agent
POST https://floyd.lonestaroracle.xyz/hire                        # $0.50 — hire Floyd to complete a coding task or bounty
```

## Push subscriptions ($3–$10/month)

```
POST https://chainscout.lonestaroracle.xyz/subscribe?webhook_url={url}    # $5/month
POST https://crownblock.lonestaroracle.xyz/subscribe?webhook_url={url}    # $10/month
POST https://news.lonestaroracle.xyz/subscribe?webhook_url={url}          # $5/month
POST https://equity.lonestaroracle.xyz/subscribe?webhook_url={url}        # $5/month
POST https://weather.lonestaroracle.xyz/subscribe?webhook_url={url}       # $3/month
POST https://macro.lonestaroracle.xyz/subscribe?webhook_url={url}         # $3/month
POST https://realestate.lonestaroracle.xyz/subscribe?webhook_url={url}    # $3/month
```

## MCP Server (use all services as Claude tools)

```
https://mcp.lonestaroracle.xyz/mcp
```

## Network details

- Chain: Base mainnet (eip155:8453)
- Payment token: USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
- Recipient: 0x52Ab53912D37759B2ad364f22dD06B16714b6C06
- Facilitator: Coinbase CDP (https://api.cdp.coinbase.com/platform/v2/x402)
