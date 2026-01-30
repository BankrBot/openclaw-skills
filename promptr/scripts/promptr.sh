#!/bin/bash
# Promptr Auction CLI - interact with the community-controlled AI agent auction
# Usage: promptr.sh <command> [args]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"

# Contract addresses (Base Mainnet)
AUCTION_CONTRACT="0x40E164E2B005C9bfd56a44634047c3bc2629371d"
USDC_CONTRACT="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
USDC_DECIMALS=6

# Find config file
if [ -f "$SKILL_DIR/config.json" ]; then
    CONFIG_FILE="$SKILL_DIR/config.json"
elif [ -f "$HOME/.clawdbot/skills/promptr/config.json" ]; then
    CONFIG_FILE="$HOME/.clawdbot/skills/promptr/config.json"
else
    echo '{"error": "config.json not found. Create it with your RPC URL and private key."}' >&2
    exit 1
fi

# Extract config
RPC_URL=$(jq -r '.rpcUrl // "https://mainnet.base.org"' "$CONFIG_FILE")
PRIVATE_KEY=$(jq -r '.privateKey // empty' "$CONFIG_FILE")

# Get wallet address from private key (if available)
get_wallet_address() {
    if [ -n "$PRIVATE_KEY" ]; then
        cast wallet address "$PRIVATE_KEY" 2>/dev/null || echo ""
    fi
}

WALLET_ADDRESS=$(get_wallet_address)

# Helper: convert USDC amount to raw (6 decimals)
to_usdc_raw() {
    local amount=$1
    # Multiply by 10^6 using bc for decimal handling
    echo "scale=0; $amount * 1000000 / 1" | bc
}

# Helper: convert raw USDC to human readable
from_usdc_raw() {
    local raw=$1
    echo "scale=6; $raw / 1000000" | bc
}

# Commands
cmd_status() {
    local round time_left min_amount
    round=$(cast call "$AUCTION_CONTRACT" "currentRound()(uint256)" --rpc-url "$RPC_URL")
    time_left=$(cast call "$AUCTION_CONTRACT" "timeRemaining()(uint256)" --rpc-url "$RPC_URL")
    min_amount=$(cast call "$AUCTION_CONTRACT" "minPromptAmount()(uint256)" --rpc-url "$RPC_URL")
    
    echo "{"
    echo "  \"currentRound\": $round,"
    echo "  \"timeRemaining\": $time_left,"
    echo "  \"timeRemainingFormatted\": \"$(printf '%02d:%02d:%02d' $((time_left/3600)) $((time_left%3600/60)) $((time_left%60)))\"," 
    echo "  \"minPromptAmount\": $(from_usdc_raw "$min_amount"),"
    echo "  \"contract\": \"$AUCTION_CONTRACT\""
    echo "}"
}

cmd_time() {
    local time_left
    time_left=$(cast call "$AUCTION_CONTRACT" "timeRemaining()(uint256)" --rpc-url "$RPC_URL")
    printf '%02d:%02d:%02d\n' $((time_left/3600)) $((time_left%3600/60)) $((time_left%60))
}

cmd_balance() {
    if [ -z "$WALLET_ADDRESS" ]; then
        echo '{"error": "privateKey not configured"}' >&2
        exit 1
    fi
    
    local usdc_balance eth_balance
    usdc_balance=$(cast call "$USDC_CONTRACT" "balanceOf(address)(uint256)" "$WALLET_ADDRESS" --rpc-url "$RPC_URL")
    eth_balance=$(cast balance "$WALLET_ADDRESS" --rpc-url "$RPC_URL")
    
    echo "{"
    echo "  \"address\": \"$WALLET_ADDRESS\","
    echo "  \"usdc\": $(from_usdc_raw "$usdc_balance"),"
    echo "  \"eth\": \"$eth_balance\""
    echo "}"
}

cmd_allowance() {
    if [ -z "$WALLET_ADDRESS" ]; then
        echo '{"error": "privateKey not configured"}' >&2
        exit 1
    fi
    
    local allowance
    allowance=$(cast call "$USDC_CONTRACT" "allowance(address,address)(uint256)" "$WALLET_ADDRESS" "$AUCTION_CONTRACT" --rpc-url "$RPC_URL")
    
    echo "{"
    echo "  \"allowance\": $(from_usdc_raw "$allowance"),"
    echo "  \"allowanceRaw\": \"$allowance\""
    echo "}"
}

