---
name: jb-omnichain-per-chain-projectids
description: |
  Omnichain Juicebox V6 projects have DIFFERENT projectIds on each chain. Use when:
  (1) "simulation reverted" / SimulationReverted errors on cross-chain operations via Relayr,
  (2) implementing setUriOf, queueRulesetsOf, setSplitGroupsOf, sendPayoutsOf, or any project
  operation across multiple chains, (3) building UI or automation that calls contracts on
  multiple chains for the same "project", (4) controllerOf(projectId) returns the zero address
  on some chains. Each chain mints its own JBProjects NFT with an incrementing ID — query
  per-chain projectIds from the Bendystraw suckerGroup before any omnichain operation.
version: 6.0.0
---

# Omnichain Projects Have Different ProjectIds Per Chain

## Root cause

`JBProjects` is a per-chain ERC-721 with an incrementing ID counter. When an omnichain project is deployed (e.g. via `JBOmnichainDeployer`, which shares one address on all chains), each chain independently mints the next available ID:

```
Same omnichain project:
- Ethereum:  projectId = 123
- Optimism:  projectId = 456
- Base:      projectId = 789
- Arbitrum:  projectId = 101
```

The per-chain projects are linked by suckers (and grouped by Bendystraw into a `suckerGroup`), but the IDs are unrelated. Calling `JBController.setUriOf(123, uri)` on Optimism targets a different project (or none) — permission checks revert or, worse, you operate on someone else's ID.

## Symptoms

- Relayr quote fails with `SimulationReverted` for some chains of a bundle.
- `JBPermissioned_Unauthorized` on chains where the ID belongs to another project.
- `JBDirectory.controllerOf(projectId)` returns `address(0)` on some chains.
- An operation "works on mainnet but reverts everywhere else".

## Solution

### 1. Resolve the per-chain ID map from Bendystraw

Two-step: project → `suckerGroupId`, then group → project list. Entries in `suckerGroup.projects` are strings formatted `"{chainId}-{projectId}-{version}"`.

```javascript
// Step 1: any known (chainId, projectId) → its sucker group
const { project } = await bendystrawQuery(
  'query($projectId: Float!, $chainId: Float!, $version: Float!) {' +
  '  project(projectId: $projectId, chainId: $chainId, version: $version) { suckerGroupId } }',
  { projectId: 123, chainId: 1, version: 6 }
);

// Step 2: group → all per-chain projects
const { suckerGroup } = await bendystrawQuery(
  'query($id: String!) { suckerGroup(id: $id) { projects } }',
  { id: project.suckerGroupId }
);

const byChain = {};
for (const s of suckerGroup.projects) {
  const m = /^(\d+)-(\d+)-/.exec(s);          // "chainId-projectId-version"
  if (m) byChain[Number(m[1])] = Number(m[2]);
}
// byChain = { 1: 123, 10: 456, 8453: 789, 42161: 101 }
```

Note: `suckerGroupId` is point-in-time — groups can merge as suckers are deployed. Re-resolve it; don't persist it long-term.

### 2. Use a per-chain mapping in every omnichain operation

```typescript
// CORRECT
const chainProjectMappings = [
  { chainId: 1, projectId: 123 },
  { chainId: 10, projectId: 456 },
  { chainId: 8453, projectId: 789 },
];

// WRONG — same ID on every chain
const wrong = [1, 10, 8453].map((chainId) => ({ chainId, projectId: 123 }));
```

Encode each chain's transaction with that chain's projectId. This applies to every project operation: `setUriOf`, `queueRulesetsOf`, `setSplitGroupsOf`, `sendPayoutsOf`, `deployERC20For`, `mintTokensOf`, sucker deploys, permission grants — everything keyed by projectId.

### 3. Handle not-yet-deployed chains

Deployment across chains happens as independent transactions (typically one Relayr bundle — one tx per chain, executed after the single payment). Until a chain's transaction confirms and indexes, that chain has no project:

```typescript
const controller = await client.readContract({
  address: JB_DIRECTORY, abi, functionName: 'controllerOf', args: [projectId],
});
if (controller === zeroAddress) {
  // project doesn't exist on this chain yet — skip or show "waiting for execution"
}
```

There is no cross-chain deployment message to wait on — if a chain lags, its Relayr transaction is still pending or failed. Check the bundle status (`jb-relayr`) rather than waiting for a bridge.

## Verification checklist

1. Resolve the suckerGroup and confirm every target chain appears in `byChain`.
2. Confirm `controllerOf(projectId) != address(0)` on each chain.
3. Simulate each chain's transaction with that chain's projectId before submitting.

## Common mistakes

- **Reusing one chain's projectId everywhere.** The defining mistake — every symptom above traces to it.
- **Persisting `suckerGroupId`.** It changes when groups merge; re-resolve from `(chainId, projectId)`.
- **Omitting `version: 6` from Bendystraw project queries.** The `project` lookup is keyed `(projectId, chainId, version)`.
- **Treating a missing chain as "still bridging".** Deploys are independent per-chain transactions; check the Relayr bundle, not a bridge.

## Related skills

- `jb-suckers` — how the per-chain projects are linked
- `jb-relayr` — executing per-chain transactions (with per-chain calldata) from one payment
- `jb-omnichain-payout-limits`, `jb-omnichain-erc20-config` — other per-chain divergences
