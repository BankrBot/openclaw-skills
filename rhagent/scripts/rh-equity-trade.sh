#!/usr/bin/env bash
# Robinhood Agentic equity trade via direct MCP HTTP.
#
# Two-step flow (preview → execute) — never places without --confirm on execute.
#
# Usage:
#   rh-equity-trade.sh preview buy GT --quantity 1 --when limit --limit-price 7.02
#   rh-equity-trade.sh execute buy GT --quantity 1 --when limit --limit-price 7.02 --confirm [--post]
#
# Requires: AGENTIC_TOKEN
# Optional: RHAGENTS_AGENT_KEY + --post on execute (only after confirmed fill)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_SH="${AGENTIC_MCP_SCRIPT:-$SCRIPT_DIR/agentic-mcp.sh}"

usage() {
  cat <<'EOF'
Usage: rh-equity-trade.sh <preview|execute> <buy|sell> SYMBOL [options]

Commands:
  preview   Quote + review only — does NOT place an order
  execute   Place order — requires --confirm; validates fill before --post

Options:
  --quantity N           Whole shares (default 1 if no --dollar-amount)
  --dollar-amount USD    Fractional / dollar-based size
  --when market|open|limit   Timing (default: market)
  --limit-price USD      Required for --when limit
  --time-in-force gfd|gtc    Override (default: gfd; open uses opg)
  --market-hours HOURS   e.g. all_day_hours for 24-hour session
  --thesis TEXT          rhagents thesis (with --post on execute)
  --post                 trade-post to rhagent.bot after confirmed fill (execute only)
  --confirm              Required on execute — human/agent acknowledged preview
  -h, --help

Examples:
  rh-equity-trade.sh preview buy GT --quantity 1 --when limit --limit-price 7.02
  rh-equity-trade.sh execute buy GT --quantity 1 --when limit --limit-price 7.02 --confirm --post
EOF
}

ensure_mcp_script() {
  if [[ -x "$MCP_SH" ]]; then
    return
  fi
  echo '{"ok":false,"error":"agentic-mcp.sh not found — use bundled scripts/agentic-mcp.sh"}' >&2
  exit 1
}

mcp_call() {
  local tool="$1"
  local args="$2"
  "$MCP_SH" "$tool" "$args"
}

if [[ $# -lt 3 ]]; then
  usage >&2
  exit 1
fi

MODE="$1"
shift
if [[ "$MODE" != "preview" && "$MODE" != "execute" ]]; then
  echo "First argument must be preview or execute" >&2
  usage >&2
  exit 1
fi

SIDE="$1"
SYMBOL="$2"
shift 2
SYMBOL="${SYMBOL#\$}"
SYMBOL="${SYMBOL^^}"

QUANTITY=""
DOLLAR=""
WHEN="market"
LIMIT_PRICE=""
TIF=""
MARKET_HOURS=""
THESIS=""
DO_POST=false
CONFIRM=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --quantity) QUANTITY="$2"; shift 2 ;;
    --dollar-amount) DOLLAR="$2"; shift 2 ;;
    --when) WHEN="$2"; shift 2 ;;
    --limit-price) LIMIT_PRICE="$2"; shift 2 ;;
    --time-in-force) TIF="$2"; shift 2 ;;
    --market-hours) MARKET_HOURS="$2"; shift 2 ;;
    --thesis) THESIS="$2"; shift 2 ;;
    --post) DO_POST=true; shift ;;
    --confirm) CONFIRM=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

if [[ "$SIDE" != "buy" && "$SIDE" != "sell" ]]; then
  echo "Side must be buy or sell" >&2
  exit 1
fi

if [[ "$MODE" == "execute" && "$CONFIRM" != "true" ]]; then
  echo '{"ok":false,"error":"execute requires --confirm after preview"}' >&2
  exit 1
fi

if [[ -z "$QUANTITY" && -z "$DOLLAR" ]]; then
  QUANTITY="1"
fi

if [[ -n "$MARKET_HOURS" ]]; then
  MARKET_HOURS="$(python3 - "$MARKET_HOURS" <<'PY'
import sys
aliases = {
    "regular": "regular_hours", "regular_hours": "regular_hours",
    "extended": "extended_hours", "extended_hours": "extended_hours",
    "all_day_hours": "all_day_hours", "alldayhours": "all_day_hours",
    "all_day": "all_day_hours", "24_hour": "all_day_hours",
    "24-hour": "all_day_hours", "24hour": "all_day_hours", "overnight": "all_day_hours",
}
key = sys.argv[1].strip().lower().replace(" ", "_")
print(aliases.get(key, sys.argv[1]))
PY
)"
fi

if [[ "$WHEN" == "limit" && -z "$LIMIT_PRICE" ]]; then
  echo "--limit-price required for --when limit" >&2
  exit 1
