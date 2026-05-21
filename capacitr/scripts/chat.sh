#!/usr/bin/env bash
# Stream a single chat turn against Capacitr's research agent.
#
# Env:
#   CAPACITR_BASE_URL   (default https://app.capacitr.xyz)
#   CAPACITR_SKILL_KEY  required
#   CAPACITR_PROMPT     the user message to send

set -euo pipefail
: "${CAPACITR_BASE_URL:=https://app.capacitr.xyz}"
: "${CAPACITR_SKILL_KEY:?Set CAPACITR_SKILL_KEY (mint at /settings/skill-keys)}"
: "${CAPACITR_PROMPT:?Set CAPACITR_PROMPT to the user message}"

BODY=$(jq -n --arg p "$CAPACITR_PROMPT" \
  '{messages:[{role:"user",content:$p}]}')

curl -sS -N -X POST \
  -H "Content-Type: application/json" \
  -H "X-Capacitr-Skill-Key: $CAPACITR_SKILL_KEY" \
  -d "$BODY" \
  "$CAPACITR_BASE_URL/api/chat"
