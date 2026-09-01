#!/bin/bash

# Configuration
SKILL_DIR="$(dirname "$0")/.."
SCRIPT_PATH="$SKILL_DIR/scripts/fetch_pools.js"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Helper function
function show_help {
    echo "Usage: ./query-pools.sh [OPTIONS]"
    echo ""
    echo "Query Aerodrome Finance active liquidity pools on Base."
    echo ""
    echo "Options:"
    echo "  --min-tvl <amount>   Minimum TVL in USD (default: 10000)"
    echo "  --limit <number>     Number of pools to return (default: 10)"
    echo "  --offset <number>    Offset for pagination (default: 0)"
    echo "  --help               Show this help message"
    echo ""
    echo "Example:"
    echo "  ./query-pools.sh --min-tvl 50000 --limit 5"
}

# Check for help flag
for arg in "$@"; do
    if [[ "$arg" == "--help" ]]; then
        show_help
        exit 0
    fi
done

# Ensure node is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is required but not found.${NC}" >&2
    exit 1
fi

# Install dependencies if needed
if [ ! -d "$SKILL_DIR/node_modules" ]; then
    echo -e "${BLUE}Installing dependencies via npm...${NC}" >&2
    cd "$SKILL_DIR"
    npm install --silent >&2
    cd - > /dev/null
fi

# Run the fetch script
echo -e "${BLUE}Querying Aerodrome Sugar Contract for active pools...${NC}" >&2
node "$SCRIPT_PATH" "$@"
