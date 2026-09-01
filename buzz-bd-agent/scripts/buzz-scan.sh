#!/bin/bash
# buzz-scan.sh — Quick token discovery scan
# Usage: ./buzz-scan.sh [chain] [limit]
# Example: ./buzz-scan.sh solana 10

CHAIN=${1:-solana}
LIMIT=${2:-20}

echo "🐝 Buzz BD Agent — Discovery Scan"
echo "Chain: $CHAIN | Limit: $LIMIT"
echo "================================="

# Fetch boosted tokens
BOOSTS=$(curl -s "https://api.dexscreener.com/token-boosts/latest/v1")

if [ -z "$BOOSTS" ] || [ "$BOOSTS" = "null" ]; then
  echo "ERROR: DexScreener API unreachable"
  exit 1
fi

# Filter by chain and output
echo "$BOOSTS" | node -e "
  const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  const chain = '$CHAIN';
  const limit = parseInt('$LIMIT');
  
  const filtered = data
    .filter(t => chain === 'all' || t.chainId === chain)
    .slice(0, limit);
  
  if (filtered.length === 0) {
    console.log('No boosted tokens found for chain:', chain);
    process.exit(0);
  }
  
  console.log('Found', filtered.length, 'boosted tokens:\n');
  
  for (const t of filtered) {
    console.log('Token:', t.tokenAddress);
    console.log('Chain:', t.chainId);
    if (t.description) console.log('Desc:', t.description.slice(0, 80));
    if (t.links) {
      const links = t.links.map(l => l.type + ': ' + l.url).join(' | ');
      console.log('Links:', links);
    }
    console.log('---');
  }
"

echo ""
echo "Scan complete. Run RugCheck on promising tokens next."
