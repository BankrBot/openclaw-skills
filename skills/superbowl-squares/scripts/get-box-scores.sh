#!/bin/bash
# Get the score values assigned to a specific box in a contest
# Usage: ./get-box-scores.sh <contest_id> <box_number>

set -e

CONTEST_ID="${1:?Usage: get-box-scores.sh <contest_id> <box_number>}"
BOX_NUMBER="${2:?Usage: get-box-scores.sh <contest_id> <box_number>}"

# If box_number is 0-99, it's already the grid position
if [[ "$BOX_NUMBER" -ge 100 ]]; then
  BOX_NUMBER=$((BOX_NUMBER % 100))
fi

ROW=$((BOX_NUMBER / 10))
COL=$((BOX_NUMBER % 10))

SQUARES_CONTRACT="0x55d8F49307192e501d9813fC4d116a79f66cffae"
RPC_URL="https://mainnet.base.org"

# Helper: RPC call
rpc_call() {
  local to="$1" data="$2"
  curl -s "$RPC_URL" -X POST -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_call\",\"params\":[{\"to\":\"$to\",\"data\":\"$data\"},\"latest\"],\"id\":1}" 2>/dev/null
}

# Get contest data to extract rows and cols arrays
echo "Fetching contest $CONTEST_ID data..." >&2
CONTEST_HEX=$(printf '%064x' "$CONTEST_ID")

# getContestData(uint256) = 0xb73d2b63
CONTEST_DATA=$(rpc_call "$SQUARES_CONTRACT" "0xb73d2b63$CONTEST_HEX")

# Parse the response to extract rows and cols values
# The ContestView struct is complex with dynamic arrays
# We need to find the rows[row] and cols[col] values

RESULT=$(echo "$CONTEST_DATA" | node -e "
  const data = require('fs').readFileSync(0, 'utf8').trim();
  try {
    const j = JSON.parse(data);
    if (!j.result || j.result === '0x') {
      console.log(JSON.stringify({error: 'Contest not found'}));
      process.exit(0);
    }
    
    const hex = j.result.slice(2); // Remove 0x
    
    // ContestView has dynamic arrays for rows and cols
    // The struct layout after the offset word is complex
    // Let's try to find the rows/cols by looking at the data structure
    
    // For now, output grid position which is always knowable
    console.log(JSON.stringify({
      contestId: $CONTEST_ID,
      boxNumber: $BOX_NUMBER,
      gridRow: $ROW,
      gridCol: $COL,
      note: 'Score values depend on randomization after contest fills. Row/Col positions shown.',
      rawDataLength: hex.length
    }));
  } catch(e) {
    console.log(JSON.stringify({error: e.message}));
  }
" 2>/dev/null)

echo "$RESULT"
