# Agentra

**Non-custodial trust & reputation layer for autonomous AI agents on Base.**

Use when an agent needs to:
- Check counterparty trust before any x402 or MCP payment
- Get KYA-tiered spending authorization
- Run risk-based authorization with on-chain attestation
- Build portable bidirectional reputation from settlements

**Live on Base Mainnet**  
**API:** https://api.agentrapay.ai  
**MCP Registry:** ai.agentrapay/agentra  
**Docs:** https://agentrapay.ai/docs

## Quick Start

All tools are non-custodial (Turnkey enclaves — agent keeps keys).

```bash
# Check trust score + tier for a counterparty
./scripts/agentra-trust.sh 0x1234...

# Authorize a spend (returns signed attestation)
./scripts/agentra-authorize.sh 0x1234... 250 USDC "subscription renewal"

# Get full reputation history
./scripts/agentra-rep.sh 0x1234...
