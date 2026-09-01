#!/bin/bash
# Install dependencies for the Clara OpenClaw skill
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "Installing claraid-sdk..."
npm install
echo "Done. Run: node $SCRIPT_DIR/openclaw.mjs help"
