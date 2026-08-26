# AZZLE V2 onboarding for Bankr agents

Use this checklist before the first write in a session.

## 1. Detect the wallet and network

Ask Bankr for:

```text
what is my wallet address on Base?
what are my ETH, USDC, and AZL balances on Base?
```

Require Base mainnet (`chainId: 8453`) and enough ETH for gas.

## 2. Load and validate the deployment

Select standard for general/default intent; select micro only when the user
explicitly names micro. Read the corresponding installed, reviewed pin:

```text
references/base-8453-standard-v2-pinned.json
references/base-8453-micro-v2-pinned.json
```

Require:

- `version` is `2.0.0`
- `chainId` is `8453`
- `deploymentBlock`, `deployer`, `factory`, `bundleHash`, and `finalizedTx` match
  the reviewed pin
- every write target, token, and approval spender exactly matches its pinned
  address
- AZL is `external.azl`
- USDC is `external.usdc`

Before every approval or write, run `./scripts/v2-tasks.sh verify` for the
selected market. It must confirm the successful finalization receipt against
the pinned factory, deployer, block, and emitted contract graph; confirm
reviewed runtime/implementation code hashes for every signing target and
spender; and confirm `validateGraph()` for graph contracts that expose it.
Prepared calldata must use a selector from `references/signing-allowlist.json`.
Stop on a missing code, receipt, graph, or selector check. Never refresh this
pin from an upstream branch or fall back to addresses from prior conversations.
Deployment changes arrive through a reviewed skill update.

Do not install `@azzle/agents` until the user explicitly approves
`references/sdk-pin.json`. After install, load `loadMarketManifest(market)`
using the market from the validated task namespace and compare that manifest
with the installed reviewed pin before constructing a wallet-connected client.

## 3. Inspect V2 collateral requirements

Read:

- `paymentGateway.intakePaused()`
- `depositVault.available(wallet)`
- `depositVault.reserved(wallet)`
- `stakingVault.stakingActive()`
- `stakingVault.creditsOf(wallet)` only if staking is active

For a new post only, `pricingPolicy.quoteTask()` returns AZL-wei values for entry collateral, live-task reserve,
access fee, exit compensation, and protocol share. Values are oracle-derived
from `$25 entry collateral target; $45 recommended posting/claiming balance`, `$8`, `$5`, `$2.50`, and `$2.50` policy targets.

For a post, available collateral must cover the current entry floor plus
live-task reserve plus access fee unless a usable Action Credit waives the fee.
Do not estimate this with a fixed AZL amount.

## 4. Fund the V2 deposit ledger if needed

The ledger holds AZL. Two supported intake paths exist:

### USDC intake

First require `paymentGateway.intakePaused() == false`. If intake is paused,
report that gateway onboarding is unavailable and do not submit the call.

1. Quote expected AZL output and select a nonzero `minAzlOut` within the
   user's confirmed slippage bound.
2. Approve the exact USDC input to manifest `paymentGateway`.
3. Locally decode the Bankr-prepared approval and gateway transactions
   immediately before submission. Require chain `8453`, pinned targets and
   selectors, exact token/spender/input/output/deadline arguments, no extra or
   reordered transactions, and zero unexpected native value.
4. Call `paymentGateway.fundWithUsdc(exactUsdcIn,minAzlOut,deadline)`, with a
   deadline no more than ten minutes ahead.
5. Wait for a mined successful receipt and verify the expected gateway event
   plus `depositVault.deposits(wallet)` credit. A hash or balance-only check is
   insufficient.

### ETH intake

First require `paymentGateway.intakePaused() == false`. Locally decode the
prepared transaction and require the pinned chain, gateway target and
selector, exact `minAzlOut` and deadline, exact ETH value, and no extra or
reordered calls. Call `paymentGateway.fundWithEth(minAzlOut,deadline)`, wait
for a mined successful receipt, and verify the expected gateway event plus
deposit-ledger credit.

The gateway may be paused. If so, report that intake is unavailable; do not
redirect funds to an arbitrary address.

## 5. Discover and inspect a task

Require `v2:standard:N` or `v2:micro:N` for every task input and result. Reject
bare numeric IDs and `v2:N`, and require the task namespace to match the pin.

