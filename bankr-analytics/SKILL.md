---
name: bankr-analytics
description: On-chain analytics for Bankr/Clanker token deployments. Use when the user wants to see creator fees (claimable vs claimed), count deployments by wallet, track self-deployments, filter out specific accounts, view fee leaderboards, or get ROI per token. Covers Base and Unichain via Clanker API and Bankr API.
metadata:
  {
    "clawdbot":
      {
        "emoji": "📊",
        "homepage": "https://filx.io",
        "requires": { "bins": ["bankr"] },
      },
  }
---

# Bankr Analytics

Query deployment statistics, creator fees, and token performance for Bankr/Clanker-deployed tokens.

## Data Sources

| Source | Base URL | Auth |
|--------|----------|------|
| Clanker API | `https://www.clanker.world/api` | None |
| Bankr API | `https://api.bankr.bot` | `X-API-Key` header |
| Base RPC | `https://mainnet.base.org` | None |

---

## 1. Deployments by Wallet

### Get all tokens deployed by a wallet address

```bash
curl "https://www.clanker.world/api/tokens?admin=<WALLET>&sort=desc&limit=50"
```

Response fields per token:
- `contract_address` — token contract
- `name`, `symbol` — token identity
- `deployed_at` — deployment timestamp
- `starting_market_cap` — market cap at launch
- `extensions.fees.recipients` — fee recipient addresses
- `msg_sender` — deployer wallet

### Count self-deployments (admin = your wallet)

```bash
WALLET="0xYOUR_WALLET"
curl -s "https://www.clanker.world/api/tokens?admin=$WALLET&limit=100" \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
tokens = d.get('data', [])
print(f'Total deployments: {len(tokens)}')
for t in tokens:
    print(f'  {t[\"symbol\"]:10} {t[\"contract_address\"]} deployed {t[\"deployed_at\"][:10]}')
"
```

### Filter: exclude specific wallets or tokens

When showing deployments, exclude addresses from the results:

```bash
EXCLUDE_WALLETS=("0xDEAD..." "0xSPAM...")
curl -s "https://www.clanker.world/api/tokens?admin=$WALLET&limit=100" \
  | python3 -c "
import sys, json
exclude = ['0xDEAD...', '0xSPAM...']
d = json.load(sys.stdin)
filtered = [t for t in d['data'] if t['admin'].lower() not in [e.lower() for e in exclude]]
print(f'Showing {len(filtered)} tokens (excluded {len(d[\"data\"]) - len(filtered)})')
for t in filtered:
    print(f'  {t[\"symbol\"]} — {t[\"contract_address\"]}')
"
```

---

## 2. Creator Fees

### Check claimable fees for a specific token (via Bankr agent)

```bash
bankr prompt "How much fees can I claim for <TOKEN_SYMBOL>?"
```

Or query Clanker directly for fee recipient config:

```bash
curl -s "https://www.clanker.world/api/tokens/<CONTRACT_ADDRESS>" \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
fees = d.get('extensions', {}).get('fees', {})
print('Fee type:', fees.get('type'))
print('Creator fee (bps):', fees.get('clankerFee'))
print('Recipients:')
for r in fees.get('recipients', []):
    print(f'  {r[\"recipient\"]} — {r[\"bps\"]} bps')
"
```

### Claim fees

```bash
bankr prompt "Claim my fees for <TOKEN_SYMBOL>"
```

### Batch: check fees for all your tokens

```bash
WALLET="0xYOUR_WALLET"
BANKR_API_KEY="bk_..."

# Get all tokens first
TOKENS=$(curl -s "https://www.clanker.world/api/tokens?admin=$WALLET&limit=100" \
  | python3 -c "import sys,json; [print(t['symbol']) for t in json.load(sys.stdin)['data']]")

# Check each
for sym in $TOKENS; do
  bankr prompt "How much unclaimed fees do I have for $sym?"
done
```

---

## 3. Fee Leaderboard (Your Tokens)

Rank your deployed tokens by total fees earned:

```bash
curl -s "https://www.clanker.world/api/tokens?admin=$WALLET&limit=100&sort=desc" \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
tokens = d['data']

print(f'{'#':>3}  {'Symbol':12} {'Market Cap':>14}  Contract')
print('-' * 60)
sorted_tokens = sorted(tokens, key=lambda t: t.get('starting_market_cap', 0), reverse=True)
for i, t in enumerate(sorted_tokens, 1):
    mcap = t.get('starting_market_cap', 0)
    print(f'{i:>3}. {t[\"symbol\"]:12} \${mcap:>12,.2f}  {t[\"contract_address\"][:12]}...')
"
```

