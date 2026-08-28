---
name: revnet-omnichain-default
description: |
  Revnets should default to omnichain deployment. Use when: (1) a revnet deployment
  targets a single chain without sucker configuration, (2) building deployRevnet
  transactions and deciding chain coverage, (3) an existing revnet needs to expand to a
  new chain, (4) verifying cross-chain config-hash consistency for sucker deployment.
version: 6.0.0
---

# Revnets Default to Omnichain

Revnets are designed for network effects. Unless the user explicitly asks for single-chain, deploy to all supported chains (Ethereum, Optimism, Base, Arbitrum — or their sepolias) with suckers bridging the token between them.

## How omnichain revnets work

- `REVDeployer` (same address on every chain: see `references/shared/chain-config.json`) deploys the revnet independently on each chain via `deployFor(...)`.
- Passing a non-zero `REVSuckerDeploymentConfig.salt` deploys suckers in the same call. `REVDeployer` pre-hashes the salt as `keccak256(abi.encode(encodedConfigurationHash, suckerConfig.salt, msgSender))` before the registry hashes it again with the deployer as caller and `JBSuckerDeployer` hashes once more for CREATE2 — identical config + salt + user sender on each chain produces matching peers.
- The revnet's ERC-20 gets a deterministic address too (salted with `description.salt` + config hash + sender), so the token has the same address on every chain.
- Holders bridge tokens through suckers; sucker cash-outs bypass tax, fees, and the cash-out delay, and are priced against the chain's **local** supply + collateral and surplus + borrowed only (`REVOwner.beforeCashOutRecordedWith` never adds remote values for suckers, even on unscoped revnets). This local-denominator asymmetry is what drives the cross-chain rebalancing arbitrage that equalizes per-chain backing; do not add remote supply when modeling sucker exits.

## `REVDeployer.deployFor` (both overloads `payable`; `revnetId == 0` creates a new project, non-zero initializes an existing blank project id)

```solidity
function deployFor(uint256 revnetId, REVConfig configuration, JBAccountingContext[] accountingContextsToAccept,
    REVSuckerDeploymentConfig suckerDeploymentConfiguration) external payable returns (uint256 revnetId, IJB721TiersHook hook);
function deployFor(uint256 revnetId, REVConfig configuration, JBAccountingContext[] accountingContextsToAccept,
    REVSuckerDeploymentConfig suckerDeploymentConfiguration, REVDeploy721TiersHookConfig tiered721HookConfiguration,
    REVCroptopAllowedPost[] allowedPosts) external payable returns (uint256 revnetId, IJB721TiersHook hook);
function deploySuckersFor(uint256 revnetId, REVSuckerDeploymentConfig suckerDeploymentConfiguration)
    external returns (address[] suckers);   // operator only; needs extraMetadata bit 2 on the current stage
```

Struct ABI order — `REVConfig {REVDescription description; uint32 baseCurrency; address operator; bool scopeCashOutsToLocalBalances; REVStageConfig[] stageConfigurations}`; `REVDescription {string name; string ticker; string uri; bytes32 salt}`; `REVStageConfig {uint48 startsAtOrAfter; REVAutoIssuance[] autoIssuances; uint16 splitPercent; JBSplit[] splits; uint112 initialIssuance; uint32 issuanceCutFrequency; uint32 issuanceCutPercent; uint16 cashOutTaxRate; uint16 extraMetadata}`; `REVAutoIssuance {uint32 chainId; uint104 count; address beneficiary}`; `REVSuckerDeploymentConfig {JBSuckerDeployerConfig[] deployerConfigurations; bytes32 salt}`.

`extraMetadata` becomes the stage ruleset's 14-bit `metadata`: bit 0 = 721 hook `pauseTransfers`, bit 1 = 721 hook `pauseMintPendingReserves`, bit 2 = allow `REVDeployer.deploySuckersFor` on this stage. It is part of the config hash.

## Deployment checklist

- [ ] Deploy on every target chain with the **same** `REVConfig`, `description.salt`, sucker salt, and sender — otherwise `hashedEncodedConfigurationOf` diverges and sucker peers won't match.
- [ ] First-stage timestamp: if the origin chain used `startsAtOrAfter = 0`, the deployer normalized it to that chain's `block.timestamp`. Later-chain deployments must pass that origin timestamp explicitly to reproduce the config hash.
- [ ] Per-chain `accountingContextsToAccept`: ERC-20 addresses differ per chain (e.g. USDC). Use the chain's actual token address in each chain's terminal accounting contexts and sucker token mappings; only the native token sentinel (`0x…EEEe`) is chain-invariant.
- [ ] Lane/token pairing: use CCIP deployers for canonical USDC. For any OP Stack or Arbitrum native-bridge ERC-20 lane, verify the exact token delivered and burned in both directions and use that token in both the sucker mapping and destination terminal. Registry approval does not validate the bridge pair.
- [ ] Per-chain `autoIssuances`: each entry carries a `chainId` and only mints on the matching chain — include the full cross-chain list on every deployment (it is part of the config hash).
- [ ] Deploying an existing revnet onto a new chain (first stage already started) triggers a 7-day cash-out delay (`REVDeployer.CASH_OUT_DELAY = 604_800`) on that chain. Bridging in via suckers stays open during the delay so the new treasury can be primed.
- [ ] Later sucker expansion: only the revnet's operator can call `REVDeployer.deploySuckersFor`, and only if the current stage's `extraMetadata` has bit 2 set (`(extraMetadata >> 2) & 1 == 1`; otherwise `REVDeployer_RulesetDoesNotAllowDeployingSuckers`). Set it on every stage that should allow expansion — it is immutable after deploy.

## Verification

For a deployRevnet transaction, check:
- Multiple chains configured (unless single-chain was explicitly requested)
- Non-zero sucker salt with deployer configurations for each peer chain
- Terminal token addresses correct per chain
- Each ERC-20 mapping matches the selected lane's exact delivered and burned token; canonical USDC lanes use CCIP

## Common mistakes

- Reusing one chain's USDC address on every chain — sucker registry or terminal config reverts or silently misroutes.
- Sending canonical USDC through a native-bridge sucker — allowlisting does not prove transport compatibility; use a CCIP sucker.
- Deploying with different senders per chain: the sender is mixed into every salt, so addresses and config hashes stop matching.
- Leaving `startsAtOrAfter = 0` on later-chain deployments of an already-started revnet — the config hash won't reproduce and the 7-day cash-out delay logic keys off the real start time.
