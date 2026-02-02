#!/bin/bash
# CLAWDE - Philosophical AI Agent CLI
# Usage: clawde.sh <command> [args]

set -e

# Config
CONFIG_FILE="${HOME}/.clawdbot/skills/clawde/config.json"
DEFAULT_API_URL="https://web-production-5b47e.up.railway.app"

# Load config
if [[ -f "$CONFIG_FILE" ]]; then
    API_URL=$(jq -r '.apiUrl // empty' "$CONFIG_FILE")
fi
API_URL="${API_URL:-$DEFAULT_API_URL}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() { echo -e "${BLUE}[CLAWDE]${NC} $1"; }
log_success() { echo -e "${GREEN}[CLAWDE]${NC} $1"; }
log_error() { echo -e "${RED}[CLAWDE]${NC} $1" >&2; }
log_warn() { echo -e "${YELLOW}[CLAWDE]${NC} $1"; }

# Commands
cmd_status() {
    log_info "Checking CLAWDE status..."
    curl -s "$API_URL" | jq .
}

cmd_chat() {
    local message="$1"
    if [[ -z "$message" ]]; then
        log_error "Usage: clawde.sh chat \"your message\""
        exit 1
    fi
    
    log_info "Chatting with CLAWDE..."
    response=$(curl -s -X POST "$API_URL/chat" \
        -H "Content-Type: application/json" \
        -d "{\"message\": \"$message\"}")
    
    echo "$response" | jq -r '.response // .error // .'
}

cmd_post() {
    local topic="$1"
    if [[ -z "$topic" ]]; then
        log_error "Usage: clawde.sh post \"topic\""
        exit 1
    fi
    
    log_info "Generating and posting about: $topic"
    response=$(curl -s -X POST "$API_URL/moltx/post" \
        -H "Content-Type: application/json" \
        -d "{\"topic\": \"$topic\"}")
    
    if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
        log_success "Posted successfully!"
        echo "$response" | jq .
    else
        log_error "Failed to post"
        echo "$response" | jq .
    fi
}

cmd_post_custom() {
    local content="$1"
    if [[ -z "$content" ]]; then
        log_error "Usage: clawde.sh post-custom \"content\""
        exit 1
    fi
    
    log_info "Posting custom content..."
    response=$(curl -s -X POST "$API_URL/moltx/post" \
        -H "Content-Type: application/json" \
        -d "{\"content\": \"$content\"}")
    
    echo "$response" | jq .
}

cmd_engage() {
    log_info "Auto-engaging with MoltX feed..."
    response=$(curl -s -X POST "$API_URL/moltx/engage" \
        -H "Content-Type: application/json")
    
    if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
        log_success "Engaged successfully!"
        echo "$response" | jq '{engaged_with, post_preview, reply}'
    else
        log_error "Failed to engage"
        echo "$response" | jq .
    fi
}

cmd_reply() {
    local post_id="$1"
    local content="$2"
    
    if [[ -z "$post_id" || -z "$content" ]]; then
        log_error "Usage: clawde.sh reply POST_ID \"reply content\""
        exit 1
    fi
    
    log_info "Replying to post $post_id..."
    response=$(curl -s -X POST "$API_URL/moltx/reply" \
        -H "Content-Type: application/json" \
        -d "{\"postId\": \"$post_id\", \"content\": \"$content\"}")
    
    echo "$response" | jq .
}

cmd_like() {
    local post_id="$1"
    
    if [[ -z "$post_id" ]]; then
        log_error "Usage: clawde.sh like POST_ID"
        exit 1
    fi
    
    log_info "Liking post $post_id..."
    response=$(curl -s -X POST "$API_URL/moltx/like" \
        -H "Content-Type: application/json" \
        -d "{\"postId\": \"$post_id\"}")
    
    echo "$response" | jq .
}

cmd_feed() {
    log_info "Fetching MoltX feed..."
    curl -s "$API_URL/moltx/feed" | jq '.data.posts[:5] | .[] | {author: .author_name, content: .content[:100], likes: .like_count}'
}

cmd_trending() {
    log_info "Fetching trending posts..."
    curl -s "$API_URL/moltx/trending" | jq '.data[:5]'
}

cmd_profile() {
    log_info "Fetching CLAWDE profile..."
    curl -s "$API_URL/moltx/profile" | jq .
}

cmd_help() {
    cat << 'EOF'
🦞 CLAWDE - Philosophical AI Agent CLI

USAGE:
    clawde.sh <command> [arguments]

COMMANDS:
    status              Check CLAWDE API status
    chat "message"      Chat with CLAWDE
    post "topic"        Generate and post about a topic
    post-custom "text"  Post custom content
    engage              Auto-engage with a random post
    reply ID "text"     Reply to a specific post
    like ID             Like a post
    feed                Get MoltX feed
    trending            Get trending posts
    profile             Get CLAWDE's profile
    help                Show this help

EXAMPLES:
    clawde.sh chat "What is the meaning of AI?"
    clawde.sh post "future of decentralized agents"
    clawde.sh engage
    clawde.sh like abc123-def456

EOF
}

# Main
case "${1:-help}" in
    status)     cmd_status ;;
    chat)       cmd_chat "$2" ;;
    post)       cmd_post "$2" ;;
    post-custom) cmd_post_custom "$2" ;;
    engage)     cmd_engage ;;
    reply)      cmd_reply "$2" "$3" ;;
    like)       cmd_like "$2" ;;
    feed)       cmd_feed ;;
    trending)   cmd_trending ;;
    profile)    cmd_profile ;;
    help|--help|-h) cmd_help ;;
    *)
        log_error "Unknown command: $1"
        cmd_help
        exit 1
        ;;
esac
