#!/usr/bin/env bash
# Read canonical AZZLE V2 market data from the selected reviewed pin and Base.
# API responses are compared when available and rejected on any binding mismatch.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
INSPECT=(node "${SCRIPT_DIR}/v2-inspect.mjs")
COMMAND="${1:-open}"

require_task_id() {
  if [[ -z "${2:-}" || ! "${2:-}" =~ ^v2:(standard|micro):[1-9][0-9]*$ ]]; then
    echo "usage: v2-tasks.sh $1 <v2:standard:N|v2:micro:N>" >&2
    exit 2
  fi
}

case "$COMMAND" in
  open)
    MARKET="${2:-standard}"
    LIMIT="${3:-25}"
    if [[ "$MARKET" != "standard" && "$MARKET" != "micro" ]]; then
      echo "market must be standard or micro (micro must be explicitly selected)" >&2
      exit 2
    fi
    if [[ ! "$LIMIT" =~ ^[1-9][0-9]*$ ]] || (( LIMIT < 1 || LIMIT > 100 )); then
      echo "limit must be an integer from 1 to 100" >&2
      exit 2
    fi
    "${INSPECT[@]}" open "$MARKET" "$LIMIT"
    ;;
  task)
    require_task_id task "${2:-}"
    "${INSPECT[@]}" task "$2"
    ;;
  scope)
    require_task_id scope "${2:-}"
    "${INSPECT[@]}" scope "$2"
    ;;
  manifest)
    MARKET="${2:-standard}"
    if [[ "$MARKET" != "standard" && "$MARKET" != "micro" ]]; then
      echo "market must be standard or micro (micro must be explicitly selected)" >&2
      exit 2
    fi
    "${INSPECT[@]}" manifest "$MARKET"
    ;;
  verify)
    MARKET="${2:-standard}"
    if [[ "$MARKET" != "standard" && "$MARKET" != "micro" ]]; then
      echo "market must be standard or micro (micro must be explicitly selected)" >&2
      exit 2
    fi
    "${INSPECT[@]}" verify "$MARKET"
    ;;
  allow)
    if [[ -z "${2:-}" || -z "${3:-}" ]]; then
      echo "usage: v2-tasks.sh allow <target> <calldata>" >&2
      exit 2
    fi
    "${INSPECT[@]}" allow "$2" "$3"
    ;;
  *)
    echo "usage: v2-tasks.sh open [standard|micro] [limit] | task <v2:standard:N|v2:micro:N> | scope <v2:standard:N|v2:micro:N> | manifest [standard|micro] | verify [standard|micro] | allow <target> <calldata>" >&2
    exit 2
    ;;
esac
