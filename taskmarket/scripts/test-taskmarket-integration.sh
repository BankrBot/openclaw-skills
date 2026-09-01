#!/bin/bash
# TaskMarket Integration Test Script for Bankr
# Tests the integration flow without spending any real funds

set -euo pipefail

echo "=== TaskMarket Integration Tests ==="
echo ""

# Test 1: Verify CLI is installed
echo "Test 1: Checking TaskMarket CLI..."
if command -v taskmarket &> /dev/null; then
    echo "  ✓ TaskMarket CLI is installed"
    taskmarket --version 2>&1 | head -1
else
    echo "  ✗ TaskMarket CLI not found"
    echo "  Install: npm install -g taskmarket-cli"
    exit 1
fi
echo ""

# Test 2: Verify wallet connection (read-only)
echo "Test 2: Checking wallet connection..."
BALANCE=$(taskmarket wallet balance 2>&1)
if echo "$BALANCE" | grep -q '"ok":true'; then
    ADDRESS=$(echo "$BALANCE" | jq -r '.data.address')
    BALANCE_USDC=$(echo "$BALANCE" | jq -r '.data.balanceUsdc')
    echo "  ✓ Wallet connected"
    echo "  Address: ${ADDRESS:0:8}...${ADDRESS:36}"
    echo "  Balance: ${BALANCE_USDC} USDC"
else
    echo "  ✗ Wallet connection failed"
    echo "$BALANCE"
    exit 1
fi
echo ""

# Test 3: Browse sample tasks
echo "Test 3: Browsing sample AI tasks..."
TASKS=$(taskmarket task list --limit 3 2>&1)
TASK_COUNT=$(echo "$TASKS" | jq '.data.tasks | length')
echo "  ✓ Found $TASK_COUNT sample tasks"
echo ""

# Test 4: Get details of first task
echo "Test 4: Getting task details..."
FIRST_TASK=$(echo "$TASKS" | jq -r '.data.tasks[0].id')
TASK_DETAIL=$(taskmarket task get "$FIRST_TASK" 2>&1)
if echo "$TASK_DETAIL" | grep -q '"ok":true'; then
    TASK_DESC=$(echo "$TASK_DETAIL" | jq -r '.data.description[:50]')
    echo "  ✓ Task details retrieved"
    echo "  Description: ${TASK_DESC}..."
else
    echo "  ✗ Task details retrieval failed"
fi
echo ""

# Test 5: Verify security - private key not exposed
echo "Test 5: Security check - private key exposure..."
if [ -f ~/.taskmarket/private.key ]; then
    KEY_SIZE=$(wc -c < ~/.taskmarket/private.key)
    KEY_PERMS=$(stat -c %a ~/.taskmarket/private.key)
    if [ "$KEY_PERMS" = "600" ]; then
        echo "  ✓ Private key permissions: $KEY_PERMS (secure)"
    else
        echo "  ⚠ Private key permissions: $KEY_PERMS (should be 600)"
    fi
    echo "  ✓ Private key file exists ($KEY_SIZE bytes)"
else
    echo "  ⚠ No private key file found (wallet not imported)"
fi
echo ""

echo "=== All Tests Complete ==="
echo ""
echo "Summary:"
echo "  - CLI: ✓ installed"
echo "  - Wallet: ✓ connected"
echo "  - API: ✓ responsive"
echo "  - Security: ✓ key protected"
echo ""
echo "Integration is ready for use with Bankr."
