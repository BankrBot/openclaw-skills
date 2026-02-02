#!/usr/bin/env bash
# Zapper CLI — query DeFi portfolio data across 50+ chains via Zapper's GraphQL API.
# Usage: zapper.sh <command> [args...]
#
# Commands:
#   portfolio <address> — Token balances + totals across all chains
#   tokens <address>    — Detailed token holdings
#   apps <address>      — DeFi positions (LPs, lending, staking)
#   nfts <address>      — NFT holdings
#   price <symbol>      — Token price lookup
#   tx <address>        — Recent transactions (human-readable)
#   claimables <address> — Unclaimed rewards

set -euo pipefail

API="https://public.zapper.xyz/graphql"

# Load config
CONFIG_DIR="${HOME}/.clawdbot/skills/zapper"
CONFIG_FILE="${CONFIG_DIR}/config.json"

load_api_key() {
  if [[ -f "$CONFIG_FILE" ]]; then
    API_KEY=$(python3 -c "import json; print(json.load(open('$CONFIG_FILE')).get('apiKey', ''))" 2>/dev/null || echo "")
    if [[ -z "$API_KEY" ]]; then
      echo "Error: API key not found in $CONFIG_FILE" >&2
      echo "Expected format: {\"apiKey\": \"YOUR_ZAPPER_API_KEY\"}" >&2
      exit 1
    fi
  else
    echo "Error: Config file not found at $CONFIG_FILE" >&2
    echo "Please create it with your Zapper API key:" >&2
    echo "  mkdir -p $CONFIG_DIR" >&2
    echo "  echo '{\"apiKey\": \"YOUR_ZAPPER_API_KEY\"}' > $CONFIG_FILE" >&2
    exit 1
  fi
}

_post() {
  curl -s "$API" -X POST \
    -H "Content-Type: application/json" \
    -H "x-zapper-api-key: $API_KEY" \
    -d "$1"
}

cmd_price() {
  local symbol="${1:?Usage: zapper.sh price <symbol>}"
  local query=$(cat << 'EOF'
query TokenPrice($symbol: String!) {
  token(symbol: $symbol) {
    price
    priceChange24h {
      percent
    }
    marketCap
    volume24h
  }
}
EOF
)
  _post "{\"query\": \"$(echo "$query" | tr '\n' ' ' | sed 's/"/\\"/g')\", \"variables\": {\"symbol\": \"$symbol\"}}" | python3 -c "
import sys, json

data = json.load(sys.stdin)
token = data.get('data', {}).get('token')
if not token or not token.get('price'):
    print(f'Token {sys.argv[1]} not found')
    sys.exit(1)

price = float(token['price'])
print(f'=== {sys.argv[1].upper()} Price ===')
print(f'Price:         \${price:,.6f}')
change = token.get('priceChange24h', {}).get('percent')
if change is not None:
    sign = '+' if float(change) > 0 else ''
    print(f'24h Change:    {sign}{float(change):.2f}%')
cap = token.get('marketCap')
if cap:
    print(f'Market Cap:    \${float(cap):,.0f}')
vol = token.get('volume24h')
if vol:
    print(f'24h Volume:    \${float(vol):,.0f}')
" "$symbol"
}

