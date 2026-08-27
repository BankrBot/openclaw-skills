---
name: jb-721-per-chain-config
description: |
  Omnichain Juicebox projects with 721 hooks deploy separate NFT collections on each
  chain — tier supply is per-chain, not aggregate. Use when: (1) user asks about total
  NFT supply across chains, (2) building UI that displays aggregate supply, (3)
  explaining why supply "multiplies" on multi-chain projects, (4) deciding between
  single-chain and multi-chain NFT deployment.
version: 6.0.0
---

# Per-Chain 721 Tier Configuration

## The constraint

**NFT tier supply is per-chain, not aggregate.** An omnichain project deploying a 100-copy tier to 3 chains creates 300 mintable NFTs — 100 on each chain.

```
Omnichain project, tier with initialSupply = 100, deployed to 3 chains:
  Ethereum:  100 mintable
  Optimism:  100 mintable
  Base:      100 mintable
  Total:     300 — not 100
```

## Why

Each chain runs its own `JB721TiersHook` instance (a `LibClone` minimal proxy of the singleton implementation, deployed per project per chain by `JB721TiersHookDeployer`). Tier data lives in the singleton `JB721TiersHookStore` on that chain, keyed by hook address. There is no cross-chain state sharing: `initialSupply` and `remainingSupply` (`uint32` fields of `JB721Tier`) count only local mints.

Project ERC-20 tokens bridge across chains via suckers to maintain a unified supply. NFTs do not bridge; each chain's collection is independent.

## How omnichain 721 deploys work

`JBOmnichainDeployer.launchProjectFor` / `launchRulesetsFor` / `queueRulesetsOf` (nana-omnichain-deployers-v6) accept a `JBOmnichain721Config`:

| Field | Type | Meaning |
|-------|------|---------|
| `deployTiersHookConfig` | `JBDeploy721TiersHookConfig` | Hook name/symbol/tiers/flags |
| `useDataHookForCashOut` | `bool` | Whether NFTs price cash outs |
| `salt` | `bytes32` | Deterministic deployment salt |

The same transaction is relayed to each target chain (e.g. via Relayr). On every chain:

1. A new `JB721TiersHook` clone is deployed with the same tier config and its ownership transferred to the project.
2. The ruleset's `dataHook` is set to `JBOmnichainDeployer` itself with `useDataHookForPay` and `useDataHookForCashOut` both forced `true`; the deployer stores the 721 hook per ruleset and forwards to it. Read it with `JBOmnichainDeployer.tiered721HookOf(projectId, rulesetId)` → `(hook, useDataHookForCashOut)`. `JBOmnichain721Config.useDataHookForCashOut` — not the ruleset bit — gates whether NFTs price cash outs. Any `metadata.dataHook` you supplied is stored as an extra hook and called after the 721 hook. Only `JB721TiersHookProjectDeployer` sets the ruleset's `dataHook` to the 721 hook directly.
3. Tier IDs, prices, and supplies are identical across chains but completely independent — provided every chain receives the same tier array. Tier IDs are assigned sequentially (`maxTierId + i + 1`), so omitting a tier on one chain shifts every later tier's ID on that chain. Put single-chain tiers LAST in the array.

`launchProjectFor` / `launchRulesetsFor` overloads without a `JBOmnichain721Config` deploy a default empty-tier hook (`baseCurrency` from the first ruleset, `decimals = 18`). `queueRulesetsOf` deploys a new hook only if `tiersConfig.tiers.length > 0`; otherwise it carries forward the previous ruleset's hook and cash-out flag, reverting `JBOmnichainDeployer_InvalidHook` if none exists. It also reverts `JBOmnichainDeployer_RulesetIdsUnpredictable` if a ruleset was already queued in the same block.

### Deploy + register paths

