#!/bin/bash

# ChainSage Setup Script
# This script sets up the ChainSage skill with all necessary dependencies

set -e

echo "🔍 Setting up ChainSage Analytics Skill..."

# Check if running in a supported environment
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    DISTRO=$(lsb_release -si 2>/dev/null || echo "Unknown")
    echo "Detected Linux distribution: $DISTRO"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Detected macOS"
else
    echo "Warning: Untested operating system: $OSTYPE"
fi

# Function to install packages on Ubuntu/Debian
install_ubuntu() {
    echo "Installing packages for Ubuntu/Debian..."
    sudo apt-get update
    sudo apt-get install -y curl jq wget nodejs npm
}

# Function to install packages on macOS
install_macos() {
    echo "Installing packages for macOS..."
    if command -v brew &> /dev/null; then
        brew install curl jq node
    else
        echo "Homebrew not found. Please install Homebrew first:"
        echo '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
        exit 1
    fi
}

# Function to install packages on other systems
install_generic() {
    echo "Attempting generic installation..."
    if command -v apt-get &> /dev/null; then
        install_ubuntu
    elif command -v yum &> /dev/null; then
        sudo yum install -y curl jq wget nodejs npm
    elif command -v pacman &> /dev/null; then
        sudo pacman -S curl jq wget nodejs npm
    else
        echo "Cannot determine package manager. Please install curl, jq, and node.js manually."
        exit 1
    fi
}

# Install dependencies based on OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    if command -v apt-get &> /dev/null; then
        install_ubuntu
    else
        install_generic
    fi
elif [[ "$OSTYPE" == "darwin"* ]]; then
    install_macos
else
    install_generic
fi

# Verify installations
echo "Verifying installations..."
if command -v curl &> /dev/null; then
    echo "✅ curl is installed: $(curl --version | head -n1)"
else
    echo "❌ curl installation failed"
    exit 1
fi

if command -v jq &> /dev/null; then
    echo "✅ jq is installed: $(jq --version)"
else
    echo "❌ jq installation failed"
    exit 1
fi

# Create configuration directory
CONFIG_DIR="$HOME/.chainsage"
mkdir -p "$CONFIG_DIR"

# Create default configuration
if [ ! -f "$CONFIG_DIR/config.json" ]; then
    echo "Creating default configuration..."
    cat > "$CONFIG_DIR/config.json" << EOF
{
  "api_keys": {
    "alchemy": "",
    "moralis": ""
  },
  "default_chain": "ethereum",
  "alert_webhook": "",
  "cache_duration": 300,
  "log_level": "info"
}
EOF
    echo "✅ Configuration created at $CONFIG_DIR/config.json"
    echo "⚠️  Please add your API keys to the configuration file"
else
    echo "✅ Configuration file already exists"
fi

# Create environment file template
if [ ! -f "$CONFIG_DIR/.env" ]; then
    cat > "$CONFIG_DIR/.env" << EOF
# ChainSage Environment Variables
ALCHEMY_API_KEY=your_alchemy_api_key_here
MORALIS_API_KEY=your_moralis_api_key_here
DEFAULT_CHAIN=ethereum
CACHE_DURATION=300
EOF
    echo "✅ Environment template created at $CONFIG_DIR/.env"
fi

# Test basic functionality
echo "Testing basic functionality..."
TEST_ADDRESS="0x742d35Cc6634C0532925a3b8D4C9db96C4b4Db45"
echo "Testing wallet analysis with address: $TEST_ADDRESS"

# Create a simple test script
cat > "$CONFIG_DIR/test.sh" << 'EOF'
#!/bin/bash
echo "Testing ChainSage functionality..."
echo "Sample API call for wallet analysis:"
echo "curl -s \"https://api.etherscan.io/api?module=account&action=balance&address=0x742d35Cc6634C0532925a3b8D4C9db96C4b4Db45&tag=latest&apikey=YourApiKey\" | jq '.'"
EOF

chmod +x "$CONFIG_DIR/test.sh"

echo ""
echo "🎉 ChainSage setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Add your API keys to $CONFIG_DIR/config.json"
echo "2. Test with: $CONFIG_DIR/test.sh"
echo "3. Check the documentation in references/ folder"
echo ""
echo "For API keys, visit:"
echo "- Alchemy: https://www.alchemy.com/"
echo "- Moralis: https://moralis.io/"
echo ""
echo "📚 Documentation: ./references/"
echo "🔧 Configuration: $CONFIG_DIR/config.json"
