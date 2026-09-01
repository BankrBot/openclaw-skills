#!/bin/bash

# Test Suite for Aerodrome Yield Finder Skill
# FIXED: process.argv indexing and require('fs')

echo "========================================"
echo "Aerodrome Yield Finder - Test Suite"
echo "========================================"
echo ""

# Prerequisites Check
echo "🔍 Checking prerequisites..."
command -v node >/dev/null 2>&1 || { echo "❌ FAIL: Node.js not installed"; exit 1; }
echo "✅ Node.js found: $(node --version)"

# Determine script directory
SCRIPT_DIR="$(dirname "$0")"
if [[ "$SCRIPT_DIR" == "." ]]; then
    CD_PATH="."
elif [[ "$SCRIPT_DIR" == "scripts" ]]; then
    CD_PATH="."
else
    CD_PATH="$SCRIPT_DIR/.."
fi

# Locate query script
if [ -f "$CD_PATH/scripts/query-pools.sh" ]; then
    QUERY_SCRIPT="$CD_PATH/scripts/query-pools.sh"
elif [ -f "./aerodrome/yield-finder/scripts/query-pools.sh" ]; then
    QUERY_SCRIPT="./aerodrome/yield-finder/scripts/query-pools.sh"
    CD_PATH="./aerodrome/yield-finder"
else 
     QUERY_SCRIPT="./scripts/query-pools.sh"
     CD_PATH="."
fi

echo "📂 Working directory: $(pwd)"
echo "   Target script: $QUERY_SCRIPT"
echo ""

# Helper to execute query script
function run_query {
    # If using absolute path, just run it. If relative, ensure we are in correct dir context?
    # query-pools.sh depends on being near fetch_pools.js.
    # It uses `dirname $0` so it should work from anywhere if path is correct.
    "$QUERY_SCRIPT" "$@"
}

# Helper for JSON parsing with Node
function json_val {
    # Usage: json_val "$JSON" "key"
    echo "$1" | node -e "
        const fs = require('fs'); 
        try { 
            const input = fs.readFileSync(0, 'utf-8'); 
            const data = JSON.parse(input);
            // In -e mode on Windows/Bash, argv[0]=node, argv[1]=arg1
            const key = process.argv[1];
            
            let res;
            if (key === 'length') res = data.length;
            else if (key === 'min_tvl') res = Math.min(...data.map(p => p.tvl));
            else if (key === 'max_apr') res = Math.max(...data.map(p => p.apr));
            else if (key === 'min_apr') res = Math.min(...data.map(p => p.apr));
            else if (key === 'is_sorted') {
                res = data.every((p,i,a) => !i || a[i-1].apr >= p.apr);
            }
            else if (key.startsWith('get_')) {
               const parts = key.split('_');
               const idx = parseInt(parts[1]);
               const field = parts[2];
               res = data[idx] ? data[idx][field] : 'null';
            }
            else res = 'unknown_key';
            
            console.log(res);
        } catch(e) { console.log('error: ' + e.message); }
    " "$2"
}

# Install dependencies if needed
echo "📦 Checking dependencies..."
if [ ! -f "$QUERY_SCRIPT" ]; then
    echo "❌ FAIL: Script not found at $QUERY_SCRIPT"
    exit 1
else
    echo "✅ Script found."
fi
echo ""

# Test 1: Default parameters
echo "TEST 1: Default parameters (--limit 10 --min-tvl 10000)"
echo "Running query..."
OUTPUT1=$(run_query 2>/dev/null)

# Validate JSON validity logic
parse_check=$(echo "$OUTPUT1" | node -e "const fs=require('fs'); try{JSON.parse(fs.readFileSync(0)); console.log('ok')}catch(e){console.log('bad')}")

