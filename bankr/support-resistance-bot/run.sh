#!/bin/bash
# Hourly Market Analysis Runner
# Monitors token metrics and logs data for review

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"
VENV_PATH="$HOME/cua-env/bin/activate"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Load API key from .env file (if not already set)
if [ -z "$BANKRBOT_API_KEY" ] && [ -f "$SCRIPT_DIR/.env" ]; then
    echo "[$(date)] Loading API key from .env file..."
    source "$SCRIPT_DIR/.env"
fi

# Export API keys (must be set via environment variable or .env file)
if [ -z "$BANKRBOT_API_KEY" ]; then
    echo "❌ Error: BANKRBOT_API_KEY not set"
    echo "Either:"
    echo "  1. Set environment variable: export BANKRBOT_API_KEY='your_key'"
    echo "  2. Create .env file in script directory with: export BANKRBOT_API_KEY=your_key"
    echo "Get your API key at: https://bankr.bot"
    exit 1
fi
export BANKRBOT_API_KEY="$BANKRBOT_API_KEY"

# Timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo "[$(date)] Starting Market Analysis..."

# Activate virtual environment if exists
if [ -f "$VENV_PATH" ]; then
    source "$VENV_PATH"
fi

# Run the analysis script
python3 "$SCRIPT_DIR/sentiment_arbitrage.py" 2>&1 | tee -a "$LOG_DIR/analysis_$TIMESTAMP.log"

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "[$(date)] ✅ Market Analysis completed successfully"
else
    echo "[$(date)] ❌ Market Analysis failed with exit code $EXIT_CODE"
fi

exit $EXIT_CODE