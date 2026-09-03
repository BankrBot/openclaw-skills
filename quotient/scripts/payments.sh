#!/usr/bin/env bash
# payments.sh — shared x402 payment policy library for the Quotient skill's
# paid-read scripts (quotient.sh, converge-monitor.sh). Not a command: source it.
#
# What it owns (canonical spec: references/payments-policy.md):
#   - the pinned per-route price table (each paid call's exact --max-payment)
#   - the QUOTIENT_BASE_URL allowlist (default gateway host; extras only from
#     the user-created policy file, never from env or fetched content)
#   - the payment gate: report mode pays within caps and reports spend after
#     the fact; confirm mode requires a user-approved token or an autopay
#     policy before anything is paid
#   - the local autopay policy (autopay.json) and spend ledger
#   - bounded, ledgered retries that never exceed the run's planned total
#
# Exit codes contributed to callers: 10 approval required (preview printed,
# nothing paid) · 11 policy cap exceeded (preview printed, nothing paid).
# Machine consumers: on exit 10/11 stdout carries a single payment_preview
# JSON object; human summary goes to stderr.

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  echo "payments.sh is a library — source it from quotient.sh or converge-monitor.sh" >&2
  exit 2
fi

QP_PROG="${QP_PROG:-$(basename "$0")}"
QP_DEFAULT_HOST="quotient-api-gateway.onrender.com"
# Pinned payment tuple (verified against the live gateway challenge 2026-08-04).
# The free challenge pre-flight validates server-supplied terms against these
# before any payer is invoked — the trust anchors themselves are never fetched.
QP_PAYEE="0xC3d01FD2F79d4c57aD106AB8ecc12a5dE24F97cB"
QP_USDC_ASSET="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"   # Base USDC, eip155:8453
QP_USDG_ASSET="0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168"   # Robinhood Chain USDG, eip155:4663
QP_MAX_TIMEOUT_SECONDS=300
# Payment posture. "report": pay within pinned per-route caps, then report the
# run's spend. "confirm": never pay without an autopay policy or a --approve
# token bound to a previewed plan. The Bankr distribution ships with the
# stricter posture (flipped at build time); QUOTIENT_PAYMENT_MODE may only
# tighten report -> confirm, never loosen.
QP_DEFAULT_MODE="confirm"
QP_MODE="$QP_DEFAULT_MODE"
if [[ "${QUOTIENT_PAYMENT_MODE:-}" == "confirm" ]]; then
  QP_MODE="confirm"
fi

# Canonical risk disclosure (full text + placement rules: skill.md "Risk Disclosure").
QP_RISK_DISCLOSURE="Risk disclosure: prediction markets and perpetual futures can lose some or all funds committed. Quotient output is informational research, not investment advice. Prediction markets carry liquidity, resolution/dispute, and oracle/venue risk; perps add leverage, funding, and liquidation risk."

QP_CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/quotient-skill"
QP_STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/quotient-skill"
QP_POLICY_FILE="$QP_CONFIG_DIR/autopay.json"
QP_LEDGER_FILE="$QP_STATE_DIR/spend-ledger.json"
QP_PENDING_FILE="$QP_STATE_DIR/pending-approval.json"
QP_PRICE_CACHE="$QP_STATE_DIR/price-cache-$$.json"

# NOTE: qp_paid_get runs inside $(…) command substitutions, so shell variables
# it sets never reach the parent. All cross-call accounting therefore goes
# through the ledger file keyed by QP_RUN_ID (inherited by subshells).
QP_RUN_ID="r-$(date -u +%Y%m%d%H%M%S)-$$"
QP_APPROVAL_KIND=""
QP_PLAN_ROUTES=()
QP_PLAN_COUNTS=()
QP_PLAN_PRICES=()
QP_PLAN_TOTAL="0"

qp_err() { printf '%s: %s\n' "$QP_PROG" "$1" >&2; }

qp_now_iso() { date -u +%Y-%m-%dT%H:%M:%SZ; }

