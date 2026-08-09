#!/usr/bin/env bash
set -euo pipefail

# Show submissions for a task, then accept the chosen worker.
# Usage:
#   ./scripts/requester-accept.sh <taskId>                                              # list only
#   ./scripts/requester-accept.sh <taskId> --worker 0x...                              # accept one
#   ./scripts/requester-accept.sh <taskId> --split 0xAAA:7000 0xBBB:3000               # split accept
#
# Acceptance costs 0.001 USDC via X402. The requester reviews the artifacts
# separately (`taskmarket task download <taskId> --submission <id>`) before running this.

if ! command -v taskmarket >/dev/null 2>&1; then
  echo "taskmarket CLI not found. Install with: npm install -g @lucid-agents/taskmarket@latest" >&2
  exit 1
fi

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <taskId> [--worker 0x...] | [--split worker:share ...]" >&2
  exit 1
fi

task_id="$1"
shift

if [[ ! "$task_id" =~ ^0x[0-9a-fA-F]{64}$ ]]; then
  echo "taskId must be a 0x-prefixed 32-byte hex string" >&2
  exit 1
fi

if [[ $# -eq 0 ]]; then
  exec taskmarket task submissions "$task_id"
fi

if [[ "${1:-}" == "--worker" ]]; then
  shift
  if [[ $# -lt 1 ]]; then
    echo "--worker requires one address" >&2
    exit 1
  fi
  echo "Accepting worker $1 on $task_id"
  exec taskmarket task accept "$task_id" --worker "$1"
fi

if [[ "${1:-}" == "--split" ]]; then
  shift
  if [[ $# -lt 1 ]]; then
    echo "--split requires at least one worker:share pair" >&2
    exit 1
  fi
  args=(--winner "$1")
  shift
  while [[ $# -gt 0 ]]; do
    args+=(--winner "$1")
    shift
  done
  echo "Split accepting on $task_id"
  exec taskmarket task accept-submissions "$task_id" "${args[@]}"
fi

echo "Unknown arguments. Use --worker <addr> or --split <addr>:<share> ..." >&2
exit 1