cmd_portfolio() {
  local address="${1:?Usage: zapper.sh portfolio <address>}"
  load_api_key

  local query=$(cat << 'EOF'
query PortfolioV2($addresses: [Address!]!) {
  portfolioV2(addresses: $addresses) {
    tokenBalances {
      totalBalanceUSD
    }
    appBalances {
      totalBalanceUSD
    }
    nftBalances {
      totalBalanceUSD
    }
  }
}
EOF
)
  _post "{\"query\": \"$(echo "$query" | tr '\n' ' ' | sed 's/"/\\"/g')\", \"variables\": {\"addresses\": [\"$address\"]}}" | python3 -c "
import sys, json

data = json.load(sys.stdin)
portfolio = data.get('data', {}).get('portfolioV2', {})
if not portfolio:
    print('No portfolio data returned')
    sys.exit(1)

tokens = portfolio.get('tokenBalances', {})
apps = portfolio.get('appBalances', {})
nfts = portfolio.get('nftBalances', {})

total_tokens = float(tokens.get('totalBalanceUSD', 0))
total_apps = float(apps.get('totalBalanceUSD', 0))
total_nfts = float(nfts.get('totalBalanceUSD', 0))
total = total_tokens + total_apps + total_nfts

print('=== Portfolio Summary ===')
print(f'Address:       {sys.argv[1][:10]}...{sys.argv[1][-6:]}')
print()
print(f'{'Asset Type':<15} {'Value (USD)':>15}')
print('-' * 32)
print(f'{'Tokens':<15} \${total_tokens:>14,.2f}')
print(f'{'DeFi Apps':<15} \${total_apps:>14,.2f}')
print(f'{'NFTs':<15} \${total_nfts:>14,.2f}')
print('-' * 32)
print(f'{'TOTAL':<15} \${total:>14,.2f}')
" "$address"
}

cmd_tokens() {
  local address="${1:?Usage: zapper.sh tokens <address>}"
  load_api_key

  local query=$(cat << 'EOF'
query PortfolioV2($addresses: [Address!]!) {
  portfolioV2(addresses: $addresses) {
    tokenBalances(first: 20) {
      edges {
        node {
          symbol
          balance
          balanceUSD
          price
          name
          network { name }
        }
      }
    }
  }
}
EOF
)
  _post "{\"query\": \"$(echo "$query" | tr '\n' ' ' | sed 's/"/\\"/g')\", \"variables\": {\"addresses\": [\"$address\"]}}" | python3 -c "
import sys, json

data = json.load(sys.stdin)
tokens = data.get('data', {}).get('portfolioV2', {}).get('tokenBalances', {}).get('edges', [])
if not tokens:
    print('No token holdings found')
    sys.exit(1)

print(f'=== Token Holdings (Top {len(tokens)}) ===')
print(f'Address: {sys.argv[1][:10]}...{sys.argv[1][-6:]}')
print()
print(f'{'Network':<12} {'Symbol':<10} {'Balance':>18} {'Price':>14} {'Value':>14}')
print('-' * 74)

total = 0
for t in tokens:
    n = t['node']
    symbol = n.get('symbol', '?')
    balance = float(n.get('balance', 0))
    balance_usd = float(n.get('balanceUSD', 0))
    price = float(n.get('price', 0))
    network = n.get('network', {}).get('name', 'Unknown')
    total += balance_usd
    
    if balance_usd >= 1000000:
        balance_str = f'{balance:,.4f}M'
    elif balance_usd >= 1000:
        balance_str = f'{balance:,.4f}K'
    else:
        balance_str = f'{balance:,.4f}'
    
    print(f'{network:<12} {symbol:<10} {balance_str:>18} \${price:>13,.2f} \${balance_usd:>13,.2f}')

print('-' * 74)
print(f'{'TOTAL':<22} {'':<18} \${total:>14,.2f}')
" "$address"
}

cmd_apps() {
  local address="${1:?Usage: zapper.sh apps <address>}"
  load_api_key

  local query=$(cat << 'EOF'
query PortfolioV2($addresses: [Address!]!) {
  portfolioV2(addresses: $addresses) {
    appBalances(first: 30) {
      edges {
        node {
          appId
          appName
          balance
          balanceUSD
          network { name }
        }
      }
    }
  }
}
EOF
)
  _post "{\"query\": \"$(echo "$query" | tr '\n' ' ' | sed 's/"/\\"/g')\", \"variables\": {\"addresses\": [\"$address\"]}}" | python3 -c "
import sys, json

data = json.load(sys.stdin)
apps = data.get('data', {}).get('portfolioV2', {}).get('appBalances', {}).get('edges', [])
if not apps:
    print('No DeFi positions found')
    sys.exit(1)

print(f'=== DeFi Positions (Top {len(apps)}) ===')
print(f'Address: {sys.argv[1][:10]}...{sys.argv[1][-6:]}')
print()
print(f'{'Network':<12} {'App':<20} {'Balance':>18} {'Value':>14}')
print('-' * 66)

total = 0
for a in apps:
    n = a['node']
    app_name = n.get('appName', n.get('appId', '?'))
    balance = float(n.get('balance', 0))
    balance_usd = float(n.get('balanceUSD', 0))
    network = n.get('network', {}).get('name', 'Unknown')
    total += balance_usd
    
    if balance_usd >= 1000000:
        balance_str = f'{balance:,.2f}M'
    elif balance_usd >= 1000:
        balance_str = f'{balance:,.2f}K'
    else:
        balance_str = f'{balance:,.4f}'
    
    print(f'{network:<12} {app_name[:20]:<20} {balance_str:>18} \${balance_usd:>13,.2f}')

print('-' * 66)
print(f'{'TOTAL':<32} \${total:>14,.2f}')
" "$address"
}