# Float helpers (bash has no float math; awk is POSIX).
qp_lt() { awk -v a="$1" -v b="$2" 'BEGIN { exit !(a + 0 < b + 0) }'; }
qp_gt() { awk -v a="$1" -v b="$2" 'BEGIN { exit !(a + 0 > b + 0) }'; }
qp_add() { awk -v a="$1" -v b="$2" 'BEGIN { printf "%.4f", a + b }'; }
qp_mul() { awk -v a="$1" -v b="$2" 'BEGIN { printf "%.4f", a * b }'; }

qp_atomic_write() {
  # qp_atomic_write <file> <content>
  local file="$1" content="$2" tmp
  mkdir -p "$(dirname "$file")"
  tmp="${file}.tmp-$$"
  printf '%s\n' "$content" >"$tmp"
  mv "$tmp" "$file"
}

# ── Route prices: live under a pinned ceiling ─────────────────────────────────
# Published per-route prices in USD (source: api-reference.md pricing table).
# The general pattern: anything informational is read live; anything that
# bounds spending is pinned. Price is both, so each route's LIVE price is read
# from a free, unauthenticated 402-challenge pre-flight (which also validates
# the pinned payment tuple) and used as --max-payment, clamped by a pinned
# CEILING of 2x the published price. Price drops flow through automatically;
# a raise above the ceiling, or any tuple mismatch, fails closed. When the
# pre-flight is unavailable the published price is the fallback cap. A policy
# route_overrides entry replaces the ceiling (the deliberate way to accept a
# larger raise); QUOTIENT_MAX_PAYMENT_USD may only lower, never raise.

qp_base_route_price() {
  local path="${1%%\?*}"
  case "$path" in
    /api/v1/markets/mispriced) echo "0.05" ;;
    /api/v1/markets/lookup) echo "0.005" ;;
    /api/v1/markets/*/forecast) echo "0.01" ;;
    /api/v1/markets/*/intelligence) echo "0.025" ;;
    /api/v1/markets/*/signals) echo "0.025" ;;
    /api/v1/markets) echo "0.005" ;;
    /api/v1/sources) echo "0.01" ;;
    /api/v1/signals/featured) echo "0.01" ;;
    /api/v1/signals/oil) echo "0.025" ;;
    /api/v1/signals) echo "0.02" ;;
    /api/v1/portfolio) echo "0.0025" ;;
    /api/v1/narratives) echo "0.01" ;;
    /api/v1/signal-score) echo "0.005" ;;
    *) echo "" ;;
  esac
}

# Canonical route key for the plan/ledger (query stripped, slug collapsed).
qp_route_key() {
  local path="${1%%\?*}"
  case "$path" in
    /api/v1/markets/mispriced | /api/v1/markets/lookup | /api/v1/markets) echo "$path" ;;
    /api/v1/markets/*/forecast) echo "/api/v1/markets/{slug}/forecast" ;;
    /api/v1/markets/*/intelligence) echo "/api/v1/markets/{slug}/intelligence" ;;
    /api/v1/markets/*/signals) echo "/api/v1/markets/{slug}/signals" ;;
    *) echo "$path" ;;
  esac
}

