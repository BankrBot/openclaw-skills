# Predicate-Gated Tools (403 Access Control)

Predicate gating restricts tool access based on onchain state (NFT ownership, subscriptions, composite logic). The caller authenticates with SIWE; the server checks the configured `IAccessPredicate` contract via the ToolRegistry.

## How predicate gating works

```
Agent                        Tool Server                   ToolRegistry (onchain)
  |--- POST /api ------------->|                                |
  |    Authorization: SIWE ... |                                |
  |                            |  (verify SIWE signature)       |
  |                            |--- staticcall tryHasAccess --->|
  |                            |    (toolId, callerAddr, data)  |
  |                            |<-- (ok=true, granted=true) ----|
  |                            |                                |
  |                            |  (execute tool handler)        |
  |<-- 200 + result -----------|                                |
```

1. Agent builds a SIWE message for the tool's domain and signs it
2. Agent sends `Authorization: SIWE <base64url(message)>.<signature>`
3. Server verifies the SIWE signature and recovers the caller's address
4. Server calls `ToolRegistry.tryHasAccess(toolId, callerAddress, data)` which delegates to the tool's configured `IAccessPredicate`
5. If access is granted: execute handler, return 200
6. If access is denied: return 403 with predicate address for self-diagnosis
7. If predicate misbehaved: return 502

## Build a predicate-gated tool (server side)

```typescript
import { createToolHandler, predicateGate, defineManifest } from "@opensea/tool-sdk"
import { z } from "zod/v4"

const manifest = defineManifest({
  name: "Gated Tool",
  description: "Only accessible to NFT holders",
  endpoint: "https://my-tool.example.com/api",
  creatorAddress: "0xYOUR_WALLET_ADDRESS",
  inputs: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  outputs: { type: "object", properties: { result: { type: "string" } } },
  // Declare access requirements in the manifest so agents can discover
  // what they need before calling (see known-predicates.md).
  access: {
    logic: "OR",
    requirements: [
      {
        kind: "0xbdf8c428",  // IERC721Holding interface ID
        data: "0x000000000000000000000000YOUR_COLLECTION_ADDRESS",  // abi.encode(address)
        label: "Hold any NFT from My Collection",
      },
    ],
  },
})

export const toolHandler = createToolHandler({
  manifest,
  inputSchema: z.object({ query: z.string() }),
  outputSchema: z.object({ result: z.string() }),
  gates: [
    predicateGate({
      toolId: 1n,  // your onchain tool ID from registration
      // chain: base,
      // rpcUrl: "https://mainnet.base.org",
    }),
  ],
  handler: async (input, ctx) => {
    // ctx.callerAddress is set after a successful predicate check
    return { result: `Hello ${ctx.callerAddress}, result: ${input.query}` }
  },
})
```

## Call a predicate-gated tool (agent/client side)

### Via CLI

```bash
PRIVATE_KEY=0x... RPC_URL=https://mainnet.base.org \
  npx @opensea/tool-sdk auth \
  https://my-tool.example.com/api \
  --body '{"query": "hello"}'
```

### Via SDK: `authenticatedFetch`

```typescript
import { authenticatedFetch, createWalletFromEnv, walletAdapterToClient } from "@opensea/tool-sdk"
import { base } from "viem/chains"

const adapter = createWalletFromEnv()
const client = await walletAdapterToClient(adapter, base)

const res = await authenticatedFetch("https://my-tool.example.com/api", {
  account: client.account,
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query: "hello" }),
  // expirationMinutes: 5,   // SIWE message TTL (max 60, default 5)
  // chainId: 8453,          // default: Base
})

const data = await res.json()
```

### Check access before calling (preview)

```typescript
import { checkToolAccess } from "@opensea/tool-sdk"

const { ok, granted } = await checkToolAccess({
  toolId: 1n,
  account: "0xYOUR_WALLET",
  // chain: base,
  // rpcUrl: "https://mainnet.base.org",
})

if (!ok) console.error("Predicate misbehaved")
else if (!granted) console.error("Access denied: you don't meet the requirements")
else console.log("Access granted: safe to call")
```

## Handling 403 responses

When the predicate denies access, the server returns:

```json
{
  "error": "Predicate gate: access predicate denied",
  "toolId": "1",
  "predicate": "0xd1F703D0B90BB7106fAebBfbcAdD2B07BDc4c769"
}
```

The `predicate` address tells the agent which predicate contract to inspect. Agents can call `IAccessPredicate.getRequirements(toolId)` to discover what's needed:

```typescript
import { IAccessPredicateABI } from "@opensea/tool-sdk"
import { createPublicClient, http } from "viem"
import { base } from "viem/chains"

const client = createPublicClient({ chain: base, transport: http() })

const [requirements, logic] = await client.readContract({
  address: "0xd1F703D0B90BB7106fAebBfbcAdD2B07BDc4c769",
  abi: IAccessPredicateABI,
  functionName: "getRequirements",
  args: [1n],  // toolId
})

// requirements: [{ kind: "0xbdf8c428", data: "0x...", label: "..." }]
// logic: 0 = AND, 1 = OR
```

## Combined gates (predicate + x402)

Tools can require both SIWE authentication and x402 payment. The server runs gates sequentially: predicate first (identity), then x402 (payment).

### Server side

```typescript
import {
  createToolHandler,
  defineToolPaywall,
  predicateGate,
  defineManifest,
} from "@opensea/tool-sdk"
import { z } from "zod/v4"

const paywall = defineToolPaywall({
  recipient: "0xYOUR_WALLET",
  amountUsdc: "0.05",
})

export const toolHandler = createToolHandler({
  manifest: defineManifest({
    name: "Premium Gated Tool",
    description: "NFT holders pay $0.05 per call",
    endpoint: "https://my-tool.example.com/api",
    creatorAddress: "0xYOUR_WALLET",
    inputs: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    outputs: { type: "object", properties: { result: { type: "string" } } },
    pricing: paywall.pricing,
    access: {
      logic: "OR",
      requirements: [{
        kind: "0xbdf8c428",
        data: "0x000000000000000000000000COLLECTION_ADDRESS",
        label: "Hold NFT from collection",
      }],
    },
  }),
  inputSchema: z.object({ query: z.string() }),
  outputSchema: z.object({ result: z.string() }),
  gates: [
    predicateGate({ toolId: 1n }),  // checked first
    paywall.gate,                   // checked second
  ],
  handler: async (input) => ({ result: input.query }),
})
```

### Client side: `paidAuthenticatedFetch`

```typescript
import { paidAuthenticatedFetch, createWalletFromEnv, walletAdapterToClient } from "@opensea/tool-sdk"
import { base } from "viem/chains"

const adapter = createWalletFromEnv()
const client = await walletAdapterToClient(adapter, base)

const res = await paidAuthenticatedFetch("https://my-tool.example.com/api", {
  account: client.account,   // for SIWE signing
  signer: adapter,           // for x402 payment signing (can differ from account)
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query: "hello" }),
  maxAmount: "100000",       // safety cap: 0.10 USDC
})
```

### Via CLI (auto-detect both gates)

```bash
PRIVATE_KEY=0x... RPC_URL=https://mainnet.base.org \
  npx @opensea/tool-sdk smoke \
  --endpoint https://my-tool.example.com/api \
  --expect 200
```
