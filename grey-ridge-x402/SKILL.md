---
name: grey-ridge-x402
description: Base-native x402 data + token security for AI agents — pay-per-call on Base USDC, no account or API key. Use BEFORE an agent buys/sells a Base token (honeypot / rug / proxy / mint-authority check), or when it needs Base-chain RPC reads (balances, gas, tx, wallet — enriched with USD values), crypto prices, cross-venue funding-rate arbitrage, DeFi yields, live Polymarket markets, or an MCP-server security audit. Base-native (most x402 data sellers are Ethereum-only) and USD-enriched. Triggers on token safety, honeypot, rug pull, is this token safe, can I sell, proxy/upgradeable, mint authority, Base RPC, wallet balance, funding rate, DeFi yield, Polymarket, crypto prices, MCP security scan.
---

# Grey Ridge Signals — Base-native x402 Data + Token Security

Agent-native, pay-per-call data on **Base** (USDC via x402 — no account, no API key).

## Token security — check BEFORE you trade ($0.02)
`GET /chain/token-security?token=0x...` — **the "can I safely buy/sell this Base token?" check every trading agent needs.** Runs real compute (not a lookup): a live `eth_call` state-override **honeypot simulation** (funds a synthetic wallet, attempts a transfer, observes revert), **proxy/upgradeability detection** (EIP-1967 / UUPS / legacy OZ slots), a **bytecode red-flag scan** (mint / pause / blacklist / fee-setter authorities), and **ownership state** (renounced vs. active owner) → a `risk_score` + `clear|review|block` verdict + human-readable flags. Free preview: `curl -s https://x402-data-api.sigrunner.workers.dev/chain/token-security/preview`

## The rest of the suite
- **Base RPC** ($0.001): block, gas (EIP-1559 + `gas_price_usd`), ETH/ERC-20 balances (+ `balance_usd`), tx, receipt (+ L1-fee breakdown), wallet bundle, EIP-7702 detection.
- **Crypto signals**: prices (+ 24h change), cross-venue funding-rate arbitrage (HL/OKX/dYdX), DeFi yields (risk-adjusted).
- **Prediction markets**: live Polymarket (bestBid/ask/spread, tags).
- **Security**: on-demand MCP-server audit (tool-poisoning / prompt-injection).

## Access
- **x402 (no account)**: pay $0.001-$0.10 USDC per call on Base — agent pays inline, no API key.
- **Free preview** routes to try with no wallet.

## MCP install (22 tools)
```json
{"mcpServers":{"grey-ridge-x402":{"type":"streamable-http","url":"https://x402-data-api.sigrunner.workers.dev/mcp"}}}
```

## Research -> Execute
Grey Ridge is the **Base data + safety layer**: vet a token, price a wallet in USD, find funding/yield/PM edges — then hand off to Bankr for **execution**.

Docs: https://x402-data-api.sigrunner.workers.dev/llms.txt
