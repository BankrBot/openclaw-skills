#!/bin/bash
# Super Bowl Squares - Claim a box in a contest
# Usage: ./claim-box.sh <contest_id> [box_number]
# If box_number is omitted, finds first available box

set -e

CONTEST_ID="${1:?Usage: claim-box.sh <contest_id> [box_number]}"
BOX_NUMBER="${2:-}"

# If box_number is 0-99, convert to full token ID (contestId * 100 + box)
if [[ -n "$BOX_NUMBER" ]] && [[ "$BOX_NUMBER" -lt 100 ]]; then
  BOX_NUMBER=$((CONTEST_ID * 100 + BOX_NUMBER))
fi

SQUARES_CONTRACT="0x55d8F49307192e501d9813fC4d116a79f66cffae"
BOXES_NFT="0x7b02f27E6946b77F046468661bF0770C910d72Ef"
RPC_URL="https://mainnet.base.org"

# Ensure js-sha3 is available for keccak256
if ! node -e "require('js-sha3')" 2>/dev/null; then
  echo "Installing js-sha3..." >&2
  cd /tmp && npm install --silent js-sha3 2>/dev/null
fi

# Helper: keccak256 function selector
keccak_selector() {
  node -e "const{keccak256}=require('js-sha3');console.log('0x'+keccak256('$1').slice(0,8));"
}

