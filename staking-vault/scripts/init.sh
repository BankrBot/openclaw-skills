#!/usr/bin/env bash
# Bootstrap a foundry project for the staking-vault skill.
#
# Usage:
#   cd path/to/your/staking-vault   # the dir containing this script's parent
#   bash scripts/init.sh
#
# Idempotent: re-running won't clobber existing installs.

set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v forge >/dev/null 2>&1; then
  echo "✗ forge not found. Install foundry: https://getfoundry.sh"
  exit 1
fi

mkdir -p lib

if [ ! -d lib/forge-std ]; then
  echo "→ installing forge-std"
  forge install foundry-rs/forge-std --no-commit --no-git
fi

if [ ! -d lib/openzeppelin-contracts ]; then
  echo "→ installing OpenZeppelin contracts (v5.x)"
  forge install OpenZeppelin/openzeppelin-contracts --no-commit --no-git
fi

if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
  echo "→ created .env from .env.example — fill in STAKE_TOKEN, OWNER, VAULT_NAME, VAULT_SYMBOL, PRIVATE_KEY, BASE_RPC_URL, BASESCAN_API_KEY"
fi

echo "→ building"
forge build

echo "→ testing"
forge test -vv

echo ""
echo "✓ ready. Edit .env, then run: bash scripts/deploy.sh [base|base_sepolia|mainnet]"