| Path | Hook address ends up | Registry |
|------|----------------------|----------|
| `JB721TiersHookDeployer.deployHookFor(projectId, config, salt)` | Returned; you wire it as `dataHook` yourself via `JBController.queueRulesetsOf` | Auto-registered in `JBAddressRegistry` |
| `JB721TiersHookProjectDeployer.launchProjectFor` / `launchRulesetsFor` / `queueRulesetsOf` | Ruleset `metadata.dataHook` | Same (uses the hook deployer) |
| `JBOmnichainDeployer.launchProjectFor` / `launchRulesetsFor` / `queueRulesetsOf` | `tiered721HookOf(projectId, rulesetId)`; ruleset `dataHook` = deployer | Same (uses the hook deployer) |

Deterministic salts are wrapped twice (`keccak256(abi.encode(caller, salt))` by the project/omnichain deployer, then again with the hook deployer's caller), so a predicted address depends on both callers.

## User communication

Say "networks" or "locations", not "chains", when talking to non-technical users:

> "Your reward supply is set per network. 100 copies deployed to 3 networks means 100 available on each — 300 total. For exactly 100 total, either enable rewards on one network only, or split the supply (e.g. 33/33/34)."

## Recommendations by goal

| Goal | Approach |
|------|----------|
| Exactly N NFTs total | Enable the 721 hook on one chain only, or divide `initialSupply` across chains (uneven sell-out risk) |
| Maximum distribution | Accept per-chain supply; every network gets full access |
| Cross-chain scarcity | Hard. Tier fields are write-once — supply cannot be decremented. Monitor aggregate mints off-chain (Bendystraw) and remove the whole tier via `adjustTiers` on chains that should stop selling, or stay single-chain |

Removing a tier via `adjustTiers` stops new mints on that chain; existing NFTs remain valid.

## Querying supply

### Per chain, on-chain (real-time)

```typescript
// 1. Hook address: JBOmnichainDeployer.tiered721HookOf(projectId, rulesetId) for omnichain
//    deploys; the ruleset's dataHook only for JB721TiersHookProjectDeployer deploys.
// 2. Store: hook.STORE() → JB721TiersHookStore (deployed at the same address on all chains).
const tiers = await client.readContract({
  address: storeAddress,
  abi: JB721TiersHookStoreAbi, // references/shared/abis/JB721TiersHookStore.json
  functionName: 'tiersOf',
  args: [hookAddress, [], false, 0n, 100n], // categories, includeResolvedUri, startingId, size
})
// Each JB721Tier: { id, price, remainingSupply, initialSupply, ... }
// Sorted by category; order within a category is insertion order, not id order. Key by tier.id, never by index.
```

### Aggregate across chains

Sum `remainingSupply` / `initialSupply` per tier ID over every chain's hook. Fetch each chain via RPC, or use Bendystraw for indexed aggregate data (see the `jb-bendystraw` skill). Tier IDs match across chains only when every chain received the same tier array; a tier omitted on one chain shifts the IDs after it on that chain.

### UI pattern

Show the current chain's remaining supply by default; expose a per-chain breakdown plus total on demand:

```
Supply by network
  Ethereum:   45
  Optimism:   67
  Base:       82
  ─────────────
  Total:     194 of 300
```

In deploy previews, label tier supply "per network" and show the multiplication explicitly ("3 networks × 100 supply = 300 total").

## Related skills

- `jb-omnichain-ui` — omnichain frontends
- `jb-bendystraw` — indexed aggregate queries
- `jb-721-tier-content` — tier metadata and content resolution

## Common mistakes

- **Displaying one chain's `remainingSupply` as the project total.** It is local to that chain's hook.
- **Assuming NFTs bridge like project tokens.** Suckers bridge the ERC-20 supply only; NFT collections are per-chain.
- **Expecting the store to aggregate.** `JB721TiersHookStore` shares an address across chains, but each chain's instance holds only local state.
- **Promising "only 100 will ever exist" on a multi-chain deploy.** True only if the 721 hook is enabled on a single chain.
- **Reading the omnichain hook from the ruleset's `dataHook`.** Under `JBOmnichainDeployer` that is the deployer; `STORE.tiersOf(deployer, ...)` returns `[]`. Use `tiered721HookOf`.
- **Omitting a tier mid-array on one chain.** Later tier IDs shift on that chain and cross-chain aggregation keyed by tier ID breaks; a zero-supply placeholder reverts (`JB721TiersHookStore_ZeroInitialSupply`).
