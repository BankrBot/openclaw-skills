#!/usr/bin/env bash
# Base Chain Utility Skill
# Interact with Base blockchain - balances, gas, blocks, transactions

set -euo pipefail

RPC_URL="https://1rpc.io/base"
EMOJIS="🟣"

# Helper function to make JSON-RPC calls
rpc_call() {
    local method="$1"
    local params="${2:-[]}"
    curl -s -X POST "$RPC_URL" \
        -H "Content-Type: application/json" \
        -d "{\"jsonrpc\":\"2.0\",\"method\":\"$method\",\"params\":$params,\"id\":1}"
}

# Helper function to parse JSON result
parse_json() {
    local json="$1"
    local key="$2"
    echo "$json" | python3 -c "import json, sys; d=json.load(sys.stdin); print(d.get('$key', '0x0'))" 2>/dev/null || echo "0x0"
}

# Helper function to format wei to ETH
wei_to_eth() {
    local wei="$1"
    python3 -c "print(f'{int(\"$wei\", 16) / 1e18:.6f}')" 2>/dev/null || echo "N/A"
}

# Helper function to format gas price
format_gas_price() {
    local gwei="$1"
    python3 -c "print(f'{int(\"$gwei\", 16) / 1e9:.2f}')" 2>/dev/null || echo "N/A"
}

# Helper function to format nonce
format_nonce() {
    local nonce="$1"
    echo "$((nonce))"
}

# Show help
show_help() {
    cat << EOF
${EMOJIS} Base Chain Utility

Usage: base <command> [args]

Commands:
    balance <address>    Get ETH/USDC balance for an address
    gas                  Get current gas price on Base
    block                Get latest block number
    price <token>        Get token price (ETH, USDC, CBETH, DAI)
    nonce <address>      Get transaction count for an address
    tx <txhash>          Get transaction status

Examples:
    base balance 0x...
    base gas
    base block
    base price ETH
    base nonce 0x...
    base tx 0x...
EOF
}

# Get balance for an address
cmd_balance() {
    local address="${1:-}"
    
    if [[ -z "$address" ]]; then
        echo "Error: Address required"
        echo "Usage: base balance <address>"
        exit 1
    fi
    
    # Validate address format
    if [[ ! "$address" =~ ^0x[a-fA-F0-9]{40}$ ]]; then
        echo "Error: Invalid address format"
        exit 1
    fi
    
    # Get ETH balance
    local eth_balance
    eth_balance=$(rpc_call "eth_getBalance" "[\"$address\",\"latest\"]")
    local eth_value
    eth_value=$(parse_json "$eth_balance" "result")
    
    # Get USDC balance
    local usdc_address="0x833589fCD6eDb6E08f4c7C32D4f71b54bdD02913"
    local usdc_data="0x70a08231000000000000000000000000${address:2}"
    local usdc_balance
    usdc_balance=$(rpc_call "eth_call" "[{\"to\":\"$usdc_address\",\"data\":\"$usdc_data\"},\"latest\"]")
    local usdc_value
    usdc_value=$(parse_json "$usdc_balance" "result")
    
    local eth_formatted
    eth_formatted=$(wei_to_eth "$eth_value")
    local usdc_formatted
    usdc_formatted=$(python3 -c "print(f'{int(\"$usdc_value\", 16) / 1e6:.2f}')" 2>/dev/null || echo "N/A")
    
    echo "${EMOJIS} Base Balance for $address"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "ETH:  $eth_formatted"
    echo "USDC: $usdc_formatted"
}

# Get current gas price
cmd_gas() {
    local gas_price
    gas_price=$(rpc_call "eth_gasPrice" "[]")
    local gwei
    gwei=$(parse_json "$gas_price" "result")
    
    local gas_formatted
    gas_formatted=$(format_gas_price "$gwei")
    
    echo "${EMOJIS} Base Gas Price"
    echo "━━━━━━━━━━━━━━━━━━"
    echo "Gas:  $gas_formatted Gwei"
}

# Get latest block number
cmd_block() {
    local block_number
    block_number=$(rpc_call "eth_blockNumber" "[]")
    local block
    block=$(parse_json "$block_number" "result")
    
    local block_decimal
    block_decimal=$((block))
    
    echo "${EMOJIS} Base Latest Block"
    echo "━━━━━━━━━━━━━━━━━━━━"
    echo "Block: $block_decimal"
}

