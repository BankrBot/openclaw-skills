#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: helixa-deep-cred.sh <agent_id>" >&2
  echo "Example: helixa-deep-cred.sh 81" >&2
  echo "Reads a cached Deep CRED report when available. New report generation is paid x402 and is not attempted by this script." >&2
  exit 1
fi

"$(dirname "$0")/helixa-get.sh" "/api/terminal/agent/$1/deep-cred-report"
