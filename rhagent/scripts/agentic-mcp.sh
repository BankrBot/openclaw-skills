#!/usr/bin/env bash
# Direct Robinhood Agentic MCP over HTTP — bypasses Bankr call_mcp_tool / arguments_json bug.
#
# Usage:
#   agentic-mcp.sh <tool_name> '<json_arguments>'
#
# Examples:
#   agentic-mcp.sh get_equity_quotes '{"symbols":["GT"]}'
#   agentic-mcp.sh get_portfolio '{}'
#   agentic-mcp.sh get_option_chains '{"symbol":"NVDA"}'
#   agentic-mcp.sh get_option_instruments '{"symbol":"NVDA","expiration_date":"2026-07-18","type":"call"}'
#   agentic-mcp.sh get_option_quotes '{"instrument_ids":["<id-from-chain>"]}'
#   agentic-mcp.sh review_equity_order '{"symbol":"GT","side":"buy","order_type":"limit","quantity":1,"limit_price":7.02,"time_in_force":"gfd","market_hours":"all_day_hours"}'
#   agentic-mcp.sh place_equity_order '{"symbol":"GT","side":"buy","order_type":"limit","quantity":1,"limit_price":7.02,"time_in_force":"gfd","market_hours":"all_day_hours"}'
#
# Requires: AGENTIC_TOKEN in env (Part C / rh-connect.sh)
# Optional: AGENTIC_MCP_URL (default: rhwallet production proxy)

set -euo pipefail

MCP_URL="${AGENTIC_MCP_URL:-https://rhwallet-rhagent-production.up.railway.app/v1/agentic/mcp}"
TOKEN="${AGENTIC_TOKEN:-}"

if [[ -z "$TOKEN" ]]; then
  echo '{"ok":false,"error":"AGENTIC_TOKEN not set — run rh-connect.sh or add to Bankr env"}' >&2
  exit 1
fi

if [[ $# -lt 1 ]]; then
  echo "Usage: agentic-mcp.sh <tool_name> '<json_arguments>'" >&2
  exit 1
fi

TOOL="$1"
ARGS="${2:-{}}"

if ! command -v python3 >/dev/null 2>&1; then
  echo '{"ok":false,"error":"python3 required to build MCP JSON-RPC payload"}' >&2
  exit 1
fi

PAYLOAD="$(python3 - "$TOOL" "$ARGS" <<'PY'
import json
import sys

tool = sys.argv[1]
raw = sys.argv[2] if len(sys.argv) > 2 else "{}"
try:
    arguments = json.loads(raw)
except json.JSONDecodeError as exc:
    print(json.dumps({"ok": False, "error": f"invalid arguments JSON: {exc}"}))
    sys.exit(1)
if not isinstance(arguments, dict):
    print(json.dumps({"ok": False, "error": "arguments must be a JSON object"}))
    sys.exit(1)

payload = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {"name": tool, "arguments": arguments},
}
print(json.dumps(payload))
PY
)"

if [[ "$PAYLOAD" == *'"ok": false'* ]] || [[ "$PAYLOAD" == *'"ok":false'* ]]; then
  echo "$PAYLOAD" >&2
  exit 1
fi

curl -sS -X POST "$MCP_URL" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "$PAYLOAD"
