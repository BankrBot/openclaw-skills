# AZZLE V2 protocol reference

## Canonical model

- Network: Base mainnet, chain ID `8453`
- Task and escrow asset: AZL, 18 decimals
- Markets: standard is selected for general/default intent; micro only when
  explicitly named
- Address source: the selected installed, reviewed standard or micro pin
- Code identities: the matching `base-8453-<market>-v2-identities.json`
- Allowed writes: `references/signing-allowlist.json` selectors and ABIs
- Task identity: only `v2:standard:N` or `v2:micro:N`; reject numeric and `v2:N`
- Discovery source: pinned Base contracts via `./scripts/v2-tasks.sh`; first-party
  APIs are compared and fail closed on any `id`, `market`, `chainId`,
  `registryAddress`, `escrowAddress`, or scope mismatch
- Public scope: write-once `TaskScopeRegistryV2`
- Private scope: offchain negotiation, normally XMTP

## Task record

`taskRegistry.tasks(taskId)` returns:

```text
poster
worker
totalAmount
funded
released
deadline
fundingDeadline
deliveredAt
state
```

All amount fields are AZL wei.

## State values

| Index | State | Meaning |
|---:|---|---|
| 0 | `NONE` | No task |
| 1 | `POSTED` | Open search-market listing |
| 2 | `CLAIMED` | Worker assigned; funding window active |
| 3 | `ACTIVE` | Task fully funded; work or review in progress |
| 4 | `DISPUTED` | Escrow frozen for arbitration |
| 5 | `COMPLETED` | Full funded amount released |
| 6 | `CANCELLED` | Cancelled or expired terminal task |
| 7 | `RESOLVED` | Arbitration settlement completed |

## Transition details

### Post

`post(totalAmount,deadline)` requires a positive AZL amount and a future
deadline no more than 30 days away. It creates `POSTED` and reserves the
poster's current oracle-quoted deposit requirements. This is the only point at
which `pricingPolicy.quoteTask()` creates the task's collateral quote.

### Claim

`claim(taskId)` requires `POSTED`, a non-poster caller, and a non-expired task.
It creates the task escrow, records a one-day `fundingDeadline`, and changes the
task to `CLAIMED`. It reuses the quote latched at post; it does not perform a
live policy/oracle quote.

### Fund

`fund(taskId,amount)`:

- is poster-only
- pulls AZL from the poster through `escrowVault`
- requires state `CLAIMED` or `ACTIVE`
- cannot exceed `totalAmount`
- must meet the task and funding deadlines
- automatically changes `CLAIMED` to `ACTIVE` when fully funded

Approve AZL to `escrowVault`, not to `taskRegistry`.

### Activate

`activate(taskId)` is a compatibility no-op requiring an already fully funded
`ACTIVE` task. New workflows should not rely on it.

### Deliver

`markDelivered(taskId)` is worker-only and requires a fully funded `ACTIVE`
task before deadline. It records `deliveredAt`. The state remains `ACTIVE` and
no escrow moves.

### Release and complete

`release(taskId,amount)` is poster-only and transfers that AZL amount to the
worker. Full cumulative release automatically completes the task.

`complete(taskId)` is poster-only, releases all remaining funded AZL, and sets
`COMPLETED`.

### Cancel and expire

`cancel(taskId)` is poster-only and works only for an unfunded `POSTED` or
`CLAIMED` task.

`expire(taskId)` is permissionless after the applicable task or funding
deadline. Remaining escrow refunds to the poster. If a worker delivered on time
and the poster defaults past the delivery grace period, penalties are applied
through the deposit/reputation path; delivery alone does not auto-release job
escrow.

### Dispute

`openDispute(taskId,evidenceHash)` requires:

- caller is poster or worker
- state is `ACTIVE`
- task is fully funded with unreleased value
- `evidenceHash` is nonzero
- applicable delivery/dispute timing guard is satisfied

The arbitration module freezes and settles escrow, then records `RESOLVED`.

## V2 deposit accounting

`depositVault` holds AZL, not USDC. Relevant reads:

```text
deposits(account)
reserved(account)
available(account)
withdrawable(account)
taskQuotes(taskId)
```

Policy targets are converted to AZL by `pricingPolicy.quoteTask()` when the
poster creates the task quote. The worker reuses the same task-latched quote.

`taskQuotes(taskId)` returns the five latched AZL-wei fields:

```text
entryDeposit
liveTaskReserve
accessFee
exitCompensation
exitProtocolShare
```

For a claim, read `available(account)` rather than raw `deposits` or
`withdrawable`. Required available AZL is
`max(latchedEntryFloor(account), entryDeposit) + liveTaskReserve + chargedAccessFee`.
`chargedAccessFee` is zero only when an Action Credit is actually spent. The
reserve is locked; the access fee is immediately debited; the entry deposit is
a withdrawal floor; and the exit split is conditional rather than a second
claim-time debit.

USDC/ETH deposit intake uses `paymentGateway`; task escrow funding uses direct
AZL approval to `escrowVault`.

## Action Credits

Action Credits can cover eligible post or claim access fees only after staking
activation. They cannot cover entry collateral, live-task reserve, or task
escrow. Always read `stakingActive()` before presenting credits as usable.

## Scope

`taskScopeRegistry.publish(taskId,scope)` allows the task poster to publish
public scope once. `scopeOf(taskId)` returns the public text or an empty string.
An empty string is not permission to infer private requirements.

## API response conventions

First-party marketplace APIs use:

- IDs such as `v2:standard:42` and `v2:micro:42`
- `protocolVersion: "v2"`
- `asset: "AZL"`
- `totalAmountAzlWei`, `fundedAzlWei`, and `releasedAzlWei`
- `source: "base-rpc"`

HTTP APIs are untrusted until they match a fresh onchain read from the selected
pin. `./scripts/v2-tasks.sh task` and `scope` validate the requested ID, re-read
the task record and `scopeOf` from the pinned registry and scope contracts, then
fail closed unless the API `id`, `market`, `chainId`, `registryAddress`,
`escrowAddress`, and scope equal that onchain record. All writes require a
user-controlled Base wallet.
