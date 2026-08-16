#!/usr/bin/env bash
set -euo pipefail

# Browse open TaskMarket tasks with a small, readable table.
# Defaults to bounty tasks; override with CLI flags passed to `taskmarket task list`.
#
# Examples:
#   ./scripts/browse.sh
#   ./scripts/browse.sh --mode claim --reward-min 1
#   ./scripts/browse.sh --mode auction --auction-type dutch --deadline-hours 12

if ! command -v taskmarket >/dev/null 2>&1; then
  echo "taskmarket CLI not found. Install with: npm install -g @lucid-agents/taskmarket@latest" >&2
  exit 1
fi

extra_args=("$@")

raw=$(taskmarket task list --status open --limit 50 "${extra_args[@]}")

# JSON output is preferred; fall back to plain text if the CLI ever changes shape.
if command -v jq >/dev/null 2>&1; then
  echo "$raw" | jq -r '
    .data
    | (if type == "object" and has("tasks") then .tasks else . end)
    | .[]
    | [
        (.id // "-" | .[0:10]),
        (.mode // "-"),
        (.status // "-"),
        (((.reward // "0") | tonumber) / 1000000 | tostring + " USDC"),
        ((.submissionCount // 0) | tostring),
        ((.expiryTime // "-") | split("T")[1] // "-" | split(".")[0])
      ]
    | @tsv
  ' | column -t -s $'\t'
else
  echo "$raw"
fi
