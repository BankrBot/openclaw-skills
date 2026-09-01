#!/usr/bin/env bash
# snapshot-query.sh — Send a GraphQL query to the Snapshot Hub API.
# Usage: bash snapshot-query.sh '<graphql_query>' [variables_json]
# Env: SNAPSHOT_API_KEY (optional, for higher rate limits)
#      SNAPSHOT_HUB (optional, default: https://hub.snapshot.org/graphql)
set -euo pipefail

QUERY="${1:?Usage: snapshot-query.sh '<graphql_query>' [variables_json]}"
VARS="${2:-null}"
HUB="${SNAPSHOT_HUB:-https://hub.snapshot.org/graphql}"

HEADERS=(-H 'Content-Type: application/json')
[[ -n "${SNAPSHOT_API_KEY:-}" ]] && HEADERS+=(-H "x-api-key: ${SNAPSHOT_API_KEY}")

BODY=$(jq -n --arg q "$QUERY" --argjson v "$VARS" '{query: $q, variables: $v}')

curl -sf "$HUB" "${HEADERS[@]}" -d "$BODY" | jq .
