---
name: aeon-on-chain-monitor
description: |
  Monitor blockchain addresses and contracts for notable activity — large transfers, new approvals,
  fresh deployments, unusual gas spends, MEV interactions. Watchlist-driven, surfaces only changed
  addresses. Pairs with Bankr-compatible RPC, Quicknode, or Alchemy as the data layer. Use for
  whale-watch, tracking a treasury, or watching a counterparty contract.
  Triggers: "watch this wallet", "monitor address X", "alert on activity for 0x...",
  "did the multisig move funds", "track this contract".
---

# aeon-on-chain-monitor

Watchlist monitor over blockchain addresses and contracts. Pulls activity from public RPC + indexers, classifies events, and surfaces only what's changed since the last run. Silent on quiet watchlist members.

## Watchlist format

```yaml
addresses:
  - address: "0x..."
    label: "DAO treasury"
    chain: base
    notes: "team multisig, expect monthly distributions"
    alert_min_usd: 1000      # only surface transfers above this
  - address: "0x..."
    label: "Counterparty contract"
    chain: ethereum
    notes: "watch for upgrade events"
  - address: "0x..."
    label: "Whale A"
    chain: base
    alert_min_usd: 50000
```

## Alert triggers

A watchlist address surfaces if any of:

| Trigger | Default |
|---|---|
| **Transfer in/out** above `alert_min_usd` | $1,000 |
| **New ERC-20 approval** | any |
| **Contract upgrade** (proxy `Upgraded` event) | any |
| **Large gas spend** (> 0.05 ETH equivalent in a single tx) | any |
| **First-time interaction** with a new contract | any (one alert per pair) |
| **MEV bot interaction** (sandwich, frontrun, backrun pattern) | any |

Addresses with no triggered events are not in the output.

## Data sources

Three options, configured per deployment:

| Layer | Use it when |
|---|---|
| **Bankr-compatible RPC** | Already provisioned via Bankr Wallet API — `eth_getLogs`, `eth_getTransactionCount`, balance reads. |
| **Quicknode / Alchemy** | High-volume monitoring across many addresses; use their token/portfolio endpoints for value enrichment. |
| **Public RPC** | Minimal watchlist; rate-limited but free. |

```bash
# Recent transfers via eth_getLogs (ERC-20 Transfer topic)
curl -s -X POST "${RPC_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0","id":1,"method":"eth_getLogs",
    "params":[{
      "fromBlock":"'"${from_block}"'","toBlock":"latest",
      "topics":[
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
        null,
        "0x000000000000000000000000${addr_no_prefix}"
      ]
    }]
  }'
```

## USD enrichment

Each event is enriched with USD value using:
- Token price at block timestamp (CoinGecko / DefiLlama).
- Decimals from token contract.
- For native ETH, ETH price at block time.

Events that can't be priced are shown without a $ value (never zero-filled).

## Output

```
*On-Chain Monitor — 2026-05-12*

3 addresses surfaced (12 silenced)

DAO treasury (0x...) — base
  Transfer out: 50,000 USDC → 0xexchange (Coinbase deposit)  [tx]
  Transfer out: 12 ETH → 0xunknown (label unknown)            [tx]
  Notes: 50k USDC outflow > $25k monthly avg

Counterparty contract (0x...) — ethereum
  Contract upgrade: implementation slot changed (0xnew_impl)
  Verify: new implementation has same ABI? [link to source]
  ⚠ Risk: review storage layout before next interaction

Whale A (0x...) — base
  Transfer in: 250k USDC ← 0xdex (Aerodrome swap)
  Transfer out: 60 ETH → 0xnew_recipient (first interaction)
  Pattern: rotating ETH after stable inflow — historical pattern
```

## Guardrails

- Watchlist file is the source of truth. The skill never adds or removes addresses on its own.
- Silence on quiet members.
- "First-time interaction" alerts fire **once** per (watched address, counterpart) pair — not every subsequent tx.
- Contract upgrade alerts always fire — even on whitelisted upgrades — because they're high-blast-radius.

## Pairs with

- `aeon-unlock-monitor` (the team wallet that just moved is probably the next unlock).
- Quicknode / Alchemy / Bankr for the RPC layer.
- BlueAgent for allowance audits on the watched address.

## Required keys

One of: Bankr API key with Wallet API scope (for `/wallet/portfolio` reads), Quicknode API key, Alchemy API key, or just a public RPC URL.
