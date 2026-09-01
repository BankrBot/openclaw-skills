#!/usr/bin/env bash
# bankr-analytics — Deployment & fee stats for Bankr/Clanker tokens
# Usage: ./analytics.sh <wallet> [--exclude 0xADDR1,0xADDR2] [--chain base]

set -euo pipefail

WALLET="${1:-}"
EXCLUDE="${EXCLUDE:-}"
CHAIN="${CHAIN:-base}"
CLANKER_API="https://www.clanker.world/api"

if [ -z "$WALLET" ]; then
  echo "Usage: $0 <wallet_address> [--exclude 0xADDR1,0xADDR2]"
  exit 1
fi

# Parse --exclude flag
shift || true
while [[ $# -gt 0 ]]; do
  case $1 in
    --exclude) EXCLUDE="$2"; shift 2 ;;
    --chain)   CHAIN="$2"; shift 2 ;;
    *) shift ;;
  esac
done

echo "📊 Bankr Analytics — $WALLET"
echo "Chain: $CHAIN | Excluded: ${EXCLUDE:-none}"
echo "─────────────────────────────────────────────────"

# Fetch all deployments
RESPONSE=$(curl -s "$CLANKER_API/tokens?admin=$WALLET&sort=desc&limit=100")

python3 - <<PYEOF
import json, sys
from datetime import datetime

data = json.loads('''$RESPONSE''')
tokens = data.get('data', [])
exclude_list = [e.lower() for e in '${EXCLUDE}'.split(',') if e]

# Apply exclusions
filtered = [t for t in tokens if t['admin'].lower() not in exclude_list]
excluded_count = len(tokens) - len(filtered)

print(f"\n🚀 Deployments: {len(filtered)} tokens", end="")
if excluded_count:
    print(f" ({excluded_count} excluded)", end="")
print()
print()

# Table header
print(f"  {'#':>3}  {'Symbol':10}  {'Name':20}  {'Deployed':12}  {'Launch MCap':>12}")
print("  " + "─" * 70)

sorted_tokens = sorted(filtered, key=lambda t: t.get('deployed_at', ''), reverse=True)
for i, t in enumerate(sorted_tokens, 1):
    deployed = t.get('deployed_at', '')[:10]
    mcap = t.get('starting_market_cap', 0)
    mcap_str = f"\${mcap:,.2f}" if mcap else "N/A"
    print(f"  {i:>3}. {t['symbol']:10}  {t['name'][:20]:20}  {deployed:12}  {mcap_str:>12}")

print()
total_mcap = sum(t.get('starting_market_cap', 0) for t in filtered)
print(f"  Total launch market cap: \${total_mcap:,.2f}")
print(f"  Est. deployment cost: ~\${len(filtered) * 3:.2f} USD")

# Self-deployments
self_deployed = []
wallet_lower = '${WALLET}'.lower()
for t in filtered:
    recipients = t.get('extensions', {}).get('fees', {}).get('recipients', [])
    if any(r['recipient'].lower() == wallet_lower for r in recipients):
        self_deployed.append(t)

print()
print(f"💰 Self-deployments (fees → your wallet): {len(self_deployed)}")
for t in self_deployed:
    print(f"   {t['symbol']:10}  {t['contract_address']}")

# Verified vs unverified
verified = [t for t in filtered if t.get('tags', {}).get('verified', False)]
print()
print(f"✅ Verified: {len(verified)} / {len(filtered)}")
PYEOF
