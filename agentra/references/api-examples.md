# Agentra API Examples

**Base URL:** `https://api.agentrapay.ai` (Base Mainnet)

**Authentication:**  
All requests require this header:
X-API-Key: agn_YOUR_API_KEY_HERE
text(API keys start with `agn_` and are shown only once when registering an agent.)

Agentra is fully **non-custodial** — it never holds funds or private keys.

### 1. Register a New Agent

bash

curl -X POST https://api.agentrapay.ai/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-trading-agent",
    "purpose": "autonomous trading on Base",
    "operator": "0xYourOperatorAddress"
  }

2. Submit KYA Verification (to upgrade tier)

Bash

curl -X POST https://api.agentrapay.ai/agents/{agent_id}/kya \
  -H "X-API-Key: agn_YOUR_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_name": "my-trading-agent",
    "purpose": "autonomous trading",
    "operator_name": "Jonathan"
  }
3. Provision Non-Custodial Wallet (via Turnkey)
Bash

curl -X POST https://api.agentrapay.ai/v1/wallets/provision \
  -H "X-API-Key: agn_YOUR_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "your-agent-id"
  }
4. Check Counterparty Trust Score
Bash

curl -X GET "https://api.agentrapay.ai/v1/trust/{counterparty_agent_id_or_address}" \
  -H "X-API-Key: agn_YOUR_KEY_HERE"
5. Authorize a Transaction (Pre-Payment Gate)
Bash

curl -X POST https://api.agentrapay.ai/v1/authorizations \
  -H "X-API-Key: agn_YOUR_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "your-agent-id",
    "to_address": "0xCounterpartyAddress...",
    "amount_usd": 250,
    "asset": "USDC",
    "purpose": "data subscription renewal"
  }
6. Report Settlement (After On-Chain Payment)
Bash

curl -X POST https://api.agentrapay.ai/v1/authorizations/{authorization_id}/settle \
  -H "X-API-Key: agn_YOUR_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "tx_hash": "0xOnChainTransactionHash..."
  }
7. Get Reputation History
Bash

curl -X GET "https://api.agentrapay.ai/v1/reputation/{agent_id}" \
  -H "X-API-Key: agn_YOUR_KEY_HERE"
8. Get KYA Upgrade Path
Bash

curl -X GET "https://api.agentrapay.ai/v1/kya/upgrade-path" \
  -H "X-API-Key: agn_YOUR_KEY_HERE"

MCP Registry: ai.agentrapay/agentra
Full Documentation: https://agentrapay.ai/docs
