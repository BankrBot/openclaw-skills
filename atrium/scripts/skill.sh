#!/usr/bin/env bash
# Fetch an Atrium skill's price, CID, and body. Usage: ./skill.sh 0x<skillId>
set -euo pipefail
BASE="${ATRIUM_INDEXER:-https://indexer-production-92e5.up.railway.app}"
ID="${1:?usage: skill.sh <skillId>}"
echo "== detail =="
curl -fsS "$BASE/skills/$ID" \
  | { jq '{name:.skill.name, price:.skill.pricePerCall, priceRaw:.skill.pricePerCallRaw, cid:.skill.cid, active:.skill.active, invocations:.skill.totalInvocations}' 2>/dev/null || cat; }
echo; echo "== body =="
curl -fsS "$BASE/skills/$ID/body"
