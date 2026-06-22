#!/usr/bin/env bash
# Query open POSTED tasks from the AZZLE subgraph (read-only).
set -euo pipefail

SUBGRAPH_URL="${AZZLE_SUBGRAPH_URL:-https://api.studio.thegraph.com/query/1754651/azzle-protocol/v0.3}"
CMD="${1:-open-tasks}"

case "$CMD" in
  open-tasks)
    QUERY='query { tasks(where: { state: "POSTED" }, orderBy: createdAt, orderDirection: desc, first: 25) { id state escrowAmount createdAt updatedAt settlementDigest poster { id } worker { id } } }'
    ;;
  task)
    TASK_ID="${2:-}"
    if [[ -z "$TASK_ID" ]]; then
      echo "usage: subgraph-open-tasks.sh task <taskId>" >&2
      exit 1
    fi
    QUERY="query { task(id: \"${TASK_ID}\") { id state escrowAmount createdAt poster { id } worker { id } } }"
    ;;
  *)
    echo "usage: subgraph-open-tasks.sh open-tasks | task <id>" >&2
    exit 1
    ;;
esac

curl -sf -X POST "$SUBGRAPH_URL" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"${QUERY}\"}"
