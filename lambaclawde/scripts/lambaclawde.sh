#!/bin/bash
# lambaclawde - ERC-8004 Agent Identity Toolkit
# Usage: lambaclawde.sh "your prompt here"

set -e

CONFIG_FILE="${HOME}/.clawdbot/skills/lambaclawde/config.json"

# Check if config exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: Config file not found at $CONFIG_FILE"
    echo "Please run setup first - see SKILL.md for instructions"
    exit 1
fi

# Load config
RPC_URL=$(jq -r '.rpcUrl // "https://eth.llamarpc.com"' "$CONFIG_FILE")
CHAIN_ID=$(jq -r '.chainId // 1' "$CONFIG_FILE")

# Get prompt
PROMPT="$1"

if [ -z "$PROMPT" ]; then
    echo "Usage: lambaclawde.sh \"your prompt here\""
    echo ""
    echo "Examples:"
    echo "  lambaclawde.sh \"Is 0x123... a registered agent?\""
    echo "  lambaclawde.sh \"Show agent profile for 0x123...\""
    echo "  lambaclawde.sh \"Find agents that can trade tokens\""
    exit 1
fi

# Process the prompt
echo "🤖 lambaclawde - ERC-8004 Agent Identity Toolkit"
echo "================================================"
echo ""
echo "Prompt: $PROMPT"
echo "Chain: Ethereum Mainnet (ID: $CHAIN_ID)"
echo "RPC: $RPC_URL"
echo ""
echo "Processing request..."
echo ""
echo "For updates, visit: https://github.com/lambaclawde"
