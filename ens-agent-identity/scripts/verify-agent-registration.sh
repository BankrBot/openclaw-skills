#!/bin/bash
# ENS Agent Identity - Verify ENSIP-25 link between ENS name and ERC-8004 identity
# Usage: ./verify-agent-registration.sh <ens-name> <agent-id> [chain]
# Example: ./verify-agent-registration.sh alpha-go.bankr.eth 42 base

set -e

ENS_NAME="${1:?Usage: verify-agent-registration.sh <ens-name> <agent-id> [chain]}"
AGENT_ID="${2:?Usage: verify-agent-registration.sh <ens-name> <agent-id> [chain]}"
CHAIN="${3:-base}"

# Validate AGENT_ID is a positive integer
if ! [[ "$AGENT_ID" =~ ^[0-9]+$ ]]; then
  echo "Error: agent-id must be a positive integer, got: $AGENT_ID" >&2
  exit 1
fi

# Chain configuration (RPC, explorer, ERC-7930 prefix, registry address)
case "$CHAIN" in
  base)
    CHAIN_ID=8453
    RPC_URL="https://mainnet.base.org"
    EXPLORER="basescan.org"
    ERC7930_PREFIX="0x0001000002210514"
    IDENTITY_REGISTRY="${ERC8004_REGISTRY:-0x8004A169FB4a3325136EB29fA0ceB6D2e539a432}"
    ;;
  ethereum|mainnet)
    CHAIN_ID=1
    RPC_URL="https://eth.drpc.org"
    EXPLORER="etherscan.io"
    ERC7930_PREFIX="0x00010000010114"
    IDENTITY_REGISTRY="${ERC8004_REGISTRY:-0x8004A169FB4a3325136EB29fA0ceB6D2e539a432}"
    ;;
  sepolia)
    CHAIN_ID=11155111
    RPC_URL="https://rpc.sepolia.org"
    EXPLORER="sepolia.etherscan.io"
    ERC7930_PREFIX="0x0001000003AA36A714"
    IDENTITY_REGISTRY="${ERC8004_REGISTRY:-0x8004A818BFB912233c491871b3d84c89A494BD9e}"
    ;;
  *)
    echo "Unsupported chain: $CHAIN" >&2
    echo "Supported: base, ethereum, sepolia" >&2
    exit 1
    ;;
esac

echo "=== ENSIP-25 Verification ===" >&2
echo "ENS Name: $ENS_NAME" >&2
echo "Agent ID: $AGENT_ID" >&2
echo "Chain: $CHAIN (ID: $CHAIN_ID)" >&2
if [ -n "$IDENTITY_REGISTRY" ]; then
  echo "Registry: $IDENTITY_REGISTRY" >&2
fi
echo "" >&2

# Step 1: Resolve ENS name to address
echo "Step 1: Resolving ENS name..." >&2