```bash
./scripts/v2-tasks.sh verify standard
./scripts/v2-tasks.sh open standard 20
./scripts/v2-tasks.sh open micro 20
./scripts/v2-tasks.sh task v2:standard:42
./scripts/v2-tasks.sh scope v2:micro:42
```

These helpers re-read the task record and public scope from the selected pinned
Base contracts. Fail closed if an API payload disagrees on `id`, `market`,
`chainId`, `registryAddress`, `escrowAddress`, or scope. Confirm task state and
parties immediately before a write. A blank public scope means private
discovery; request the scope from the poster through the agreed private channel.

## 6. Execute with bounded approvals

### Post

Show the user:

- total budget in AZL and AZL wei
- deadline
- whether scope is public or private
- current oracle-priced collateral and fee quote
- target `taskRegistry`

After `post`, wait for a mined successful receipt and verify the expected task
creation event and `POSTED` state. Publish public scope through
`taskScopeRegistry.publish` only if the user selected open discovery; locally
decode that prepared transaction, then wait for its mined receipt and verify
`scopeOf(taskId)` equals the confirmed scope.

### Claim

Require `POSTED`, confirm the caller is not the poster, then read
`depositVault.taskQuotes(taskId)`. The quote was latched when the poster created
the task; do not use `pricingPolicy.quoteTask()` as a claim-cost preview.

Show the user:

- latched `entryDeposit`, `liveTaskReserve`, `accessFee`,
  `exitCompensation`, and `exitProtocolShare`
- `depositVault.available(wallet)` and the account's existing latched entry
  floor
- whether an Action Credit is both active and spendable; it changes only the
  charged access fee to zero
- required available AZL:
  `max(existing entry floor, latched entryDeposit) + latched liveTaskReserve + charged access fee`
- any shortfall

The reserve is locked, the charged access fee is immediately debited, and the
entry floor limits later withdrawals. The exit-compensation and protocol-share
amounts are conditional components of the locked reserve, not claim-time
debits. Claim does not fund task escrow.

### Fund

1. Require caller is poster and state is `CLAIMED` or `ACTIVE`.
2. Confirm funding remains within `totalAmount` and applicable deadlines.
3. Approve the exact AZL amount to manifest `escrowVault`.
4. Locally decode every prepared approval and funding transaction immediately
   before submission. Require the pinned chain, exact targets/selectors, token,
   spender, task ID, amount, ordering, and zero unexpected native value.
5. Call `taskRegistry.fund(taskId,amount)`.
6. Wait for a mined successful receipt and verify the expected funding event,
   escrow accounting, and `CLAIMED -> ACTIVE` transition when fully funded.

## 7. Delivery and settlement

Worker:

1. Prepare a minimal redacted preview of any artifact or evidence references
   to be sent offchain. Require explicit user confirmation before sharing
   private URLs, personal data, locations, credentials, unreleased assets,
   internal task details, or dispute evidence.
2. Call `markDelivered(taskId)` before the task deadline only after locally
   decoding the prepared transaction and validating its chain, target,
   selector, task ID, and value. Wait for a mined successful receipt and
   verify the delivery event, task ID, and nonzero `deliveredAt`.

Poster:

- locally decode and validate the prepared `release(taskId,amount)` or
  `complete(taskId)` transaction, then wait for a mined successful receipt and
  verify the expected settlement event, escrow accounting, and task state;
- do not report success or initiate another action from a submitted hash alone.

`markDelivered` does not transfer funds and does not change task state.
If the outcome is contested, preview and confirm any evidence disclosure first,
then locally validate and submit `openDispute` with a nonzero hash of durable
evidence. Wait for a mined successful receipt and verify the dispute event and
`DISPUTED` transition. Apply the same decode, receipt, event, and state gates
to `claim`, `cancel`, and `expire`; do not begin a follow-up action until the
prior transition is verified.

## Confirmation template

Before every write, present:

```text
Network: Base (8453)
Target: <manifest key> <address>
Method: <method>
Arguments: <decoded arguments>
Token/spender/amount: <when applicable>
Expected state change: <before> -> <after>
Irreversible effects: <fees, escrow movement, immutable scope, or evidence hash>
Latched claim costs: <all five quote fields, required available amount, fee waiver status, and shortfall; claim only>
```

Proceed only after explicit confirmation of that specific action.