---

## 4. Global Deployment Stats

### Recent deployments (global, not filtered)

```bash
curl -s "https://www.clanker.world/api/tokens?sort=desc&limit=20" \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
for t in d['data']:
    print(f'{t[\"deployed_at\"][:16]}  {t[\"symbol\"]:12}  {t[\"name\"]}')
"
```

### Count deployments in a time window

```bash
FROM_DATE="2026-01-01"
curl -s "https://www.clanker.world/api/tokens?sort=desc&limit=1000" \
  | python3 -c "
import sys, json
from datetime import datetime
from_dt = datetime.fromisoformat('$FROM_DATE')
d = json.load(sys.stdin)
recent = [t for t in d['data'] if datetime.fromisoformat(t['deployed_at'].replace('Z','')) >= from_dt]
print(f'Deployments since {from_dt.date()}: {len(recent)}')
"
```

---

## 5. ROI Calculator

Estimate return per token (fees earned vs deployment gas cost):

```bash
# Rough gas cost for Clanker deployment on Base: ~$2–5 USD
DEPLOY_COST_USD=3.00

curl -s "https://www.clanker.world/api/tokens?admin=$WALLET&limit=100" \
  | python3 -c "
import sys, json
deploy_cost = $DEPLOY_COST_USD
d = json.load(sys.stdin)
tokens = d['data']
print(f'Deployed {len(tokens)} tokens. Estimated deployment cost: \${len(tokens) * deploy_cost:.2f}')
print()
print('Token ROI (based on starting market cap):')
for t in tokens:
    mcap = t.get('starting_market_cap', 0)
    print(f'  {t[\"symbol\"]:10}  launch mcap: \${mcap:>10,.2f}')
"
```

---

## 6. Self-Deployment Detection

A "self-deployment" is a token where the Bankr wallet is also the `admin` (fee recipient). Detect them:

```bash
curl -s "https://www.clanker.world/api/tokens?admin=$WALLET&limit=100" \
  | python3 -c "
import sys, json
wallet = '$WALLET'.lower()
d = json.load(sys.stdin)
self_deployed = [
    t for t in d['data']
    if any(r['recipient'].lower() == wallet for r in t.get('extensions', {}).get('fees', {}).get('recipients', []))
]
print(f'Self-deployments (fees → your wallet): {len(self_deployed)}')
for t in self_deployed:
    print(f'  {t[\"symbol\"]} — {t[\"contract_address\"]}')
"
```

---

## 7. Exclude / Filter Patterns

### Exclude known bot/spam deployer wallets

```bash
EXCLUDE = [
    "0x000000000000000000000000000000000000dead",  # burn address
    "0xSPAMWALLET1...",
    "0xSPAMWALLET2...",
]
```

Apply filter to any API response:
```python
filtered = [t for t in tokens if t['admin'].lower() not in [e.lower() for e in EXCLUDE]]
```

### Exclude tokens by symbol or name pattern

```python
EXCLUDE_SYMBOLS = ["TEST", "SPAM", "RUG"]
filtered = [t for t in tokens if t['symbol'].upper() not in EXCLUDE_SYMBOLS]
```

### Show only verified tokens

```python
verified = [t for t in tokens if t.get('tags', {}).get('verified', False)]
```

---

## Quick Commands Summary

| Task | Command |
|------|---------|
| My deployments | `curl "https://www.clanker.world/api/tokens?admin=<WALLET>&limit=100"` |
| Check fees | `bankr prompt "How much fees can I claim for <TOKEN>?"` |
| Claim fees | `bankr prompt "Claim fees for <TOKEN>"` |
| Global recent | `curl "https://www.clanker.world/api/tokens?sort=desc&limit=20"` |
| Token detail | `curl "https://www.clanker.world/api/tokens/<CONTRACT>"` |

---

## Clanker API Reference

**Base URL:** `https://www.clanker.world/api`

| Endpoint | Method | Params | Description |
|----------|--------|--------|-------------|
| `/tokens` | GET | `sort`, `limit`, `page`, `admin`, `requestor` | List tokens |
| `/tokens/:address` | GET | — | Token detail + fee config |

**Query params for `/tokens`:**
- `admin` — filter by deployer/admin wallet address
- `sort` — `desc` (newest) or `asc`
- `limit` — max 100 per page
- `page` — pagination
- `requestor` — filter by interface deployer (clank.fun, bankr, etc.)

---

## Resources

- **Clanker Explorer:** https://www.clanker.world
- **Bankr Launches:** https://bankr.bot/launches
- **Bankr API Docs:** https://docs.bankr.bot
- **Base Explorer:** https://basescan.org
