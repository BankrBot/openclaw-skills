# Bankr execution and recovery

Use this reference immediately before and after every Bankr submission.

## Submission record

Persist a separate record for each action before sending it. Include the exact CLI command, complete prepared result, purpose, preparation block and time, expected signer, simulation result, transaction fields, user confirmation or run-scoped automation authorization, Bankr response, and transaction hash. Do not overwrite an earlier prepared artifact with a fresh one.

The Bankr Wallet request must preserve the Steer transaction exactly:

```json
{
  "transaction": {
    "to": "<prepared request.transaction.to>",
    "chainId": <prepared request.transaction.chainId>,
    "value": "<prepared request.transaction.value>",
    "data": "<prepared request.transaction.data>"
  },
  "description": "<specific Steer action>",
  "waitForConfirmation": true
}
```

Use Bankr's `submit_raw_transaction` tool for this exact payload. The non-agent HTTP equivalent is `POST /wallet/submit`. The Bankr Agent prompt API may explain a workflow, but it must not rebuild or alter an unsigned Steer transaction.

For a manual action, show the user a compact confirmation that includes:

- action and irreversible effect
- chain, target, and Bankr signer
- approval token and exact allowance, or deposit and tend positions, as applicable
- native value, simulation status, selected block, expiry, and material quote risk
- the fact that the submitted `to`, `value`, and `data` will be byte-for-byte identical to the reviewed preparation

For a run-scoped automated curated tend, persist the same fields in the run record and confirm that every gate in [automated-tend.md](automated-tend.md) passed. Do not request a new confirmation or substitute a prior run's authorization.

After a successful response, record the hash before issuing any other command. Then verify the receipt with `steer transactions verify <TX_HASH> --trace` and inspect the relevant pool or vault state.

## Do not submit when

- the Bankr wallet address does not match `expectedSigner`
- the chain ID, target, value, or calldata differs from preparation
- the preparation simulation failed, is expired, or has an unknown status
- required pool identity, price orientation, curated manager mode, range policy, or capability is unverified
- a deposit uses an unlimited allowance or zero minimums
- a quote or fresh preparation changed materially and has not been reviewed again
- a dynamic pool or vault action is unsupported by the installed CLI

## Signer-side simulation failure

If Bankr rejects a transaction before broadcast, no receipt exists and no chain state changed. Do not call this a stale quote, retry the old transaction, or generate replacement calldata yet.

1. Preserve the original prepared artifact and Bankr rejection.
2. Ask Bankr for the exact calldata it simulated, simulation block when available, and raw revert data. Compare its calldata to the preparation artifact byte-for-byte.
3. If the installed CLI exposes `steer vaults tend diagnose` and the original bytes plus a replay block are available, diagnose that exact artifact:

```sh
steer vaults tend diagnose <VAULT> \
  --data <EXACT_ORIGINAL_CALLDATA> \
  --account <EXPECTED_SIGNER> \
  --block <BANKR_SIMULATION_BLOCK> \
  --prepared-block <ORIGINAL_PREPARATION_BLOCK> \
  --format json
```

4. If that command is unavailable, report the capability limit with the preserved original artifact. Do not replace it with a newly prepared transaction or infer a contract cause.
5. Treat `TEND_REPLAY_NOT_REPRODUCED` as a diagnostic limit, not proof of state drift. Treat `TEND_DIAGNOSIS_RPC_ERROR` as infrastructure evidence, not a contract cause.
6. If an implementation does not match a verified profile, preserve the raw selector and implementation hash. Do not guess semantics from a similar protocol or a stale local artifact.
7. Only after the diagnosis and a fresh user decision, prepare again against current state. Review and confirm that new transaction independently.

## Prepared transactions are short-lived

Pool state can change between Steer preparation and Bankr simulation. A later successful replay of newly generated calldata does not diagnose an earlier Bankr rejection. Exact bytes and block context are required.

For a verified stale-price-limit or state-drift result, re-run the read-only quote and fresh prepare, compare it to the prior plan, then present the new confirmation. Never automatically replace or broadcast a failed transaction.
