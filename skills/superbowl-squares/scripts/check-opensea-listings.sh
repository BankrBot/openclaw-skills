#!/bin/bash
# Super Bowl Squares - Check OpenSea listings when boxes are sold out
# Usage: ./check-opensea-listings.sh <contest_id>

set -e

CONTEST_ID="${1:?Usage: check-opensea-listings.sh <contest_id>}"

SQUARES_CONTRACT="0x55d8F49307192e501d9813fC4d116a79f66cffae"
BOXES_NFT="0x7b02f27E6946b77F046468661bF0770C910d72Ef"
COLLECTION_SLUG="super-bowl-squares-onchain"
SEAPORT_ADDRESS="0x0000000000000068f116a894984e2db1123eb395"
RPC_URL="https://mainnet.base.org"
OPENSEA_SKILL_DIR="$HOME/clawd/skills/opensea"

# Check OpenSea API key
if [[ -z "${OPENSEA_API_KEY:-}" ]]; then
  echo "Error: OPENSEA_API_KEY not set" >&2
  exit 1
fi

# Helper: RPC call
rpc_call() {
  local to="$1" data="$2"
  curl -s "$RPC_URL" -X POST -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_call\",\"params\":[{\"to\":\"$to\",\"data\":\"$data\"},\"latest\"],\"id\":1}" \
    | node -e "const r=require('fs').readFileSync(0,'utf8');const j=JSON.parse(r);
      if(j.result) console.log(j.result);
      else console.log('ERROR');" 2>/dev/null
}

# Check if order is valid via Seaport getOrderStatus
# Returns "VALID" or "INVALID"
check_order_status() {
  local order_hash="$1"
  # getOrderStatus(bytes32) selector = 0x46423aa7
  local data="0x46423aa7${order_hash:2}"  # Remove 0x from hash, selector already has it
  
  local result=$(rpc_call "$SEAPORT_ADDRESS" "$data")
  
  if [[ "$result" == "ERROR" ]] || [[ -z "$result" ]]; then
    echo "UNKNOWN"
    return
  fi
  
  # Parse result: (bool isValidated, bool isCancelled, uint256 totalFilled, uint256 totalSize)
  # Each bool/uint256 is 32 bytes (64 hex chars)
  # isValidated: bytes 0-64, isCancelled: bytes 64-128, totalFilled: 128-192, totalSize: 192-256
  node -e "
    const hex = '${result}'.slice(2); // Remove 0x
    if (hex.length < 256) { console.log('UNKNOWN'); process.exit(0); }
    
    const isCancelled = parseInt(hex.slice(64, 128), 16) !== 0;
    const totalFilled = BigInt('0x' + hex.slice(128, 192));
    const totalSize = BigInt('0x' + hex.slice(192, 256));
    const isFullyFilled = totalSize > 0n && totalFilled >= totalSize;
    
    if (isCancelled || isFullyFilled) {
      console.log('INVALID');
    } else {
      console.log('VALID');
    }
  " 2>/dev/null
}

# Get ETH price in USD
get_eth_price() {
  # Use CoinGecko simple price
  local price=$(curl -s "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd" | \
    node -e "const r=require('fs').readFileSync(0,'utf8');try{console.log(JSON.parse(r).ethereum.usd)}catch{console.log('3000')}")
  echo "${price:-3000}"
}

echo "=== Checking OpenSea listings for Contest $CONTEST_ID ===" >&2

# First, get contest row/col values (team scores)
echo "Fetching contest data..." >&2
CONTEST_HEX=$(printf '%064x' "$CONTEST_ID")
CONTEST_DATA=$(rpc_call "$SQUARES_CONTRACT" "0xb73d2b63$CONTEST_HEX")

# Parse rows and cols arrays from contest data if available
# This is complex due to dynamic array encoding - we'll get it from the contract view
# For now, we'll query individual box data if we find listings

# Check OpenSea for listings of boxes in this contest
BOX_START=$((CONTEST_ID * 100))
BOX_END=$((BOX_START + 99))

echo "Querying OpenSea for listed boxes in range $BOX_START-$BOX_END..." >&2

# Use OpenSea collection listings endpoint, then filter by on-chain order status
LISTINGS_JSON=$(curl -s "https://api.opensea.io/api/v2/listings/collection/$COLLECTION_SLUG/all?limit=100" \
  -H "X-API-KEY: $OPENSEA_API_KEY" \
  -H "Accept: application/json")

