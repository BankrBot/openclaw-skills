#!/bin/bash
# ERC-8004 - Register agent with on-chain data URI (no external hosting)
# Usage: ./register-onchain.sh [--testnet]
#
# Creates a base64-encoded data URI so the entire registration is on-chain.
# No IPFS or HTTP hosting required!
#
# Environment variables:
#   AGENT_NAME        - Agent display name
#   AGENT_DESCRIPTION - Agent description
#   AGENT_IMAGE       - Avatar URL (optional)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Require Bankr CLI
if ! command -v bankr >/dev/null 2>&1; then
  echo "Error: Bankr CLI not found. Install with: bun install -g @bankr/cli" >&2
  exit 1
fi

# Require jq
if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq not found. Install with: apt-get install jq" >&2
  exit 1
fi

# Check for testnet flag
if [ "${1:-}" = "--testnet" ] || [ "${1:-}" = "-t" ]; then
  CHAIN="sepolia"
  CHAIN_ID=11155111
  IDENTITY_REGISTRY="0x8004A818BFB912233c491871b3d84c89A494BD9e"
  EXPLORER="sepolia.etherscan.io"
  echo "=== TESTNET MODE (Sepolia) ===" >&2
else
  CHAIN="ethereum"
  CHAIN_ID=1
  IDENTITY_REGISTRY="0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
  EXPLORER="etherscan.io"
  echo "=== MAINNET MODE ===" >&2
fi

# Temp file with guaranteed cleanup
REG_FILE="/tmp/agent-reg-$$.json"
trap 'rm -f "$REG_FILE"' EXIT

# Create registration file
"$SCRIPT_DIR/create-registration.sh" "$REG_FILE" >/dev/null

# Read and base64 encode — use -w 0 to disable line wrapping
BASE64_CONTENT=$(base64 -w 0 < "$REG_FILE")
DATA_URI="data:application/json;base64,$BASE64_CONTENT"

echo "" >&2
echo "Chain: $CHAIN (ID: $CHAIN_ID)" >&2
echo "Data URI length: ${#DATA_URI} bytes" >&2
echo "Note: Larger calldata = higher gas cost vs IPFS/HTTP" >&2
echo "" >&2

# Encode register(string) calldata safely — URI passed via env, never shell-interpolated
CALLDATA=$(AGENT_URI="$DATA_URI" node -e "
const uri = process.env.AGENT_URI;
if (!uri) { process.stderr.write('Error: AGENT_URI not set\n'); process.exit(1); }
const selector = '0xf2c298be';
const offset = '0000000000000000000000000000000000000000000000000000000000000020';
const encoded = Buffer.from(uri, 'utf8');
const len = encoded.length.toString(16).padStart(64, '0');
const data = encoded.toString('hex').padEnd(Math.ceil(encoded.length / 32) * 64, '0');
process.stdout.write(selector + offset + len + data + '\n');
")

echo "Registering on-chain (data URI)..." >&2

# Build the transaction payload safely with jq
TX_PAYLOAD=$(jq -n \
  --arg to "$IDENTITY_REGISTRY" \
  --arg data "$CALLDATA" \
  --argjson chainId "$CHAIN_ID" \
  '{"to": $to, "data": $data, "value": "0", "chainId": $chainId}')

# Submit via Bankr
RESULT=$(bankr agent "Submit this transaction on $CHAIN: $TX_PAYLOAD" 2>/dev/null)

if echo "$RESULT" | grep -qE "$EXPLORER/tx/0x[a-fA-F0-9]{64}"; then
  TX_HASH=$(echo "$RESULT" | grep -oE "$EXPLORER/tx/0x[a-fA-F0-9]{64}" | grep -oE '0x[a-fA-F0-9]{64}' | head -1)

  echo "" >&2
  echo "=== REGISTRATION SUCCESSFUL! ===" >&2
  echo "TX: https://$EXPLORER/tx/$TX_HASH" >&2
  echo "Data is fully on-chain!" >&2
  echo "" >&2

  jq -n \
    --arg chain "$CHAIN" \
    --argjson dataUri true \
    --arg tx "$TX_HASH" \
    '{"success": true, "chain": $chain, "dataUri": $dataUri, "tx": $tx}'
else
  echo "Registration submitted. Result:" >&2
  echo "$RESULT" >&2
fi