cmd_approve() {
    if [ -z "$PRIVATE_KEY" ]; then
        echo '{"error": "privateKey not configured"}' >&2
        exit 1
    fi
    
    local amount=${1:-1000000}  # Default to 1M USDC
    local raw_amount=$(to_usdc_raw "$amount")
    
    echo "Approving $amount USDC for auction contract..." >&2
    
    local tx_hash
    tx_hash=$(cast send "$USDC_CONTRACT" "approve(address,uint256)" \
        "$AUCTION_CONTRACT" "$raw_amount" \
        --private-key "$PRIVATE_KEY" \
        --rpc-url "$RPC_URL" \
        --json | jq -r '.transactionHash')
    
    echo "{"
    echo "  \"success\": true,"
    echo "  \"amount\": $amount,"
    echo "  \"txHash\": \"$tx_hash\""
    echo "}"
}

cmd_prompts() {
    local round=${1:-$(cast call "$AUCTION_CONTRACT" "currentRound()(uint256)" --rpc-url "$RPC_URL")}
    
    # Get prompt IDs for the round
    local prompts_data
    prompts_data=$(cast call "$AUCTION_CONTRACT" "getRoundPrompts(uint256)(bytes32[])" "$round" --rpc-url "$RPC_URL")
    
    # Parse the array - cast returns it as [0x..., 0x..., ...]
    # Remove brackets and split
    local prompt_ids
    prompt_ids=$(echo "$prompts_data" | tr -d '[]' | tr ',' '\n' | sed 's/^ *//')
    
    echo "{"
    echo "  \"round\": $round,"
    echo "  \"prompts\": ["
    
    local first=true
    while IFS= read -r prompt_id; do
        [ -z "$prompt_id" ] && continue
        
        # Get prompt details
        local prompt_data
        prompt_data=$(cast call "$AUCTION_CONTRACT" "getPrompt(bytes32)((address,string,uint256,uint256,bool))" "$prompt_id" --rpc-url "$RPC_URL" 2>/dev/null || echo "")
        
        if [ -n "$prompt_data" ]; then
            # Parse tuple: (submitter, text, totalVotes, timestamp, claimed)
            local submitter text total_votes
            submitter=$(echo "$prompt_data" | grep -oP '0x[a-fA-F0-9]{40}' | head -1 || echo "unknown")
            total_votes=$(echo "$prompt_data" | grep -oP '\d+' | head -1 || echo "0")
            
            [ "$first" = false ] && echo ","
            first=false
            
            echo "    {"
            echo "      \"promptId\": \"$prompt_id\","
            echo "      \"submitter\": \"$submitter\","
            echo "      \"totalVotes\": $(from_usdc_raw "$total_votes")"
            echo -n "    }"
        fi
    done <<< "$prompt_ids"
    
    echo ""
    echo "  ]"
    echo "}"
}

cmd_submit() {
    if [ -z "$PRIVATE_KEY" ]; then
        echo '{"error": "privateKey not configured"}' >&2
        exit 1
    fi
    
    local text=$1
    local amount=$2
    
    if [ -z "$text" ] || [ -z "$amount" ]; then
        echo '{"error": "Usage: promptr.sh submit <text> <usdc_amount>"}' >&2
        exit 1
    fi
    
    local raw_amount=$(to_usdc_raw "$amount")
    
    echo "Submitting prompt with $amount USDC..." >&2
    
    local tx_hash
    tx_hash=$(cast send "$AUCTION_CONTRACT" "submitPrompt(string,uint256)" \
        "$text" "$raw_amount" \
        --private-key "$PRIVATE_KEY" \
        --rpc-url "$RPC_URL" \
        --json | jq -r '.transactionHash')
    
    echo "{"
    echo "  \"success\": true,"
    echo "  \"text\": \"$text\","
    echo "  \"amount\": $amount,"
    echo "  \"txHash\": \"$tx_hash\""
    echo "}"
}

