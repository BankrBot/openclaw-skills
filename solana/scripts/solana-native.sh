#!/bin/bash
# Solana Native Skill CLI
# Usage: solana-native.sh <command> [subcommand] [args]

set -e

# Config
CONFIG_DIR="${HOME}/.clawdbot/skills/solana-native"
CONFIG_FILE="${CONFIG_DIR}/config.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Load config
load_config() {
    if [ -f "$CONFIG_FILE" ]; then
        RPC_URL=$(jq -r '.rpcUrl // "https://api.mainnet-beta.solana.com"' "$CONFIG_FILE")
        KEYPAIR_PATH=$(jq -r '.keypairPath // "~/.config/solana/id.json"' "$CONFIG_FILE")
        KEYPAIR_PATH="${KEYPAIR_PATH/#\~/$HOME}"
    else
        RPC_URL="https://api.mainnet-beta.solana.com"
        KEYPAIR_PATH="$HOME/.config/solana/id.json"
    fi
}

# ============ PRICE COMMANDS ============

price_get() {
    local token="${1:-solana}"
    echo -e "${YELLOW}Fetching price for $token...${NC}"
    
    # Map common names to CoinGecko IDs
    case "$token" in
        sol|SOL|solana) token="solana" ;;
        jup|JUP|jupiter) token="jupiter-exchange-solana" ;;
        bonk|BONK) token="bonk" ;;
        ray|RAY|raydium) token="raydium" ;;
        jto|JTO|jito) token="jito-governance-token" ;;
    esac
    
    result=$(curl -s "https://api.coingecko.com/api/v3/simple/price?ids=${token}&vs_currencies=usd&include_24hr_change=true")
    
    price=$(echo "$result" | jq -r ".\"$token\".usd // \"N/A\"")
    change=$(echo "$result" | jq -r ".\"$token\".usd_24h_change // 0" | xargs printf "%.2f")
    
    echo -e "${GREEN}$token: \$${price} (${change}% 24h)${NC}"
}

price_multi() {
    echo -e "${YELLOW}Fetching Solana ecosystem prices...${NC}"
    curl -s "https://api.coingecko.com/api/v3/simple/price?ids=solana,jupiter-exchange-solana,bonk,raydium,jito-governance-token,marinade,orca&vs_currencies=usd&include_24hr_change=true" | \
    jq -r 'to_entries[] | "\(.key): $\(.value.usd) (\(.value.usd_24h_change | tostring | .[0:5])%)"'
}

# ============ DEXSCREENER COMMANDS ============

dex_token() {
    local address="$1"
    echo -e "${YELLOW}Fetching token data from DexScreener...${NC}"
    
    curl -s "https://api.dexscreener.com/latest/dex/tokens/${address}" | jq '{
        name: .pairs[0].baseToken.name,
        symbol: .pairs[0].baseToken.symbol,
        price: .pairs[0].priceUsd,
        priceChange24h: .pairs[0].priceChange.h24,
        volume24h: .pairs[0].volume.h24,
        liquidity: .pairs[0].liquidity.usd,
        fdv: .pairs[0].fdv,
        pairAddress: .pairs[0].pairAddress,
        dex: .pairs[0].dexId
    }'
}

dex_search() {
    local query="$1"
    echo -e "${YELLOW}Searching DexScreener for: $query${NC}"
    
    curl -s "https://api.dexscreener.com/latest/dex/search?q=${query}" | jq '.pairs[0:5] | .[] | {
        name: .baseToken.name,
        symbol: .baseToken.symbol,
        price: .priceUsd,
        volume24h: .volume.h24,
        chain: .chainId,
        address: .baseToken.address
    }'
}

# ============ PUMP.FUN COMMANDS ============

pumpfun_trending() {
    echo -e "${YELLOW}Fetching trending Pump.fun tokens via DexScreener...${NC}"
    
    # Search for recent pump.fun tokens
    curl -s "https://api.dexscreener.com/latest/dex/search?q=pump" | jq '.pairs | map(select(.chainId == "solana")) | .[0:10] | .[] | {
        name: .baseToken.name,
        symbol: .baseToken.symbol,
        price: .priceUsd,
        volume24h: .volume.h24,
        priceChange: .priceChange.h24,
        address: .baseToken.address
    }'
}

pumpfun_check() {
    local address="$1"
    echo -e "${YELLOW}Checking token: $address${NC}"
    
    # Use DexScreener as pump.fun API is protected
    curl -s "https://api.dexscreener.com/latest/dex/tokens/${address}" | jq '{
        name: .pairs[0].baseToken.name,
        symbol: .pairs[0].baseToken.symbol,
        price: .pairs[0].priceUsd,
        marketCap: .pairs[0].fdv,
        volume24h: .pairs[0].volume.h24,
        liquidity: .pairs[0].liquidity.usd,
        priceChange1h: .pairs[0].priceChange.h1,
        priceChange24h: .pairs[0].priceChange.h24,
        txns24h: (.pairs[0].txns.h24.buys + .pairs[0].txns.h24.sells),
        dex: .pairs[0].dexId,
        url: .pairs[0].url
    }'
}

