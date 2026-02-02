#!/usr/bin/env bash
# x402 Payment Required Test Script
# Tests HTTP 402 payment flow including paywall functionality
# Usage: x402.sh [options]

set -euo pipefail

# Default configuration
DEFAULT_SERVER_URL="http://localhost:4021"
DEFAULT_ENDPOINT="/weather"
FACILITATOR_URL="https://x402.org/facilitator"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1" >&2
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_usage() {
    cat << 'EOF'
x402 Payment Required Test Script

Usage: x402.sh [options]

Options:
  --url <url>           Server URL (default: http://localhost:4021)
  --endpoint <path>     API endpoint to test (default: /weather)
  --query <params>      Query parameters (e.g., "city=Tokyo")
  --decode-only         Only decode PAYMENT-REQUIRED header
  --test-facilitator    Test facilitator connectivity
  --help, -h            Show this help message

Examples:
  # Test default endpoint
  x402.sh

  # Test custom endpoint
  x402.sh --url http://api.example.com --endpoint /premium/data

  # Test with query parameters
  x402.sh --endpoint /weather --query "city=Tokyo&units=metric"

  # Decode payment requirement from header
  x402.sh --decode-only

  # Test facilitator connection
  x402.sh --test-facilitator

Description:
  This script tests HTTP 402 Payment Required functionality by:
  1. Making a request to a protected endpoint
  2. Receiving and decoding the PAYMENT-REQUIRED header
  3. Displaying payment options and requirements
  4. Validating the response format

  The script demonstrates the x402 protocol flow without making actual payments.
EOF
}

# Decode base64 payment header
decode_payment_header() {
    local header="$1"
    echo "$header" | base64 -d 2>/dev/null | jq . 2>/dev/null || {
        log_error "Failed to decode PAYMENT-REQUIRED header"
        return 1
    }
}

# Test facilitator connectivity
test_facilitator() {
    log_info "Testing facilitator connectivity..."
    log_info "Facilitator: $FACILITATOR_URL"
    
    if response=$(curl -sf "$FACILITATOR_URL" -o /dev/null -w "%{http_code}" 2>&1); then
        log_success "Facilitator is reachable (HTTP $response)"
        return 0
    else
        log_error "Facilitator is unreachable"
        log_warning "This may affect payment verification in production"
        return 1
    fi
}

# Test 402 payment flow
test_payment_required() {
    local server_url="$1"
    local endpoint="$2"
    local query="${3:-}"
    
    local full_url="$server_url$endpoint"
    if [ -n "$query" ]; then
        full_url="$full_url?$query"
    fi
    
    log_info "Testing 402 Payment Required flow"
    log_info "URL: $full_url"
    echo
    
    # Make initial request expecting 402
    log_info "Step 1: Making initial request without payment..."
    
    local response_code
    local response_headers
    local response_body
    local payment_required_header
    
    # Capture headers and body separately
    response_headers=$(mktemp)
    response_body=$(mktemp)
    
    # Make request and capture response
    response_code=$(curl -s -w "%{http_code}" \
        -D "$response_headers" \
        -o "$response_body" \
        "$full_url" 2>&1 || echo "000")
    
    echo
    log_info "Response Code: $response_code"
    
    if [ "$response_code" = "402" ]; then
        log_success "Received 402 Payment Required (as expected)"
        echo
        
        # Extract PAYMENT-REQUIRED header
        payment_required_header=$(grep -i "^PAYMENT-REQUIRED:" "$response_headers" | cut -d' ' -f2- | tr -d '\r\n' || echo "")
        
        if [ -z "$payment_required_header" ]; then
            log_error "Missing PAYMENT-REQUIRED header in 402 response"
            log_warning "Response headers:"
            cat "$response_headers"
            rm -f "$response_headers" "$response_body"
            return 1
        fi
        
        log_info "Step 2: Decoding PAYMENT-REQUIRED header..."
        echo
        
        # Decode and display payment requirements
        local payment_data
        if payment_data=$(decode_payment_header "$payment_required_header"); then
            log_success "Payment requirements decoded successfully:"
            echo
            echo "$payment_data" | jq -C '.'
            echo
            
            # Extract and display key information
            log_info "Payment Options:"
            echo "$payment_data" | jq -r '.accepts[] | 
                "  • Scheme: \(.scheme // "N/A")\n" +
                "    Price: \(.price // "N/A")\n" +
                "    Network: \(.network // "N/A")\n" +
                "    Pay To: \(.payTo // "N/A")\n" +
                "    Description: \(.description // "N/A")\n" +
                "    Facilitator: \(.facilitator // "N/A")\n"'
            
            # Display response body if present
            if [ -s "$response_body" ]; then
                echo
                log_info "Response Body:"
                jq -C '.' < "$response_body" 2>/dev/null || cat "$response_body"
            fi
            
            echo
            log_success "402 Payment Required test completed successfully"
            log_info "Next steps:"
            echo "  1. Client would create a payment signature"
            echo "  2. Client would retry request with PAYMENT-SIGNATURE header"
            echo "  3. Server would verify and settle payment via facilitator"
            echo "  4. Server would return resource with PAYMENT-RESPONSE header"
            
        else
            log_error "Failed to decode payment requirements"
            rm -f "$response_headers" "$response_body"
            return 1
        fi
        
    elif [ "$response_code" = "200" ]; then
        log_warning "Received 200 OK (endpoint may not require payment)"
        log_info "Response:"
        jq -C '.' < "$response_body" 2>/dev/null || cat "$response_body"
        
    elif [ "$response_code" = "000" ]; then
        log_error "Failed to connect to server"
        log_error "Is the server running at $server_url?"
        rm -f "$response_headers" "$response_body"
        return 1
        
    else
        log_error "Unexpected response code: $response_code"
        log_info "Response headers:"
        cat "$response_headers"
        echo
        log_info "Response body:"
        cat "$response_body"
        rm -f "$response_headers" "$response_body"
        return 1
    fi
    
    rm -f "$response_headers" "$response_body"
    return 0
}

# Interactive decode mode
interactive_decode() {
    log_info "Interactive PAYMENT-REQUIRED Header Decoder"
    echo
    echo "Paste the base64-encoded PAYMENT-REQUIRED header value and press Enter:"
    read -r header_value
    
    if [ -z "$header_value" ]; then
        log_error "No input provided"
        return 1
    fi
    
    echo
    log_info "Decoding header..."
    if decoded=$(decode_payment_header "$header_value"); then
        log_success "Decoded successfully:"
        echo
        echo "$decoded" | jq -C '.'
    else
        return 1
    fi
}

# Main execution
main() {
    local server_url="$DEFAULT_SERVER_URL"
    local endpoint="$DEFAULT_ENDPOINT"
    local query=""
    local decode_only=false
    local test_facilitator_only=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --url)
                server_url="$2"
                shift 2
                ;;
            --endpoint)
                endpoint="$2"
                shift 2
                ;;
            --query)
                query="$2"
                shift 2
                ;;
            --decode-only)
                decode_only=true
                shift
                ;;
            --test-facilitator)
                test_facilitator_only=true
                shift
                ;;
            --help|-h)
                print_usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                echo
                print_usage
                exit 1
                ;;
        esac
    done
    
    # Check dependencies
    for cmd in curl jq base64; do
        if ! command -v "$cmd" &> /dev/null; then
            log_error "Required command not found: $cmd"
            log_info "Please install $cmd to use this script"
            exit 1
        fi
    done
    
    # Execute requested action
    if [ "$test_facilitator_only" = true ]; then
        test_facilitator
        exit $?
    fi
    
    if [ "$decode_only" = true ]; then
        interactive_decode
        exit $?
    fi
    
    # Run the full test
    test_payment_required "$server_url" "$endpoint" "$query"
}

# Run main if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
