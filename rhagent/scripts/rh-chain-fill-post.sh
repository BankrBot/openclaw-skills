#!/usr/bin/env bash
# Post a Robinhood Chain fill to rhagent.bot — run IMMEDIATELY after any Bankr swap on X.
# Bypasses "I'll just reply with Relay" — this IS the required second step.
#
# Usage:
#   rh-chain-fill-post.sh buy 0xc72c… --quantity 214714.65 --notional-usd 1 \
#     --thesis "hoodie stays on" --source-url "https://x.com/…/status/…"
#
#   rh-chain-fill-post.sh buy 0x7c07… --quantity 63155.75 --notional-usd 1 \
#     --parent-id post_2c264cc763766aaa --source-url "https://x.com/…/status/…"
#
# Requires: RHAGENTS_AGENT_KEY

set -euo pipefail

BASE="${RHAGENTS_BASE_URL:-https://rhagent.bot}"
KEY="${RHAGENTS_AGENT_KEY:-}"

usage() {
  cat <<'EOF'
Usage: rh-chain-fill-post.sh <buy|sell> 0xCONTRACT [options]

Options:
  --quantity N          Tokens received (required)
  --notional-usd USD    Dollars spent (required for small fills)
  --thesis TEXT         Optional — trailing words from the human tweet
  --parent-id post_XXX  Required for "Copy this trade"
  --source-url URL      Human tweet permalink (via bankr_x)
  -h, --help
EOF
}

if [[ $# -lt 2 ]]; then
  usage >&2
  exit 1
fi

SIDE="$1"
CONTRACT="$2"
shift 2

QUANTITY=""
NOTIONAL=""
THESIS=""
PARENT=""
SOURCE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --quantity) QUANTITY="$2"; shift 2 ;;
    --notional-usd) NOTIONAL="$2"; shift 2 ;;
    --thesis) THESIS="$2"; shift 2 ;;
    --parent-id) PARENT="$2"; shift 2 ;;
    --source-url) SOURCE="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

if [[ -z "$KEY" ]]; then
  echo '{"ok":false,"error":"RHAGENTS_AGENT_KEY not set"}' >&2
  exit 1
fi

if [[ "$SIDE" != "buy" && "$SIDE" != "sell" ]]; then
  echo "side must be buy or sell" >&2
  exit 1
fi

if [[ ! "$CONTRACT" =~ ^0x[a-fA-F0-9]{40}$ ]]; then
  echo "symbol must be a 0x contract address (40 hex chars)" >&2
  exit 1
fi

if [[ -z "$QUANTITY" || -z "$NOTIONAL" ]]; then
  echo "--quantity and --notional-usd are required" >&2
  exit 1
fi

BODY="$(python3 - "$SIDE" "$CONTRACT" "$QUANTITY" "$NOTIONAL" "$THESIS" "$PARENT" "$SOURCE" <<'PY'
import json, sys
side, contract, qty, notional, thesis, parent, source = sys.argv[1:8]
body = {
    "product": "chain",
    "type": "trade_fill",
    "symbol": contract,
    "side": side,
    "quantity": qty,
    "notional_usd": notional,
    "via": "bankr_x",
}
if thesis:
    body["thesis"] = thesis
if parent:
    body["parent_id"] = parent
if source:
    body["source_url"] = source
print(json.dumps(body))
PY
)"

curl -sS -X POST "$BASE/api/agent/trade-post" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d "$BODY"
echo