# ============ JUPITER COMMANDS ============

jupiter_quote() {
    local input_mint="$1"
    local output_mint="$2"
    local amount="$3"
    
    echo -e "${YELLOW}Getting Jupiter quote...${NC}"
    
    # SOL mint
    SOL_MINT="So11111111111111111111111111111111111111112"
    USDC_MINT="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    
    # Default to SOL if not specified
    [ -z "$input_mint" ] && input_mint="$SOL_MINT"
    [ -z "$output_mint" ] && output_mint="$USDC_MINT"
    [ -z "$amount" ] && amount="1000000000"  # 1 SOL in lamports
    
    curl -s "https://quote-api.jup.ag/v6/quote?inputMint=${input_mint}&outputMint=${output_mint}&amount=${amount}&slippageBps=50" | jq '{
        inputAmount: .inAmount,
        outputAmount: .outAmount,
        priceImpact: .priceImpactPct,
        routePlan: [.routePlan[].swapInfo.label]
    }'
}

jupiter_tokens() {
    echo -e "${YELLOW}Fetching Jupiter token list...${NC}"
    curl -s "https://token.jup.ag/strict" | jq '.[0:20] | .[] | {symbol: .symbol, name: .name, address: .address}'
}

# ============ SOLANA RPC COMMANDS ============

solana_balance() {
    local address="$1"
    
    if [ -z "$address" ]; then
        # Try to get from keypair
        if [ -f "$KEYPAIR_PATH" ]; then
            address=$(solana-keygen pubkey "$KEYPAIR_PATH" 2>/dev/null)
        fi
    fi
    
    if [ -z "$address" ]; then
        echo -e "${RED}Error: No address provided and no keypair found${NC}"
        return 1
    fi
    
    echo -e "${YELLOW}Fetching balance for $address...${NC}"
    
    result=$(curl -s "$RPC_URL" -X POST -H "Content-Type: application/json" -d "{
        \"jsonrpc\": \"2.0\",
        \"id\": 1,
        \"method\": \"getBalance\",
        \"params\": [\"$address\"]
    }")
    
    lamports=$(echo "$result" | jq -r '.result.value')
    sol=$(echo "scale=4; $lamports / 1000000000" | bc)
    
    echo -e "${GREEN}Balance: $sol SOL${NC}"
}

solana_slot() {
    echo -e "${YELLOW}Current slot...${NC}"
    curl -s "$RPC_URL" -X POST -H "Content-Type: application/json" -d '{
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getSlot"
    }' | jq '.result'
}

# ============ TENSOR COMMANDS ============

tensor_collections() {
    echo -e "${YELLOW}Note: Tensor API requires authentication for most endpoints${NC}"
    echo "Popular Solana NFT collections:"
    echo "  - mad_lads"
    echo "  - okay_bears" 
    echo "  - degods"
    echo "  - claynosaurz"
    echo "  - tensorians"
    echo ""
    echo "Use: solana-native.sh dex <collection_token_address> for price data"
}

# ============ HELP ============

show_help() {
    cat << 'EOF'
Solana Native Skill CLI

Usage: solana-native.sh <command> [subcommand] [args]

PRICE COMMANDS:
  price <token>                    Get token price (sol, jup, bonk, etc.)
  prices                           Get all major Solana token prices

DEXSCREENER COMMANDS:  
  dex <token_address>              Get detailed token data
  search <query>                   Search for tokens

PUMP.FUN COMMANDS:
  pumpfun trending                 Show trending pump.fun tokens
  pumpfun check <address>          Check specific token

JUPITER COMMANDS:
  jupiter quote [in] [out] [amt]   Get swap quote
  jupiter tokens                   List popular tokens

SOLANA RPC COMMANDS:
  balance [address]                Get SOL balance
  slot                             Get current slot

NFT COMMANDS:
  tensor                           Show NFT collection info

EXAMPLES:
  solana-native.sh price sol
  solana-native.sh prices
  solana-native.sh dex EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
  solana-native.sh search bonk
  solana-native.sh pumpfun trending
  solana-native.sh jupiter quote
  solana-native.sh balance

EOF
}

# ============ MAIN ============

load_config

case "$1" in
    price)
        price_get "$2"
        ;;
    prices)
        price_multi
        ;;
    dex)
        dex_token "$2"
        ;;
    search)
        dex_search "$2"
        ;;
    pumpfun)
        case "$2" in
            trending) pumpfun_trending ;;
            check) pumpfun_check "$3" ;;
            *) echo "Usage: pumpfun [trending|check <address>]" ;;
        esac
        ;;
    jupiter)
        case "$2" in
            quote) jupiter_quote "$3" "$4" "$5" ;;
            tokens) jupiter_tokens ;;
            *) echo "Usage: jupiter [quote|tokens]" ;;
        esac
        ;;
    balance)
        solana_balance "$2"
        ;;
    slot)
        solana_slot
        ;;
    tensor)
        tensor_collections
        ;;
    help|--help|-h|"")
        show_help
        ;;
    *)
        echo "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
