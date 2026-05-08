---
name: opensea-tool-sdk
description: Build, register, and gate AI-callable tool endpoints using the OpenSea Tool Registry (ERC-8257) on Base. Scaffold HTTPS tools with JSON Schema interfaces, register them onchain, gate access via NFT ownership or x402 pay-per-call (USDC), and call gated tools. For querying OpenSea marketplace data use opensea-api instead.
homepage: https://github.com/ProjectOpenSea/tool-sdk
repository: https://github.com/ProjectOpenSea/tool-sdk
license: MIT
env:
  PRIVATE_KEY:
    description: Wallet private key for onchain registration and tool calls
    required: false
  RPC_URL:
    description: RPC URL for Base mainnet (default https://mainnet.base.org)
    required: false
dependencies:
  - node >= 18.0.0
---

# OpenSea Tool SDK

Build, register, and gate AI-callable tool endpoints using the OpenSea Tool Registry (ERC-8257) on Base.

## When to use this skill (`scope_in`)

Use `opensea-tool-sdk` when you need to:

- Scaffold an AI-callable tool endpoint (HTTPS, JSON Schema, `.well-known` manifest) for Vercel, Cloudflare, or Express
- Register a tool onchain on the Base ToolRegistry so other agents can discover it
- Gate access via x402 pay-per-call (USDC) or predicates (ERC-721/ERC-1155 ownership, subscriptions, composites)
- Call a gated tool: SIWE auth (`authenticatedFetch`), 402 payments (`paidFetch`), or both (`paidAuthenticatedFetch`)

## When NOT to use this skill (`scope_out`, handoff)

| Need | Use instead |
|---|---|
| Query NFT/token data, search, collection stats | `opensea-api` |
| Buy/sell NFTs | `opensea-marketplace` |
| Swap ERC20 tokens | `opensea-swaps` |
| Set up wallet signing providers | `opensea-wallet` |

This SDK is for tool *providers and consumers*. To query OpenSea marketplace data (floor prices, listings, trades), use the [`opensea-api`](../opensea-api/SKILL.md) skill instead.

## Concepts

| Term | Meaning |
|------|---------|
| **Tool** | An HTTPS endpoint with a JSON Schema interface, discoverable via `/.well-known/ai-tool/<slug>.json` |
| **Manifest** | JCS-canonicalized JSON describing the tool's name, endpoint, inputs, outputs, pricing, and access policy |
| **ToolRegistry** | Onchain contract (Base) where tools are registered with a manifest hash and optional access predicate |
| **Access Predicate** | An `IAccessPredicate` contract that gates who can invoke a tool (NFT ownership, subscriptions, composites) |
| **x402** | HTTP 402-based pay-per-call protocol (caller signs a USDC `TransferWithAuthorization`; server settles after execution) |
| **SIWE** | Sign-In with Ethereum (EIP-4361), used to authenticate callers for predicate-gated tools |
| **Facilitator** | Third-party service that verifies and settles x402 payments (PayAI or Coinbase CDP) |

## Deployed Contracts (Base mainnet)

| Contract | Address |
|----------|---------|
| ToolRegistry (v0.1) | `0x7291BbFbC368C2D478eCe1eA30de31F612a34856` |
| ERC721OwnerPredicate (v0.2) | `0xd1F703D0B90BB7106fAebBfbcAdD2B07BDc4c769` |
| ERC1155OwnerPredicate (v0.2) | `0xc179b9d4D9B7ffe0CdA608134729f72003380A7e` |

## 1. Create a Tool

### 1a. Scaffold a project

```bash
npx @opensea/tool-sdk init --runtime vercel   # or: cloudflare, express
```

This generates:
- `src/manifest.ts`: tool manifest definition
- `src/handler.ts`: request handler with input/output schemas
- `api/index.ts`: framework adapter entry point
- `public/llms.txt`: agent-readable discovery page
- `api/well-known/[slug].ts`: serves the manifest at `/.well-known/ai-tool/<slug>.json`

### 1b. Define the manifest

```typescript
import { defineManifest } from "@opensea/tool-sdk"

export const manifest = defineManifest({
  name: "My Tool",
  description: "What this tool does",
  endpoint: "https://my-tool.example.com/api",
  creatorAddress: "0xYOUR_WALLET_ADDRESS",
  inputs: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
    },
    required: ["query"],
  },
  outputs: {
    type: "object",
    properties: {
      result: { type: "string" },
    },
  },
  // Optional: add pricing for x402 paywall (see references/x402.md)
  // pricing: paywall.pricing,
  // Optional: add access requirements (see references/predicate-gating.md)
  // access: { logic: "OR", requirements: [...] },
})
```

### 1c. Write the handler

```typescript
import { createToolHandler } from "@opensea/tool-sdk"
import { z } from "zod/v4"
import { manifest } from "./manifest.js"

const InputSchema = z.object({ query: z.string() })
const OutputSchema = z.object({ result: z.string() })

export const toolHandler = createToolHandler({
  manifest,
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  // gates: [],  // Add gates here (see references/x402.md and references/predicate-gating.md)
  handler: async (input) => {
    return { result: `Processed: ${input.query}` }
  },
})
```

### 1d. Wire up the adapter

**Vercel:**
```typescript
import { toVercelHandler } from "@opensea/tool-sdk"
import { toolHandler } from "../src/handler.js"
export default toVercelHandler(toolHandler)
```

**Express:**
```typescript
import { toExpressHandler } from "@opensea/tool-sdk"
import { toolHandler } from "./handler.js"
app.post("/api", toExpressHandler(toolHandler))
```

**Cloudflare Workers:**
```typescript
import { toolHandler } from "./handler.js"
export default { fetch: toolHandler }
```

## 2. Register a Tool Onchain

### 2a. Via CLI

```bash
# Set up wallet
export PRIVATE_KEY=0x...
export RPC_URL=https://mainnet.base.org

# Register (open access, no predicate)
npx @opensea/tool-sdk register \
  --metadata https://my-tool.example.com/.well-known/ai-tool/my-tool.json \
  --network base

# Register with NFT gate (ERC-721 collection)
npx @opensea/tool-sdk register \
  --metadata https://my-tool.example.com/.well-known/ai-tool/my-tool.json \
  --network base \
  --nft-gate 0xCOLLECTION_ADDRESS

# Register with a custom access predicate
npx @opensea/tool-sdk register \
  --metadata https://my-tool.example.com/.well-known/ai-tool/my-tool.json \
  --network base \
  --access-predicate 0xPREDICATE_ADDRESS

# Dry run (no transaction)
npx @opensea/tool-sdk register --metadata ... --network base --dry-run
```

The CLI:
1. Fetches the manifest from `--metadata` URL
2. Validates the manifest schema
3. Verifies `manifest.creatorAddress` matches your wallet
4. Computes the JCS keccak256 manifest hash
5. Calls `ToolRegistry.registerTool(metadataURI, manifestHash, accessPredicate)`
6. Returns the `toolId` from the `ToolRegistered` event

### 2b. Via SDK (programmatic)

```typescript
import { ToolRegistryClient, computeManifestHash } from "@opensea/tool-sdk"
import { createWalletFromEnv, walletAdapterToClient } from "@opensea/tool-sdk"
import { base } from "viem/chains"

const adapter = createWalletFromEnv()
const walletClient = await walletAdapterToClient(adapter, base)

const registry = new ToolRegistryClient({
  chain: base,
  rpcUrl: "https://mainnet.base.org",
  walletClient,
})

const { toolId, txHash } = await registry.registerTool({
  metadataURI: "https://my-tool.example.com/.well-known/ai-tool/my-tool.json",
  manifest,                                      // your ToolManifest object
  accessPredicate: "0x0000...0000",              // address(0) for open access
})

console.log(`Registered tool ${toolId} in tx ${txHash}`)
```

## 3. Gating tool access

Tools can be gated three ways:

| Gate | Mechanism | Reference |
|------|-----------|-----------|
| **x402 paywall** | Pay-per-call (USDC, EIP-3009) | [`references/x402.md`](references/x402.md) |
| **Predicate gate** | Onchain check (NFT, subscription, composite) | [`references/predicate-gating.md`](references/predicate-gating.md) |
| **Combined** | SIWE auth and payment (predicate first, then x402) | [`references/predicate-gating.md`](references/predicate-gating.md) |

For deployed predicate addresses, requirement encodings, and SDK helpers like `describeToolAccess` / `decodeRequirement`, see [`references/known-predicates.md`](references/known-predicates.md).

## 4. Wallet Setup

The SDK supports multiple wallet providers via `@opensea/wallet-adapters`. Set environment variables and the SDK auto-detects the provider. See the [`opensea-wallet`](../opensea-wallet/SKILL.md) skill for the full provider table, env vars, setup walkthroughs, and signing-policy configuration.

```typescript
import { createWalletFromEnv } from "@opensea/tool-sdk"

const adapter = createWalletFromEnv()
const address = await adapter.getAddress()
```

For Bankr (external signer):

```typescript
import { createBankrAccount } from "@opensea/tool-sdk"

const account = await createBankrAccount("your-bankr-api-key")
// Use with authenticatedFetch or paidAuthenticatedFetch
```

## 5. Response Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Parse the JSON body per the manifest's `outputs` schema |
| 400 | Invalid input | Fix request body to match the manifest's `inputs` schema |
| 401 | Missing/invalid SIWE auth | Sign a SIWE message and include `Authorization: SIWE <token>` |
| 402 | Payment required | Read `body.accepts[0]` for payment requirements, sign and retry with `X-Payment` |
| 403 | Access denied | Inspect `body.predicate` to discover what's needed; acquire the required token/subscription |
| 405 | Method not allowed | Use POST |
| 500 | Internal tool error | Retry or contact the tool creator |
| 502 | Predicate/facilitator error | The upstream predicate or payment facilitator misbehaved; retry later |

## 6. Quick Reference: CLI Commands

| Command | Purpose |
|---------|---------|
| `init` | Scaffold a new tool project |
| `validate` | Validate a manifest file |
| `hash` | Compute the JCS keccak256 hash of a manifest |
| `export` | Export the manifest as JSON |
| `register` | Register a tool onchain |
| `update-metadata` | Update a tool's metadata URI and manifest hash onchain |
| `inspect` | Look up a tool's onchain config by ID |
| `verify` | Verify a manifest against its onchain hash |
| `deploy` | Deploy a tool to Vercel |
| `auth` | Call a predicate-gated tool (SIWE) |
| `pay` | Call an x402-paid tool (USDC) |
| `smoke` | Auto-detect gate type and call |
| `dry-run-gate` | Simulate an x402 gate check locally |
| `dry-run-predicate-gate` | Simulate a predicate gate check locally |

All CLI commands accept `--wallet-provider privy|turnkey|fireblocks|bankr|private-key` or auto-detect from env vars.

## 7. End-to-End Examples

### Example A: Free open-access tool

```bash
# 1. Scaffold
npx @opensea/tool-sdk init --runtime vercel
# 2. Edit src/manifest.ts and src/handler.ts with your logic
# 3. Deploy
npx @opensea/tool-sdk deploy
# 4. Register (open access)
PRIVATE_KEY=0x... npx @opensea/tool-sdk register \
  --metadata https://my-tool.vercel.app/.well-known/ai-tool/my-tool.json \
  --network base
# 5. Call
curl -X POST https://my-tool.vercel.app/api \
  -H "Content-Type: application/json" \
  -d '{"query": "hello"}'
```

### Example B: x402 paid tool (pay-per-call only, no identity check)

```bash
# Server: add paywall gate (see references/x402.md)
# Call via CLI:
PRIVATE_KEY=0x... npx @opensea/tool-sdk pay \
  https://my-tool.vercel.app/api \
  --body '{"query": "hello"}'
```

### Example C: NFT-gated tool (identity check, no payment)

```bash
# Register with NFT gate
PRIVATE_KEY=0x... npx @opensea/tool-sdk register \
  --metadata https://my-tool.vercel.app/.well-known/ai-tool/my-tool.json \
  --network base \
  --nft-gate 0xCOLLECTION

# Server: add predicateGate (see references/predicate-gating.md)

# Call via CLI:
PRIVATE_KEY=0x... RPC_URL=https://mainnet.base.org \
  npx @opensea/tool-sdk auth \
  https://my-tool.vercel.app/api \
  --body '{"query": "hello"}'
```

### Example D: NFT-gated and paid tool (both gates)

```bash
# Server: add both predicateGate and paywall.gate (see references/predicate-gating.md)
# Call via CLI:
PRIVATE_KEY=0x... RPC_URL=https://mainnet.base.org \
  npx @opensea/tool-sdk smoke \
  --endpoint https://my-tool.vercel.app/api \
  --expect 200
```

## References

- [`references/x402.md`](references/x402.md): pay-per-call protocol, server-side paywall, `paidFetch`
- [`references/predicate-gating.md`](references/predicate-gating.md): SIWE-based access control, combined gates
- [`references/known-predicates.md`](references/known-predicates.md): deployed predicate contracts and SDK helpers
- [Tool SDK GitHub](https://github.com/ProjectOpenSea/tool-sdk)
