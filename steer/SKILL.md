---
name: steer
description: Create and curate LP vaults on Uniswap or Sushi, and manage eligible Aerodrome vaults, powered by Steer.
tags: [lp, liquidity-provision, vaults, aerodrome, uniswap, sushi, base, bankr]
version: 1
visibility: public
metadata:
  clawdbot:
    emoji: "🧭"
    homepage: "https://steer.finance"
    requires:
      bins: [node, npm]
      packages: ["@steerprotocol/cli"]
---

# Steer

Create, curate, deposit into, and manage LP vaults with the Steer CLI. Establish chain facts and prepare simulation-backed transactions with Steer; Bankr Wallet signs and submits only the exact reviewed transaction.

## Before use

1. At the start of each live workflow, run `node scripts/ensure-steer-cli.mjs`. It resolves npm latest, installs that exact version only when needed, and verifies the `steer` binary on PATH matches. Proceed only when its JSON result has `ok: true`. Do not re-run it between quote and preparation; if it updated the CLI, inspect the relevant command help and schema before collecting live data.
2. Configure `STEER_RPC_URL` and `STEER_SUBGRAPH_STUDIO_KEY` securely. Do not print either value or a credentialed RPC URL. The rebalance-context helper requires the subgraph key; tend quote and preparation require `eth_getProof` support from the RPC.
3. Resolve the Bankr EVM wallet and requested chain. Use that wallet as `--account` for account-aware quote and preparation commands.
4. Read [references/command-discovery.md](references/command-discovery.md), then inspect the exact installed command with `--help` and `--schema`. Use native structured Steer tools only when their schema matches the installed CLI.
5. Request JSON full output for operational results, normally `--format json --full-output`.

## Non-negotiable rules

- A symbol is not a pool identity. Verify the canonical token addresses and decimals, token order, protocol, fee or tick spacing, hooks where applicable, factory membership, and initialized price.
- Derive human price direction from canonical `token0`, `token1`, and decimals. Every supplied range must use that same pair ratio, not a single-asset USD price.
- `steer pools support` and the actual preparation result are the write-capability authority. Do not infer support from a protocol listing, subgraph, or existing pool.
- Never construct calldata, alter prepared calldata, use unlimited approvals, set deposit minimums to zero, or use `--skipSwap` to bypass a quote failure.
- Every vault created through this Bankr skill must use `--management curated`. The Bankr wallet is its direct manager; it has no connectors, strategy scheduler, or GasVault reserve. Stop and report requests for a Steer-managed orchestrator as out of scope.
- Read-only inspection, validation, quote, and preparation may proceed when requested. Publishing, submission, and other external writes require a fresh action-specific confirmation.
- A recurring automation may inspect and report, but it does not authorize a submission. Only one current, explicitly authorized unattended curated tend may submit, and only after every gate in [references/automated-tend.md](references/automated-tend.md) passes. Never substitute `--web` for the Bankr execution path.

## Workflow routing

- For command selection or a structured-tool match, read [references/command-discovery.md](references/command-discovery.md).
- For pool identity, price direction, curated manifests, vault creation, deposits, ranges, or manual tending, read [references/lifecycle.md](references/lifecycle.md).
- To gather compact vault and market context before considering a tend, read [references/rebalance-context.md](references/rebalance-context.md) and call `execute_cli` once to run `scripts/rebalance-context.mjs`.
- Immediately before or after a submission, and for stale preparations or signer simulation failures, read [references/bankr-execution.md](references/bankr-execution.md).
- For one explicitly authorized unattended curated tend, read [references/automated-tend.md](references/automated-tend.md) before [references/lifecycle.md](references/lifecycle.md) and [references/bankr-execution.md](references/bankr-execution.md).

## Submission boundary

The only submission payload is the final Steer preparation result's `request.transaction`. Before calling `submit_raw_transaction`, require all of the following:

1. Simulation succeeded and preparation has not expired.
2. `expectedSigner` equals the Bankr wallet, case-insensitively.
3. Requested chain equals numeric `request.transaction.chainId`.
4. `to`, decimal-string `value`, and hex `data` exactly match the reviewed preparation.
5. The user has just confirmed the specific action after reviewing its purpose, target, chain, value, effect, simulation, and material risks, or the exact vault action passes the current one-time authorization in [references/automated-tend.md](references/automated-tend.md).

Record the complete preparation before sending it. Submit the bytes unchanged through `submit_raw_transaction`, record its hash before another action, then verify the receipt and post-state with Steer.
