#!/bin/bash
# ERC-8004 - Update agent profile URI
# Usage: ./update-profile.sh <agent-id> <new-uri> [--testnet]
# Example: ./update-profile.sh 123 ipfs://QmXxx...

set -euo pipefail

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

AGENT_ID="${1:?Usage: update-profile.sh <agent-id> <new-uri> [--testnet]}"
NEW_URI="${2:?Usage: update-profile.sh <agent-id> <new-uri> [--testnet]}"

# Validate agent ID is a non-negative integer
if ! [[ "$AGENT_ID" =~ ^[0-9]+$ ]]; then
  echo "Error: agent-id must be a non-negative integer" >&2
  exit 1
fi

# Validate URI scheme
if [[ ! "$NEW_URI" =~ ^(ipfs|https?|data): ]]; then
  echo "Error: new-uri must start with ipfs://, http://, https://, or data:" >&2
  exit 1
fi

# Check for testnet flag
if [ "${3:-}" = "--testnet" ] || [ "${3:-}" = "-t" ]; then
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

echo "" >&2
echo "Agent ID: $AGENT_ID" >&2
echo "New URI: $NEW_URI" >&2
echo "Chain: $CHAIN" >&2
echo "" >&2

# Encode setAgentURI(uint256,string) calldata safely via Node
# Agent ID and URI passed via env to avoid shell injection
CALLDATA=$(AGENT_ID_VAL="$AGENT_ID" AGENT_URI="$NEW_URI" node -e "
const agentId = BigInt(process.env.AGENT_ID_VAL);
const uri = process.env.AGENT_URI;
if (!uri) { process.stderr.write('Error: AGENT_URI not set\n'); process.exit(1); }

const selector = '0x862440e2';
const id = agentId.toString(16).padStart(64, '0');
// String offset: 0x40 = 64 bytes from start of params (after the uint256)
const offset = '0000000000000000000000000000000000000000000000000000000000000040';
const encoded = Buffer.from(uri, 'utf8');
const len = encoded.length.toString(16).padStart(64, '0');
const data = encoded.toString('hex').padEnd(Math.ceil(encoded.length / 32) * 64, '0');
process.stdout.write(selector + id + offset + len + data + '\n');
")

echo "Calldata: $CALLDATA" >&2

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

  echo "=== SUCCESS ===" >&2
  echo "Agent $AGENT_ID profile updated!" >&2
  echo "New URI: $NEW_URI" >&2
  echo "TX: https://$EXPLORER/tx/$TX_HASH" >&2

  jq -n \
    --arg agentId "$AGENT_ID" \
    --arg newUri "$NEW_URI" \
    --arg tx "$TX_HASH" \
    '{"success": true, "agentId": $agentId, "newUri": $newUri, "tx": $tx}'
else
  echo "Update submitted. Check transaction status:" >&2
  echo "$RESULT" >&2
  exit 1
fi
