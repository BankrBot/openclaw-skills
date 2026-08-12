#!/bin/bash
# Get swap quote from SwapAPI

set -e

CHAIN_ID=$1
TOKEN_IN=$2
TOKEN_OUT=$3
AMOUNT=$4
SENDER=$5

if [ -z "$CHAIN_ID" ] || [ -z "$TOKEN_IN" ] || [ -z "$TOKEN_OUT" ] || [ -z "$AMOUNT" ] || [ -z "$SENDER" ]; then
    echo "Usage: $0 <chainId> <tokenIn> <tokenOut> <amount> <sender>"
    echo "Example: $0 8453 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 1000000000000000 0xYourAddress"
    exit 1
fi

curl -s "https://api.swapapi.dev/v1/swap/${CHAIN_ID}?tokenIn=${TOKEN_IN}&tokenOut=${TOKEN_OUT}&amount=${AMOUNT}&sender=${SENDER}" | jq .
