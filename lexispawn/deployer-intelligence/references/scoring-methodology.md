# Scoring Methodology

## Formula

Base score: **50** (neutral). Six adjustments applied in order. Result clamped to 0–100.

### Positive adjustments

| # | Condition | Weight |
|---|-----------|--------|
| 1 | Any prior token `active` for 30+ days | +10 (once) |
| 2 | Each prior token `active` for 7+ days | +5 per token (max +20) |
| 3 | Average peak mcap across tokens with data > $500K | +10 (once) |

### Negative adjustments

| # | Condition | Weight |
|---|-----------|--------|
| 4 | Each prior token `dead` within 72h of pair creation | -10 per token (max -30) |
| 5 | 5+ total contracts AND zero tokens survived 7 days | -20 (once) |
| 6 | 10+ total contracts AND < 30% have DexScreener data | -15 (once) |

```
final = Math.max(0, Math.min(100, score))
```

## Token status

| Status | Criteria |
|--------|----------|
| `active` | liquidity > $1K AND mcap > 0 AND price > 0 |
| `low_liquidity` | liquidity $1–$1K |
| `dead` | liquidity = 0 OR mcap = 0 OR price = 0 |

"Survived N days" requires `active` status AND `daysOld >= N`.
`daysOld` is measured from DexScreener `pairCreatedAt` (first liquidity), not contract deployment.

## Example: score 85 — proven builder

Deployer created 8 contracts. 5 have DexScreener pairs.

| Token | Status | Days old | Mcap |
|-------|--------|----------|------|
| A | active | 45 | $1.8M |
| B | active | 32 | $900K |
| C | active | 14 | $400K |
| D | active | 9 | $200K |
| E | dead | 2 | $0 |

```
Base:                                       50
#1  30-day survivor exists (A, B):         +10
#2  7-day survivors (A, B, C, D = 4):      +20  (cap)
#3  Avg mcap ($825K) > $500K:              +10
#4  Dead < 72h (E = 1):                    -10
#5  8 deploys, 4 survived 7d:               —
#6  8 deploys, 5/8 = 63% have data:         —
                                           ----
Total:                                      80
```

## Example: score 5 — serial failure

Deployer created 16 contracts. 1 has a DexScreener pair.

| Token | Status | Days old | Mcap |
|-------|--------|----------|------|
| A | dead | 1 | $0 |

```
Base:                                       50
#1  No 30-day survivor:                      —
#2  No 7-day survivor:                       —
#3  Avg mcap ($0) < $500K:                   —
#4  Dead < 72h (A = 1):                    -10
#5  16 deploys, 0 survived 7d:             -20
#6  16 deploys, 1/16 = 6% have data:       -15
                                           ----
Total:                                       5
```

## API endpoints

### Routescan — resolve deployer

```
GET https://api.routescan.io/v2/network/mainnet/evm/8453/etherscan/api
  ?module=contract
  &action=getcontractcreation
  &contractaddresses={TOKEN_CA}
  &apikey={KEY}
```

Returns `contractCreator`. Fallback: query `txlist` for the token CA, use `from` of earliest transaction.

### Routescan — deployer contract history

```
GET https://api.routescan.io/v2/network/mainnet/evm/8453/etherscan/api
  ?module=account
  &action=txlistinternal
  &address={DEPLOYER}
  &startblock=0
  &endblock=99999999
  &sort=asc
  &apikey={KEY}
```

Filter: `type === "create" || type === "create2"` with non-empty `contractAddress`.

### DexScreener — token market data

```
GET https://api.dexscreener.com/token-pairs/v1/base/{CONTRACT_ADDRESS}
```

Returns array of pairs. First pair used. Fields: `fdv` (mcap), `liquidity.usd`, `volume.h24`, `priceUsd`, `pairCreatedAt`.
Rate limited at 300ms between calls.

## Notes

- `peakMcap` is current mcap at scan time. Historical peak is not tracked via API. A token that hit $5M but sits at $200K scores on $200K.
- The target token being scanned is excluded from the deployer's history to avoid self-reference.
- Contracts with no DexScreener pair count toward total deploys (adjustments #5, #6) but receive no status or scoring weight.
- ERC-4337 wallets: deployments via UserOp `initCode` are invisible to `txlistinternal`. These deployers return 0 history regardless of actual track record.
