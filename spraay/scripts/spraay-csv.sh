#!/bin/bash
# spraay-csv.sh — Parse a CSV file and submit a batch spray via Bankr
# Usage: scripts/spraay-csv.sh <ETH|TOKEN_ADDRESS> /path/to/recipients.csv
# CSV format: address,amount

set -euo pipefail

SKILL_DIR="${HOME}/.clawdbot/skills/spraay"
CONFIG_FILE="${SKILL_DIR}/config.json"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: Config file not found at ${CONFIG_FILE}"
    exit 1
fi

if [ $# -lt 2 ]; then
    echo "Usage: scripts/spraay-csv.sh <ETH|TOKEN_ADDRESS> /path/to/recipients.csv"
    echo ""
    echo "CSV format:"
    echo "  address,amount"
    echo "  0xAAA...,0.5"
    echo "  0xBBB...,0.2"
    exit 0
fi

TOKEN="$1"
CSV_FILE="$2"

if [ ! -f "$CSV_FILE" ]; then
    echo "Error: CSV file not found: ${CSV_FILE}"
    exit 1
fi

# Parse CSV, skip header
RECIPIENTS=""
COUNT=0
TOTAL="0"

while IFS=',' read -r ADDR AMT; do
    # Skip header
    if [ "$ADDR" = "address" ]; then
        continue
    fi

    # Trim whitespace
    ADDR=$(echo "$ADDR" | xargs)
    AMT=$(echo "$AMT" | xargs)

    # Validate address format
    if [[ ! "$ADDR" =~ ^0x[0-9a-fA-F]{40}$ ]]; then
        echo "Warning: Skipping invalid address: ${ADDR}"
        continue
    fi

    if [ -n "$RECIPIENTS" ]; then
        RECIPIENTS="${RECIPIENTS}, "
    fi
    RECIPIENTS="${RECIPIENTS}${AMT} to ${ADDR}"
    COUNT=$((COUNT + 1))
done < "$CSV_FILE"

if [ $COUNT -eq 0 ]; then
    echo "Error: No valid recipients found in CSV"
    exit 1
fi

echo "Parsed ${COUNT} recipients from CSV"
echo "Submitting batch spray..."

if [ "$TOKEN" = "ETH" ] || [ "$TOKEN" = "eth" ]; then
    PROMPT="Spray ETH on Base: ${RECIPIENTS}"
else
    PROMPT="Spray token ${TOKEN} on Base: ${RECIPIENTS}"
fi

# Pass to main spraay script
exec "$(dirname "$0")/spraay.sh" "$PROMPT"
