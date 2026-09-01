#!/bin/bash
# Deploy TrustEscrowV2 to Base

set -e

# Default to Base Sepolia
RPC_URL="${RPC_URL:-https://sepolia.base.org}"
PRIVATE_KEY="${PRIVATE_KEY:-}"
USDC_ADDRESS="${USDC_ADDRESS:-0x036CbD53842c5426634e7929541eC2318f3dCF7e}"  # Base Sepolia USDC
ARBITRATOR="${ARBITRATOR:-}"

if [ -z "$PRIVATE_KEY" ]; then
    echo "Error: PRIVATE_KEY not set"
    echo ""
    echo "Usage:"
    echo "  Base Sepolia (default):"
    echo "    PRIVATE_KEY=0x... ARBITRATOR=0x... ./deploy.sh"
    echo ""
    echo "  Base Mainnet:"
    echo "    PRIVATE_KEY=0x... ARBITRATOR=0x... USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 RPC_URL=https://mainnet.base.org ./deploy.sh"
    exit 1
fi

if [ -z "$ARBITRATOR" ]; then
    echo "Error: ARBITRATOR not set (address for dispute resolution)"
    echo "Usage: PRIVATE_KEY=0x... ARBITRATOR=0x... ./deploy.sh"
    exit 1
fi

echo "🚀 Deploying TrustEscrowV2..."
echo "   Network: $RPC_URL"
echo "   USDC: $USDC_ADDRESS"
echo "   Arbitrator: $ARBITRATOR"
echo ""

ESCROW_ADDRESS=$(forge create \
    --rpc-url "$RPC_URL" \
    --private-key "$PRIVATE_KEY" \
    contracts/TrustEscrow.sol:TrustEscrowV2 \
    --constructor-args "$USDC_ADDRESS" "$ARBITRATOR" \
    --json | jq -r '.deployedTo')

echo "✅ TrustEscrowV2 deployed at: $ESCROW_ADDRESS"

# Detect network from RPC
NETWORK="base-sepolia"
if [[ "$RPC_URL" == *"mainnet"* ]]; then
    NETWORK="base"
fi

cat > deployment.json <<EOF
{
  "network": "$NETWORK",
  "trustEscrowV2": "$ESCROW_ADDRESS",
  "usdc": "$USDC_ADDRESS",
  "arbitrator": "$ARBITRATOR",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo "📝 Saved to deployment.json"
echo ""
echo "🔗 Verify on Basescan:"
if [[ "$NETWORK" == "base" ]]; then
    echo "   https://basescan.org/address/$ESCROW_ADDRESS"
else
    echo "   https://sepolia.basescan.org/address/$ESCROW_ADDRESS"
fi
