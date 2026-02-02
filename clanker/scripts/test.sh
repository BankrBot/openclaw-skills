#!/bin/bash
#
# Clanker Skill - Test Script
# Tests read-only operations on Base mainnet
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=========================================="
echo "  Clanker Skill - Test Suite"
echo "=========================================="
echo ""

# Create test config if not exists
CONFIG_FILE="$HOME/.clawdbot/skills/clanker/config.json"
if [[ ! -f "$CONFIG_FILE" ]]; then
    mkdir -p "$HOME/.clawdbot/skills/clanker"
    cat > "$CONFIG_FILE" << 'EOF'
{
  "mainnet": {
    "rpc_url": "https://1rpc.io/base",
    "private_key": "PLACEHOLDER"
  },
  "testnet": {
    "rpc_url": "https://base-sepolia.public.blastapi.io",
    "private_key": "PLACEHOLDER"
  }
}
EOF
    echo "Created test config at $CONFIG_FILE"
    echo ""
fi

# Test 1: Get token info (WETH on mainnet)
echo "Test 1: Get Token Info (WETH on mainnet)"
echo "--------------------------------"
"$SCRIPT_DIR/clanker.sh" info 0x4200000000000000000000000000000000000006 --network mainnet
echo ""

# Test 2: Get deployer stats (mainnet)
echo "Test 2: Get Deployer Stats (mainnet)"
echo "--------------------------------"
"$SCRIPT_DIR/clanker.sh" get-token 0xd8a8ea133f482b42480d1679f0e4f589198f9573 --network mainnet
echo ""

# Test 3: Check transaction status (fake tx on mainnet)
echo "Test 3: Check Transaction Status (mainnet)"
echo "--------------------------------"
"$SCRIPT_DIR/clanker.sh" status 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef --network mainnet 2>&1 || true
echo ""

echo "=========================================="
echo "  Read-Only Tests Complete"
echo "=========================================="
echo ""
echo "To test deployment on Base Sepolia:"
echo ""
echo "1. Set up testnet config:"
echo "   echo '{\"testnet\":{\"rpc_url\":\"https://base-sepolia.public.blastapi.io\",\"private_key\":\"YOUR_KEY\"}}' > ~/.clawdbot/skills/clanker/config.json"
echo ""
echo "2. Get test ETH from faucet:"
echo "   Visit https://cloud.base.org/faucet"
echo ""
echo "3. Deploy test token:"
echo "   $ clanker.sh testnet-deploy \"Test Token\" TST"
echo ""
echo "4. Check deployment:"
echo "   $ clanker.sh status <txhash> --network testnet"
echo "   $ clanker.sh info <token-address> --network testnet"
echo ""
