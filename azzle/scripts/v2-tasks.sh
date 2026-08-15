#!/usr/bin/env bash
# Read canonical AZZLE V2 market data. No wallet or transaction signing.
set -euo pipefail

BASE_URL="${AZZLE_API_URL:-https://azzle.org}"
COMMAND="${1:-open}"

require_task_id() {
  if [[ -z "${2:-}" || ! "${2:-}" =~ ^(v2:)?[0-9]+$ ]]; then
    echo "usage: v2-tasks.sh $1 <taskId>" >&2
    exit 2
  fi
}

case "$COMMAND" in
  open)
    LIMIT="${2:-25}"
    if [[ ! "$LIMIT" =~ ^[0-9]+$ ]] || (( LIMIT < 1 || LIMIT > 100 )); then
      echo "limit must be an integer from 1 to 100" >&2
      exit 2
    fi
    curl --fail-with-body --silent --show-error \
      "${BASE_URL%/}/api/market/open?limit=${LIMIT}"
    ;;
  task)
    require_task_id task "${2:-}"
    TASK_ID="${2#v2:}"
    curl --fail-with-body --silent --show-error \
      "${BASE_URL%/}/api/get-task?id=v2:${TASK_ID}"
    ;;
  scope)
    require_task_id scope "${2:-}"
    TASK_ID="${2#v2:}"
    curl --fail-with-body --silent --show-error \
      "${BASE_URL%/}/api/get-task?id=v2:${TASK_ID}" |
      node -e '
        let input = "";
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", (chunk) => { input += chunk; });
        process.stdin.on("end", () => {
          const task = JSON.parse(input).task;
          process.stdout.write(JSON.stringify({
            id: task?.id ?? null,
            discovery: task?.discovery ?? null,
            scope: task?.scope ?? task?.description ?? null
          }, null, 2) + "\n");
        });
      '
    ;;
  manifest)
    SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
    cat "${SCRIPT_DIR}/../references/base-8453-v2-pinned.json"
    ;;
  *)
    echo "usage: v2-tasks.sh open [limit] | task <taskId> | scope <taskId> | manifest" >&2
    exit 2
    ;;
esac