# Free pre-flight of a route's 402 challenge: validates the complete pinned
# payment tuple (scheme, network, asset contract, payee, expiry window) and
# prints the live USD price. Empty output = challenge unavailable (fall back
# to the published price); a TUPLE MISMATCH is a hard failure — that is the
# attack signal this whole layer exists to catch. Results are cached per
# route for the run (file-based: paid calls execute in subshells).
# Honest caveat: this read and the payer's own challenge fetch are two
# requests — a server could show different terms to each; the cap and host
# allowlist still bound that residual risk.
qp_preflight_price() {
  local path="$1" route cached b64 verdict
  route="$(qp_route_key "$path")"
  if [[ -f "$QP_PRICE_CACHE" ]]; then
    cached="$(jq -r --arg r "$route" '.[$r] // empty' "$QP_PRICE_CACHE" 2>/dev/null || true)"
    if [[ -n "$cached" ]]; then
      echo "$cached"
      return 0
    fi
  fi
  b64="$(curl -sS -m 10 -o /dev/null -D - "${QUOTIENT_BASE}${path}" 2>/dev/null \
    | tr -d '\r' | awk 'tolower($1) == "payment-required:" { print $2; exit }')" || true
  [[ -n "$b64" ]] || { echo ""; return 0; }
  verdict="$(jq -cn --arg b "$b64" \
    --arg payee "$QP_PAYEE" --arg usdc "$QP_USDC_ASSET" --arg usdg "$QP_USDG_ASSET" \
    --argjson maxt "$QP_MAX_TIMEOUT_SECONDS" '
    def pick(net; asset):
      [.accepts[]? | select(.scheme == "exact" and .network == net
        and ((.asset // "") | ascii_downcase) == (asset | ascii_downcase))] | first;
    (try ($b | @base64d | fromjson) catch null) as $c
    | if $c == null then {status: "unreadable"}
      elif ($c.x402Version // 0) != 2 then {status: "mismatch", err: "unexpected x402Version"}
      else
        ($c | pick("eip155:8453"; $usdc)) as $u
        | ($c | pick("eip155:4663"; $usdg)) as $g
        | ($u // $g) as $offer
        | if $offer == null then
            {status: "mismatch", err: "no accepts entry matches the pinned scheme/network/asset"}
          elif (($offer.payTo // "") | ascii_downcase) != ($payee | ascii_downcase) then
            {status: "mismatch", err: ("payTo " + ($offer.payTo // "absent") + " is not the pinned Quotient payee")}
          elif ($offer.maxTimeoutSeconds // 0) > $maxt then
            {status: "mismatch", err: "maxTimeoutSeconds exceeds the pinned bound"}
          elif (($offer.amount // "") | test("^[0-9]+$") | not) then
            {status: "mismatch", err: "amount is not a positive atomic-unit integer"}
          else {status: "ok", usd: (($offer.amount | tonumber) / 1000000)}
          end
      end' 2>/dev/null)" || verdict='{"status":"unreadable"}'
  case "$(jq -r '.status' <<<"$verdict")" in
    ok)
      cached="$(jq -r '.usd' <<<"$verdict")"
      qp_atomic_write "$QP_PRICE_CACHE" "$(jq -cn \
        --argjson prev "$(cat "$QP_PRICE_CACHE" 2>/dev/null || echo '{}')" \
        --arg r "$route" --arg p "$cached" '$prev + {($r): $p}')"
      echo "$cached"
      ;;
    mismatch)
      qp_err "402 challenge for ${path%%\?*} FAILED pinned-tuple validation: $(jq -r '.err' <<<"$verdict"). Refusing to pay — this origin's payment terms do not match Quotient's pinned payee/asset/network."
      exit 1
      ;;
    *) echo "" ;;
  esac
}

qp_route_price() {
  # qp_route_price <path> → the USD cap for one paid call: the live
  # challenge price when readable, clamped to the pinned ceiling
  # (2x published, or the policy route_overrides value); the published price
  # when the pre-flight is unavailable. Exits on unknown routes, ceiling
  # breaches, and tuple mismatches (fail closed — never guess a payment cap).
  local path="$1" published ceiling override live price
  published="$(qp_base_route_price "$path")"
  if [[ -z "$published" ]]; then
    qp_err "no pinned price for route ${path%%\?*} — refusing to pay an unknown amount (update the payments.sh price table deliberately)"
    exit 2
  fi
  ceiling="$(qp_mul "$published" 2)"
  if [[ -f "$QP_POLICY_FILE" ]]; then
    override="$(jq -r --arg r "$(qp_route_key "$path")" \
      '.route_overrides[$r].max_payment_usd // empty' "$QP_POLICY_FILE" 2>/dev/null || true)"
    [[ -z "$override" ]] || ceiling="$override"
  fi
  # Explicit status propagation: this runs inside $(…) subshells where set -e
  # is not inherited, so a tuple-mismatch exit inside the pre-flight would
  # otherwise be swallowed and the fallback price paid.
  live="$(qp_preflight_price "$path")" || exit 1
  if [[ -n "$live" ]]; then
    if qp_gt "$live" "$ceiling"; then
      qp_err "live price \$${live} for ${path%%\?*} exceeds the pinned ceiling \$${ceiling} — refusing to pay. If this raise is legitimate, accept it explicitly via a route_overrides entry in autopay.json."
      exit 1
    fi
    price="$live"
  else
    price="$published"
  fi
  if [[ -n "${QUOTIENT_MAX_PAYMENT_USD:-}" ]] && qp_lt "$QUOTIENT_MAX_PAYMENT_USD" "$price"; then
    price="$QUOTIENT_MAX_PAYMENT_USD"
  fi
  echo "$price"
}

# ── Base URL allowlist ────────────────────────────────────────────────────────

qp_validate_base_url() {
  # qp_validate_base_url <base-url> — exact-origin allowlist. The default
  # gateway origin is always allowed; anything else must appear verbatim in
  # the policy file's extra_hosts[] (https required except localhost).
  local base="${1%%/}"
  if [[ "$base" == "https://${QP_DEFAULT_HOST}" ]]; then
    return 0
  fi
  if [[ -f "$QP_POLICY_FILE" ]]; then
    local entry
    while IFS= read -r entry; do
      [[ -n "$entry" ]] || continue
      if [[ "${entry%%/}" == "$base" ]]; then
        if [[ "$base" == https://* || "$base" == http://localhost:* || "$base" == http://localhost \
              || "$base" == http://127.0.0.1:* || "$base" == http://127.0.0.1 ]]; then
          return 0
        fi
        qp_err "extra_hosts entry '$entry' is not HTTPS (plain http is allowed only for localhost)"
        exit 2
      fi
    done < <(jq -r '.extra_hosts[]?' "$QP_POLICY_FILE" 2>/dev/null || true)
  fi
  qp_err "QUOTIENT_BASE_URL '$base' is not on the payment allowlist (default https://${QP_DEFAULT_HOST}; extras only via autopay.json extra_hosts). Refusing to send x402 payments to an unpinned origin."
  exit 2
}

# ── Ledger ────────────────────────────────────────────────────────────────────

qp_ledger_read() {
  if [[ -f "$QP_LEDGER_FILE" ]] && jq -e . "$QP_LEDGER_FILE" >/dev/null 2>&1; then
    cat "$QP_LEDGER_FILE"
  else
    echo '{"version":1,"lifetime_spent_usd":0,"entries":[]}'
  fi
}

qp_ledger_append() {
  # qp_ledger_append <route> <url> <max_payment_usd> <attempt> <status>
  local route="$1" url="$2" cap="$3" attempt="$4" status="$5" ledger
  ledger="$(qp_ledger_read | jq -c \
    --arg ts "$(qp_now_iso)" --arg run "$QP_RUN_ID" --arg route "$route" --arg url "$url" \
    --arg cap "$cap" --arg approval "${QP_APPROVAL_KIND:-report-mode}" \
    --argjson attempt "$attempt" --arg status "$status" '
    .entries += [{ts: $ts, run_id: $run, route: $route, url: $url,
                  max_payment_usd: ($cap | tonumber),
                  charged_usd_estimate: (if $status == "paid" then ($cap | tonumber) else 0 end),
                  approval: $approval, attempt: $attempt, status: $status}]
    | .lifetime_spent_usd = ((.lifetime_spent_usd // 0)
        + (if $status == "paid" then ($cap | tonumber) else 0 end))
    | .entries = [.entries[] | select((.ts | fromdateiso8601? // 0) > (now - 30 * 86400))]')"
  qp_atomic_write "$QP_LEDGER_FILE" "$ledger"
}

qp_ledger_day_total() {
  qp_ledger_read | jq -r --arg day "$(date -u +%Y-%m-%d)" \
    '[.entries[] | select(.status == "paid" and (.ts | startswith($day))) | .charged_usd_estimate] | add // 0'
}

qp_ledger_lifetime_total() {
  qp_ledger_read | jq -r '.lifetime_spent_usd // 0'
}

# This run's paid total and call count, derived from the ledger (survives the
# $(…) subshells the paid calls execute in). Prints "<total>\t<count>".
qp_run_totals() {
  qp_ledger_read | jq -r --arg run "$QP_RUN_ID" '
    [.entries[] | select(.run_id == $run and .status == "paid")]
    | [([.[].charged_usd_estimate] | add // 0), length] | @tsv'
}

qp_recently_paid_age() {
  # Seconds since this exact URL was last paid, empty if never / > 10 min.
  qp_ledger_read | jq -r --arg url "$1" \
    '[.entries[] | select(.status == "paid" and .url == $url)
      | (now - (.ts | fromdateiso8601? // 0))] | min // empty
     | if . != null and . < 600 then floor else empty end'
}

# ── Run plan (declared before any paid call) ──────────────────────────────────

qp_plan_reset() {
  QP_PLAN_ROUTES=()
  QP_PLAN_COUNTS=()
  QP_PLAN_PRICES=()
  QP_PLAN_TOTAL="0"
}

qp_plan_add() {
  # qp_plan_add <path> <max_count> — declare a worst-case batch of paid calls.
  local path="$1" count="$2" price
  price="$(qp_route_price "$path")"
  QP_PLAN_ROUTES+=("$(qp_route_key "$path")")
  QP_PLAN_COUNTS+=("$count")
  QP_PLAN_PRICES+=("$price")
  QP_PLAN_TOTAL="$(qp_add "$QP_PLAN_TOTAL" "$(qp_mul "$count" "$price")")"
}

qp_plan_calls_json() {
  local calls='[]' i
  for i in "${!QP_PLAN_ROUTES[@]}"; do
    calls="$(jq -cn --argjson acc "$calls" --arg r "${QP_PLAN_ROUTES[$i]}" \
      --argjson c "${QP_PLAN_COUNTS[$i]}" --arg p "${QP_PLAN_PRICES[$i]}" \
      '$acc + [{route: $r, count_max: $c, max_payment_usd: ($p | tonumber),
                subtotal_usd: (($c * ($p | tonumber)) * 10000 | round / 10000)}]')"
  done
  echo "$calls"
}

# ── Policy ────────────────────────────────────────────────────────────────────

qp_policy_json() {
  if [[ -f "$QP_POLICY_FILE" ]] && jq -e . "$QP_POLICY_FILE" >/dev/null 2>&1; then
    cat "$QP_POLICY_FILE"
  else
    echo "null"
  fi
}

# Prints the names of violated caps (one per line); empty output = covered.
qp_policy_violations() {
  local policy="$1"
  jq -r --arg total "$QP_PLAN_TOTAL" --arg day "$(qp_ledger_day_total)" \
    --arg lifetime "$(qp_ledger_lifetime_total)" \
    --argjson calls "$(qp_plan_calls_json)" '
    .autopay as $a
    | ($total | tonumber) as $t
    | [ (if ($a.enabled // false) | not then "autopay_disabled" else empty end),
        (if $a.expires_at != null and (($a.expires_at | fromdateiso8601? // 0) < now)
         then "policy_expired" else empty end),
        (if [$calls[] | select(.max_payment_usd > ($a.per_call_max_usd // 1e9))] | length > 0
         then "per_call_max_usd" else empty end),
        (if $t > ($a.per_run_max_usd // 1e9) then "per_run_max_usd" else empty end),
        (if (($day | tonumber) + $t) > ($a.per_day_max_usd // 1e9) then "per_day_max_usd" else empty end),
        (if $a.total_budget_usd != null
            and ((($lifetime | tonumber) - (.lifetime_spent_at_init_usd // 0)) + $t) > $a.total_budget_usd
         then "total_budget_usd" else empty end)
      ] | .[]' <<<"$policy"
}

# ── Approval tokens ───────────────────────────────────────────────────────────

qp_new_token() {
  local nonce
  nonce="$(od -An -N4 -tx4 /dev/urandom | tr -d ' \n')"
  echo "qpay-$(date -u +%Y%m%d%H%M%S)-${nonce}"
}

qp_token_valid() {
  # qp_token_valid <token> — matches the pending file, is < 15 min old, and
  # the pending plan equals the current plan.
  local token="$1"
  [[ -f "$QP_PENDING_FILE" ]] || { qp_err "no pending payment approval on file — run without --approve to get a fresh preview"; return 1; }
  jq -e --arg t "$token" '.token == $t' "$QP_PENDING_FILE" >/dev/null 2>&1 \
    || { qp_err "approval token does not match the pending preview — re-run without --approve for a fresh one"; return 1; }
  jq -e '(.created_at | fromdateiso8601? // 0) > (now - 900)' "$QP_PENDING_FILE" >/dev/null 2>&1 \
    || { qp_err "approval token expired (15 min) — re-run without --approve for a fresh preview"; return 1; }
  jq -e --argjson calls "$(qp_plan_calls_json)" \
    '(.calls | map({route, count_max, max_payment_usd}) | sort_by(.route))
     == ($calls | map({route, count_max, max_payment_usd}) | sort_by(.route))' \
    "$QP_PENDING_FILE" >/dev/null 2>&1 \
    || { qp_err "the call plan changed since the approved preview — re-run without --approve to re-preview"; return 1; }
  return 0
}

# ── The gate ──────────────────────────────────────────────────────────────────

qp_emit_preview() {
  # qp_emit_preview <reason> <command-line> <issue_token 0|1> <violations-json>
  local reason="$1" command="$2" issue_token="$3" violations="$4"
  local token="null" policy warnings='[]' i preauth="null" today
  policy="$(qp_policy_json)"
  today="$(qp_ledger_day_total)"

  # At preview time only routes are known; warn from the ledger when any
  # planned route was paid in the last 10 minutes (possible duplicate spend).
  warnings="$(qp_ledger_read | jq -c --argjson calls "$(qp_plan_calls_json)" '
    [ .entries[] | select(.status == "paid" and ((now - (.ts | fromdateiso8601? // 0)) < 600))
      | .route ] as $recent
    | [ $calls[].route | select(. as $r | $recent | index($r) != null)
        | "paid \(.) less than 10 minutes ago — the previous response may still be usable" ]
    | unique')"

  if [[ "$issue_token" == "1" ]]; then
    token="$(qp_new_token)"
    qp_atomic_write "$QP_PENDING_FILE" "$(jq -cn \
      --arg token "$token" --arg created "$(qp_now_iso)" --arg command "$command" \
      --argjson calls "$(qp_plan_calls_json)" --arg total "$QP_PLAN_TOTAL" \
      '{token: $token, created_at: $created, command: $command, calls: $calls,
        total_max_usd: ($total | tonumber)}')"
    token="\"$token\""
  fi

  if [[ "$policy" == "null" ]]; then
    preauth="$(jq -cn --arg total "$QP_PLAN_TOTAL" \
      '{amount_usd: 1.00,
        covers_requests_like_this: (if ($total | tonumber) > 0 then (1.00 / ($total | tonumber) | floor) else null end),
        create_with: "./scripts/quotient.sh autopay init --total-budget 1.00"}')"
  fi

  jq -n \
    --arg reason "$reason" --arg mode "$QP_MODE" --arg command "$command" \
    --argjson calls "$(qp_plan_calls_json)" --arg total "$QP_PLAN_TOTAL" \
    --arg today "$today" --argjson policy "$policy" --argjson token "$token" \
    --argjson preauth "$preauth" --argjson warnings "$warnings" --argjson violations "$violations" '
    {type: "payment_preview", reason: $reason, mode: $mode, command: $command,
     calls: $calls, total_max_usd: ($total | tonumber),
     today_spent_usd: ($today | tonumber),
     caps: (if $policy == null then null else $policy.autopay end),
     cap_violations: $violations,
     approval_token: $token,
     approve_with: (if $token == null then null
                    else "re-run the same command with --approve \($token)" end),
     preauth_offer: $preauth,
     warnings: $warnings}'

  {
    printf '%s: payment preview — nothing was paid.\n' "$QP_PROG"
    printf '  command: %s\n' "$command"
    for i in "${!QP_PLAN_ROUTES[@]}"; do
      printf '  %s × up to %s @ $%s\n' "${QP_PLAN_ROUTES[$i]}" "${QP_PLAN_COUNTS[$i]}" "${QP_PLAN_PRICES[$i]}"
    done
    printf '  worst-case total: $%s · spent today: $%s\n' "$QP_PLAN_TOTAL" "$today"
    if [[ "$violations" != "[]" ]]; then
      printf '  blocked by policy caps: %s\n' "$(jq -r 'join(", ")' <<<"$violations")"
    fi
    if [[ "$token" != "null" ]]; then
      printf '  approve: re-run the same command with --approve %s (valid 15 min)\n' "$(jq -r . <<<"$token")"
    fi
    if [[ "$policy" == "null" ]]; then
      printf '  or pre-authorize $1.00 of reads: ./scripts/quotient.sh autopay init --total-budget 1.00\n'
    fi
  } >&2
}

qp_gate() {
  # qp_gate <command-line> — decide whether the declared plan may pay.
  # Honors QP_PREVIEW=1 (forced preview) and QP_APPROVE_TOKEN (user approval).
  local command="$1" policy violations
  if [[ "${QP_PREVIEW:-0}" == "1" ]]; then
    qp_emit_preview "approval_required" "$command" 1 "[]"
    exit 10
  fi

  if [[ -n "${QP_APPROVE_TOKEN:-}" ]]; then
    if qp_token_valid "$QP_APPROVE_TOKEN"; then
      rm -f "$QP_PENDING_FILE"
      QP_APPROVAL_KIND="user-token"
      return 0
    fi
    exit 2
  fi

  policy="$(qp_policy_json)"
  if [[ "$policy" != "null" ]]; then
    violations="$(qp_policy_violations "$policy" | jq -Rcn '[inputs | select(length > 0)]')"
    if [[ "$violations" == "[]" ]]; then
      QP_APPROVAL_KIND="autopay"
      return 0
    fi
    qp_emit_preview "cap_exceeded" "$command" 1 "$violations"
    exit 11
  fi

  if [[ "$QP_MODE" == "confirm" ]]; then
    qp_emit_preview "approval_required" "$command" 1 "[]"
    exit 10
  fi

  QP_APPROVAL_KIND="report-mode"
  return 0
}

# ── Paid fetch ────────────────────────────────────────────────────────────────

qp_paid_get() {
  # qp_paid_get <path-and-query> [soft] — one x402-paid GET through the Bankr
  # CLI at the route's pinned cap, with one bounded retry that never exceeds
  # the gated plan total. Prints the JSON body. "soft" returns 1 on failure
  # instead of exiting (degradable sub-reads). Callers never fetch the same
  # URL twice in a run; the ledger warns about cross-run duplicates.
  local path="$1" soft="${2:-}" url price route body attempt age run_spent
  url="${QUOTIENT_BASE:?qp_paid_get: caller must set QUOTIENT_BASE}${path}"
  price="$(qp_route_price "$path")" || exit 1
  route="$(qp_route_key "$path")"

  age="$(qp_recently_paid_age "$url" || true)"
  if [[ -n "$age" ]]; then
    qp_err "note: this exact read was already paid ${age}s ago (see spend ledger) — paying again"
  fi

  for attempt in 1 2; do
    # Never let a retry exceed the gated worst-case total.
    run_spent="$(qp_run_totals | cut -f1)"
    if qp_gt "$(qp_add "$run_spent" "$price")" "$QP_PLAN_TOTAL"; then
      qp_err "retry for ${path%%\?*} would exceed the approved run total (\$$QP_PLAN_TOTAL) — stopping"
      [[ "$soft" == "soft" ]] && return 1
      exit 1
    fi
    if body="$(bankr x402 call "$url" --max-payment "$price" --yes --raw 2>/dev/null)" \
       && jq -e . >/dev/null 2>&1 <<<"$body"; then
      qp_ledger_append "$route" "$url" "$price" "$attempt" "paid"
      printf '%s' "$body"
      return 0
    fi
    qp_ledger_append "$route" "$url" "$price" "$attempt" "failed"
    if [[ "$attempt" == "1" ]]; then
      qp_err "x402 request failed for ${path%%\?*} — retrying once (if the failure happened after payment this may double-charge; check the spend ledger)"
      sleep 2
    fi
  done
  qp_err "x402 request failed for ${path%%\?*} after retry"
  [[ "$soft" == "soft" ]] && return 1
  exit 1
}

qp_report_spend() {
  # End-of-run spend summary (stderr, so stdout JSON/tables stay clean).
  local total calls
  rm -f "$QP_PRICE_CACHE"
  IFS="$(printf '\t')" read -r total calls <<<"$(qp_run_totals)"
  if [[ "${calls:-0}" -gt 0 ]]; then
    qp_err "paid calls this run: ${calls} (\$${total} charged at live challenge prices under the pinned ceilings; approval: ${QP_APPROVAL_KIND:-report-mode}). Today: \$$(qp_ledger_day_total) total. Surface this cost to the user."
  fi
}

# ── autopay subcommand (quotient.sh autopay ...) ──────────────────────────────

qp_autopay_init() {
  local total="1.00" per_day="1.00" per_run="0.25" per_call="0.05" expires="null"
  local note="" force=0 hosts='[]'
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --total-budget) [[ $# -ge 2 ]] || { qp_err "--total-budget needs a value"; exit 2; }; total="$2"; shift 2 ;;
      --per-day) [[ $# -ge 2 ]] || { qp_err "--per-day needs a value"; exit 2; }; per_day="$2"; shift 2 ;;
      --per-run) [[ $# -ge 2 ]] || { qp_err "--per-run needs a value"; exit 2; }; per_run="$2"; shift 2 ;;
      --per-call) [[ $# -ge 2 ]] || { qp_err "--per-call needs a value"; exit 2; }; per_call="$2"; shift 2 ;;
      --expires) [[ $# -ge 2 ]] || { qp_err "--expires needs an ISO timestamp"; exit 2; }; expires="\"$2\""; shift 2 ;;
      --add-host) [[ $# -ge 2 ]] || { qp_err "--add-host needs an origin"; exit 2; }
        hosts="$(jq -cn --argjson acc "$hosts" --arg h "$2" '$acc + [$h]')"; shift 2 ;;
      --note) [[ $# -ge 2 ]] || { qp_err "--note needs a value"; exit 2; }; note="$2"; shift 2 ;;
      --force) force=1; shift ;;
      *) qp_err "unknown autopay init option: $1"; exit 2 ;;
    esac
  done
  local numre='^[0-9]+(\.[0-9]+)?$'
  for v in "$total" "$per_day" "$per_run" "$per_call"; do
    [[ "$v" =~ $numre ]] || { qp_err "budget/cap values must be non-negative numbers"; exit 2; }
  done
  if [[ -f "$QP_POLICY_FILE" && "$force" -ne 1 ]]; then
    qp_err "autopay policy already exists at $QP_POLICY_FILE — pass --force to replace it"
    exit 2
  fi
  qp_atomic_write "$QP_POLICY_FILE" "$(jq -cn \
    --arg created "$(qp_now_iso)" --arg note "$note" \
    --arg total "$total" --arg per_day "$per_day" --arg per_run "$per_run" --arg per_call "$per_call" \
    --argjson expires "$expires" --argjson hosts "$hosts" \
    --arg lifetime "$(qp_ledger_lifetime_total)" \
    '{version: 1, created_at: $created,
      authorized_note: (if $note == "" then "user-authorized autopay" else $note end),
      autopay: {enabled: true,
                per_call_max_usd: ($per_call | tonumber),
                per_run_max_usd: ($per_run | tonumber),
                per_day_max_usd: ($per_day | tonumber),
                total_budget_usd: ($total | tonumber),
                expires_at: $expires},
      route_overrides: {}, extra_hosts: $hosts,
      lifetime_spent_at_init_usd: ($lifetime | tonumber)}')"
  qp_err "autopay policy written to $QP_POLICY_FILE (budget \$$total, per-day \$$per_day, per-run \$$per_run, per-call \$$per_call). Only create this on an explicit user instruction stating the amounts."
}

qp_autopay_status() {
  local policy
  policy="$(qp_policy_json)"
  jq -n --argjson policy "$policy" \
    --arg today "$(qp_ledger_day_total)" --arg lifetime "$(qp_ledger_lifetime_total)" '
    {policy: $policy, today_spent_usd: ($today | tonumber),
     ledger_lifetime_spent_usd: ($lifetime | tonumber),
     spent_against_budget_usd:
       (if $policy == null then null
        else (($lifetime | tonumber) - ($policy.lifetime_spent_at_init_usd // 0)) end)}'
}

qp_autopay_revoke() {
  rm -f "$QP_POLICY_FILE" "$QP_PENDING_FILE"
  qp_err "autopay policy revoked (deleted $QP_POLICY_FILE)"
}

qp_autopay_cmd() {
  local sub="${1:-status}"
  shift || true
  case "$sub" in
    init) qp_autopay_init "$@" ;;
    status) qp_autopay_status ;;
    revoke) qp_autopay_revoke ;;
    *) qp_err "unknown autopay subcommand: $sub (init|status|revoke)"; exit 2 ;;
  esac
}
