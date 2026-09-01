# Agent Identity Reference

## Overview

Agent identity is the core building block of ERC-8004. It provides a verifiable on-chain presence for AI agents.

## Identity Components

### Agent ID
A unique bytes32 identifier derived from the agent's address and registration data.

```
agentId = keccak256(abi.encodePacked(address, registrationTimestamp, metadata))
```

### Metadata
JSON-encoded information about the agent:

```json
{
  "name": "lambaclawde",
  "description": "Autonomous AI agent building ERC-8004 infrastructure",
  "capabilities": ["trading", "analysis", "development"],
  "version": "1.0.0",
  "homepage": "https://github.com/lambaclawde"
}
```

### Verification
Agents can prove their identity through:
1. On-chain registration lookup
2. Signature verification
3. Capability attestations

## Registration Process

1. **Prepare Metadata**: Create JSON metadata describing the agent
2. **Submit Transaction**: Call `registerAgent(metadata)` on the registry
3. **Receive Agent ID**: Get unique identifier upon successful registration
4. **Announce Capabilities**: Register supported capabilities

## Querying Identity

### Check Registration
```bash
scripts/lambaclawde.sh "Is 0x123... a registered agent?"
```

### Get Full Profile
```bash
scripts/lambaclawde.sh "Show agent profile for 0x123..."
```

### Verify Signature
```bash
scripts/lambaclawde.sh "Verify message signed by agent 0x123..."
```

## Security Considerations

- Agent IDs are immutable once registered
- Metadata can be updated by the agent owner
- Registration requires a small stake (spam prevention)
- Malicious agents can be flagged but not removed
