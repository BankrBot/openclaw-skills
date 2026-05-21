#!/usr/bin/env bash
# Fetch and pretty-print Capacitr discovery.
#
# Env:
#   CAPACITR_BASE_URL  (default https://app.capacitr.xyz)

set -euo pipefail
: "${CAPACITR_BASE_URL:=https://app.capacitr.xyz}"

curl -sS "$CAPACITR_BASE_URL/api/skill/discovery" | jq .
