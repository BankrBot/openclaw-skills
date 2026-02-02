#!/bin/bash
#
# Clanker Skill - ERC20 Token Deployment on Base
# https://clanker.world
#

set -e

# Configuration paths
CONFIG_DIR="$HOME/.clawdbot/skills/clanker"
CONFIG_FILE="$CONFIG_DIR/config.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load configuration
load_config() {
    if [[ ! -f "$CONFIG_FILE" ]]; then
        print_error "Config file not found: $CONFIG_FILE"
        echo "Please create it with the following structure:"
        cat << 'EOF'
{
  "mainnet": {
    "rpc_url": "https://1rpc.io/base",
    "private_key": "YOUR_PRIVATE_KEY"
  },
  "testnet": {
    "rpc_url": "https://base-sepolia.public.blastapi.io",
    "private_key": "YOUR_TESTNET_PRIVATE_KEY"
  }
}
EOF
        exit 1
    fi
    
    # Use python3 for reliable JSON parsing
    CONFIG_JSON=$(python3 -c "
import json
with open('$CONFIG_FILE', 'r') as f:
    data = json.load(f)
    import sys
    sys.stdout.write(json.dumps(data))
" 2>/dev/null) || {
        print_error "Failed to parse config file"
        exit 1
    }
}

# Get network config
get_network_config() {
    local network="$1"
    python3 -c "
import json
import sys
config = json.loads('''$CONFIG_JSON''')
if '$network' not in config:
    print('Network not configured', file=sys.stderr)
    sys.exit(1)
print(json.dumps(config['$network']))
" 2>/dev/null
}

config_has_network() {
    local network="$1"
    python3 -c "import json,sys; data=json.loads('''$CONFIG_JSON'''); sys.exit(0 if '$network' in data else 1)" 2>/dev/null
}

# Get RPC URL
get_rpc_url() {
    local network="$1"
    local config=$(get_network_config "$network")
    echo "$config" | python3 -c "import json,sys; print(json.load(sys.stdin)['rpc_url'])"
}

# Get private key
get_private_key() {
    local network="$1"
    local config=$(get_network_config "$network")
    echo "$config" | python3 -c "import json,sys; print(json.load(sys.stdin)['private_key'])" | python3 -c "
import sys
key = sys.stdin.read().strip()
if not key or key == 'YOUR_PRIVATE_KEY':
    print('', end='')
    sys.exit(1)
print(key)
" 2>/dev/null || {
        print_error "Private key not configured for $network"
        echo "Please set your private key in $CONFIG_FILE"
        exit 1
    }
}

# Make JSON RPC call and extract result
rpc_call() {
    local method="$1"
    local params="$2"
    local rpc_url="$3"
    
    curl -s -X POST "$rpc_url" \
        -H "Content-Type: application/json" \
        -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"$method\",\"params\":$params}" \
        | python3 -c "import sys,json; print(json.load(sys.stdin).get('result','0x'))"
}

