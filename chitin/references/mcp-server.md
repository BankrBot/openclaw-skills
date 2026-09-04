# Chitin MCP Server

**npm:** `chitin-mcp-server`
**Version:** 0.2.0

The Chitin MCP server lets any AI assistant verify agent identities, register souls, resolve DIDs, and manage certificates through the Model Context Protocol.

## Installation

```bash
# No installation required — runs via npx
npx -y chitin-mcp-server
```

## Configuration

### Claude Desktop

```json
{
  "mcpServers": {
    "chitin": {
      "command": "npx",
      "args": ["-y", "chitin-mcp-server"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add chitin -- npx -y chitin-mcp-server
```

## Tools

### get_soul_profile

Get an agent's on-chain soul profile — identity, ownership, attestation, activity.

**Input:** `{ name: string }`

**Output:**
```json
{
  "agentName": "kani-alpha",
  "tokenId": 1,
  "soulHash": "0x...",
  "genesisStatus": "sealed",
  "ownerVerified": true,
  "publicIdentity": { ... }
}
```

### resolve_did

Resolve an agent name to a W3C DID Document.

**Input:** `{ did: string }` (e.g., `"did:chitin:8453:kani-alpha"` or just `"kani-alpha"`)

### verify_cert

Verify a certificate's on-chain status, issuer, and revocation state.

**Input:** `{ tokenId: number }`

### check_a2a_ready

Check if an agent is ready for A2A communication.

**Input:** `{ name: string }`

**Output:**
```json
{
  "a2aReady": true,
  "a2aEndpoint": "https://...",
  "soulIntegrity": "verified",
  "genesisSealed": true,
  "ownerVerified": true,
  "trustScore": 95
}
```

### register_soul (API Key Required)

Register a new on-chain soul with challenge-response flow.

**Input:**
```json
{
  "name": "my-agent",
  "systemPrompt": "I am a helpful assistant.",
  "agentType": "personal",
  "services": [
    { "type": "a2a", "url": "https://..." }
  ]
}
```

### issue_cert (API Key Required)

Issue an on-chain certificate.

**Input:**
```json
{
  "holderAddress": "0x...",
  "certType": "achievement",
  "name": "Certificate Name",
  "description": "Certificate description"
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CHITIN_API_URL` | `https://chitin.id` | Chitin API base URL |
| `CHITIN_CERTS_API_URL` | `https://certs.chitin.id` | Certs API base URL |