cmd_nfts() {
  local address="${1:?Usage: zapper.sh nfts <address>}"
  load_api_key

  local query=$(cat << 'EOF'
query PortfolioV2($addresses: [Address!]!) {
  portfolioV2(addresses: $addresses) {
    nftBalances {
      totalBalanceUSD
      edges {
        node {
          name
          collectionName
          balance
          floorPrice
          network { name }
        }
      }
    }
  }
}
EOF
)
  _post "{\"query\": \"$(echo "$query" | tr '\n' ' ' | sed 's/"/\\"/g')\", \"variables\": {\"addresses\": [\"$address\"]}}" | python3 -c "
import sys, json

data = json.load(sys.stdin)
nfts = data.get('data', {}).get('portfolioV2', {}).get('nftBalances', {})
edges = nfts.get('edges', []) if nfts else []
total = float(nfts.get('totalBalanceUSD', 0)) if nfts else 0

print(f'=== NFT Holdings ===')
print(f'Address: {sys.argv[1][:10]}...{sys.argv[1][-6:]}')
print()

if not edges:
    print('No NFT holdings found')
    sys.exit(1)

print(f'{'Network':<12} {'Collection':<24} {'Items':>6} {'Floor':>12} {'Est. Value':>14}')
print('-' * 70)

for n in edges:
    node = n['node']
    collection = node.get('collectionName', 'Unknown')[:24]
    balance = int(node.get('balance', 0))
    floor = float(node.get('floorPrice', 0))
    network = node.get('network', {}).get('name', 'Unknown')
    
    print(f'{network:<12} {collection:<24} {balance:>6} \${floor:>11,.2f}')

print('-' * 70)
print(f'Total Value: \${total:,.2f}')
" "$address"
}

cmd_tx() {
  local address="${1:?Usage: zapper.sh tx <address>}"
  load_api_key

  local query=$(cat << 'EOF'
query Transactions($addresses: [Address!]!) {
  transactions(addresses: $addresses, limit: 20) {
    edges {
      node {
        hash
        blockNumber
        timestamp
        type
        details {
          ... on TokenTransfer {
            tokenSymbol
            tokenAmount
            valueUSD
          }
          ... on Swap {
            fromTokenSymbol
            toTokenSymbol
            fromAmount
            toAmount
          }
        }
      }
    }
  }
}
EOF
)
  _post "{\"query\": \"$(echo "$query" | tr '\n' ' ' | sed 's/"/\\"/g')\", \"variables\": {\"addresses\": [\"$address\"]}}" | python3 -c "
import sys, json
from datetime import datetime

data = json.load(sys.stdin)
txs = data.get('data', {}).get('transactions', {}).get('edges', [])
if not txs:
    print('No recent transactions found')
    sys.exit(1)

print(f'=== Recent Transactions (Last 20) ===')
print(f'Address: {sys.argv[1][:10]}...{sys.argv[1][-6:]}')
print()

for t in txs[:10]:
    n = t['node']
    ts = int(n.get('timestamp', 0)) / 1000
    dt = datetime.fromtimestamp(ts).strftime('%Y-%m-%d %H:%M')
    tx_type = n.get('type', 'Unknown')
    hash_ = n.get('hash', '')[:16]
    
    print(f'{dt} | {tx_type:<12} | {hash_}...')
    
    details = n.get('details', {})
    if details.get('tokenSymbol'):
        amt = float(details.get('tokenAmount', 0))
        val = float(details.get('valueUSD', 0))
        sym = details.get('tokenSymbol', '')
        print(f'   └─ {amt:.4f} {sym} (\${val:,.2f})')
    elif details.get('fromTokenSymbol'):
        from_tok = details.get('fromTokenSymbol', '')
        to_tok = details.get('toTokenSymbol', '')
        from_amt = float(details.get('fromAmount', 0))
        to_amt = float(details.get('toAmount', 0))
        print(f'   └─ {from_amt:.4f} {from_tok} → {to_amt:.4f} {to_tok}')
    print()
" "$address"
}

