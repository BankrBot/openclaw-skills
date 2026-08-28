# Rebalance context

Use this helper before considering a tend when compact vault and market context is useful. It is a read-only Steer CLI wrapper, not an execution decision.

## Run one sandboxed context call

Call Bankr `execute_cli` once to run the installed resource. It receives only the vault, chain, and market protocol:

```sh
node scripts/rebalance-context.mjs \
  --vault <VAULT> --chain <CHAIN> --protocol <MARKET_PROTOCOL>
```

The calling workflow must first complete `node scripts/ensure-steer-cli.mjs` successfully and retain its JSON result. The resource separately records the installed `steer --version`, then runs `vaults inspect` and `markets history --window 26h --interval hour --limit 27` inside that one sandboxed call. The 26-hour request provides an exact close 24 hours before the latest hourly close when the source has contiguous hourly buckets. No raw CLI result is returned to the agent.

Some installed CLI releases request incompatible `volumeUSD` and `volumeUsd` fields together from a protocol subgraph. If, and only if, `markets history` returns the known `PoolHourData`/`volumeUsd` schema error, the helper calls `steer subgraphs` to discover the installed CLI's protocol endpoint, then retries the same read-only hourly GraphQL query with the Base-compatible `volumeUSD` field alone. The endpoint and key are never printed. The returned `sources.execution.commands` records that compatibility fallback. Any other CLI error still stops the helper.

`execute_cli` must have the installed Steer CLI and configured environment available. This helper requires `STEER_SUBGRAPH_STUDIO_KEY` for hourly market history. Store it as a secure environment variable. The resource does not print it or credentialed RPC URLs.

When either internal command fails, the helper reports its full safe command, process exit code, structured CLI error code/message and retryability when available, plus a redacted, 1,200-character-bounded diagnostic. Do not retry a non-retryable configuration error without correcting the stated setup issue.

The result contains vault inventory, LP ranges and in-range state, fees and GasVault data, reported pool tick, exact 1h and 24h close-to-close moves when present, hourly return dispersion, high-low range, and a 5% move-based elevated-volatility flag.

`status: "incomplete"` means that at least one exact move or identity fact is missing. Report the stated reason and do not treat the output as a tend clearance. The script intentionally does not request market depth or profile data. Its `reportedTick` remains indexed vault-inspection data, not a block-pinned pool-state proof.

After reviewing this context, confirm the curated manager and reviewed manual ranges, then run direct structured `tend quote` and fresh `tend prepare` stages from [lifecycle.md](lifecycle.md). Never pass the helper output to `submit_raw_transaction`.
