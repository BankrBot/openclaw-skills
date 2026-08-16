#!/usr/bin/env bash
# Taskmarket skill CLI — thin wrapper around scripts/taskmarket_api.py.
#
# Usage:
#   scripts/taskmarket.sh <command> [args...]
#
# All output is JSON. Pass --human for pretty-printed JSON grouped by intent.
#
# Examples:
#   scripts/taskmarket.sh list
#   scripts/taskmarket.sh get 0xTASK...
#   scripts/taskmarket.sh stats
#   scripts/taskmarket.sh leaderboard
#   scripts/taskmarket.sh agent 0xWALLET
#   scripts/taskmarket.sh submissions 0xTASK...
#   scripts/taskmarket.sh create-task --description "..." --reward 5 --duration 72
#
# See SKILL.md for the full workflow.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HUMAN=0
if [[ "${1:-}" == "--human" ]]; then
  HUMAN=1
  shift
fi

PYTHON_BIN="${PYTHON_BIN:-python3}"
exec "${PYTHON_BIN}" "${SCRIPT_DIR}/taskmarket_api.py" "$@"