# Get token price
cmd_price() {
    local token="${1:-ETH}"
    local token_upper
    token_upper=$(echo "$token" | tr '[:lower:]' '[:upper:]')
    
    # Token addresses on Base
    case "$token_upper" in
        ETH)
            # Use Coingecko API for ETH price
            local price
            price=$(curl -s "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd" 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('ethereum',{}).get('usd',0))" || echo "0")
            echo "${EMOJIS} Token Price - $token"
            echo "━━━━━━━━━━━━━━━━━━━━"
            echo "ETH: \$$price USD"
            ;;
        USDC)
            echo "${EMOJIS} Token Price - $token"
            echo "━━━━━━━━━━━━━━━━━━━━"
            echo "USDC: \$1.00 USD (stablecoin)"
            ;;
        CBETH)
            local price
            price=$(curl -s "https://api.coingecko.com/api/v3/simple/price?ids=coinbase-wrapped-staked-eth&vs_currencies=usd" 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('coinbase-wrapped-staked-eth',{}).get('usd',0))" || echo "0")
            echo "${EMOJIS} Token Price - $token"
            echo "━━━━━━━━━━━━━━━━━━━━"
            echo "cbETH: \$$price USD"
            ;;
        DAI)
            echo "${EMOJIS} Token Price - $token"
            echo "━━━━━━━━━━━━━━━━━━━━"
            echo "DAI: \$1.00 USD (stablecoin)"
            ;;
        *)
            echo "Error: Unknown token '$token'"
            echo "Supported: ETH, USDC, CBETH, DAI"
            exit 1
            ;;
    esac
}

# Get nonce for an address
cmd_nonce() {
    local address="${1:-}"
    
    if [[ -z "$address" ]]; then
        echo "Error: Address required"
        echo "Usage: base nonce <address>"
        exit 1
    fi
    
    # Validate address format
    if [[ ! "$address" =~ ^0x[a-fA-F0-9]{40}$ ]]; then
        echo "Error: Invalid address format"
        exit 1
    fi
    
    # Get pending nonce
    local pending_nonce
    pending_nonce=$(rpc_call "eth_getTransactionCount" "[\"$address\",\"pending\"]")
    local pending
    pending=$(parse_json "$pending_nonce" "result")
    
    # Get confirmed nonce
    local confirmed_nonce
    confirmed_nonce=$(rpc_call "eth_getTransactionCount" "[\"$address\",\"latest\"]")
    local confirmed
    confirmed=$(parse_json "$confirmed_nonce" "result")
    
    local pending_decimal=$((pending))
    local confirmed_decimal=$((confirmed))
    
    echo "${EMOJIS} Nonce for $address"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Pending:  $pending_decimal"
    echo "Confirmed: $confirmed_decimal"
}

# Get transaction status
cmd_tx() {
    local txhash="${1:-}"
    
    if [[ -z "$txhash" ]]; then
        echo "Error: Transaction hash required"
        echo "Usage: base tx <txhash>"
        exit 1
    fi
    
    # Validate txhash format
    if [[ ! "$txhash" =~ ^0x[a-fA-F0-9]{64}$ ]]; then
        echo "Error: Invalid transaction hash format"
        exit 1
    fi
    
    local receipt
    receipt=$(rpc_call "eth_getTransactionReceipt" "[\"$txhash\"]")
    
    local status
    status=$(echo "$receipt" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('result',{}).get('status','pending'))" 2>/dev/null || echo "pending")
    
    local block_number
    block_number=$(echo "$receipt" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('result',{}).get('blockNumber','pending'))" 2>/dev/null || echo "pending")
    
    local gas_used
    gas_used=$(echo "$receipt" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('result',{}).get('gasUsed','0x0'))" 2>/dev/null || echo "0x0")
    
    local gas_used_decimal=$((gas_used))
    
    echo "${EMOJIS} Transaction Status"
    echo "━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Hash:   $txhash"
    echo "Status: $([ "$status" = "0x1" ] && echo "✅ Confirmed" || echo "⏳ Pending/Failed")"
    echo "Block:  $([[ "$block_number" = "pending" ]] && echo "Pending" || echo "$((block_number))")"
    echo "Gas:    $gas_used_decimal"
}

# Main entry point
main() {
    local command="${1:-}"
    
    case "${command}" in
        balance)
            cmd_balance "${2:-}"
            ;;
        gas)
            cmd_gas
            ;;
        block)
            cmd_block
            ;;
        price)
            cmd_price "${2:-}"
            ;;
        nonce)
            cmd_nonce "${2:-}"
            ;;
        tx)
            cmd_tx "${2:-}"
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            if [[ -n "$command" ]]; then
                echo "Error: Unknown command '$command'"
            fi
            show_help
            exit 1
            ;;
    esac
}

main "$@"
