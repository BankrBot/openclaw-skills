# Automated curated tend

Read this reference only for a current request that explicitly authorizes one unattended curated-vault tend. It does not authorize recurring execution, a different vault, a different chain, or a retry after an uncertain result.

## Required policy

Before any preparation, the request must identify the curated vault and chain, state that submission may proceed without an interactive confirmation, and provide compatible CLI version requirements. It must also provide the complete range-selection policy, including exact tick alignment, position count, weights, and range-width rules. It must provide measurable inputs or thresholds for data freshness, cross-source price tolerance, maximum price impact or swap cost, gas cost, and economic benefit. It must define a durable run identifier or equivalent duplicate-run check.

If a required policy value, tool, source, or durable state check is absent, stop with `AUTOMATION_POLICY_INCOMPLETE`. Do not fill gaps with a heuristic.

At the start of every scheduled run, call `node scripts/ensure-steer-cli.mjs` and persist its complete JSON result. It resolves npm latest twice, installs the initially resolved exact version only when needed, and fails if npm latest changes during the preflight or the binary does not match. Do not re-run it between quote and preparation. Stop with `VERSION_POLICY_CONFLICT` when a request requires a different version, or the script's returned version error when it cannot verify the current npm latest.

## Run sequence

1. Resolve the Bankr wallet and confirm the target vault and chain. Inspect the vault, underlying pool, canonical token order, decimals, fee, tick spacing, manager mode, current inventory, and existing positions.
2. Run the policy's specified market-data checks. Use onchain pool facts as the authority for pool identity and price orientation. Stop on missing, stale, inconsistent, or abnormal data according to the policy thresholds.
3. Check the durable run record and current vault state. Stop with `DUPLICATE_RUN` if an equivalent scheduled run already submitted or completed a tend.
4. Confirm the vault manager is curated and the Bankr wallet is the direct manager. Do not run `steer vaults tend plan`; a curated vault has no strategy decision. Derive one complete replacement set only from the supplied policy.
5. Evaluate the selected ranges and weights against current market and inventory facts. Do not prepare multiple candidates.
6. Quote the selected complete replacement set. Stop for unacceptable swap economics, price impact, gas, inventory risk, simulation status, or any policy violation.
7. Prepare the same complete replacement set once, against fresh state. Recheck simulation, expiry, `expectedSigner`, chain ID, target, value, calldata, positions, and price limits. The initial wallet lookup does not replace this post-preparation signer comparison.
8. Call `submit_raw_transaction` once with the final `request.transaction` unchanged. Record the returned hash before any other action.
9. Verify the receipt with `steer transactions verify`, re-inspect the vault and positions, and persist the outcome under the run identifier.

## Minimum skip reasons

Report the first applicable specific reason and submit no transaction: `VERSION_POLICY_CONFLICT`, `NPM_LATEST_UNAVAILABLE`, `NPM_LATEST_INVALID`, `CLI_VERSION_UNAVAILABLE`, `CLI_VERSION_INVALID`, `CLI_INSTALL_FAILED`, `CLI_VERSION_MISMATCH`, `VERSION_CHANGED_DURING_RUN`, `VAULT_CHAIN_MISMATCH`, `CAPABILITY_UNSUPPORTED`, `WALLET_UNAVAILABLE`, `AUTOMATION_POLICY_INCOMPLETE`, `RANGE_POLICY_UNSPECIFIED`, `DATA_UNAVAILABLE`, `DATA_STALE`, `PRICE_DISAGREEMENT`, `DUPLICATE_RUN`, `UNECONOMIC_TEND`, `QUOTE_UNACCEPTABLE`, `PREPARATION_INVALID`, `SIGNER_MISMATCH`, or `SIMULATION_FAILED`.

Never automatically retry a submission-side failure. Preserve the prepared artifact, Bankr response, and any hash before following the recovery procedure in [bankr-execution.md](bankr-execution.md).
