#!/usr/bin/env bash
set -euo pipefail

# Submit an artifact to a task with the eligibility check up front.
# Usage: ./scripts/submit.sh <taskId> <file>
#
# Refuses to submit if:
#   - the task is not in `open` or `claim`-derived state
#   - submissionWindowOpen is false
#   - there is no pendingActions entry with role=worker and action=submit
#   - the current local time is past expiryTime

if ! command -v taskmarket >/dev/null 2>&1; then
  echo "taskmarket CLI not found. Install with: npm install -g @lucid-agents/taskmarket@latest" >&2
  exit 1
fi

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <taskId> <file> [--role <draft|final>]" >&2
  exit 1
fi

task_id="$1"
file="$2"
shift 2
extra_args=("$@")

if [[ ! "$task_id" =~ ^0x[0-9a-fA-F]{64}$ ]]; then
  echo "taskId must be a 0x-prefixed 32-byte hex string" >&2
  exit 1
fi

if [[ ! -f "$file" ]]; then
  echo "file not found: $file" >&2
  exit 1
fi

raw=$(taskmarket task get "$task_id")

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required for this helper. Install jq or run: taskmarket task submit $task_id --file $file" >&2
  exit 1
fi

status=$(echo "$raw" | jq -r '.data.status')
window=$(echo "$raw" | jq -r '.data.submissionWindowOpen')
expiry=$(echo "$raw" | jq -r '.data.expiryTime')
now=$(date -u +%s)
expiry_unix=$(date -u -d "$expiry" +%s 2>/dev/null || echo "0")

if [[ "$status" != "open" && "$status" != "claimed" && "$status" != "worker_selected" ]]; then
  echo "Refusing: task status is '$status'; expected open/claimed/worker_selected" >&2
  exit 1
fi

if [[ "$window" != "true" ]]; then
  echo "Refusing: submissionWindowOpen is false; the requester is not accepting submissions right now" >&2
  exit 1
fi

if [[ "$expiry_unix" != "0" && "$now" -gt "$expiry_unix" ]]; then
  echo "Refusing: expiryTime $expiry is in the past" >&2
  exit 1
fi

worker_action=$(echo "$raw" | jq -r '
  .data.pendingActions // []
  | map(select(.role == "worker" and .action == "submit"))
  | .[0].action // empty
')

if [[ -z "$worker_action" ]]; then
  echo "Refusing: no pendingActions entry with role=worker action=submit for this task" >&2
  echo "Available worker actions:" >&2
  echo "$raw" | jq -r '.data.pendingActions // [] | .[] | select(.role == "worker") | "  " + .action' >&2
  exit 1
fi

echo "Submitting $file to $task_id"
exec taskmarket task submit "$task_id" --file "$file" "${extra_args[@]}"
