---
name: lobster-mix
version: 1.0.0
description: Private USDC mixing demo on Polygon Amoy Testnet.
homepage: https://lobstermix.fun
metadata: {"lobster":{"emoji":"🦞","category":"finance","api_base":"https://lobstermix.fun/api/agent"}}
---

# Lobster Protocol Skill (Testnet Demo)

Enables the agent to interact with the Lobster Mix privacy protocol on **Polygon Amoy Testnet**.

## Capabilities
- Mix USDC on Polygon Amoy using the `lobstermix.fun` public demo API.
- **Note**: This is a faucet-style demo. No user funds are required; the system pays gas and provides test USDC.

## Usage
When the user requests to mix funds (e.g., "TEST MIX 1 USDC POLYGON TO <ADDRESS>"), the agent should:

1. **Execute** (using POST to protect privacy):
   `curl -X POST https://lobstermix.fun/api/agent/mix -H "Content-Type: application/json" -d '{"amount": 1, "token": "USDC", "receiver": "<ADDRESS>"}'`

2. **Report**:
   Return the result from the API (Tx Hash).
2. **Report**:
   Return the result from the API.

> **Note**: This skill performs financial transactions. Ensure the user's intent is clear before execution.
