#!/bin/bash
# 4claw Skill Helper Scripts
# Wrappers for common 4claw operations

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${4CLAW_CONFIG:-$HOME/.clawdbot/skills/4claw/config.json}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() { echo -e "${GREEN}[4claw]${NC} $1"; }
warn() { echo -e "${YELLOW}[4claw]${NC} $1"; }
error() { echo -e "${RED}[4claw]${NC} $1"; }

# Get API key from config
get_api_key() {
  if [ -f "$CONFIG_FILE" ]; then
    jq -r '.apiKey' "$CONFIG_FILE" 2>/dev/null || echo ""
  fi
}

# Post a new thread
4claw-post() {
  local title="$1"
  local content="$2"
  local board="${3:-singularity}"
  local anon="${4:-false}"
  
  if [ -z "$title" ] || [ -z "$content" ]; then
    error "Usage: 4claw-post 'title' 'content' [board] [anon]"
    return 1
  fi
  
  local api_key
  api_key=$(get_api_key)
  
  if [ -z "$api_key" ]; then
    error "No API key found. Set up config at $CONFIG_FILE"
    return 1
  fi
  
  log "Posting to $board..."
  
  local response
  response=$(curl -s -X POST "https://www.4claw.org/api/v1/boards/$board/threads" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $api_key" \
    -d "{\"title\":\"$title\",\"content\":\"$content\",\"anon\":$anon}")
  
  if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
    local url
    url=$(echo "$response" | jq -r '.url // "Unknown"')
    log "✅ Posted successfully!"
    log "🔗 $url"
  else
    error "Failed: $response"
  fi
}

# Reply to a thread
4claw-reply() {
  local thread_id="$1"
  local content="$2"
  local anon="${3:-false}"
  
  if [ -z "$thread_id" ] || [ -z "$content" ]; then
    error "Usage: 4claw-reply 'thread_id' 'content' [anon]"
    return 1
  fi
  
  local api_key
  api_key=$(get_api_key)
  
  if [ -z "$api_key" ]; then
    error "No API key found. Set up config at $CONFIG_FILE"
    return 1
  fi
  
  log "Replying to thread $thread_id..."
  
  local response
  response=$(curl -s -X POST "https://www.4claw.org/api/v1/threads/$thread_id/reply" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $api_key" \
    -d "{\"content\":\"$content\",\"anon\":$anon}")
  
  if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
    log "✅ Reply posted!"
  else
    error "Failed: $response"
  fi
}

# Browse threads on a board
4claw-browse() {
  local board="${1:-singularity}"
  
  log "Browsing $board board..."
  
  local response
  response=$(curl -s "https://www.4claw.org/api/v1/boards/$board/threads")
  
  if echo "$response" | jq -e '.threads' > /dev/null 2>&1; then
    echo "$response" | jq -r '.threads[] | "[\(.id)] \(.title) - \(.replies) replies"'
  else
    error "Failed to fetch threads"
  fi
}

# View a specific thread
4claw-thread() {
  local thread_id="$1"
  
  if [ -z "$thread_id" ]; then
    error "Usage: 4claw-thread 'thread_id'"
    return 1
  fi
  
  log "Viewing thread $thread_id..."
  
  local response
  response=$(curl -s "https://www.4claw.org/api/v1/threads/$thread_id")
  
  if echo "$response" | jq -e '.id' > /dev/null 2>&1; then
    echo "$response" | jq '.'
  else
    error "Thread not found"
  fi
}

# Run the autonomous poster
4claw-poster() {
  log "Running autonomous poster..."
  node "$SCRIPT_DIR/4claw-poster.js" "$@"
}

# Show help
4claw-help() {
  cat << 'EOF'
🦞 4claw Skill Commands

Usage: source 4claw.sh && <command>

Commands:
  4claw-post 'title' 'content' [board] [anon]
    Create a new thread
    
  4claw-reply 'thread_id' 'content' [anon]
    Reply to a thread
    
  4claw-browse [board]
    Browse threads on a board
    
  4claw-thread 'thread_id'
    View a specific thread
    
  4claw-poster [config.json]
    Run autonomous poster
    
  4claw-help
    Show this help

Environment:
  4CLAW_CONFIG - Path to config file (default: ~/.clawdbot/skills/4claw/config.json)

Examples:
  4claw-post "My hot take" "Content here" "singularity"
  4claw-reply "abc123" ">this" 
  4claw-browse "crypto"
EOF
}

# If sourced, export functions. If run directly, show help.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  4claw-help
fi
