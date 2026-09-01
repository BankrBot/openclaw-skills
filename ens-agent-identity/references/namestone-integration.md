# NameStone Integration

[NameStone](https://namestone.com) is a managed offchain ENS subname service powering 9M+ subnames across 250+ domains. It provides gasless subname registration and text record management for `bankr.eth` agent names.

## Setup

### 1. Set Resolver (one-time, on-chain)

Set `bankr.eth`'s resolver to NameStone's Hybrid Resolver:

```
Resolver: 0xA87361C4E58B619c390f469B9E6F27d759715125
```

This is a single on-chain transaction on Ethereum mainnet.

### 2. Get API Key

Obtain a free API key via Sign-In with Ethereum (SIWE) at [namestone.com](https://namestone.com).

```bash
export NAMESTONE_API_KEY="your-api-key"
```

### 3. Install SDK (optional)

```bash
npm install @namestone/namestone-sdk
```

## API Reference

### Register a Subname

```bash
curl -X POST "https://namestone.com/api/public_v1/set-name" \
  -H "Authorization: $NAMESTONE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "alpha-go",
    "domain": "bankr.eth",
    "address": "0x703ae03fB120eC91e9Ed6d08Ce8044E498CC789B",
    "text_records": {
      "agent:type": "trading-bot",
      "agent:capabilities": "swap,bridge,limit-order",
      "agent:chains": "base,ethereum"
    }
  }'
```

### TypeScript SDK

```typescript
import NameStone from "@namestone/namestone-sdk";
const ns = new NameStone(process.env.NAMESTONE_API_KEY);

// Register agent with metadata
await ns.setName({
  name: "alpha-go",
  domain: "bankr.eth",
  address: "0x703ae03fB120eC91e9Ed6d08Ce8044E498CC789B",
  text_records: {
    "agent:type": "trading-bot",
    "agent:capabilities": "swap,bridge,limit-order,dca",
    "agent:chains": "base,ethereum,polygon",
    "agent:a2a": "https://api.bankr.bot/agent/alpha-go",
    "agent:version": "2.1.0",
    "agent:creator": "estmcmxci.eth"
  }
});
```

### Get a Name

```bash
curl "https://namestone.com/api/public_v1/get-names?domain=bankr.eth&name=alpha-go" \
  -H "Authorization: $NAMESTONE_API_KEY"
```

### Search Names

```bash
# Find all agents under bankr.eth
curl "https://namestone.com/api/public_v1/search-names?domain=bankr.eth" \
  -H "Authorization: $NAMESTONE_API_KEY"
```

### Delete a Name

```bash
curl -X POST "https://namestone.com/api/public_v1/delete-name" \
  -H "Authorization: $NAMESTONE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "alpha-go",
    "domain": "bankr.eth"
  }'
```

## How CCIP-Read Works

NameStone uses [EIP-3668 (CCIP-Read)](https://eips.ethereum.org/EIPS/eip-3668) for gasless resolution:

```
1. Client calls resolve() on the NameStone Hybrid Resolver
2. Resolver reverts with OffchainLookup(url, calldata)
3. Client fetches the signed response from NameStone's gateway
4. Client calls resolver again with the signed proof
5. Resolver verifies the signature and returns the data
```

This means:
- **Registration is free** (no on-chain transaction per subname)
- **Resolution is trustless** (cryptographically signed responses)
- **Standard ENS clients work** (any client supporting CCIP-Read)

## Text Record Management

NameStone supports arbitrary text records as `Record<string, string>`. This means the full `agent:*` schema and ENSIP-25 verification records can be written at registration time or updated later.

### Updating Records

To update text records on an existing subname, call `setName` again with the same name and domain. **NameStone overwrites the entire record** — you must include all text records in each call, not just the ones you want to change. Records omitted from the update will be removed.

### ENSIP-25 Records

ENSIP-25 verification records can be set as text records:

```typescript
await ns.setName({
  name: "alpha-go",
  domain: "bankr.eth",
  address: "0x703ae03fB120eC91e9Ed6d08Ce8044E498CC789B",
  text_records: {
    "agent-registration[0x0001000002210514BA001234...][42]": "1"
  }
});
```

## Migration Path

If custom resolution logic or data sovereignty is needed in the future, the `bankr.eth` resolver can be swapped with a single on-chain transaction. NameStone has no lock-in — the resolver is the only integration point.

## Limits & Pricing

- **Free**: NameStone is funded by ENS DAO grants. No documented usage limits or paid tiers.
- **Batch size**: Max 50 subnames per `set-names` call
- **Text records**: Arbitrary key-value pairs (`Record<string, string>`), no limit on number per name
- **Resolution latency**: ~0.9s (CCIP-Read roundtrip), supported by all major ENS clients
- **Overwrite semantics**: `set-name` replaces the entire record — always include all text records in each call