if [ "$parse_check" == "ok" ]; then
    COUNT=$(json_val "$OUTPUT1" "length")
    echo "✅ PASS: Valid JSON returned with $COUNT pools"
    
    # Validate structure
    HAS_SYMBOL=$(json_val "$OUTPUT1" "get_0_symbol")
    HAS_TVL=$(json_val "$OUTPUT1" "get_0_tvl")
    HAS_APR=$(json_val "$OUTPUT1" "get_0_apr")
    
    if [[ "$HAS_SYMBOL" != "error"* ]] && [[ "$HAS_SYMBOL" != "null" ]]; then
        # Format numbers
        fTVL=$(echo "$HAS_TVL" | awk '{printf "%.2f", $1}')
        fAPR=$(echo "$HAS_APR" | awk '{printf "%.2f", $1}')
        # Fallback if awk missing? Node.
        if [ -z "$fTVL" ]; then
           fTVL=$(echo $HAS_TVL | node -e "const fs=require('fs'); console.log(parseFloat(fs.readFileSync(0)).toFixed(2))")
           fAPR=$(echo $HAS_APR | node -e "const fs=require('fs'); console.log(parseFloat(fs.readFileSync(0)).toFixed(2))")
        fi
        
        echo "✅ PASS: Pool structure valid"
        echo "   Top pool: $HAS_SYMBOL | TVL: \$$fTVL | APR: $fAPR%"
    else
        echo "❌ FAIL: Missing required fields or error: $HAS_SYMBOL"
    fi
else
    echo "❌ FAIL: Invalid JSON or empty output"
fi
echo ""

# Test 2: High TVL threshold
echo "TEST 2: High yield pools (--limit 5 --min-tvl 100000)"
OUTPUT2=$(run_query --limit 5 --min-tvl 100000 2>/dev/null)
parse_check2=$(echo "$OUTPUT2" | node -e "const fs=require('fs'); try{JSON.parse(fs.readFileSync(0)); console.log('ok')}catch(e){console.log('bad')}")

if [ "$parse_check2" == "ok" ]; then
    COUNT=$(json_val "$OUTPUT2" "length")
    MIN_TVL=$(json_val "$OUTPUT2" "min_tvl")
    echo "✅ PASS: Returned $COUNT pools"
    
    # Check threshold using node
    is_valid=$(echo "$MIN_TVL 100000" | node -e "const fs=require('fs'); const input=fs.readFileSync(0,'utf8').split(' '); console.log(parseFloat(input[0]) >= parseFloat(input[1]) ? 'yes' : 'no')")
    
    if [ "$is_valid" == "yes" ]; then
        # Check if min_tvl is valid number
        if [[ "$MIN_TVL" == "error"* ]] || [[ "$MIN_TVL" == "Infinity" ]]; then
             echo "⚠️  WARNING: No pools returned or error calculating min TVL ($MIN_TVL)"
        else
             fMIN=$(echo $MIN_TVL | node -e "const fs=require('fs'); console.log(parseFloat(fs.readFileSync(0)).toFixed(2))")
             echo "✅ PASS: All pools meet \$100k TVL threshold (min: \$$fMIN)"
        fi
    else
        echo "❌ FAIL: Found pool below threshold (min: $MIN_TVL)"
    fi
else
    echo "❌ FAIL: Invalid output"
fi
echo ""

# Test 3: APR validation
echo "TEST 3: APR reasonableness check"
MAX_APR=$(json_val "$OUTPUT1" "max_apr")
MIN_APR=$(json_val "$OUTPUT1" "min_apr")
echo "APR range: $MIN_APR% - $MAX_APR%"

# Check valid
is_reas=$(echo "$MAX_APR $MIN_APR" | node -e "const fs=require('fs'); const [max, min] = fs.readFileSync(0,'utf8').split(' ').map(parseFloat); console.log((max < 100000 && min >= 0) ? 'yes' : 'no')")

if [ "$is_reas" == "yes" ]; then
    echo "✅ PASS: APR values are reasonable"
else
    echo "⚠️  WARNING: APR values seem unusual"
fi
echo ""

# Test 4: TVL ordering
echo "TEST 4: APR sorting verification"
IS_SORTED=$(json_val "$OUTPUT1" "is_sorted")

if [ "$IS_SORTED" == "true" ]; then
    echo "✅ PASS: Pools correctly sorted by APR (descending)"
else
    echo "❌ FAIL: Pools not properly sorted"
fi
echo ""

# Manual verification helper
echo "🔗 MANUAL VERIFICATION"
echo "Compare top 3 results with Aerodrome UI:"
echo "https://aerodrome.finance/liquidity"
echo ""
echo "Top 3 pools from our query:"
# Use node to print nice list
echo "$OUTPUT1" | node -e "
    const fs=require('fs');
    try {
        const d=JSON.parse(fs.readFileSync(0));
        d.slice(0,3).forEach(p => 
            console.log('  • ' + p.symbol + ' | TVL: $' + Math.floor(p.tvl).toLocaleString() + ' | APR: ' + Math.floor(p.apr) + '%')
        )
    } catch(e) {}
"
echo ""

echo "========================================"
echo "Test Suite Complete"
echo "========================================"
