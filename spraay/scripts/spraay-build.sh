#!/bin/bash
# spraay-build.sh — Build Spraay transaction calldata locally
# Usage: scripts/spraay-build.sh <token|ETH> <recipient1:amount1> <recipient2:amount2> ...
# Example: scripts/spraay-build.sh ETH 0xAAA:0.1 0xBBB:0.2 0xCCC:0.3

set -euo pipefail

SKILL_DIR="${HOME}/.clawdbot/skills/spraay"
CONFIG_FILE="${SKILL_DIR}/config.json"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: Config file not found at ${CONFIG_FILE}"
    exit 1
fi

SPRAY_CONTRACT=$(jq -r '.sprayContract // empty' "$CONFIG_FILE")
CHAIN_ID=$(jq -r '.chainId // 8453' "$CONFIG_FILE")

if [ $# -lt 2 ]; then
    echo "Usage: scripts/spraay-build.sh <ETH|TOKEN_ADDRESS> <addr1:amount1> [addr2:amount2] ..."
    echo ""
    echo "Examples:"
    echo "  scripts/spraay-build.sh ETH 0xAAA:0.1 0xBBB:0.2"
    echo "  scripts/spraay-build.sh 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 0xAAA:100 0xBBB:50"
    exit 0
fi

TOKEN="$1"
shift

echo "{"
echo "  \"to\": \"${SPRAY_CONTRACT}\","
echo "  \"chainId\": ${CHAIN_ID},"

if [ "$TOKEN" = "ETH" ] || [ "$TOKEN" = "eth" ]; then
    echo "  \"function\": \"sprayETH\","
else
    echo "  \"function\": \"sprayToken\","
    echo "  \"token\": \"${TOKEN}\","
fi

echo "  \"recipients\": ["
FIRST=true
TOTAL="0"
for PAIR in "$@"; do
    ADDR=$(echo "$PAIR" | cut -d: -f1)
    AMT=$(echo "$PAIR" | cut -d: -f2)

    if [ "$FIRST" = true ]; then
        FIRST=false
    else
        echo ","
    fi
    printf "    {\"recipient\": \"%s\", \"amount\": \"%s\"}" "$ADDR" "$AMT"
done
echo ""
echo "  ],"
echo "  \"protocolFee\": \"0.3%\","
echo "  \"note\": \"Submit this via Bankr arbitrary transaction or sign directly\""
echo "}"
