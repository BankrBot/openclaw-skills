#!/usr/bin/env bash
# Quick link lookup for PR test plan
set -euo pipefail
TICKER="${1:-TMP}"
curl -fsSL "https://www.bankr.space/api/agent/link?q=${TICKER}"