cmd_vote() {
    if [ -z "$PRIVATE_KEY" ]; then
        echo '{"error": "privateKey not configured"}' >&2
        exit 1
    fi
    
    local prompt_id=$1
    local amount=$2
    
    if [ -z "$prompt_id" ] || [ -z "$amount" ]; then
        echo '{"error": "Usage: promptr.sh vote <promptId> <usdc_amount>"}' >&2
        exit 1
    fi
    
    local raw_amount=$(to_usdc_raw "$amount")
    
    echo "Voting $amount USDC on prompt $prompt_id..." >&2
    
    local tx_hash
    tx_hash=$(cast send "$AUCTION_CONTRACT" "vote(bytes32,uint256)" \
        "$prompt_id" "$raw_amount" \
        --private-key "$PRIVATE_KEY" \
        --rpc-url "$RPC_URL" \
        --json | jq -r '.transactionHash')
    
    echo "{"
    echo "  \"success\": true,"
    echo "  \"promptId\": \"$prompt_id\","
    echo "  \"amount\": $amount,"
    echo "  \"txHash\": \"$tx_hash\""
    echo "}"
}

cmd_finalize() {
    if [ -z "$PRIVATE_KEY" ]; then
        echo '{"error": "privateKey not configured"}' >&2
        exit 1
    fi
    
    echo "Finalizing round (0.5% keeper reward)..." >&2
    
    local tx_hash
    tx_hash=$(cast send "$AUCTION_CONTRACT" "finalizeRound()" \
        --private-key "$PRIVATE_KEY" \
        --rpc-url "$RPC_URL" \
        --json | jq -r '.transactionHash')
    
    echo "{"
    echo "  \"success\": true,"
    echo "  \"txHash\": \"$tx_hash\""
    echo "}"
}

cmd_refunds() {
    if [ -z "$WALLET_ADDRESS" ]; then
        echo '{"error": "privateKey not configured"}' >&2
        exit 1
    fi
    
    local round=$1
    
    if [ -z "$round" ]; then
        echo '{"error": "Usage: promptr.sh refunds <round>"}' >&2
        exit 1
    fi
    
    local refunds
    refunds=$(cast call "$AUCTION_CONTRACT" "getUnclaimedRefundsForRound(address,uint256)((bytes32[],uint256[]))" "$WALLET_ADDRESS" "$round" --rpc-url "$RPC_URL")
    
    echo "{"
    echo "  \"round\": $round,"
    echo "  \"address\": \"$WALLET_ADDRESS\","
    echo "  \"refunds\": \"$refunds\""
    echo "}"
}

cmd_claim() {
    if [ -z "$PRIVATE_KEY" ]; then
        echo '{"error": "privateKey not configured"}' >&2
        exit 1
    fi
    
    local round=$1
    local prompt_id=$2
    
    if [ -z "$round" ] || [ -z "$prompt_id" ]; then
        echo '{"error": "Usage: promptr.sh claim <round> <promptId>"}' >&2
        exit 1
    fi
    
    echo "Claiming refund for prompt $prompt_id in round $round..." >&2
    
    local tx_hash
    tx_hash=$(cast send "$AUCTION_CONTRACT" "claimRefund(uint256,bytes32)" \
        "$round" "$prompt_id" \
        --private-key "$PRIVATE_KEY" \
        --rpc-url "$RPC_URL" \
        --json | jq -r '.transactionHash')
    
    echo "{"
    echo "  \"success\": true,"
    echo "  \"round\": $round,"
    echo "  \"promptId\": \"$prompt_id\","
    echo "  \"txHash\": \"$tx_hash\""
    echo "}"
}

cmd_claim_batch() {
    if [ -z "$PRIVATE_KEY" ]; then
        echo '{"error": "privateKey not configured"}' >&2
        exit 1
    fi
    
    local round=$1
    local prompt_ids=$2  # comma-separated
    
    if [ -z "$round" ] || [ -z "$prompt_ids" ]; then
        echo '{"error": "Usage: promptr.sh claim-batch <round> <promptId1,promptId2,...>"}' >&2
        exit 1
    fi
    
    # Convert comma-separated to array format
    local ids_array="[$(echo "$prompt_ids" | sed 's/,/","/g' | sed 's/^/"/;s/$/"/')]"
    
    echo "Batch claiming refunds in round $round..." >&2
    
    local tx_hash
    tx_hash=$(cast send "$AUCTION_CONTRACT" "batchClaimRefunds(uint256,bytes32[])" \
        "$round" "$ids_array" \
        --private-key "$PRIVATE_KEY" \
        --rpc-url "$RPC_URL" \
        --json | jq -r '.transactionHash')
    
    echo "{"
    echo "  \"success\": true,"
    echo "  \"round\": $round,"
    echo "  \"txHash\": \"$tx_hash\""
    echo "}"
}