# Check if we got valid response
if echo "$LISTINGS_JSON" | grep -qE '"listings"'; then
  ETH_PRICE=$(get_eth_price)
  
  # First pass: extract listings in our contest range
  CANDIDATE_LISTINGS=$(echo "$LISTINGS_JSON" | node -e "
    const data = JSON.parse(require('fs').readFileSync(0, 'utf8'));
    const contestStart = $BOX_START;
    const contestEnd = $BOX_END;
    
    const rawListings = data.listings || [];
    
    const listings = rawListings.filter(listing => {
      const tokenId = parseInt(
        listing.protocol_data?.parameters?.offer?.[0]?.identifierOrCriteria || '0'
      );
      return tokenId >= contestStart && tokenId <= contestEnd;
    });
    
    // Output each listing's order_hash for status checking
    listings.forEach(listing => {
      const tokenId = parseInt(listing.protocol_data?.parameters?.offer?.[0]?.identifierOrCriteria || '0');
      const priceWei = listing.price?.current?.value || '0';
      console.log(JSON.stringify({
        tokenId,
        priceWei,
        orderHash: listing.order_hash
      }));
    });
  " 2>/dev/null)
  
  if [[ -z "$CANDIDATE_LISTINGS" ]]; then
    echo "No boxes from contest $CONTEST_ID are listed on OpenSea" >&2
    echo '{"found":false,"listings":[]}'
    exit 0
  fi
  
  # Second pass: check each order's on-chain status
  echo "Checking on-chain order status..." >&2
  VALID_LISTINGS=""
  
  while IFS= read -r listing; do
    ORDER_HASH=$(echo "$listing" | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).orderHash)" 2>/dev/null)
    
    if [[ -n "$ORDER_HASH" ]]; then
      STATUS=$(check_order_status "$ORDER_HASH")
      echo "  Order $ORDER_HASH: $STATUS" >&2
      
      if [[ "$STATUS" == "VALID" ]] || [[ "$STATUS" == "UNKNOWN" ]]; then
        # Include UNKNOWN as potentially valid (rate limit issue)
        VALID_LISTINGS="${VALID_LISTINGS}${listing}"$'\n'
      fi
      
      # Small delay to avoid rate limits
      sleep 0.3
    fi
  done <<< "$CANDIDATE_LISTINGS"
  
  # Format valid listings for output
  if [[ -z "$VALID_LISTINGS" ]]; then
    echo "No active (non-cancelled) listings found" >&2
    echo '{"found":false,"listings":[]}'
    exit 0
  fi
  
  FOUND_LISTINGS=$(echo "$VALID_LISTINGS" | node -e "
    const lines = require('fs').readFileSync(0, 'utf8').trim().split('\n').filter(l => l);
    const ethPrice = $ETH_PRICE;
    
    if (lines.length === 0) {
      console.log('NO_LISTINGS');
    } else {
      lines.forEach(line => {
        try {
          const item = JSON.parse(line);
          const tokenId = item.tokenId;
          const boxNum = tokenId % 100;
          const row = Math.floor(boxNum / 10);
          const col = boxNum % 10;
          
          const priceEthFloat = Number(item.priceWei) / 1e18;
          const priceUsd = (priceEthFloat * ethPrice).toFixed(2);
          
          console.log(JSON.stringify({
            tokenId,
            boxNum,
            row,
            col,
            priceEth: priceEthFloat.toFixed(6),
            priceUsd,
            orderHash: item.orderHash
          }));
        } catch(e) {}
      });
    }
  " 2>/dev/null)
  
  if [[ "$FOUND_LISTINGS" == "NO_LISTINGS" ]]; then
    echo "No boxes from contest $CONTEST_ID are listed on OpenSea" >&2
    echo '{"found":false,"listings":[]}'
  else
    echo "Found listings!" >&2
    # Output as JSON array
    echo "{\"found\":true,\"ethPrice\":$ETH_PRICE,\"listings\":["
    echo "$FOUND_LISTINGS" | paste -sd, -
    echo "]}"
  fi
else
  echo "Error querying OpenSea or no listings found" >&2
  echo "$LISTINGS_JSON" >&2
  echo '{"found":false,"error":"api_error","listings":[]}'
fi