# Check if transaction succeeded
check_tx_status() {
    local txhash="$1"
    local network="$2"
    local rpc_url=$(get_rpc_url "$network")
    local explorer_url="https://basescan.org"
    if [[ "$network" == "testnet" ]]; then
        explorer_url="https://sepolia.basescan.org"
    fi
    
    local receipt_json=$(curl -s -X POST "$rpc_url" \
        -H "Content-Type: application/json" \
        -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_getTransactionReceipt\",\"params\":[\"$txhash\"]}")
    
    local receipt=$(echo "$receipt_json" | python3 -c "
import json,sys
data = json.load(sys.stdin)
res = data.get('result')
if res is None:
    sys.exit(0)
print(json.dumps(res))
" 2>/dev/null || true)

    if [[ -z "$receipt" ]]; then
        print_warning "Transaction not yet confirmed or not found"
        echo ""
        echo "Explorer: ${explorer_url}/tx/$txhash"
        exit 0
    fi
    
    local status=$(echo "$receipt" | python3 -c "import json,sys; print(json.load(sys.stdin).get('status','0x1'))" 2>/dev/null)
    
    if [[ "$status" == "0x1" ]]; then
        print_success "Transaction confirmed successfully!"
        echo ""
        echo "Transaction Hash: $txhash"
        echo ""
        
        # Try to extract token address from logs
        local token_addr=$(echo "$receipt" | python3 -c "
import json,sys
data = json.load(sys.stdin)
logs = data.get('logs', [])
for log in logs:
    topics = log.get('topics', [])
    if len(topics) >= 2 and isinstance(topics[1], str) and topics[1].startswith('0x'):
        addr = topics[1][-40:]
        if addr and addr != '0' * 40:
            print(f'0x{addr}')
            break
    data_hex = log.get('data', '')
    if isinstance(data_hex, str) and data_hex.startswith('0x') and len(data_hex) >= 42:
        addr = data_hex[-40:]
        if addr and addr != '0' * 40:
            print(f'0x{addr}')
            break
" 2>/dev/null)
        
        if [[ -n "$token_addr" ]]; then
            echo "Token Address: $token_addr"
            echo ""
            echo "Run 'clanker.sh info $token_addr --network $network' for token details"
        fi
        
        echo "Explorer: ${explorer_url}/tx/$txhash"
    else
        print_error "Transaction failed"
        echo ""
        echo "Transaction Hash: $txhash"
        echo ""
        echo "Receipt:"
        echo "$receipt" | python3 -m json.tool 2>/dev/null || echo "$receipt"
        echo ""
        echo "Explorer: ${explorer_url}/tx/$txhash"
        exit 1
    fi
}

# Decode ABI string (offset + length + data)
decode_abi_string() {
    python3 -c "
import sys
hex_data = sys.stdin.read().strip()
if not hex_data or hex_data == '0x':
    print('')
    sys.exit(0)
try:
    if hex_data.startswith('0x'):
        hex_data = hex_data[2:]
    length = int(hex_data[64:128], 16)
    str_hex = hex_data[128:128 + length * 2]
    bytes_data = bytes.fromhex(str_hex)
    print(bytes_data.decode('utf-8'))
except Exception as e:
    print('(decode error)')
" 2>/dev/null || echo "(error)"
}

# Get token info
get_token_info() {
    local token_addr="$1"
    local network="$2"
    local rpc_url=$(get_rpc_url "$network")
    
    # Validate address
    if ! echo "$token_addr" | grep -qE '^0x[a-fA-F0-9]{40}$'; then
        print_error "Invalid token address: $token_addr"
        exit 1
    fi
    
    print_info "Fetching token info from $network..."
    
    # Get name
    local name=$(rpc_call "eth_call" "[{\"to\":\"$token_addr\",\"data\":\"0x06fdde03\"},\"latest\"]" "$rpc_url")
    name=$(echo "$name" | decode_abi_string)
    
    # Get symbol
    local symbol=$(rpc_call "eth_call" "[{\"to\":\"$token_addr\",\"data\":\"0x95d89b41\"},\"latest\"]" "$rpc_url")
    symbol=$(echo "$symbol" | decode_abi_string)
    
    # Get decimals
    local decimals=$(rpc_call "eth_call" "[{\"to\":\"$token_addr\",\"data\":\"0x313ce567\"},\"latest\"]" "$rpc_url")
    decimals=$(echo "$decimals" | python3 -c "import sys; d=sys.stdin.read().strip(); print(int(d, 16) if d and d!='0x' else 18)" 2>/dev/null || echo "18")
    
    # Get total supply
    local supply=$(rpc_call "eth_call" "[{\"to\":\"$token_addr\",\"data\":\"0x18160ddd\"},\"latest\"]" "$rpc_url")
    local supply_human="0"
    supply_human=$(DECIMALS="$decimals" python3 -c "
import os,sys
d = sys.stdin.read().strip()
dec = int(os.environ.get('DECIMALS', '18'))
if not d or d == '0x':
    print('0')
else:
    val = int(d, 16)
    print(val / (10 ** dec))
" 2>/dev/null <<< "$supply" || echo "0")
    
    local explorer_url="https://basescan.org"
    if [[ "$network" == "testnet" ]]; then
        explorer_url="https://sepolia.basescan.org"
    fi
    
    echo ""
    echo "========================================"
    echo "           TOKEN INFORMATION"
    echo "========================================"
    echo ""
    echo "  Name:        $name"
    echo "  Symbol:      $symbol"
    echo "  Decimals:    $decimals"
    echo "  Total Supply: $supply_human"
    echo "  Address:     $token_addr"
    echo ""
    echo "  Explorer:    ${explorer_url}/token/$token_addr"
    echo "========================================"
}

# Get tokens deployed by address
get_tokens_by_deployer() {
    local deployer_addr="$1"
    local network="$2"
    local rpc_url=$(get_rpc_url "$network")
    
    # Validate address
    if ! echo "$deployer_addr" | grep -qE '^0x[a-fA-F0-9]{40}$'; then
        print_error "Invalid deployer address: $deployer_addr"
        exit 1
    fi
    
    print_info "Searching for tokens deployed by $deployer_addr..."
    print_warning "Note: Full indexing requires Basescan API access"
    echo ""
    
    # Get transaction count as a simple check
    local tx_count_hex=$(rpc_call "eth_getTransactionCount" "[\"$deployer_addr\",\"latest\"]" "$rpc_url")
    local tx_count=$(python3 -c "import sys; d=sys.stdin.read().strip(); print(int(d, 16) if d and d != '0x' else 0)" 2>/dev/null <<< "$tx_count_hex" || echo "$tx_count_hex")
    
    local explorer_url="https://basescan.org"
    if [[ "$network" == "testnet" ]]; then
        explorer_url="https://sepolia.basescan.org"
    fi
    
    echo "Deployer Stats:"
    echo "  Address: $deployer_addr"
    echo "  Transactions: $tx_count"
    echo ""
    echo "To find all deployed tokens, you would typically:"
    echo "  1. Use Basescan API: ${explorer_url}/api?module=account&action=txlist&address=$deployer_addr"
    echo "  2. Filter transactions to Clanker Factory contract"
    echo "  3. Parse token addresses from transaction logs"
    echo ""
    echo "Alternative: Check https://clanker.world for deployed tokens list"
}

# Deploy token using Python helper
deploy_token() {
    local name="$1"
    local symbol="$2"
    local lp_eth="$3"
    local network="$4"
    
    print_info "Preparing deployment..."
    print_info "Token: $name ($symbol)"
    print_info "Initial ETH (dev buy): $lp_eth ETH"
    local net_label="$network"
    case "$network" in
        testnet) net_label="Base Sepolia (testnet)" ;;
        mainnet) net_label="Base (mainnet)" ;;
    esac
    print_info "Network: $net_label"
    echo ""
    
    # Check for web3
    if ! python3 -c "import web3" 2>/dev/null; then
        print_warning "Python web3 package not installed"
        echo ""
        echo "To enable deployment, install web3:"
        echo "  pip install web3"
        echo ""
        print_info "Alternative: Use https://clanker.world to deploy tokens"
        echo ""
        echo "For manual deployment on testnet:"
        echo "  1. Go to https://clanker.world"
        echo "  2. Connect your wallet (MetaMask)"
        echo "  3. Switch to Base Sepolia"
        echo "  4. Enter token name and symbol"
        echo "  5. Deploy with small ETH amount"
        echo ""
        return 0
    fi
    
    local private_key=$(get_private_key "$network")
    if [[ -z "$private_key" ]]; then
        print_error "Cannot deploy: private key not configured"
        exit 1
    fi

    local rpc_url=$(get_rpc_url "$network")
    
    # Use Python deployment helper
    python3 "$SCRIPT_DIR/deploy.py" "$network" "$name" "$symbol" "$lp_eth" "$private_key" --rpc-url "$rpc_url"
}

# Show usage
usage() {
    cat << EOF
Clanker Skill - Deploy ERC20 tokens on Base

Usage: $0 <command> [options]

Commands:
    deploy <name> <symbol> <initial-lp-eth>
        Deploy token on mainnet with initial liquidity
    
    testnet-deploy <name> <symbol>
        Deploy token on Base Sepolia testnet
    
    status <txhash>
        Check deployment transaction status
    
    info <token-address>
        Get token information (name, symbol, supply)
    
    get-token <deployer-address>
        Find tokens deployed by an address

Options:
    --network mainnet|testnet
        Force network (default: auto-detect from config)

Examples:
    # Deploy on mainnet
    $0 deploy "My Token" MYT 0.1
    
    # Deploy on testnet
    $0 testnet-deploy "Test Token" TST
    
    # Check transaction status on testnet
    $0 status 0x1234... --network testnet
    
    # Get token info on testnet
    $0 info 0xabcd... --network testnet

Setup:
    Create ~/.clawdbot/skills/clanker/config.json with RPC and private keys.
    See SKILL.md for configuration details.

EOF
}

# Parse global options
parse_global_options() {
    local args=("$@")
    local new_args=()
    local i=0
    while [[ $i -lt ${#args[@]} ]]; do
        if [[ "${args[$i]}" == "--network" ]]; then
            NETWORK="${args[$((i+1))]}"
            i=$((i+2))
        else
            new_args+=("${args[$i]}")
            i=$((i+1))
        fi
    done
    # Return remaining args via global array
    REMAINING_ARGS=("${new_args[@]}")
}

# Main
main() {
    if [[ $# -lt 1 ]]; then
        usage
        exit 1
    fi
    
    local command="$1"
    shift
    
    # Parse global options
    local NETWORK=""
    local REMAINING_ARGS=()
    parse_global_options "$@"
    set -- "${REMAINING_ARGS[@]}"
    
    load_config
    
    # Default network for commands that need it
    if [[ -z "$NETWORK" ]]; then
        case "$command" in
            status|info|get-token)
                if config_has_network "mainnet"; then
                    NETWORK="mainnet"
                elif config_has_network "testnet"; then
                    NETWORK="testnet"
                fi
                ;;
        esac
    fi
    
    case "$command" in
        deploy)
            if [[ $# -lt 3 ]]; then
                print_error "Usage: $0 deploy <name> <symbol> <initial-lp-eth>"
                exit 1
            fi
            deploy_token "$1" "$2" "$3" "mainnet"
            ;;
        testnet-deploy)
            if [[ $# -lt 2 ]]; then
                print_error "Usage: $0 testnet-deploy <name> <symbol>"
                exit 1
            fi
            deploy_token "$1" "$2" "0" "testnet"
            ;;
        status)
            if [[ $# -lt 1 ]]; then
                print_error "Usage: $0 status <txhash>"
                exit 1
            fi
            local net=${NETWORK:-mainnet}
            check_tx_status "$1" "$net"
            ;;
        info)
            if [[ $# -lt 1 ]]; then
                print_error "Usage: $0 info <token-address>"
                exit 1
            fi
            local net=${NETWORK:-testnet}
            get_token_info "$1" "$net"
            ;;
        get-token)
            if [[ $# -lt 1 ]]; then
                print_error "Usage: $0 get-token <deployer-address>"
                exit 1
            fi
            local net=${NETWORK:-testnet}
            get_tokens_by_deployer "$1" "$net"
            ;;
        -h|--help|help)
            usage
            ;;
        *)
            print_error "Unknown command: $command"
            usage
            exit 1
            ;;
    esac
}

main "$@"