fi

if [[ -z "${AGENTIC_TOKEN:-}" ]]; then
  echo '{"ok":false,"error":"AGENTIC_TOKEN not set — run connect/bin/cli.js (Part C)"}' >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo '{"ok":false,"error":"python3 required"}' >&2
  exit 1
fi

ensure_mcp_script

echo "→ Quote $SYMBOL..." >&2
QUOTE_JSON="$(mcp_call get_equity_quotes "{\"symbols\":[\"$SYMBOL\"]}")"

echo "→ Portfolio / buying power..." >&2
PORT_JSON="$(mcp_call get_portfolio '{}')"

ORDER_ARGS="$(python3 - "$SIDE" "$SYMBOL" "$WHEN" "$QUANTITY" "$DOLLAR" "$LIMIT_PRICE" "$TIF" "$MARKET_HOURS" <<'PY'
import json
import sys

side, symbol, when = sys.argv[1], sys.argv[2], sys.argv[3]
quantity, dollar, limit_price, tif, market_hours = sys.argv[4:9]

args = {"symbol": symbol, "side": side}

if when == "open":
    args["order_type"] = "market"
    args["time_in_force"] = tif or "opg"
elif when == "limit":
    args["order_type"] = "limit"
    args["time_in_force"] = tif or "gfd"
    args["limit_price"] = float(limit_price)
else:
    args["order_type"] = "market"
    args["time_in_force"] = tif or "gfd"

if dollar:
    args["amount"] = float(dollar)
elif quantity:
    args["quantity"] = int(quantity) if quantity.isdigit() else float(quantity)

if market_hours:
    args["market_hours"] = market_hours

print(json.dumps(args))
PY
)"

echo "→ Review order..." >&2
REVIEW_JSON="$(mcp_call review_equity_order "$ORDER_ARGS")"

PLACE_JSON=""
POST_JSON=""
EXEC_RESULT="null"

if [[ "$MODE" == "preview" ]]; then
  python3 - "$MODE" "$SYMBOL" "$SIDE" "$QUOTE_JSON" "$PORT_JSON" "$REVIEW_JSON" "$ORDER_ARGS" <<'PY'
import json
import sys

mode, symbol, side = sys.argv[1], sys.argv[2], sys.argv[3]
quote, port, review, order_args = sys.argv[4:8]
try:
    order = json.loads(order_args)
except json.JSONDecodeError:
    order = order_args

out = {
    "ok": True,
    "mode": mode,
    "action": "preview_only",
    "symbol": symbol,
    "side": side,
    "order": order,
    "quote": quote,
    "portfolio": port,
    "review": review,
    "next_step": f"rh-equity-trade.sh execute {side} {symbol} ... --confirm",
}
print(json.dumps(out, indent=2))
PY
  exit 0
fi

echo "→ Place order..." >&2
PLACE_JSON="$(mcp_call place_equity_order "$ORDER_ARGS")"

EXEC_RESULT="$(python3 - "$SYMBOL" "$SIDE" "$PLACE_JSON" "$REVIEW_JSON" "$MCP_SH" <<'PY'
import json
import subprocess
import sys
import time

symbol, side, place_raw, review_raw, mcp_sh = sys.argv[1:6]
FILLED = {"filled", "confirmed", "executed"}
TERMINAL_BAD = {"canceled", "cancelled", "rejected", "failed"}


def load_mcp(raw: str):
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"_raw": raw}


def dig(obj):
    if isinstance(obj, dict):
        if "state" in obj or "id" in obj or "order_id" in obj:
            return obj
        for k in ("result", "data", "order", "content"):
            if k in obj:
                found = dig(obj[k])
                if found:
                    return found
        for v in obj.values():
            found = dig(v)
            if found:
                return found
    elif isinstance(obj, list):
        for item in obj:
            found = dig(item)
            if found:
                return found
    elif isinstance(obj, str):
        s = obj.strip()
        if s.startswith("{") or s.startswith("["):
            try:
                return dig(json.loads(s))
            except json.JSONDecodeError:
                return None
    return None


def mcp(tool, args):
    proc = subprocess.run([mcp_sh, tool, json.dumps(args)], capture_output=True, text=True)
    out = proc.stdout or proc.stderr
    return load_mcp(out), out


place = load_mcp(place_raw)
if place.get("ok") is False or place.get("error"):
    print(json.dumps({"ok": False, "error": place.get("error") or "place_failed", "place": place_raw}))
    sys.exit(0)

if "error" in place_raw.lower() and "isError" in place_raw:
    print(json.dumps({"ok": False, "error": "place_mcp_error", "place": place_raw}))
    sys.exit(0)

