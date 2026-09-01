#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "Usage: helixa-multipass.sh <id-or-slug> [profile|agent-card|card|tools|x402|receipts|changes|standards|fragments]" >&2
  echo "Example: helixa-multipass.sh bendr-2-1 agent-card" >&2
  exit 1
fi

id="$1"
resource="${2:-profile}"
base="${HELIXA_WEB_BASE_URL:-https://helixa.xyz}"
encoded_id=$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$id")

case "$resource" in
  profile) path="/api/multipass/${encoded_id}" ;;
  agent-card|card|tools|x402|receipts|changes|standards|fragments) path="/api/multipass/${encoded_id}/${resource}" ;;
  *) echo "helixa-multipass.sh: unsupported resource: $resource" >&2; exit 1 ;;
esac

curl -sS --connect-timeout 10 --max-time 30 \
  -H "User-Agent: helixa-skill/1.1" \
  "$base$path"
