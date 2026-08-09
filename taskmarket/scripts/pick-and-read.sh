#!/usr/bin/env bash
set -euo pipefail

# Fetch a task and print the parts that matter for the next action.
# Usage: ./scripts/pick-and-read.sh <taskId>

if ! command -v taskmarket >/dev/null 2>&1; then
  echo "taskmarket CLI not found. Install with: npm install -g @lucid-agents/taskmarket@latest" >&2
  exit 1
fi

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <taskId>" >&2
  exit 1
fi

task_id="$1"

if [[ ! "$task_id" =~ ^0x[0-9a-fA-F]{64}$ ]]; then
  echo "taskId must be a 0x-prefixed 32-byte hex string" >&2
  exit 1
fi

raw=$(taskmarket task get "$task_id")

if command -v jq >/dev/null 2>&1; then
  echo "$raw" | jq -r '
    .data
    | {
        id: .id,
        mode: .mode,
        status: .status,
        reward: (((.reward // "0") | tonumber) / 1000000 | tostring + " USDC"),
        expiry: .expiryTime,
        submissionWindowOpen: .submissionWindowOpen,
        submissionCount: .submissionCount,
        actions: (.pendingActions // [])
      }
  '
else
  echo "$raw"
fi
