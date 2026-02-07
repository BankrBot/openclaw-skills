#!/bin/bash
# Deploy TrustEscrow to Base

set -e

RPC_URL="${RPC_URL:-https://mainnet.base.org}"
PRIVATE_KEY="${PRIVATE_KEY:-}"
FEE_RECIPIENT="${FEE_RECIPIENT:-}"
ARBITRATOR="${ARBITRATOR:-$FEE_RECIPIENT}"

if [ -z "$PRIVATE_KEY" ] || [ -z "$FEE_RECIPIENT" ]; then
    echo "Usage: PRIVATE_KEY=0x... FEE_RECIPIENT=0x... ARBITRATOR=0x... ./deploy.sh"
    exit 1
fi

echo "🚀 Deploying TrustEscrow to Base..."

ESCROW_ADDRESS=$(forge create \
    --rpc-url "$RPC_URL" \
    --private-key "$PRIVATE_KEY" \
    contracts/TrustEscrow.sol:TrustEscrow \
    --constructor-args "$FEE_RECIPIENT" "$ARBITRATOR" \
    --json | jq -r '.deployedTo')

echo "✅ TrustEscrow deployed at: $ESCROW_ADDRESS"

cat > deployment.json <<EOF
{
  "network": "base",
  "trustEscrow": "$ESCROW_ADDRESS",
  "feeRecipient": "$FEE_RECIPIENT",
  "arbitrator": "$ARBITRATOR",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo "📝 Saved to deployment.json"
