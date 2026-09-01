# Synths

Synths are ERC-20 tokens on Base that wrap a Solana SPL mint via the Hydrex bridge. The mapping between `(solana mint ↔ base evmAddress)` lives in the **validator's** `/tokens` registry — not the router. Always go through the validator for addresses; the router's token list may be stale.

**Validator base URL:** `https://synths-validator-1.onrender.com`

## Endpoint: `GET /tokens`

Returns the entire wrapped-token registry.

```bash
curl -s https://synths-validator-1.onrender.com/tokens
```

### Response Shape

Array of:

```ts
{
  sourceChainId: string;        // "501474" for Solana (Hydrex's Solana chain id)
  sourceMint: string;           // bytes32 hex, 0x-prefixed (mint padded to 32 bytes)
  evmAddress: string;           // Base ERC-20 address of the wrapped synth
  name: string;
  symbol: string;
  decimals: number;
  solanaTokenAddress: string;   // base58 Solana mint (decoded from sourceMint)
}
```

### Query Filters

All filters are optional and AND-combined. Within `solana` / `evmAddress`, comma-separated values are OR.

| Param | Accepts | Example |
|---|---|---|
| `solana` | base58 mints OR `0x`-prefixed 32-byte hex (comma-separated) | `?solana=EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm` |
| `evmAddress` | 0x EVM addresses (comma-separated) | `?evmAddress=0xabc...` |
| `name` | case-insensitive substring | `?name=wif` |
| `symbol` | case-insensitive substring | `?symbol=WIF` |

### Examples

```bash
# Full registry
curl -s https://synths-validator-1.onrender.com/tokens

# Look up by symbol
curl -s "https://synths-validator-1.onrender.com/tokens?symbol=WIF"

# Look up by Solana mint
curl -s "https://synths-validator-1.onrender.com/tokens?solana=EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm"

# Look up by Base ERC-20 address
curl -s "https://synths-validator-1.onrender.com/tokens?evmAddress=0xBaseSynthAddress"

# Multiple mints at once
curl -s "https://synths-validator-1.onrender.com/tokens?solana=mintA,mintB"
```

## Endpoint: `GET /relayer/wrapped-address/:solanaTokenAddress`

Computes the **deterministic** wrapped-token address for a Solana mint — even one that hasn't been deployed yet. Useful when:

- The mint isn't in `/tokens` yet (not bootstrapped)
- You want to verify a known synth address matches what the bridge would produce

```bash
curl -s "https://synths-validator-1.onrender.com/relayer/wrapped-address/EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm"
```

Response:

```json
{
  "solanaTokenAddress": "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
  "solanaTokenAddressBytes32": "0x...",
  "wrappedTokenAddress": "0x..."
}
```

**Note**: a deterministic address being computable doesn't mean the token is deployed. If `/tokens` doesn't list it, the on-chain code at that address is empty — `balanceOf` will revert and intents will fail. Use this endpoint for verification, not for production address discovery.

## Reading Synth Balances On-Chain

Synths are standard ERC-20s. Use `balanceOf(address)` on the `evmAddress` from `/tokens`.

### Single balance

```
# Pseudocode for Bankr
1. row = GET /tokens?symbol=WIF → take first
2. raw = balanceOf(userAddress) on row.evmAddress (Base RPC)
3. human = raw / 10^row.decimals
4. Show "{human} {row.symbol}"
```

**Bankr natural language:**

```bash
bankr agent "Read balanceOf 0xUserAddress on token 0xBaseSynthAddress on Base"
```

### All synth balances (portfolio scan)

```
1. registry = GET /tokens
2. multicall balanceOf(userAddress) over registry.map(r => r.evmAddress) on Base
3. Filter to rows where balance > 0
4. Display each as "{balance/10^decimals} {symbol}"
```

This can be ~100+ tokens depending on registry size, so prefer a multicall.

## Identifying a Synth

You only need three checks to know a Base ERC-20 is a Hydrex synth:

1. It appears in `GET /tokens` (the validator's registry is the source of truth)
2. Its `sourceChainId === "501474"` (Solana)
3. Its `evmAddress` matches the result of `/relayer/wrapped-address/:mint`

The frontend in `send-app` uses a slightly different heuristic for its UI (`hydrexSynth` field on `HydrexAsset`, `solana` block on portfolio rows), but for this skill the validator registry is the canonical reference.

## Common Mistakes

- **Don't trust the router's token list for synth addresses.** The router caches metadata; the validator is the source of truth.
- **Don't assume decimals = 6.** Most Solana memecoins are 6, but always read `decimals` from `/tokens`.
- **`sourceMint` is bytes32 hex, not base58.** Use the `solanaTokenAddress` field when displaying or matching against a user-supplied mint.
- **The registry can have entries the user has never held.** Filter by balance > 0 before showing a "your synths" list.

## Where this lives in send-app / synths-validator

For cross-reference:

- `synths-validator/src/token-registry/token-registry.controller.ts` — `/tokens` route
- `synths-validator/src/token-registry/token-registry.interface.ts` — `WrappedTokenInfo` shape
- `synths-validator/src/token-registry/token-registry.filters.ts` — query semantics
- `synths-validator/src/relayer/relayer.controller.ts` — `/relayer/wrapped-address/:mint` and `/relayer/processed/:mint/:nonce`
- `synths-solver/src/validator-client/validator-client.service.ts` — example consumer that loads the registry from `${VALIDATOR_URL}/tokens`
