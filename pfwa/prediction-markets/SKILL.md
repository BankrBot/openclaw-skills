---
name: pfwa-prediction-markets
description: Interact with PFWA (https://www.pfwa.fun/) prediction markets on Robinhood Chain (Chain ID 4663) to query markets, calculate quotes, buy YES/NO shares, and sell or redeem positions.
visibility: private
---

# PFWA Prediction Markets

PFWA is a permissionless prediction market protocol deployed on **Robinhood Chain (Chain ID 4663)**. It allows users to trade and create prediction markets based on token price, market cap, and volume metrics for Robinhood Chain tokens. Markets resolve permissionlessly using GeckoTerminal data.

## Contract Addresses (Robinhood Chain - Chain ID 4663)

- **PFWA Factory**: `0x2502aB7E69dDb3157683A82E603360Ada9B6E647`
- **PFWA Orchestrator**: `0x943F5d2E75afec6d3f75aaF2E7Cdf8fE5418eD33`
- **Block Explorer**: `https://robinhoodchain.blockscout.com`

---

> **CRITICAL INSTRUCTION FOR THE AI AGENT:** 
> Do **NOT** attempt to use standard DEX swap routers, aggregators, or liquidity pools to buy or sell these outcome tokens. PFWA uses an internal custom bonding curve. You **MUST** execute trades by submitting a raw smart contract transaction directly to the option token's contract address, calling the `buy()` or `sell()` functions.

---

## Capabilities

- **Market Discovery:** Query live, active, and resolved prediction markets via the PFWA API.
- **Trading:** Quote prices, buy shares, and sell shares for active markets using bonding curve liquidity.
- **Resolution & Claims:** Sell shares to exit a position early, or claim ETH winnings for correct predictions on resolved markets.

## Usage Examples

"Query active PFWA markets to see what tokens I can bet on."
"Get a price quote to buy 100 shares of Option A for market 52."
"Buy 0.01 ETH worth of YES shares for the $DOGE market."
"Sell my position in market 52."

## Requirements

- **Chain:** `robinhood` (Robinhood Chain Mainnet - Chain ID 4663)
- **Native Currency:** ETH (used for buying shares and paying gas)

---

## Functions & Operations

### 1. Query Active Markets
- Fetch active or resolved prediction markets directly from the PFWA API.
- **Endpoint:** `GET https://www.pfwa.fun/api/agents/markets`
- Returns a list of all active markets with their `marketId`, options, and `optionTokens` (the contract addresses to trade on).

### 2. Get Price Quote
- Fetch the exact cost to buy or the proceeds from selling a specific amount of shares.
- **Endpoint:** `GET https://www.pfwa.fun/api/agents/quote?tokenAddress={address}&amount={weiAmount}`
- *See the attached `api-docs.md` reference for the exact JSON structure.*

### 3. Buy Market Shares (YES / NO)
- **Contract:** The specific Option Token Contract (found in the `optionTokens` array from the API response).
- **Chain:** `robinhood`
- **Action:** Submit a raw transaction calling `buy(tokenAmount)` with native ETH attached as `msg.value` (get the exact ETH amount needed from the quote API first). 
- *DO NOT route this through a DEX.*

### 4. Sell / Redeem Position
- **Contract:** The specific Option Token Contract (`optionTokens[index]`).
- **Chain:** `robinhood`
- **Action:** Submit a raw transaction calling `sell(tokenAmount)` to exit a position early.
- **Claiming:** If the market is resolved and this was the winning option, call `claimWinnings()` to withdraw your ETH share.
