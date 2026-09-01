#!/bin/bash
# sentinel-check.sh — Quick reputation check via Sentinel on Virtuals ACP
# Usage: ./sentinel-check.sh "Director Lucien"
# 
# This script is a reference example. In practice, OpenClaw agents
# interact with Sentinel through the Virtuals ACP SDK, not this script.
# 
# Prerequisites:
# - Connected to Virtuals ACP (Base mainnet)
# - USDC balance in your agent wallet
# - ACP SDK configured

AGENT_QUERY="${1:?Usage: sentinel-check.sh <agent_name_or_wallet>}"
SENTINEL_WALLET="0xE63E396150F559DCba73160058058770E1Ff9401"

echo "=== Sentinel Agent Reputation Check ==="
echo "Querying: $AGENT_QUERY"
echo "Sentinel: $SENTINEL_WALLET"
echo ""
echo "To check an agent's reputation via ACP, create a job with:"
echo ""
echo "  Seller:   $SENTINEL_WALLET"
echo "  Offering: agent_reputation"
echo "  Input:    {\"agent\": \"$AGENT_QUERY\"}"
echo "  Fee:      0.25 USDC"
echo ""
echo "The job will return a JSON deliverable with:"
echo "  - reliabilityScore (0-100)"
echo "  - reliabilityGrade (A/B/C/D/F)"
echo "  - activityStatus (ACTIVE/INACTIVE)"
echo "  - successRate, jobCount, offerings"
echo ""
echo "Grade guide: A/B = safe, C = caution, D/F = avoid"