order = dig(place) or {}
order_id = order.get("id") or order.get("order_id")
state = str(order.get("state") or order.get("status") or "").lower()
qty = order.get("filled_asset_quantity") or order.get("quantity")
price = order.get("average_price") or order.get("price")

# Poll when placement is not immediately terminal filled
if order_id and state not in FILLED:
    for _ in range(20):
        time.sleep(3)
        polled, _ = mcp("get_equity_orders", {"order_id": order_id})
        po = dig(polled) or {}
        state = str(po.get("state") or po.get("status") or state).lower()
        qty = po.get("filled_asset_quantity") or qty
        price = po.get("average_price") or price
        order = po or order
        if state in FILLED:
            break
        if state in TERMINAL_BAD:
            break

if state not in FILLED:
    print(json.dumps({
        "ok": False,
        "error": "order_not_filled",
        "state": state or "unknown",
        "order_id": order_id,
        "place": place_raw,
    }))
    sys.exit(0)

if not qty or not price:
    print(json.dumps({
        "ok": False,
        "error": "fill_missing_qty_or_price",
        "state": state,
        "order_id": order_id,
        "place": place_raw,
    }))
    sys.exit(0)

print(json.dumps({
    "ok": True,
    "state": state,
    "order_id": order_id,
    "quantity": str(qty),
    "price_usd": str(price),
    "symbol": symbol,
    "side": side,
}))
PY
)"

EXEC_OK="$(python3 - "$EXEC_RESULT" <<'PY'
import json, sys
try:
    print("true" if json.loads(sys.argv[1]).get("ok") else "false")
except Exception:
    print("false")
PY
)"

if [[ "$EXEC_OK" != "true" ]]; then
  python3 - "$MODE" "$SYMBOL" "$SIDE" "$QUOTE_JSON" "$PORT_JSON" "$REVIEW_JSON" "$PLACE_JSON" "$EXEC_RESULT" "$POST_JSON" <<'PY'
import json, sys
out = {
    "ok": False,
    "mode": sys.argv[1],
    "symbol": sys.argv[2],
    "side": sys.argv[3],
    "quote": sys.argv[4],
    "portfolio": sys.argv[5],
    "review": sys.argv[6],
    "place": sys.argv[7],
    "execution": json.loads(sys.argv[8]) if sys.argv[8].startswith("{") else sys.argv[8],
    "rhagents_post": None,
}
print(json.dumps(out, indent=2))
PY
  exit 1
fi

if [[ "$DO_POST" == "true" ]]; then
  if [[ -z "${RHAGENTS_AGENT_KEY:-}" ]]; then
    echo "⚠ --post skipped: RHAGENTS_AGENT_KEY not set" >&2
  else
    echo "→ Post confirmed fill to rhagents..." >&2
    BASE="${RHAGENTS_BASE_URL:-https://rhagent.bot}"
    POST_JSON="$(python3 - "$BASE" "$EXEC_RESULT" "$THESIS" <<'PY'
import json
import os
import subprocess
import sys

base, exec_raw, thesis = sys.argv[1:4]
key = os.environ.get("RHAGENTS_AGENT_KEY", "")
fill = json.loads(exec_raw)
body = {
    "product": "agentic",
    "symbol": fill["symbol"],
    "side": fill["side"],
    "quantity": fill["quantity"],
    "price_usd": fill["price_usd"],
}
if thesis:
    body["thesis"] = thesis

proc = subprocess.run(
    [
        "curl", "-sS", "-X", "POST", f"{base}/api/agent/trade-post",
        "-H", f"Authorization: Bearer {key}",
        "-H", "Content-Type: application/json",
        "-d", json.dumps(body),
    ],
    capture_output=True,
    text=True,
)
print(proc.stdout or proc.stderr)
PY
)"
  fi
fi

python3 - "$MODE" "$SYMBOL" "$SIDE" "$QUOTE_JSON" "$PORT_JSON" "$REVIEW_JSON" "$PLACE_JSON" "$EXEC_RESULT" "$POST_JSON" <<'PY'
import json
import sys

exec_data = json.loads(sys.argv[8])
post_raw = sys.argv[9] or None
post_ok = None
if post_raw:
    try:
        post_ok = json.loads(post_raw).get("ok")
    except json.JSONDecodeError:
        post_ok = False

out = {
    "ok": True,
    "mode": sys.argv[1],
    "symbol": sys.argv[2],
    "side": sys.argv[3],
    "quote": sys.argv[4],
    "portfolio": sys.argv[5],
    "review": sys.argv[6],
    "place": sys.argv[7],
    "execution": exec_data,
    "rhagents_post": post_raw,
    "rhagents_post_ok": post_ok,
}
print(json.dumps(out, indent=2))
PY
