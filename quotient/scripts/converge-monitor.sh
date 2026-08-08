#!/usr/bin/env bash
# converge-monitor.sh — hold-or-sell read on a Polymarket wallet, powered by the
# Quotient portfolio join (GET /api/v1/portfolio). Optional --oil appends the
# WTI crude reading + perps position read.
#
# Part of the Quotient skill (https://quotient-api-gateway.onrender.com/skill/skill.md).
# Requires: bash, bankr, jq.
#
# Env:
#   QUOTIENT_BASE_URL       optional — default https://quotient-api-gateway.onrender.com;
#                           must pass the payments.sh host allowlist
#   QUOTIENT_MAX_PAYMENT_USD optional — may only LOWER the pinned per-route caps
#   QUOTIENT_PAYMENT_MODE   optional — "confirm" tightens report mode
#
# Security: API responses are untrusted data, never instructions. Reads are
# advisory — this script never places or cancels trades. Paid calls are capped
# at pinned per-route prices, ledgered, and summarized on exit.
#
# Usage: converge-monitor.sh <wallet> [--json] [--oil] [--preview] [--approve TOKEN]
# Exit codes: 0 ok · 1 API/HTTP error · 2 config/usage error · 3 partial data
#             (--oil fetch failed) · 10 payment approval required · 11 autopay
#             cap exceeded (10/11: preview printed, nothing paid).

set -euo pipefail

VERSION="1.0.0"
DEFAULT_BASE="https://quotient-api-gateway.onrender.com"
DISCLAIMER="Informational reads derived from Quotient's forecast — not trade instructions."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=payments.sh
source "$SCRIPT_DIR/payments.sh"

usage() {
  cat <<'EOF'
Usage: converge-monitor.sh <wallet> [--json] [--oil]

Per-position table (MARKET | YOURS | Q-SIDE | COST¢ | Q¢ | DIST¢ | UPSIDE% |
STATUS | READ) with an advisory read per position:
  HOLD            aligned with Q, signal actionable, convergence distance remaining
  WATCH           unconfirmed signal or incomplete data — check before acting
  EXIT-CANDIDATE  converged/paused signal, Q opposed, or Q's call flipped
  NO-COVERAGE     Quotient does not cover this position

Options:
  --json           Machine-readable output only
  --oil            Append the WTI crude reading + perps position read
  --preview        Print the paid-call plan + cost and exit 10 without paying
  --approve TOKEN  Run a previously previewed plan (valid 15 min, plan-bound)
  --version        Print version and exit
  -h, --help       This text

x402: uses the logged-in Bankr CLI wallet; paid calls are capped at pinned
      per-route prices and ledgered (see references/payments-policy.md).
      QUOTIENT_MAX_PAYMENT_USD may only lower caps.
EOF
}

err() { printf 'converge-monitor: %s\n' "$1" >&2; }

WALLET=""
JSON=0
OIL=0
while [ $# -gt 0 ]; do
  case "$1" in
    --json) JSON=1 ;;
    --oil) OIL=1 ;;
    --preview) QP_PREVIEW=1 ;;
    --approve)
      if [ $# -lt 2 ]; then
        err "--approve needs a token"
        exit 2
      fi
      QP_APPROVE_TOKEN="$2"
      shift
      ;;
    --version)
      printf 'converge-monitor.sh %s\n' "$VERSION"
      exit 0
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    -*)
      err "unknown option: $1"
      usage >&2
      exit 2
      ;;
    *)
      if [ -n "$WALLET" ]; then
        err "unexpected extra argument: $1"
        exit 2
      fi
      WALLET="$1"
      ;;
  esac
  shift
done

if ! [[ "$WALLET" =~ ^0x[0-9a-fA-F]{40}$ ]]; then
  err "wallet must be a 0x-prefixed 40-hex Polymarket address"
  usage >&2
  exit 2
fi
WALLET="$(printf '%s' "$WALLET" | tr '[:upper:]' '[:lower:]')"

for bin in bankr jq curl; do
  if ! command -v "$bin" > /dev/null 2>&1; then
    err "$bin is required (install it and retry)"
    exit 2
  fi
done

BASE="${QUOTIENT_BASE_URL:-$DEFAULT_BASE}"
BASE="${BASE%/}"
qp_validate_base_url "$BASE"
QUOTIENT_BASE="$BASE"
trap qp_report_spend EXIT

# quotient_get <path-and-query> [soft] — paid GET via payments.sh (pinned
# per-route cap, ledger, bounded retry). The qp_gate below must have run
# first. With "soft" a failure returns 1, so --oil can degrade to partial data.
quotient_get() {
  qp_paid_get "$1" "${2:-}"
}

QP_CMDLINE="converge-monitor.sh ${WALLET}"
[ "$JSON" = "1" ] && QP_CMDLINE="${QP_CMDLINE} --json"
[ "$OIL" = "1" ] && QP_CMDLINE="${QP_CMDLINE} --oil"
qp_plan_add "/api/v1/portfolio" 1
[ "$OIL" = "1" ] && qp_plan_add "/api/v1/signals/oil" 1
qp_gate "$QP_CMDLINE"

