---
name: juicebox-v6
description: Build, inspect, configure, and safely transact with Juicebox V6 projects, terminals, rulesets, hooks, tiered NFTs, Revnets, Croptop, Bendystraw, and omnichain deployments. Use for Juicebox protocol questions, contract addresses or ABIs, project creation, payments, cash-outs, tokenomics, hooks, NFT tiers, cross-chain bridges, loan queries, transaction decoding, and Juicebox app/UI development on Ethereum, Optimism, Base, Arbitrum, or their Sepolia testnets.
---

# Juicebox V6

Use this skill as the single entry point for Juicebox V6. Load the smallest applicable module from `references/modules/<module>.md`; modules contain the upstream protocol-specific procedures and examples. Do not load every module.

## Operating rules

1. Resolve chain, project ID, token, and intended outcome before proposing a write.
2. Use `references/shared/chain-config.json` only for read-only discovery. For any write, read [deployment verification](references/deployment-verification.md) and use `references/shared/deployment-manifest.json` as the sole target authority. Missing, unknown, mismatched, or non-write-enabled entries stop the action.
3. Use `references/shared/abis/<Contract>.json` for complete ABI tuple definitions when encoding or decoding calls.
4. For every write, also read `references/modules/jb-tx-safety.md`. Apply its review → re-verify → simulate → gas → send → prove pipeline without skipping steps. Abort on stale/missing quotes, failed preview/simulation, code or graph mismatch, or unavailable price-feed/hook/terminal/accounting context.
5. Derive every `minReturnedTokens`, `minTokensReclaimed`, and `minTokensPaidOut` from a fresh successful preview and the user's approved slippage tolerance. A protocol-verified zero may remain zero only where `jb-tx-safety` explicitly permits it; unavailable is never treated as zero.
6. Treat source data as versioned guidance, not live proof. Immediately before confirmation, verify the exact chain, nonempty matching runtime code, allowed selector, proxy/clone implementation pin, controller/terminal/project ownership and wiring, balances, approvals, and price-sensitive inputs.
7. Default to explanation, read-only inspection, or an unsigned transaction plan. Before signing or broadcasting, decode and present the exact chain, target, selector/function/arguments, asset and amount, recipient/project, native value, approvals, fees, expected effects, and partial-completion risk; require explicit user confirmation.
8. After mining, require `receipt.status === 'success'` plus operation-specific event and post-state evidence. A missing receipt is pending; missing evidence is uncertain; either state disables retry. Never report success from a bare receipt or third-party status string.
9. Never request, expose, or place private keys in code. Use Bankr's wallet/signing flow or the user's approved signer.

## Module routing

| User intent | Read this module or modules |
| --- | --- |
| Find contract addresses, roles, supported chains, or ABIs | `jb-contracts`, then `jb-v6-api` as needed; use `deployment-verification.md` for writes |
| Explain a Juicebox concept or protocol mechanics | `jb-simplify`, `jb-v6-impl`, or `jb-patterns` |
| Launch or configure a project or Revnet | `jb-project`, `jb-revnet-deploy`, `jb-ruleset`, `jb-fund-access-limits`, `jb-multi-currency` |
| Pay a project, cash out, manage terminal routing, fees, or Permit2 | `jb-query`, `jb-terminal-selection`, `jb-protocol-fees`, `jb-fee-flows`, `jb-cash-out-curve`, `jb-permit2-metadata` |
| Build or review custom hooks | `jb-data-hook-resolution`, `jb-buyback-hook`, `jb-lp-split-hook`, `jb-pay-hook`, `jb-cash-out-hook`, `jb-split-hook`, `jb-terminal-wrapper` |
| Configure or mint tiered NFTs | `jb-721-per-chain-config`, `jb-721-tier-content` |
| Configure an omnichain project or bridge | `revnet-omnichain-default`, `jb-suckers`, `jb-omnichain-erc20-config`, `jb-omnichain-payout-limits`, `jb-omnichain-per-chain-projectids`, `jb-omnichain-tier-quantity-per-chain` |
| Design a Revnet or inspect/operate REVLoans | `revnet-economics`, `revnet-modeler`, `jb-revloans`, `jb-loan-queries` |
| Use Croptop or Bendystraw | `jb-croptop` or `jb-bendystraw` |
| Inspect state, decode calldata, use the SDK, or obtain docs | `jb-query`, `jb-decode`, `jb-sdk`, or `jb-docs` |
| Build a Juicebox frontend | Choose the relevant `*-ui` module: `jb-deploy-ui`, `jb-interact-ui`, `jb-explorer-ui`, `jb-event-explorer-ui`, `jb-ruleset-timeline-ui`, `jb-nft-gallery-ui`, `jb-hook-deploy-ui`, or `jb-omnichain-ui` |
| Resolve currency or reserved-rate questions | `jb-currency-types` or `jb-reserved-rate-offchain-revenue` |
| Relay transactions or execute through a Safe | `jb-relayr` and `jb-safe-and-relayr-execution` |
| Construct, audit, or execute any write | `jb-tx-safety` plus the domain module and `deployment-verification.md` |

For a named module, read `references/modules/<module>.md`. Combine modules only when the requested workflow actually crosses domains.

## Frontend dependency boundary

Before generating or modifying a wallet-connected UI, read [frontend security](references/frontend-security.md). Obtain approval before installing exact local dependencies (`viem@2.55.19`, or `ethers@6.15.0` only for the explorer), preserve the lockfile integrity pins, import only from local packages, move scripts out of inline HTML, and apply the restrictive CSP. Never dynamically import wallet-adjacent JavaScript from a CDN.

## UI module adaptation

The UI modules include upstream fragments, not deployable pages. Copy only required assets into the generated app, update module paths, and enforce the frontend and transaction boundaries above. Copy `deployment-manifest.json` with the ABI and chain references; never assume a Bankr skill directory is served by the generated app.

## Attribution

This bundle adapts the Juicebox V6 skill library from `mejango/juicebox-skills` at commit `783b11ab163fdc60fd68db8b690ee1ebc26dc2fa`, licensed MIT. Preserve the included `LICENSE` when redistributing the bundle or derived content.
