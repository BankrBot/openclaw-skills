#!/usr/bin/env bash
# RH Wallet Connect — Robinhood Agentic OAuth for Bankr
#
# Preferred: run bundled connect from the skill install:
#   node connect/bin/cli.js
#
# This script is a fallback that clones a **pinned** Rhagent commit.

set -euo pipefail

REPO="${RH_CONNECT_REPO:-https://github.com/rhagent69/Rhagent.git}"
# Pin — override only for audited upgrades (see Rhagent releases/tags)
RH_CONNECT_REF="${RH_CONNECT_REF:-08b17e327a122e1de9eaa6615e7b9cb2a340689e}"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install from https://nodejs.org then re-run this script." >&2
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "git is required. Install git then re-run this script." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUNDLED_CLI="${SCRIPT_DIR}/../connect/bin/cli.js"
if [[ -f "$BUNDLED_CLI" ]]; then
  echo "→ Using bundled connect tool (skill package)..."
  exec node "$BUNDLED_CLI" "$@"
fi

WORKDIR="$(mktemp -d)"
cleanup() { rm -rf "$WORKDIR"; }
trap cleanup EXIT

echo "→ Cloning Rhagent @ ${RH_CONNECT_REF}..."
git clone --depth 1 "$REPO" "$WORKDIR" >/dev/null 2>&1
git -C "$WORKDIR" checkout --quiet "$RH_CONNECT_REF"

echo "→ Starting Robinhood Agentic OAuth (localhost)..."
exec node "$WORKDIR/skill/connect/bin/cli.js" "$@"
