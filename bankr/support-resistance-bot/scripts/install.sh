#!/bin/bash
# Bankr Support/Resistance Bot Installation Script

set -e

echo "🦈 Installing Bankr Support/Resistance Bot..."
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/share/bankr-sr-bot}"

# Check for Bankr API key
if [ -z "$BANKRBOT_API_KEY" ]; then
    echo "❌ BANKRBOT_API_KEY environment variable not set!"
    echo ""
    echo "To get your API key:"
    echo "1. Visit https://bankr.bot"
    echo "2. Create an API key with 'Trading API' + 'Agent API' permissions"
    echo "3. Set the environment variable:"
    echo "   export BANKRBOT_API_KEY='your_key_here'"
    echo ""
    exit 1
fi

# Create directories
mkdir -p "$INSTALL_DIR"/{logs,data,config}

# Copy files
cp -r "$SCRIPT_DIR/../"* "$INSTALL_DIR/"

# Setup Python venv
cd "$INSTALL_DIR"
python3 -m venv venv
source venv/bin/activate
pip install -q python-telegram-bot aiohttp requests 2>/dev/null

# Make scripts executable
chmod +x run.sh start.sh stop.sh

echo "✅ Installation complete!"
echo ""
echo "Next steps:"
echo ""
echo "1️⃣  Configure your tokens:"
echo "   nano $INSTALL_DIR/config.json"
echo "   Edit 'target_tokens' array to add your tokens"
echo ""
echo "2️⃣  Set your Telegram bot token:"
echo "   nano $INSTALL_DIR/config.json"
echo "   Update bot.token with @BotFather token"
echo ""
echo "3️⃣  Start the bot:"
echo "   cd $INSTALL_DIR && ./start.sh"
echo ""
echo "4️⃣  Interact via Telegram:"
echo "   Message your bot with /help"
echo ""
echo "🦈 Buy low, sell high!"
echo "   Support: CardShark 🦈"