cmd_claimables() {
  local address="${1:?Usage: zapper.sh claimables <address>}"
  load_api_key

  local query=$(cat << 'EOF'
query Claimables($addresses: [Address!]!) {
  claimables(addresses: $addresses) {
    edges {
      node {
        appId
        appName
        claimableBalance
        claimableBalanceUSD
        network { name }
        tokenSymbol
      }
    }
  }
}
EOF
)
  _post "{\"query\": \"$(echo "$query" | tr '\n' ' ' | sed 's/"/\\"/g')\", \"variables\": {\"addresses\": [\"$address\"]}}" | python3 -c "
import sys, json

data = json.load(sys.stdin)
claimables = data.get('data', {}).get('claimables', {}).get('edges', [])
if not claimables:
    print('No unclaimed rewards found')
    sys.exit(1)

print(f'=== Unclaimed Rewards ===')
print(f'Address: {sys.argv[1][:10]}...{sys.argv[1][-6:]}')
print()
print(f'{'Network':<12} {'App':<20} {'Token':<10} {'Amount':>14} {'Value':>14}')
print('-' * 72)

total = 0
for c in claimables:
    n = c['node']
    app_name = n.get('appName', n.get('appId', '?'))[:20]
    token = n.get('tokenSymbol', '?')[:10]
    amount = float(n.get('claimableBalance', 0))
    value = float(n.get('claimableBalanceUSD', 0))
    network = n.get('network', {}).get('name', 'Unknown')
    total += value
    
    if value >= 1000000:
        amt_str = f'{amount:,.2f}M'
    elif value >= 1000:
        amt_str = f'{amount:,.2f}K'
    else:
        amt_str = f'{amount:,.4f}'
    
    print(f'{network:<12} {app_name:<20} {token:<10} {amt_str:>14} \${value:>13,.2f}')

print('-' * 72)
print(f'{'TOTAL':<42} \${total:>14,.2f}')
" "$address"
}

# --- Main dispatcher ---
cmd="${1:-portfolio}"
shift 2>/dev/null || true

case "$cmd" in
  portfolio)   cmd_portfolio "$@" ;;
  tokens)      cmd_tokens "$@" ;;
  apps)        cmd_apps "$@" ;;
  nfts)        cmd_nfts "$@" ;;
  price)       cmd_price "$@" ;;
  tx)          cmd_tx "$@" ;;
  claimables)  cmd_claimables "$@" ;;
  *)
    echo "Unknown command: $cmd"
    echo "Usage: zapper.sh <portfolio|tokens|apps|nfts|price|tx|claimables> [args...]"
    echo ""
    echo "Commands:"
    echo "  portfolio <address>   Token balances + totals across all chains"
    echo "  tokens <address>      Detailed token holdings"
    echo "  apps <address>        DeFi positions (LPs, lending, staking)"
    echo "  nfts <address>        NFT holdings"
    echo "  price <symbol>        Token price lookup"
    echo "  tx <address>          Recent transactions (human-readable)"
    echo "  claimables <address>  Unclaimed rewards"
    exit 1
    ;;
esac
