---
name: jb-docs
description: |
  Find Juicebox V6 reference material. Use when: (1) looking up interface
  definitions, struct schemas, or event signatures, (2) finding implementation
  guides for hooks, terminals, or project configuration, (3) searching for
  protocol concepts or patterns, (4) need deployed contract addresses (prefer
  references/shared/chain-config.json for those).
version: 6.0.0
---

# Juicebox V6 Reference Lookup

docs.juicebox.money publishes no V6 pages: `GET /api/mcp/structure` lists no `v6` version, `POST /api/mcp/search` with `"version": "v6"` returns `[]`, and every `/dev/v6/...` URL is 404. Do not fetch it for V6 facts. Ground truth is source.

## Sources of Truth, in Order

1. **Contract addresses**: chain config for read-only discovery; the reviewed deployment manifest plus live verification for writes. Do not take addresses from web pages.
2. **Interfaces / structs / events / behavior**: the source repos (below) and `references/shared/abis/*.json`.
3. **Concept guides**: the sibling skills in this plugin (`jb-patterns`, `jb-pay-hook`, `jb-cash-out-hook`, `jb-multi-currency`, `jb-query`, `jb-bendystraw`).

## Source Repositories

| Repo | Contents |
|------|----------|
| [Bananapus/nana-core-v6](https://github.com/Bananapus/nana-core-v6) | Core protocol: controller, terminals, rulesets, tokens, splits, prices |
| [Bananapus/nana-721-hook-v6](https://github.com/Bananapus/nana-721-hook-v6) | 721 tiers hook (NFT rewards) |
| [Bananapus/nana-buyback-hook-v6](https://github.com/Bananapus/nana-buyback-hook-v6) | Buyback hook (AMM routing on pay) |
| [Bananapus/nana-suckers-v6](https://github.com/Bananapus/nana-suckers-v6) | Cross-chain suckers |
| [Bananapus/nana-router-terminal-v6](https://github.com/Bananapus/nana-router-terminal-v6) | Router terminal and registry |
| [Bananapus/nana-univ4-lp-split-hook-v6](https://github.com/Bananapus/nana-univ4-lp-split-hook-v6) | Uniswap v4 LP split hook |
| [rev-net/revnet-core-v6](https://github.com/rev-net/revnet-core-v6) | Revnets: REVDeployer, REVLoans |
| [mejango/croptop-core-v6](https://github.com/mejango/croptop-core-v6) | Croptop publisher |
| [BallKidz/defifa](https://github.com/BallKidz/defifa) | Defifa prediction games |
| [peripheralist/bendystraw](https://github.com/peripheralist/bendystraw) | GraphQL indexer |

## Concept → source path

Paths are relative to each repo's `src/`. Read the interface first, then the implementation for revert conditions.

| Need | File |
|------|------|
| Pay hook interface | `nana-core-v6` `interfaces/IJBPayHook.sol`, `structs/JBAfterPayRecordedContext.sol` |
| Cash-out hook interface | `nana-core-v6` `interfaces/IJBCashOutHook.sol`, `structs/JBAfterCashOutRecordedContext.sol` |
| Data hook (pay + cash-out pricing) | `nana-core-v6` `interfaces/IJBRulesetDataHook.sol`, `structs/JBBeforePayRecordedContext.sol`, `structs/JBBeforeCashOutRecordedContext.sol`, `structs/JBPayHookSpecification.sol`, `structs/JBCashOutHookSpecification.sol` |
| Split hook interface | `nana-core-v6` `interfaces/IJBSplitHook.sol`, `structs/JBSplitHookContext.sol`, `libraries/JBPayoutSplitGroupLib.sol` |
| Ruleset approval hook | `nana-core-v6` `interfaces/IJBRulesetApprovalHook.sol` |
| Ruleset / metadata structs | `nana-core-v6` `structs/JBRuleset.sol`, `structs/JBRulesetMetadata.sol`, `structs/JBRulesetConfig.sol`, `libraries/JBRulesetMetadataResolver.sol` |
| Splits, fund access limits, accounting contexts | `nana-core-v6` `structs/JBSplit.sol`, `structs/JBSplitGroup.sol`, `structs/JBFundAccessLimitGroup.sol`, `structs/JBCurrencyAmount.sol`, `structs/JBAccountingContext.sol`, `structs/JBTokenAmount.sol` |
| Terminal entry points and events | `nana-core-v6` `interfaces/IJBTerminal.sol`, `interfaces/IJBMultiTerminal.sol`, `JBMultiTerminal.sol` |
| Balance / surplus / preview math | `nana-core-v6` `JBTerminalStore.sol`, `libraries/JBCashOuts.sol`, `libraries/JBSurplus.sol`, `libraries/JBFees.sol` |
| Controller (launch, queue, mint, reserved tokens) | `nana-core-v6` `interfaces/IJBController.sol`, `JBController.sol` |
| Permissions | `nana-core-v6` `JBPermissions.sol`, `structs/JBPermissionsData.sol`; IDs in `@bananapus/permission-ids-v6` `src/JBPermissionIds.sol` |
| Constants and currency IDs | `nana-core-v6` `libraries/JBConstants.sol`, `libraries/JBCurrencyIds.sol`, `libraries/JBSplitGroupIds.sol` |
| Price feeds | `nana-core-v6` `JBPrices.sol`, `interfaces/IJBPriceFeed.sol`, `JBChainlinkV3PriceFeed.sol`, `JBChainlinkV3SequencerPriceFeed.sol`, `periphery/JBMatchingPriceFeed.sol`, `periphery/JBRatioPriceFeed.sol` |
| Project tokens | `nana-core-v6` `interfaces/IJBToken.sol`, `JBERC20.sol`, `JBTokens.sol` |
| Metadata encoding for hooks | `nana-core-v6` `libraries/JBMetadataResolver.sol` |
| 721 tiers hook | `nana-721-hook-v6` `JB721TiersHook.sol`, `JB721TiersHookStore.sol`, `JB721TiersHookProjectDeployer.sol`, `structs/JB721TierConfig.sol`, `structs/JBDeploy721TiersHookConfig.sol`, `structs/JBLaunchProjectConfig.sol` |
| Buyback hook | `nana-buyback-hook-v6` `JBBuybackHook.sol`, `JBBuybackHookRegistry.sol` |
| Suckers | `nana-suckers-v6` `JBSucker.sol`, `JBSuckerRegistry.sol`, `deployers/` |
| Revnets | `revnet-core-v6` `REVDeployer.sol`, `REVLoans.sol`, `structs/` |

## Common Queries

### "What's the JBController address on mainnet?"

Read chain config for discovery. For a write, resolve JBController from the reviewed manifest and verify live code and selector on the connected chain; do not infer authority from a cross-chain address coincidence.

### "How do I implement a pay hook?"

Read `IJBPayHook.sol` and `IJBRulesetDataHook.sol` in `nana-core-v6/src/interfaces/`, then the `jb-pay-hook` skill.

### "What events does JBMultiTerminal emit?"

`references/shared/abis/JBMultiTerminal.json` (verified deployment ABI) or `nana-core-v6/src/interfaces/IJBMultiTerminal.sol` plus the inherited terminal interfaces.

## Official Resources

- **GitHub**: https://github.com/Bananapus
- **Indexer**: https://bendystraw.up.railway.app (see `/jb-bendystraw`)

## Generation Guidelines

1. **Addresses from `references/shared/chain-config.json`**, never from fetched pages.
2. **Interfaces/structs from source repos or `references/shared/abis/`**.
3. **Cite the source path** (repo + file) for every contract fact you state.

## Common mistakes

- **Fetching docs.juicebox.money for V6 facts.** Its pages cover other protocol versions; signatures, permission IDs, and fees there do not match V6 source.
- **Copying addresses from web pages.** `references/shared/chain-config.json` is generated from the deployment artifacts and is authoritative.
- **Treating a missing doc page as "feature doesn't exist."** Check the source repo.
