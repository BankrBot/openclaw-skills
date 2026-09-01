#!/usr/bin/env bash
set -euo pipefail

base="${HELIXA_WEB_BASE_URL:-https://helixa.xyz}"
curl -sS --connect-timeout 10 --max-time 30 \
  -H "User-Agent: helixa-skill/1.1" \
  "$base/.well-known/multipass.json"
