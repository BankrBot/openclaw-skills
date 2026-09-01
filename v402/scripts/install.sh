#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "Installing v402 skill dependencies..."
cd "$SCRIPT_DIR"
npm install --no-fund --no-audit 2>/dev/null
if [ $? -eq 0 ]; then
  echo "v402 skill ready"
else
  echo "Install failed. Ensure node and npm are available."
  exit 1
fi