cmd_can_emergency() {
    local round=$1
    
    if [ -z "$round" ]; then
        echo '{"error": "Usage: promptr.sh can-emergency <round>"}' >&2
        exit 1
    fi
    
    local can_withdraw
    can_withdraw=$(cast call "$AUCTION_CONTRACT" "canEmergencyWithdraw(uint256)(bool)" "$round" --rpc-url "$RPC_URL")
    
    echo "{"
    echo "  \"round\": $round,"
    echo "  \"canEmergencyWithdraw\": $can_withdraw"
    echo "}"
}

cmd_emergency() {
    if [ -z "$PRIVATE_KEY" ]; then
        echo '{"error": "privateKey not configured"}' >&2
        exit 1
    fi
    
    local round=$1
    local prompt_id=$2
    
    if [ -z "$round" ] || [ -z "$prompt_id" ]; then
        echo '{"error": "Usage: promptr.sh emergency <round> <promptId>"}' >&2
        exit 1
    fi
    
    echo "Emergency withdrawing from round $round..." >&2
    
    local tx_hash
    tx_hash=$(cast send "$AUCTION_CONTRACT" "emergencyWithdraw(uint256,bytes32)" \
        "$round" "$prompt_id" \
        --private-key "$PRIVATE_KEY" \
        --rpc-url "$RPC_URL" \
        --json | jq -r '.transactionHash')
    
    echo "{"
    echo "  \"success\": true,"
    echo "  \"round\": $round,"
    echo "  \"promptId\": \"$prompt_id\","
    echo "  \"txHash\": \"$tx_hash\""
    echo "}"
}

cmd_result() {
    local round=$1
    
    if [ -z "$round" ]; then
        echo '{"error": "Usage: promptr.sh result <round>"}' >&2
        exit 1
    fi
    
    local result
    result=$(cast call "$AUCTION_CONTRACT" "getRoundResult(uint256)((bytes32,uint256))" "$round" --rpc-url "$RPC_URL")
    
    echo "{"
    echo "  \"round\": $round,"
    echo "  \"result\": \"$result\""
    echo "}"
}

cmd_help() {
    cat << 'EOF'
Promptr Auction CLI

Usage: promptr.sh <command> [args]

Read Commands:
  status              Show current round info
  time                Show time remaining (HH:MM:SS)
  balance             Show your USDC and ETH balance
  allowance           Show USDC allowance for auction contract
  prompts [round]     List prompts in round (default: current)
  refunds <round>     Check unclaimed refunds for a round
  result <round>      Get round result (winner, pot)
  can-emergency <r>   Check if emergency withdrawal available

Write Commands:
  approve [amount]    Approve USDC spending (default: 1M)
  submit <text> <amt> Submit a new prompt with USDC bid
  vote <id> <amount>  Add USDC votes to existing prompt
  finalize            Finalize ended round (0.5% reward)
  claim <r> <id>      Claim refund for losing prompt
  claim-batch <r> <ids> Batch claim (comma-separated ids)
  emergency <r> <id>  Emergency withdraw (after 24h)

Examples:
  promptr.sh status
  promptr.sh submit "gm world" 5
  promptr.sh vote 0x1234...abcd 10
  promptr.sh finalize
EOF
}

# Main dispatch
case "${1:-help}" in
    status)      cmd_status ;;
    time)        cmd_time ;;
    balance)     cmd_balance ;;
    allowance)   cmd_allowance ;;
    approve)     cmd_approve "${2:-}" ;;
    prompts)     cmd_prompts "${2:-}" ;;
    submit)      cmd_submit "${2:-}" "${3:-}" ;;
    vote)        cmd_vote "${2:-}" "${3:-}" ;;
    finalize)    cmd_finalize ;;
    refunds)     cmd_refunds "${2:-}" ;;
    claim)       cmd_claim "${2:-}" "${3:-}" ;;
    claim-batch) cmd_claim_batch "${2:-}" "${3:-}" ;;
    can-emergency) cmd_can_emergency "${2:-}" ;;
    emergency)   cmd_emergency "${2:-}" "${3:-}" ;;
    result)      cmd_result "${2:-}" ;;
    help|--help|-h) cmd_help ;;
    *)
        echo "Unknown command: $1" >&2
        echo "Run 'promptr.sh help' for usage" >&2
        exit 1
        ;;
esac
