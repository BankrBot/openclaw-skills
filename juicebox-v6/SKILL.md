---
name: juicebox-v6
description: Build, inspect, configure, and safely transact with Juicebox V6 projects, terminals, rulesets, hooks, tiered NFTs, Revnets, Croptop, Bendystraw, and omnichain deployments. Use for Juicebox protocol questions, contract addresses or ABIs, project creation, payments, cash-outs, tokenomics, hooks, NFT tiers, cross-chain bridges, loan queries, transaction decoding, and Juicebox app/UI development on Ethereum, Optimism, Base, Arbitrum, or their Sepolia testnets.
---

# Juicebox V6

Use this skill as the single entry point for Juicebox V6. Load the smallest applicable module from `references/modules/<module>.md`; modules contain the upstream protocol-specific procedures and examples. Do not load every module.

## Operating rules

1. Resolve chain, project ID, token, and intended outcome before proposing a write.
2. Read `references/shared/chain-config.json` for deployed addresses. Do not invent, memorize, or copy contract addresses from unverified pages.
3. Use `references/shared/abis/<Contract>.json` for complete ABI tuple definitions when encoding or decoding calls.
4. Treat source reference data as versioned guidance, not proof of current live state. For a consequential action, query the selected chain and verify bytecode, ownership/permissions, project configuration, balances, and price-sensitive inputs immediately before execution.
5. Default to explanation, read-only inspection, or an unsigned transaction plan. Before signing or broadcasting, present the chain, target contract, function, asset and amount, recipient/project, value, approvals, fees, and expected effects; require explicit user confirmation.
6. Never request, expose, or place private keys in code. Use Bankr's wallet/signing flow or the user's approved signer.

## Module routing

| User intent | Read this module or modules |
| --- | --- |
| Find contract addresses, roles, supported chains, or ABIs | `jb-contracts`, then `jb-v6-api` as needed |
| Explain a Juicebox concept or protocol mechanics | `jb-simplify`, `jb-v6-impl`, or `jb-patterns` |
| Launch or configure a project | `jb-project`, `jb-ruleset`, `jb-fund-access-limits`, `jb-multi-currency` |
| Pay a project, cash out, manage terminal routing, fees, or Permit2 | `jb-query`, `jb-terminal-selection`, `jb-protocol-fees`, `jb-fee-flows`, `jb-cash-out-curve`, `jb-permit2-metadata` |
| Build or review custom hooks | `jb-pay-hook`, `jb-cash-out-hook`, `jb-split-hook`, `jb-terminal-wrapper` |
| Configure or mint tiered NFTs | `jb-721-per-chain-config`, `jb-721-tier-content` |
| Configure an omnichain project or bridge | `revnet-omnichain-default`, `jb-suckers`, `jb-omnichain-erc20-config`, `jb-omnichain-payout-limits`, `jb-omnichain-per-chain-projectids`, `jb-omnichain-tier-quantity-per-chain` |
| Design a Revnet or inspect/operate REVLoans | `revnet-economics`, `revnet-modeler`, `jb-revloans`, `jb-loan-queries` |
| Use Croptop or Bendystraw | `jb-croptop` or `jb-bendystraw` |
| Inspect state, decode calldata, or obtain docs | `jb-query`, `jb-decode`, or `jb-docs` |
| Build a Juicebox frontend | Choose the relevant `*-ui` module: `jb-deploy-ui`, `jb-interact-ui`, `jb-explorer-ui`, `jb-event-explorer-ui`, `jb-ruleset-timeline-ui`, `jb-nft-gallery-ui`, `jb-hook-deploy-ui`, or `jb-omnichain-ui` |
| Resolve currency or reserved-rate questions | `jb-currency-types` or `jb-reserved-rate-offchain-revenue` |
| Relay transactions | `jb-relayr` |

For a named module, read `references/modules/<module>.md`. Combine modules only when the requested workflow actually crosses domains.

## UI module adaptation

The UI modules include upstream examples that reference `/references/shared/...`. Treat these as source assets for a generated app: copy the required `styles.css`, `wallet-utils.js`, ABI JSON, and chain config into the app's own public/static path and update import URLs accordingly. Do not assume a Bankr skill directory is served by the generated application.

## Attribution

This bundle adapts the Juicebox V6 skill library from `mejango/juicebox-skills`, licensed MIT. Preserve the included `LICENSE` when redistributing the bundle or derived content.