# Helper: RPC call with retry for rate limits
rpc_call() {
  local to="$1" data="$2"
  local retries=3
  local result
  
  for ((i=1; i<=retries; i++)); do
    result=$(curl -s "$RPC_URL" -X POST -H "Content-Type: application/json" \
      -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_call\",\"params\":[{\"to\":\"$to\",\"data\":\"$data\"},\"latest\"],\"id\":1}" \
      | node -e "const r=require('fs').readFileSync(0,'utf8');const j=JSON.parse(r);
        if(j.result) console.log(j.result);
        else if(j.error?.message?.includes('rate limit')) console.log('RATELIMIT');
        else if(j.error?.message?.includes('invalid token')) console.log('UNMINTED');
        else console.log('ERROR:'+JSON.stringify(j.error));" 2>/dev/null)
    
    if [[ "$result" == "RATELIMIT" ]]; then
      sleep 1
      continue
    fi
    echo "$result"
    return
  done
  echo "ERROR:rate_limit_exceeded"
}

echo "=== Super Bowl Squares - Contest $CONTEST_ID ===" >&2

# Step 1: Get contest data
echo "Fetching contest data..." >&2
CONTEST_HEX=$(printf '%064x' "$CONTEST_ID")
CONTEST_DATA=$(rpc_call "$SQUARES_CONTRACT" "0xb73d2b63$CONTEST_HEX")

if [[ "$CONTEST_DATA" == ERROR* ]]; then
  echo "Error fetching contest: $CONTEST_DATA" >&2
  exit 1
fi

# Parse entry fee token and amount from contest data
# ContestView struct after offset word: id(1), gameId(2), creator(3), rows_offset(4), cols_offset(5), boxCost.currency(6), boxCost.amount(7)
# Slot 7 = entry token (chars 3 + 64*6 to 3 + 64*7 - 1, accounting for 0x prefix)
# Slot 8 = entry amount
ENTRY_TOKEN_RAW=$(echo "$CONTEST_DATA" | cut -c$((3 + 64*6))-$((2 + 64*7)))
ENTRY_TOKEN="0x$(echo "$ENTRY_TOKEN_RAW" | grep -oE '[0-9a-fA-F]{40}$')"
ENTRY_AMOUNT_HEX=$(echo "$CONTEST_DATA" | cut -c$((3 + 64*7))-$((2 + 64*8)))
ENTRY_AMOUNT=$(node -e "console.log(BigInt('0x$ENTRY_AMOUNT_HEX').toString())")

echo "Entry token: $ENTRY_TOKEN" >&2
echo "Entry amount: $ENTRY_AMOUNT (raw wei)" >&2

# Step 2: Find available box
BOX_START=$((CONTEST_ID * 100))
BOX_END=$((BOX_START + 99))

# Lowercase the squares contract for comparison
SQUARES_CONTRACT_LOWER="${SQUARES_CONTRACT,,}"

# Helper to check if box is available
is_box_available() {
  local owner="$1"
  # Available if: unminted, owned by squares contract, or error indicating unminted
  [[ "$owner" == "UNMINTED" ]] || \
  [[ "${owner,,}" == *"${SQUARES_CONTRACT_LOWER:2}"* ]] || \
  [[ "$owner" == ERROR*"invalid token"* ]]
}

if [[ -z "$BOX_NUMBER" ]]; then
  echo "Finding available box in range $BOX_START-$BOX_END..." >&2
  for i in $(seq $BOX_START $BOX_END); do
    BOX_HEX=$(printf '%064x' "$i")
    OWNER=$(rpc_call "$BOXES_NFT" "0x6352211e$BOX_HEX")
    
    # Skip on rate limit errors - don't treat as available
    if [[ "$OWNER" == *"rate_limit"* ]] || [[ "$OWNER" == "RATELIMIT" ]]; then
      echo "Rate limited, waiting..." >&2
      sleep 2
      OWNER=$(rpc_call "$BOXES_NFT" "0x6352211e$BOX_HEX")
    fi
    
    if is_box_available "$OWNER"; then
      BOX_NUMBER=$i
      echo "Found available box: $BOX_NUMBER" >&2
      break
    fi
    
    # Small delay to avoid rate limits
    sleep 0.1
  done
  
  if [[ -z "$BOX_NUMBER" ]]; then
    echo "No available boxes in contest $CONTEST_ID - checking OpenSea for secondary listings..." >&2
    
    # Try to find OpenSea listings
    SCRIPT_DIR="$(dirname "$0")"
    if [[ -x "$SCRIPT_DIR/check-opensea-listings.sh" ]]; then
      "$SCRIPT_DIR/check-opensea-listings.sh" "$CONTEST_ID"
    else
      echo "OpenSea check script not found. Run check-opensea-listings.sh manually." >&2
    fi
    exit 1
  fi
else
  # Verify requested box is available
  BOX_HEX=$(printf '%064x' "$BOX_NUMBER")
  OWNER=$(rpc_call "$BOXES_NFT" "0x6352211e$BOX_HEX")
  
  if ! is_box_available "$OWNER"; then
    OWNER_ADDR="0x$(echo "$OWNER" | cut -c27-66)"
    echo "Box $BOX_NUMBER already claimed by $OWNER_ADDR" >&2
    exit 1
  fi
fi

echo "Will claim box: $BOX_NUMBER" >&2

# Step 3: Get wallet address from Bankr
echo "Getting wallet address..." >&2
WALLET=$(~/clawd/skills/bankr/scripts/bankr.sh "What is my wallet address on Base?" 2>/dev/null | grep -oE '0x[a-fA-F0-9]{40}' | head -1)
if [[ -z "$WALLET" ]]; then
  echo "Could not determine wallet address" >&2
  exit 1
fi
echo "Wallet: $WALLET" >&2

# Step 4: Approve entry token
echo "Approving $ENTRY_AMOUNT tokens to Squares contract..." >&2
SPENDER_PADDED=$(echo "${SQUARES_CONTRACT:2}" | tr '[:upper:]' '[:lower:]')
SPENDER_PADDED=$(printf '%064s' "$SPENDER_PADDED" | tr ' ' '0')
AMOUNT_PADDED=$(node -e "console.log(BigInt('$ENTRY_AMOUNT').toString(16).padStart(64,'0'))")
APPROVE_DATA="0x095ea7b3${SPENDER_PADDED}${AMOUNT_PADDED}"

APPROVE_TX=$(~/clawd/skills/bankr/scripts/bankr.sh "Submit this transaction: {\"to\": \"$ENTRY_TOKEN\", \"data\": \"$APPROVE_DATA\", \"value\": \"0\", \"chainId\": 8453}" 2>/dev/null)
echo "$APPROVE_TX" | grep -q "basescan.org" && echo "Approval submitted!" >&2 || { echo "Approval failed: $APPROVE_TX" >&2; exit 1; }

sleep 2

# Step 5: Claim the box
echo "Claiming box $BOX_NUMBER..." >&2
WALLET_PADDED=$(echo "${WALLET:2}" | tr '[:upper:]' '[:lower:]')
WALLET_PADDED=$(printf '%064s' "$WALLET_PADDED" | tr ' ' '0')
BOX_HEX=$(node -e "console.log(($BOX_NUMBER).toString(16).padStart(64,'0'))")

# claimBoxes(uint256[],address) selector = 0x92a54cac
# Array offset (0x40), wallet, array length (1), box id
CLAIM_DATA="0x92a54cac0000000000000000000000000000000000000000000000000000000000000040${WALLET_PADDED}0000000000000000000000000000000000000000000000000000000000000001${BOX_HEX}"

CLAIM_TX=$(~/clawd/skills/bankr/scripts/bankr.sh "Submit this transaction: {\"to\": \"$SQUARES_CONTRACT\", \"data\": \"$CLAIM_DATA\", \"value\": \"0\", \"chainId\": 8453}" 2>/dev/null)

if echo "$CLAIM_TX" | grep -q "basescan.org"; then
  # Extract TX hash from the basescan URL in the response
  TX_HASH=$(echo "$CLAIM_TX" | grep -oE 'basescan.org/tx/0x[a-fA-F0-9]{64}' | grep -oE '0x[a-fA-F0-9]{64}')
  echo "=== SUCCESS ===" >&2
  echo "Claimed box $BOX_NUMBER in contest $CONTEST_ID" >&2
  echo "TX: https://basescan.org/tx/$TX_HASH" >&2
  echo "{\"success\":true,\"contestId\":$CONTEST_ID,\"boxNumber\":$BOX_NUMBER,\"tx\":\"$TX_HASH\"}"
else
  echo "Claim failed: $CLAIM_TX" >&2
  exit 1
fi
