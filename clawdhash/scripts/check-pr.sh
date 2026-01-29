#!/bin/bash
# Check a PR for common security red flags
# Usage: ./check-pr.sh <owner/repo> <pr-number>

set -e

REPO="${1:?Usage: $0 <owner/repo> <pr-number>}"
PR="${2:?Usage: $0 <owner/repo> <pr-number>}"

echo "🔍 Checking PR #$PR in $REPO..."
echo ""

# Get PR diff
DIFF=$(gh pr diff "$PR" --repo "$REPO" 2>/dev/null || echo "")

if [ -z "$DIFF" ]; then
    echo "❌ Could not fetch PR diff"
    exit 1
fi

# Check for red flags
RED_FLAGS=0

echo "=== Security Checks ==="
echo ""

# Ownership changes
if echo "$DIFF" | grep -qiE "(transferOwnership|renounceOwnership|_transferOwnership)"; then
    echo "🚨 OWNERSHIP: Found ownership-related changes"
    RED_FLAGS=$((RED_FLAGS + 1))
else
    echo "✅ OWNERSHIP: No ownership changes detected"
fi

# Fund movement
if echo "$DIFF" | grep -qiE "(\.transfer\(|\.send\(|\.call\{value|withdraw|emergencyWithdraw)"; then
    echo "🚨 FUNDS: Found fund movement logic"
    RED_FLAGS=$((RED_FLAGS + 1))
else
    echo "✅ FUNDS: No fund movement detected"
fi

# Unsafe randomness
if echo "$DIFF" | grep -qiE "(block\.timestamp|blockhash|block\.number)" | grep -qiE "(random|seed|lottery)"; then
    echo "🚨 RANDOMNESS: Potential unsafe randomness"
    RED_FLAGS=$((RED_FLAGS + 1))
else
    echo "✅ RANDOMNESS: No unsafe randomness patterns"
fi

# Admin roles
if echo "$DIFF" | grep -qiE "(grantRole|revokeRole|_setupRole|DEFAULT_ADMIN_ROLE)"; then
    echo "🚨 ADMIN: Found admin role changes"
    RED_FLAGS=$((RED_FLAGS + 1))
else
    echo "✅ ADMIN: No admin role changes"
fi

# Deployment scripts
if echo "$DIFF" | grep -qiE "(deploy|\.s\.sol|broadcast)"; then
    echo "⚠️  DEPLOY: Found deployment-related changes (review carefully)"
else
    echo "✅ DEPLOY: No deployment scripts modified"
fi

echo ""
echo "=== Summary ==="
if [ $RED_FLAGS -gt 0 ]; then
    echo "🚨 Found $RED_FLAGS potential security concern(s)"
    echo "   Manual review required before approval"
    exit 1
else
    echo "✅ No critical red flags detected"
    echo "   Safe to review for code quality"
    exit 0
fi