RESOLVED_ADDR=$(ENS_NAME="$ENS_NAME" node -e "
const { createPublicClient, http } = require('viem');
const { mainnet } = require('viem/chains');
const { normalize } = require('viem/ens');

const client = createPublicClient({
  chain: mainnet,
  transport: http('https://eth.drpc.org'),
});

(async () => {
  try {
    const address = await client.getEnsAddress({ name: normalize(process.env.ENS_NAME) });
    if (address) console.log(address);
  } catch (e) {
    console.error(e.message);
  }
})();
" 2>/dev/null)

if [ -z "$RESOLVED_ADDR" ]; then
  echo "Could not resolve $ENS_NAME to an address" >&2
  exit 1
fi

echo "Address: $RESOLVED_ADDR" >&2

# Step 2: Check ENSIP-25 text record
echo "" >&2
echo "Step 2: Checking ENSIP-25 verification record..." >&2

ENSIP25_VERIFIED=false
RECORD_VALUE=""

if [ -n "$IDENTITY_REGISTRY" ]; then
  REGISTRY_LOWER=$(echo "$IDENTITY_REGISTRY" | tr '[:upper:]' '[:lower:]')
  ERC7930_ADDR="${ERC7930_PREFIX}${REGISTRY_LOWER#0x}"
  TEXT_RECORD_KEY="agent-registration[${ERC7930_ADDR}][${AGENT_ID}]"

  echo "Text record key: $TEXT_RECORD_KEY" >&2

  RECORD_VALUE=$(ENS_NAME="$ENS_NAME" TEXT_RECORD_KEY="$TEXT_RECORD_KEY" node -e "
const { createPublicClient, http } = require('viem');
const { mainnet } = require('viem/chains');
const { normalize } = require('viem/ens');

const client = createPublicClient({
  chain: mainnet,
  transport: http('https://eth.drpc.org'),
});

(async () => {
  try {
    const value = await client.getEnsText({
      name: normalize(process.env.ENS_NAME),
      key: process.env.TEXT_RECORD_KEY
    });
    if (value) console.log(value);
  } catch {}
})();
" 2>/dev/null)

  if [ -n "$RECORD_VALUE" ]; then
    echo "ENSIP-25 record value: $RECORD_VALUE" >&2
    ENSIP25_VERIFIED=true
  else
    echo "No ENSIP-25 record found" >&2
  fi
else
  echo "No registry address configured for $CHAIN. Set ERC8004_REGISTRY env var." >&2
fi

# Step 3: Check ERC-8004 registry
echo "" >&2
echo "Step 3: Checking ERC-8004 registry..." >&2

ERC8004_VERIFIED=false

if [ -n "$IDENTITY_REGISTRY" ]; then
  # Call tokenURI(uint256) on the Identity Registry (standard ERC-721)
  AGENT_ID_HEX=$(printf '%064x' "$AGENT_ID")
  CALLDATA="0xc87b56dd${AGENT_ID_HEX}"

  REGISTRY_RESULT=$(curl -s --max-time 10 -X POST "$RPC_URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"jsonrpc\": \"2.0\",
      \"id\": 1,
      \"method\": \"eth_call\",
      \"params\": [{
        \"to\": \"$IDENTITY_REGISTRY\",
        \"data\": \"$CALLDATA\"
      }, \"latest\"]
    }" | node -e "
      const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
      if (data.result && data.result !== '0x') {
        const hex = data.result;
        try {
          const length = parseInt(hex.slice(66, 130), 16);
          if (length > 0) {
            const str = Buffer.from(hex.slice(130, 130 + length * 2), 'hex').toString('utf8');
            console.log(str);
          }
        } catch {}
      }
    " 2>/dev/null)

  if [ -n "$REGISTRY_RESULT" ]; then
    echo "ERC-8004 agent URI: $REGISTRY_RESULT" >&2
    ERC8004_VERIFIED=true
  else
    echo "Agent #$AGENT_ID not found in registry" >&2
  fi
else
  echo "Skipped (no registry address)" >&2
fi

# Summary
echo "" >&2
echo "=== Verification Summary ===" >&2
echo "" >&2

echo "ENS Resolution:       $ENS_NAME -> $RESOLVED_ADDR" >&2

if [ "$ENSIP25_VERIFIED" = "true" ]; then
  echo "ENSIP-25 Record:      $TEXT_RECORD_KEY = \"$RECORD_VALUE\"" >&2
else
  echo "ENSIP-25 Record:      Not set" >&2
fi

if [ "$ERC8004_VERIFIED" = "true" ]; then
  echo "ERC-8004 Registry:    Agent #$AGENT_ID found" >&2
else
  echo "ERC-8004 Registry:    Not verified" >&2
fi

echo "" >&2

# Determine overall status
if [ "$ENSIP25_VERIFIED" = "true" ] && [ "$ERC8004_VERIFIED" = "true" ]; then
  VERIFIED="true"
  echo "FULLY VERIFIED: $ENS_NAME is agent #$AGENT_ID" >&2
elif [ "$ENSIP25_VERIFIED" = "true" ] || [ "$ERC8004_VERIFIED" = "true" ]; then
  VERIFIED="partial"
  if [ "$ENSIP25_VERIFIED" = "true" ]; then
    echo "PARTIAL: ENSIP-25 set but ERC-8004 not confirmed" >&2
  else
    echo "PARTIAL: ERC-8004 exists but ENSIP-25 not set" >&2
  fi
else
  VERIFIED="false"
  echo "NOT VERIFIED: No ENSIP-25 or ERC-8004 link found" >&2
fi

# Emit JSON result (all values passed via env vars to prevent injection)
ENS_NAME="$ENS_NAME" RESOLVED_ADDR="$RESOLVED_ADDR" AGENT_ID="$AGENT_ID" \
  VERIFIED="$VERIFIED" ENSIP25="$ENSIP25_VERIFIED" ERC8004="$ERC8004_VERIFIED" \
  node -e "
    console.log(JSON.stringify({
      verified: process.env.VERIFIED === 'true' || process.env.VERIFIED === 'false'
        ? process.env.VERIFIED === 'true'
        : process.env.VERIFIED,
      name: process.env.ENS_NAME,
      address: process.env.RESOLVED_ADDR,
      agentId: parseInt(process.env.AGENT_ID, 10),
      ensip25: process.env.ENSIP25 === 'true',
      erc8004: process.env.ERC8004 === 'true',
    }));
  "
