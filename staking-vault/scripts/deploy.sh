#!/usr/bin/env bash
# Deploy StakingVault.
#
# Usage:
#   bash scripts/deploy.sh                  # defaults to base
#   bash scripts/deploy.sh base_sepolia
#   bash scripts/deploy.sh mainnet
#
# Reads STAKE_TOKEN, OWNER, VAULT_NAME, VAULT_SYMBOL, COOLDOWN_PERIOD,
# WITHDRAW_WINDOW, PRIVATE_KEY and the network's RPC + scan key from .env.

set -euo pipefail

cd "$(dirname "$0")/.."

NETWORK="${1:-base}"

if [ ! -f .env ]; then
  echo "✗ .env not found. Run scripts/init.sh first."
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

: "${STAKE_TOKEN:?STAKE_TOKEN must be set in .env}"
: "${OWNER:?OWNER must be set in .env}"
: "${VAULT_NAME:?VAULT_NAME must be set in .env}"
: "${VAULT_SYMBOL:?VAULT_SYMBOL must be set in .env}"
: "${PRIVATE_KEY:?PRIVATE_KEY must be set in .env}"

echo "→ deploying StakingVault to $NETWORK"
echo "  stake token : $STAKE_TOKEN"
echo "  owner       : $OWNER"
echo "  name/symbol : $VAULT_NAME / $VAULT_SYMBOL"
echo "  cooldown    : ${COOLDOWN_PERIOD:-259200}s"
echo "  window      : ${WITHDRAW_WINDOW:-172800}s"

forge script script/Deploy.s.sol \
  --rpc-url "$NETWORK" \
  --broadcast \
  --verify \
  --slow \
  --private-key "$PRIVATE_KEY"