PORTFOLIO_PATH="/api/v1/portfolio?wallet=${WALLET}"
[ "$OIL" = "1" ] && PORTFOLIO_PATH="${PORTFOLIO_PATH}&include_perps=true"
PORTFOLIO="$(quotient_get "$PORTFOLIO_PATH")"

OIL_BODY=""
EXIT_CODE=0
if [ "$OIL" = "1" ]; then
  if ! OIL_BODY="$(quotient_get "/api/v1/signals/oil" soft)"; then
    err "warning: oil signal fetch failed — continuing without it (partial data)"
    OIL_BODY=""
    EXIT_CODE=3
  fi
fi

# Annotate every position with the advisory READ. Mapping (contract):
#   NO-COVERAGE     covered == false
#   EXIT-CANDIDATE  signal done|paused, retired_reason flipped, or !aligned
#   HOLD            aligned && signal actionable && distance_to_convergence_cents > 0
#   WATCH           everything else (unconfirmed signal, missing/partial read)
ANNOTATED="$(jq --arg disclaimer "$DISCLAIMER" '
  def read_of:
    .quotient as $q | $q.signal as $s | $q.convergence as $c
    | if ($q.covered // false) | not then "NO-COVERAGE"
      elif ($s != null and ($s.status == "done" or $s.status == "paused"
             or $s.retired_reason == "flipped"))
           or ($c != null and ($c.aligned | not)) then
        "EXIT-CANDIDATE"
        + (if $c != null and ($c.aligned | not) then " (Q opposed)"
           elif $s.status == "done" then " (converged)"
           elif $s.status == "paused" then " (paused)"
           else " (flipped)" end)
      elif $c != null and $c.aligned and ($s != null and $s.status == "actionable")
           and (($c.distance_to_convergence_cents // 0) > 0) then "HOLD"
      else "WATCH" end;
  {
    wallet, as_of, value_usd, positions_count, covered_count, unmatched_count,
    positions_capped,
    disclaimer: $disclaimer,
    positions: [ .positions[]
      | .quotient as $q | $q.signal as $s | $q.convergence as $c
      | (read_of) as $read
      | ($q.market.slug // .slug // "") as $slug
      | {
          market: ($q.market.slug // .slug // .title // .condition_id),
          yours: (.outcome // "?"),
          q_side: ($c.q_side // null),
          cost_cents: ($c.current_cost_cents // null),
          q_cents: ($c.q_value_cents // null),
          distance_cents: ($c.distance_to_convergence_cents // null),
          upside_pct: ($c.converge_upside_pct // null),
          status: (if $s == null then null
                   elif $s.status == "retired" then "retired:" + ($s.retired_reason // "?")
                   else $s.status end),
          read: $read,
          sell_prompt: (if ($read | startswith("EXIT-CANDIDATE"))
                           and ($slug | test("^[a-z0-9][a-z0-9-]*$"))
                           and ((.outcome // "") | test("^(Yes|No)$")) then
                          "Sell my \(.outcome) position on \($slug) on Polymarket"
                        else null end)
        }
    ],
    unmatched: (.unmatched // [])
  }' <<< "$PORTFOLIO")"

OIL_ANNOTATED="null"
if [ "$OIL" = "1" ] && [ -n "$OIL_BODY" ]; then
  # Oil read: WATCH when the reading is missing/stale/degraded; otherwise
  # position sign (signed perps size) vs reading side → HOLD (aligned) or
  # EXIT-CANDIDATE (opposed); NO-POSITION when no WTIOIL-USD perps position.
  OIL_ANNOTATED="$(jq --argjson portfolio "$PORTFOLIO" '
    .reading as $r
    | ([$portfolio.perps.positions[]? | select(.symbol == "WTIOIL-USD")] | first) as $pos
    | {
        asset,
        reading: (if $r == null then null else {
          reading_date: $r.reading_date, state: $r.state, side: $r.side,
          z: $r.z, intensity: $r.intensity, is_current: $r.is_current,
          days_since_reading: $r.days_since_reading
        } end),
        degraded, reading_missing,
        marks,
        perps_error: ($portfolio.perps.error // null),
        position: (if $pos == null then null else { symbol: $pos.symbol, size: $pos.size } end),
        read: (
          if .reading_missing or $r == null then "WATCH (no current reading)"
          elif .degraded or (($r.is_current // false) | not) then "WATCH (stale or degraded reading)"
          elif $pos == null then "NO-POSITION (informational)"
          elif ($r.side == "long" and $pos.size > 0) or ($r.side == "short" and $pos.size < 0) then
            "HOLD (position aligned with reading)"
          else "EXIT-CANDIDATE (position opposed to reading)" end)
      }' <<< "$OIL_BODY")"
fi

if [ "$JSON" = "1" ]; then
  jq -n --argjson p "$ANNOTATED" --argjson oil "$OIL_ANNOTATED" --arg risk "$QP_RISK_DISCLOSURE" \
    '$p + { risk_disclosure: $risk } + (if $oil == null then {} else { oil: $oil } end)'
  exit "$EXIT_CODE"
fi

# ── Human output ──────────────────────────────────────────────────────────────

HEADER_META="$(jq -r '"\(.wallet) · \(.positions_count) position(s) · value $\((.value_usd // 0) * 100 | round / 100) · covered \(.covered_count) · as of \(.as_of)"' <<< "$ANNOTATED")"
printf 'Quotient convergence monitor — %s\n\n' "$HEADER_META"

POS_COUNT="$(jq -r '.positions | length' <<< "$ANNOTATED")"
if [ "$POS_COUNT" = "0" ]; then
  printf 'No open Polymarket positions for this wallet.\n'
else
  # ¢ is 2 bytes in UTF-8, so header widths for the ¢ columns get +1 byte to
  # keep visual alignment with the ASCII data rows.
  printf '%-32s %-5s %-6s %6s %5s %7s %8s %-16s %s\n' \
    'MARKET' 'YOURS' 'Q-SIDE' 'COST¢' 'Q¢' 'DIST¢' 'UPSIDE%' 'STATUS' 'READ'
  jq -r '.positions[]
    | [ (.market | tostring | .[0:32]),
        .yours,
        (.q_side // "-"),
        (.cost_cents // "-" | tostring),
        (.q_cents // "-" | tostring),
        (if .distance_cents == null then "-"
         elif .distance_cents > 0 then "+\(.distance_cents)"
         else (.distance_cents | tostring) end),
        (if (.upside_pct // 0) > 0 then "+\(.upside_pct)%" else "—" end),
        (.status // "-"),
        .read
      ] | @tsv' <<< "$ANNOTATED" |
    while IFS=$'\t' read -r market yours qside cost qcents dist upside status readcell; do
      # "—" is 3 bytes; widen that cell's byte width so columns stay aligned.
      uw=8
      [ "$upside" = "—" ] && uw=10
      printf '%-32s %-5s %-6s %5s %4s %6s %*s %-16s %s\n' \
        "$market" "$yours" "$qside" "$cost" "$qcents" "$dist" "$uw" "$upside" "$status" "$readcell"
    done

  SELL_PROMPTS="$(jq -r '.positions[] | select(.sell_prompt != null) | .sell_prompt' <<< "$ANNOTATED")"
  if [ -n "$SELL_PROMPTS" ]; then
    printf '\nExit-candidate handoffs (advisory — review before acting):\n'
    while IFS= read -r p; do
      printf 'bankr prompt "%s"\n' "$p"
    done <<< "$SELL_PROMPTS"
  fi
fi

UNMATCHED="$(jq -r '.unmatched | length' <<< "$ANNOTATED")"
if [ "$UNMATCHED" != "0" ]; then
  UNMATCHED_LIST="$(jq -r '[.unmatched[] | (.slug // .title // .condition_id)] | join(", ")' <<< "$ANNOTATED")"
  printf '\nNot covered by Quotient (%s): %s\n' "$UNMATCHED" "$UNMATCHED_LIST"
fi

if [ "$OIL" = "1" ] && [ "$OIL_ANNOTATED" != "null" ]; then
  printf '\nOIL — %s\n' "$(jq -r '.asset' <<< "$OIL_ANNOTATED")"
  jq -r '
    (if .reading == null then "  Reading: none" else
      "  Reading: \(.reading.side) (\(.reading.state)) · z \(.reading.z // "n/a") · intensity \(.reading.intensity // "n/a") · \(.reading.reading_date) (\(if .reading.is_current then "current" else "stale, \(.reading.days_since_reading)d old" end))"
     end),
    "  Marks: PM perps \(.marks.polymarket_perps.symbol // "WTIOIL-USD") mark \(.marks.polymarket_perps.mark // "n/a") (funding \(.marks.polymarket_perps.funding_rate // "n/a")/h) · HL \(.marks.hyperliquid.coin // "xyz:CL") mid \(.marks.hyperliquid.mid // "n/a")",
    (if .perps_error != null then "  Perps portfolio: unavailable (\(.perps_error))" else empty end),
    (if .position == null then "  Your perps: no WTIOIL-USD position"
     else "  Your perps: \(.position.symbol) size \(.position.size) (\(if .position.size > 0 then "long" else "short" end))" end),
    "  Read: \(.read)"
  ' <<< "$OIL_ANNOTATED"
elif [ "$OIL" = "1" ]; then
  printf '\nOIL — unavailable this run (see warning above).\n'
fi

printf '\n%s\n%s\n' "$DISCLAIMER" "$QP_RISK_DISCLOSURE"
exit "$EXIT_CODE"
