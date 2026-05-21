#!/usr/bin/env bash
# Fetch the authenticated Capacitr feed.
#
# Env:
#   CAPACITR_BASE_URL   (default https://app.capacitr.xyz)
#   CAPACITR_SKILL_KEY  required
#   CAPACITR_INTERESTS  optional, comma-separated (default crypto,ai,tech)

set -euo pipefail
: "${CAPACITR_BASE_URL:=https://app.capacitr.xyz}"
: "${CAPACITR_SKILL_KEY:?Set CAPACITR_SKILL_KEY (mint at /settings/skill-keys)}"
: "${CAPACITR_INTERESTS:=crypto,ai,tech}"

curl -sS \
  -H "X-Capacitr-Skill-Key: $CAPACITR_SKILL_KEY" \
  "$CAPACITR_BASE_URL/api/feed?interests=$(printf '%s' "$CAPACITR_INTERESTS" | jq -sRr @uri)" \
  | jq .
