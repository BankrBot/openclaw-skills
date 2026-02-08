#!/bin/bash
# spraay.sh — Main entry point for Spraay batch payments via Bankr API
# Usage: scripts/spraay.sh "Spray 0.1 ETH each to 0xAAA, 0xBBB, 0xCCC on Base"

set -euo pipefail

SKILL_DIR="${HOME}/.clawdbot/skills/spraay"
CONFIG_FILE="${SKILL_DIR}/config.json"

# Load configuration
if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: Config file not found at ${CONFIG_FILE}"
    echo "Run setup first. See SKILL.md for instructions."
    exit 1
fi

API_KEY=$(jq -r '.bankrApiKey // .apiKey // empty' "$CONFIG_FILE")
API_URL=$(jq -r '.bankrApiUrl // .apiUrl // "https://api.bankr.bot"' "$CONFIG_FILE")
SPRAY_CONTRACT=$(jq -r '.sprayContract // empty' "$CONFIG_FILE")
CHAIN_ID=$(jq -r '.chainId // 8453' "$CONFIG_FILE")

if [ -z "$API_KEY" ]; then
    echo "Error: No API key found in config. Set bankrApiKey in config.json."
    exit 1
fi

if [ -z "$SPRAY_CONTRACT" ]; then
    echo "Error: No Spraay contract address in config. Set sprayContract in config.json."
    exit 1
fi

PROMPT="$*"

if [ -z "$PROMPT" ]; then
    echo "Usage: scripts/spraay.sh \"<your batch payment request>\""
    echo ""
    echo "Examples:"
    echo "  scripts/spraay.sh \"Spray 0.1 ETH each to 0xAAA, 0xBBB, 0xCCC on Base\""
    echo "  scripts/spraay.sh \"Send 50 USDC to 0xAAA, 0xBBB on Base\""
    echo "  scripts/spraay.sh \"Show Spraay contract info\""
    exit 0
fi

# Submit job to Bankr API
echo "Submitting Spraay request..."
SUBMIT_RESPONSE=$(curl -s -X POST "${API_URL}/v1/agent/prompt" \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
        \"prompt\": \"Using the Spraay batch payment contract at ${SPRAY_CONTRACT} on chain ${CHAIN_ID}: ${PROMPT}\",
        \"context\": \"Spraay is a batch payment protocol. For ETH: call sprayETH with recipients array. For ERC-20: approve then call sprayToken. Protocol fee is 0.3%. Submit as arbitrary transaction.\"
    }")

JOB_ID=$(echo "$SUBMIT_RESPONSE" | jq -r '.jobId // .id // empty')

if [ -z "$JOB_ID" ]; then
    echo "Error submitting request:"
    echo "$SUBMIT_RESPONSE" | jq .
    exit 1
fi

echo "Job submitted: ${JOB_ID}"

# Poll for completion
MAX_ATTEMPTS=60
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    sleep 2
    ATTEMPT=$((ATTEMPT + 1))

    STATUS_RESPONSE=$(curl -s -X GET "${API_URL}/v1/agent/job/${JOB_ID}" \
        -H "Authorization: Bearer ${API_KEY}")

    STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status // "unknown"')

    case "$STATUS" in
        "completed"|"done"|"success")
            echo ""
            echo "✅ Spraay Complete!"
            echo "$STATUS_RESPONSE" | jq -r '.result // .response // .message // .'
            exit 0
            ;;
        "failed"|"error")
            echo ""
            echo "❌ Spraay Failed:"
            echo "$STATUS_RESPONSE" | jq -r '.error // .message // .'
            exit 1
            ;;
        "pending"|"processing"|"running")
            printf "."
            ;;
        *)
            printf "."
            ;;
    esac
done

echo ""
echo "⏰ Job timed out. Check status manually:"
echo "  Job ID: ${JOB_ID}"
exit 1
