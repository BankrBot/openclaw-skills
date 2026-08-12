#!/bin/bash
# Interactive swap helper for SwapAPI

set -e

echo "🔄 SwapAPI Swap Helper"
echo ""

# Get user input
read -p "Chain ID (8453=Base, 1=Ethereum, 42161=Arbitrum): " CHAIN_ID
read -p "Token In (0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE for ETH): " TOKEN_IN
read -p "Token Out: " TOKEN_OUT
read -p "Amount (in wei/smallest unit): " AMOUNT
read -p "Sender Address: " SENDER

echo ""
echo "Fetching quote..."
echo ""

RESPONSE=$(curl -s "https://api.swapapi.dev/v1/swap/${CHAIN_ID}?tokenIn=${TOKEN_IN}&tokenOut=${TOKEN_OUT}&amount=${AMOUNT}&sender=${SENDER}")

# Check if successful
if [ "$(echo "$RESPONSE" | jq -r '.success')" != "true" ]; then
    echo "❌ Error:"
    echo "$RESPONSE" | jq .
    exit 1
fi

# Display quote
STATUS=$(echo "$RESPONSE" | jq -r '.data.status')
EXPECTED_OUT=$(echo "$RESPONSE" | jq -r '.data.expectedAmountOut')
MIN_OUT=$(echo "$RESPONSE" | jq -r '.data.minAmountOut')
PRICE_IMPACT=$(echo "$RESPONSE" | jq -r '.data.priceImpact')

echo "✅ Quote received (Status: $STATUS)"
echo "Expected output: $EXPECTED_OUT"
echo "Minimum output: $MIN_OUT"
echo "Price impact: $PRICE_IMPACT"
echo ""

# Display transaction data
TX_TO=$(echo "$RESPONSE" | jq -r '.data.tx.to')
TX_DATA=$(echo "$RESPONSE" | jq -r '.data.tx.data')
TX_VALUE=$(echo "$RESPONSE" | jq -r '.data.tx.value')
TX_GAS=$(echo "$RESPONSE" | jq -r '.data.tx.gas')

echo "Transaction Data:"
echo "  To: $TX_TO"
echo "  Value: $TX_VALUE"
echo "  Gas: $TX_GAS"
echo "  Data: ${TX_DATA:0:50}..."
echo ""

# Save to file
OUTPUT_FILE="/tmp/swap_${CHAIN_ID}_$(date +%s).json"
echo "$RESPONSE" | jq '.data.tx' > "$OUTPUT_FILE"
echo "💾 Transaction saved to: $OUTPUT_FILE"
echo ""
echo "Next steps:"
echo "  1. Review the transaction data"
echo "  2. If tokenIn is ERC-20, ensure approval is set"
echo "  3. Sign and broadcast using cast, viem, or your wallet"
