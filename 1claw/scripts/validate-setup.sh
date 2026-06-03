#!/usr/bin/env bash
# validate-setup.sh — Smoke-test 1Claw API reachability and optional agent credentials.
# Usage:
#   ./1claw/scripts/validate-setup.sh           # health only
#   ONECLAW_AGENT_API_KEY=ocv_... ./1claw/scripts/validate-setup.sh  # + token exchange
set -euo pipefail

BASE_URL="${ONECLAW_BASE_URL:-https://api.1claw.xyz}"
API_KEY="${ONECLAW_AGENT_API_KEY:-}"

pass() { printf 'OK   %s\n' "$1"; }
fail() { printf 'FAIL %s\n' "$1" >&2; exit 1; }
warn() { printf 'WARN %s\n' "$1"; }

if ! command -v curl >/dev/null 2>&1; then
  fail "curl is required"
fi

# --- API health (public) ---
health_code=$(curl -s -o /tmp/1claw-health.json -w '%{http_code}' "${BASE_URL}/v1/health" || true)
if [[ "${health_code}" != "200" ]]; then
  fail "GET ${BASE_URL}/v1/health returned HTTP ${health_code}"
fi
pass "API health (${BASE_URL}/v1/health)"

if command -v jq >/dev/null 2>&1 && jq -e . >/dev/null 2>&1 </tmp/1claw-health.json; then
  pass "Health response is valid JSON"
else
  warn "jq missing or health body not JSON — skipping parse"
fi

# --- Agent token exchange (optional) ---
if [[ -z "${API_KEY}" ]]; then
  warn "ONECLAW_AGENT_API_KEY not set — skipping agent-token test"
  pass "Smoke complete (health only). Set ONECLAW_AGENT_API_KEY=ocv_... for full validation."
  exit 0
fi

if [[ "${API_KEY}" != ocv_* ]]; then
  warn "ONECLAW_AGENT_API_KEY does not start with ocv_ — still attempting exchange"
fi

token_body=$(curl -s -w '\n%{http_code}' -X POST "${BASE_URL}/v1/auth/agent-token" \
  -H "Content-Type: application/json" \
  -d "$(printf '{"api_key":"%s"}' "${API_KEY}")")
token_http=$(echo "${token_body}" | tail -n1)
token_json=$(echo "${token_body}" | sed '$d')

if [[ "${token_http}" != "200" ]]; then
  fail "agent-token returned HTTP ${token_http} (check key, expiry, and policies)"
fi
pass "agent-token exchange"

if command -v jq >/dev/null 2>&1; then
  agent_id=$(echo "${token_json}" | jq -r '.agent_id // empty')
  access=$(echo "${token_json}" | jq -r '.access_token // empty')
  if [[ -z "${agent_id}" || "${agent_id}" == "null" ]]; then
    fail "agent-token response missing agent_id"
  fi
  if [[ -z "${access}" || "${access}" == "null" ]]; then
    fail "agent-token response missing access_token"
  fi
  pass "agent_id=${agent_id}"

  vault_ids=$(echo "${token_json}" | jq -r '.vault_ids // [] | length')
  if [[ "${vault_ids}" == "0" ]]; then
    warn "vault_ids empty — agent may access all org vaults allowed by policy"
  else
    pass "vault_ids bound (${vault_ids} vault(s))"
  fi

  # Optional: list vaults with JWT
  list_code=$(curl -s -o /tmp/1claw-vaults.json -w '%{http_code}' \
    -H "Authorization: Bearer ${access}" \
    "${BASE_URL}/v1/vaults" || true)
  if [[ "${list_code}" == "200" ]]; then
    count=$(jq -r '.vaults | length' /tmp/1claw-vaults.json 2>/dev/null || echo "?")
    pass "GET /v1/vaults (${count} vault(s))"
  else
    warn "GET /v1/vaults returned HTTP ${list_code} (may be policy-limited)"
  fi
else
  warn "jq not installed — skipping JSON field checks"
fi

pass "Full validation complete"
