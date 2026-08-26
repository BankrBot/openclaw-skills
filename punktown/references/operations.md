# Punk Town operation playbook

Use this reference whenever a request could create a transaction. It covers the
complete public/user surface supported by the skill. The reviewed addresses,
runtime code identities, and ABI surface live in `deployment.json` and
`signing-allowlist.json`; do not duplicate or replace them from prose.

## Protocol model

Punk Town is live on Base (`chainId: 8453`) and non-upgradeable. The user-facing
system has three connected parts:

- **PunkAMM:** a fixed-price FIFO desk for Bario Punks and BAES.
- **LockVault:** non-transferable Crew positions created by locking a punk and
  paying a non-refundable BAES tier cost.
- **StockLock:** converts fee WETH into rotating stock tokens, settles each
  position's earned units, and lets beneficiaries claim their credits.

The single immutable owner is not part of the reward execution path. This skill
does not expose owner-only configuration, pause, roster, recovery, or dust-sweep
methods. It also does not add or recommend governance, roles, multisigs,
timelocks, proxies, or upgrade paths.

## Fixed values and roles

### Desk prices

| Direction | Wallet receives | Wallet pays | Fee conversion |
|---|---:|---:|---:|
| Sell punk to desk | exactly 5,400,000 BAES | one Bario Punk | 600,000 BAES withheld from the 6,000,000 principal |
| Buy punk from desk | one FIFO-head Bario Punk | exactly 6,600,000 BAES | 600,000 BAES above the 6,000,000 principal |

For both directions, the 600,000 BAES fee is immediately swapped to WETH and
deposited into StockLock. The user supplies a nonzero `minWethOut`. The planner
uses the same immutable fee adapter's fresh quote and defaults to 300 basis
points of slippage tolerance (97% minimum). Never set the floor to zero.

### Crew tiers

| Tier | Name | Non-refundable BAES cost | Weight |
|---:|---|---:|---:|
| 0 | Signal | 600,000 | 100 |
| 1 | Surge | 1,500,000 | 158 |
| 2 | Riot | 3,300,000 | 235 |
| 3 | Overdrive | 6,000,000 | 316 |
| 4 | Maximum | 15,000,000 | 500 |

Each payment is split 50/50 between burn and the PunkAMM reserve. It is never
refunded and never funds stock purchases. An upgrade pays only the cost
difference, settles at the old weight first, and can only move upward.

### Position roles

- **Depositor:** the wallet that locked the NFT. Only this address can upgrade
  or unstake the position.
- **Beneficiary:** the address that earns and owns the stock credits. It may be
  different from the depositor. Only the beneficiary can claim or forfeit its
  credits.
- **Settler:** anybody may settle a valid position; the resulting credit always
  goes to the recorded beneficiary.

Default a new position's beneficiary and every claim/unstake recipient to the
active Bankr EVM wallet. A different address must be requested explicitly and
named in the confirmation.

## Pause and exit behavior

| Route state | Blocked | Still available |
|---|---|---|
| Fee route paused | NFT buy and sell | Crew exit, settlement, claims, bootstrap poke, credit forfeiture, head eviction, BAES donation sync |
| Stock route paused | New Crew stake, Crew upgrade, stock convert | Crew exit, settlement, claims, bootstrap poke, credit forfeiture, head eviction, BAES donation sync |

The contracts intentionally preserve exits when routes are paused. The external
Bario Punks transfer validator can still block an NFT transfer independently;
see “ERC721-C and wallet receivers” below.

## Shared write workflow

Every `plan-*` command runs the reviewed deployment and relevant state gates,
reads fresh state, and emits at most one unsigned transaction. A buy, stake, or
upgrade with insufficient BAES instead emits `phase: acquire-baes` and no raw
transaction; action simulation follows only after the wallet is funded and the
planner is rerun.

1. Resolve and pass the authenticated Bankr EVM signer as `--wallet`.
2. Run the relevant read command so the user sees the current NFT, position,
   credit, route, and capacity state.
3. Run the planner. On `ok: false`, stop and relay `detail`; do not improvise.
4. If the planner requests BAES, follow `natural-join-flow.md`: obtain a concrete
   Bankr preview, bind the source and maximum spend, and include the swap plus
   every later approval/final call in one confirmation. Otherwise present one
   confirmation for the whole unchanged operation.
5. Decode the emitted transaction again with `inspect-calldata` immediately
   before Bankr submission.
6. Submit one transaction with confirmation waiting enabled, then run
   `inspect-tx` with the same context/key. Require its direct-sender or selected
   sponsored UserOperation proof, expected event from that operation's isolated
   log window, and fresh state postcondition. Never treat a bundler relayer's
   outer `transaction.from` as the wallet.
7. If the emitted transaction was an approval, rerun the original planner. The
   final call must use a fresh head, quote, deadline, allowance, and simulation.
8. If the planner has more bounded work (`settle-all` or `claim-all`), rerun it
   only after the previous step is mined and verified.
9. Treat every later settle batch or claim token as a new economic step. Show
   its fresh terms and confirmation key and obtain fresh user confirmation.

Never reuse a transaction after any state change. Never submit two plans in
parallel. Base transaction ordering is the workflow's atomicity boundary.
When an ERC-20 allowance is nonzero but differs from the exact requirement, the
planner first emits an approval to zero. After that reset mines, a fresh plan
emits the exact approval; only a later fresh plan may emit the protocol action.
Never increase the old allowance or treat a greater allowance as “good enough.”

### Execution-time selections and races

`inspect-calldata` requires the same plan's `inspectionContextHex` and
`inspectionKey` and rejects state drift already visible at inspection. State can
still change after inspection and before mining. For the operations below, the
confirmation must authorize the contract's explicit execution rule, not imply
that the displayed observation is a calldata cap.

| Operation | Fixed in calldata | Observed at planning | Valid execution-time result |
|---|---|---|---|
| Convert | WETH amount, deadline | next enabled slot/token | contract-selected next enabled token; a preceding conversion can advance rotation, while one in the same block can make this call revert |
| Donation sync | no amount argument | current BAES surplus | all unsynchronized BAES at execution; a prior sync can make the call revert and a new donation can increase the reconciled amount |
| FIFO eviction | no token-ID argument | current broken head | whichever execution-time FIFO head is still proven unowned; an owned/valid head makes the call revert |
| WETH top-up | amount, source ID | current zero/positive Crew weight | `bootstrapLocked` at zero execution-time weight, otherwise `wethPot` |
| Lossy claim | token, recipient, minimum received | current full credit | the wallet's entire current credit is debited; settlement before mining can increase that debit and there is no maximum-debit argument |

For `claimLossy`, the delivery floor is not a debit cap. If the user does not
explicitly accept that the displayed full credit may increase before mining,
do not execute the lossy claim. A later receipt-proof failure can expose debit
drift but cannot reverse the successful destructive transaction.

## Read-only discovery

### Verify and status

```bash
node scripts/punktown.mjs verify --wallet 0x…
node scripts/punktown.mjs status --wallet 0x…
```

`verify` must confirm the reviewed chain, release pin, runtime code hashes,
immutable owner where exposed, reciprocal peer wiring, peer locks, system-open
state, assets, fee adapter and route, and the stock adapter discovered through
`StockLock.stockAdapter()`. A mismatch means the skill is not ready to write.

`status` reports moving state such as route pauses, desk capacities, total Crew
weight, WETH pot/bootstrap, rotation, conversion bounds, and lifetime token
count. Moving state is not configuration; re-read it before acting.

### Inventory

```bash
node scripts/punktown.mjs inventory --wallet 0x…
node scripts/punktown.mjs punk --wallet 0x… --token-id N
```

The Bario Punks collection is not ERC-721 Enumerable. Bankr portfolio/NFT data
is the wallet-candidate discovery source, but each candidate's ownership must be
confirmed through `punk --token-id`, which performs a fresh `ownerOf(tokenId)`
read. `inventory` is the desk's bounded FIFO view, not a wallet index. Desk
entries must be cross-checked against custody. Never infer ownership from old
transfer events or an indexer alone.

### Crew and rewards

```bash
node scripts/punktown.mjs crew --wallet 0x…
node scripts/punktown.mjs rewards --wallet 0x…
```

Crew discovery scans bounded position pages and separates positions where the
wallet is depositor, beneficiary, or both. Rewards must walk the lifetime
`distributedTokens` list, not only the currently enabled stock roster. Delisted
or disabled tokens can retain valid pending amounts and credits.

## Desk operations

### Buy the FIFO head

```bash
node scripts/punktown.mjs plan-buy --wallet 0x… [--slippage-bps 300]
node scripts/punktown.mjs plan-buy --wallet 0x… --join [--slippage-bps 300]
```

Preconditions and plan:

- fee route active and unpaused;
- nonempty inventory and a fresh `fifoHead`;
- desk still owns the head;
- wallet bytecode is checked before acquisition; a contract wallet's current
  receiver compatibility is proven later by the funded action simulation;
- if the wallet has less than 6,600,000 BAES, the planner emits an acquisition
  request for exactly the current deficit and no Punk Town transaction;
- BAES allowance to PunkAMM is exactly 6,600,000 BAES;
- fresh fee quote, nonzero `minWethOut`, latest-Base-block deadline;
- call fixes `expectedHeadTokenId` to the fresh head and `maxBAESIn` to exactly
  6,600,000 BAES.

If allowance is not exact, the planner emits only `BAES.approve(PunkAMM,
6,600,000 BAES)`. After it mines, rerun; the FIFO head or quote may have
changed. Do not ask the user to select a different desk NFT: buying is FIFO.

With `--join`, the same final plan carries a post-success tier handoff. Do not
ask for or fund a tier until `NFTBought` and fresh wallet ownership are proven.

Expected completion: successful `NFTBought` for the signer and head token,
wallet `ownerOf(tokenId)`, inventory reduced by one, tracked reserve increased
by 6,000,000 BAES, and exact wallet BAES delta (apart from Bankr execution
mechanics).

### Sell a wallet-owned punk

```bash
node scripts/punktown.mjs plan-sell --wallet 0x… --token-id N [--slippage-bps 300]
```

Preconditions and plan:

- wallet is the fresh `ownerOf(tokenId)`;
- punk is not already tracked by the desk or LockVault;
- fee route active and unpaused;
- desk has one 6,000,000 BAES principal of sell capacity;
- token-specific NFT approval to PunkAMM;
- fresh fee quote, nonzero `minWethOut`, latest-Base-block deadline;
- `minBAESOut` is the exact 5,400,000 BAES payout.

Use only `approve(PunkAMM, tokenId)`. Never use `setApprovalForAll`. The NFT is
received before BAES is paid, but the whole transaction reverts atomically if
the fee conversion or any exact-delta check fails.

Expected completion: successful `NFTSold`, desk ownership and FIFO tracking of
the token, inventory increased by one, tracked reserve reduced by 6,000,000
BAES, and the wallet receives exactly 5,400,000 BAES.

### Repair an unowned FIFO head

```bash
node scripts/punktown.mjs plan-evict-head --wallet 0x…
```

This is permissionless repair, not inventory choice. Plan only when the current
FIFO entry is proven not to be owned by PunkAMM. There is no token-ID argument:
the current head is an observation, and the contract re-checks the FIFO head at
execution. If ordering changes it, the call may evict a different head only if
that new head is also proven unowned; an owned/buyable head makes the call
revert. Expected completion: `HeadEvicted` naming the actual execution-time
broken head, inventory reduced by one, and a new head or empty inventory.

### Reserve top-up and donation sync

```bash
node scripts/punktown.mjs plan-reserve-topup --wallet 0x… --amount-baes AMOUNT
node scripts/punktown.mjs plan-sync-donation --wallet 0x…
```

`reserve-topup` transfers BAES from the wallet into the tracked desk reserve.
It is an irreversible donation that increases sell capacity. Require exact BAES
approval to PunkAMM and a confirmation that names the donation and resulting
capacity. Expected completion: `ReserveToppedUp`, exact BAES transfer, and
`trackedBAES` increased by the amount.

`sync-donation` does not transfer funds and takes no amount argument. It folds
all BAES sitting above the tracked reserve into `trackedBAES` at execution. Use
it only when a fresh raw balance proves a surplus. Another sync before mining
can make the call revert; another donation can increase the amount reconciled.
Expected completion: `DonationSynced` for at least the confirmed observed
surplus and `trackedBAES == raw BAES balance` at that execution. Do not
manufacture the surplus with an unsolicited transfer as part of this skill.

## Crew operations

### Add a punk to Crew

```bash
node scripts/punktown.mjs plan-stake \
  --wallet 0x… --token-id N --tier 0..4 [--beneficiary 0x…]
```

Preconditions and plan:

- wallet owns the punk; this is proven before any tier BAES acquisition request;
- stock route unpaused and system open;
- active position count below 3,333;
- valid tier and nonzero beneficiary;
- exact BAES allowance to LockVault for that tier's cost;
- token-specific Bario Punk approval to LockVault;
- current ERC721-C transfer and receiver simulation succeeds.

If the wallet lacks the chosen tier cost, the planner requests only that live
BAES shortfall after ownership and capacity gates pass. Follow the Bankr
acquisition flow, rerun the exact command, and obtain a new confirmation because
the tier is a separate non-refundable decision from buying the Punk.

The planner emits only one missing approval at a time and must be rerun after
each mined approval. The confirmation names the full non-refundable BAES cost,
the 50/50 burn/reserve split, NFT, tier, weight, and beneficiary.

Expected completion: `PositionOpened`, new active position owned by the signer
as depositor, the exact beneficiary/tier/weight, vault ownership and tracking of
the NFT, total weight increase, and exact BAES collection/split.

### Upgrade a Crew position

```bash
node scripts/punktown.mjs plan-upgrade \
  --wallet 0x… --position-id N --new-tier 1..4
```

Only the active position's depositor may upgrade, and only to a higher tier.
The exact BAES cost is `tierCost(new) - tierCost(old)`. StockLock settles all
lifetime tokens at the old weight before the new weight takes effect, so an
upgrade cannot earn past distributions retroactively. The stock route must be
unpaused. If the depositor lacks the delta, acquire only that shortfall through
the same concretely quoted and confirmed Bankr flow before any approval.

Expected completion: any earned `CreditWritten` events at old weight,
`PositionUpgraded`, exact BAES delta/split, and the new tier, weight, and total
weight.

### Exit Crew

```bash
node scripts/punktown.mjs plan-unstake \
  --wallet 0x… --position-id N [--recipient 0x…]
```

Only the depositor can exit. Without `--recipient`, use `unstake(positionId)`
and return the NFT to the depositor. With an explicit different recipient, use
`unstakeTo(positionId, recipient)`. This is the supported exit for a contract
depositor that cannot receive ERC-721s. It is not a transfer of depositor
authority; the signer must still be the depositor.

Unstake works regardless of fee-route or stock-route pause and automatically
settles at the old weight. It returns only the NFT; no tier BAES is refunded.

Expected completion: any earned `CreditWritten` events, `PositionClosed`,
inactive position/zero reward weight, reduced active count and total weight,
cleared vault tracking, and `ownerOf(tokenId) == recipient`.

## Reward operations

### Settle one or all

```bash
node scripts/punktown.mjs plan-settle --wallet 0x… --position-id N
node scripts/punktown.mjs plan-settle-all --wallet 0x…
```

Settlement is permissionless and transfers no token. It crystallizes each
position's pending stock into `stockCredit[token][beneficiary]`. It never
redirects credit to the caller.

`plan-settle-all` selects active positions whose beneficiary is the active
wallet and groups at most 20 IDs per transaction. Rerun after each successful
batch until no eligible pending amount remains. Every later batch has a new set
of position IDs and requires a new confirmation. A zero-pending position needs
no write.

Expected completion: `CreditWritten` events for nonzero token amounts,
position checkpoints advanced to current accumulators, pending reduced to zero,
and beneficiary credits increased by the matching amounts.

### Strict claim, batch claim, and claim all

```bash
node scripts/punktown.mjs plan-claim \
  --wallet 0x… --token 0x… [--recipient 0x…]

node scripts/punktown.mjs plan-claim-batch \
  --wallet 0x… --tokens 0x…,0x… [--recipient 0x…]

node scripts/punktown.mjs plan-claim-all \
  --wallet 0x… [--recipient 0x…]
```

Claims spend only the signer's own beneficiary credit. Strict claims require
the stock token to deliver the exact credited amount. WETH is never a claimable
stock token.

- `plan-claim` calls `claim` for the wallet recipient or `claimTo` for another
  explicit recipient.
- `plan-claim-batch` accepts at most 20 unique lifetime distributed tokens and
  skips zero credits. The batch is one atomic transaction; one broken token can
  revert the whole batch.
- `plan-claim-all` walks every lifetime distributed token and deliberately plans
  one strict claim at a time so a broken token does not block healthy credits.
  Rerun after each mined claim, show the newly selected token/amount/recipient,
  and obtain a fresh confirmation before submitting that next claim.

Settle pending positions before claiming if the user asks to collect
“everything.” `plan-settle-all` must finish, then `rewards` and
`plan-claim-all` must be rerun from fresh state. The user's broad request starts
the workflow; it does not replace the per-batch and per-token confirmations.

Expected completion: `Claimed` with the signer, exact token, recipient, and
amount; signer credit reduced to zero for that token; stock liability reduced;
recipient balance increased by the exact amount.

### Lossy claim

```bash
node scripts/punktown.mjs plan-claim-lossy \
  --wallet 0x… --token 0x… --min-received AMOUNT [--recipient 0x…]
```

Use only when a strict claim is genuinely stuck because a previously purchased
stock token now short-delivers, such as after enabling a transfer fee. Never
offer it as a routine fallback immediately after any generic claim failure.

The calldata fixes token, recipient, and a nonzero `minReceived` floor, but it
contains no debit amount or maximum-debit cap. The contract debits the
**entire current credit at execution** while accepting a smaller delivered
amount. A permissionless settlement mined after inspection can add credit and
therefore increase both the debit and possible loss. Read token decimals from
chain; the CLI accepts a human amount and reports the raw floor. Before
confirmation show the currently observed full credit, minimum accepted,
possible loss, recipient, and the execution-time increase risk. If the user
does not accept that dynamic full-credit debit, stop: no safe calldata rewrite
can impose a cap.

Expected completion: `ClaimedLossy` with actual execution-time debited and
delivered amounts, credit reduced to zero, liability reduced by the full debit,
and recipient balance delta at least `minReceived`. If the debit differs from
the confirmed observation, report proof incomplete and stop; the successful
debit is irreversible.

### Forfeit credit

```bash
node scripts/punktown.mjs plan-forfeit \
  --wallet 0x… --token 0x… --amount AMOUNT
```

This irreversibly destroys some or all of the signer's credit without sending
any token. It is the final recovery choice for credit the holder knowingly
abandons. Never automate it and never suggest it merely because a strict claim
reverted once. Confirm the exact credit destroyed and that the wallet receives
nothing.

Expected completion: `CreditForfeited`, credit and stock liability reduced by
the exact amount, no recipient transfer.

## Stock engine operations

### Permissionless conversion

```bash
node scripts/punktown.mjs plan-convert --wallet 0x… --amount-weth AMOUNT
```

Conversion spends WETH already held by StockLock; it does not pull the caller's
principal. It buys the next enabled rotation stock at execution, credits all
positions weighted at that execution through the accumulator, and pays the
caller 1% of `amountIn` in WETH.

Required bounds:

- stock route active and unpaused;
- total Crew weight above zero;
- amount at least 0.001 WETH, at most 0.5 WETH, and at most the effective pot after current bootstrap accrual;
- no successful conversion already in the current Base block;
- a valid next enabled roster slot;
- lifetime distributed-token count remains at most 16;
- fresh deadline based on the latest Base block.

There is deliberately no stock-output price floor. Do not inject one, claim the
integrity checks are a price guarantee, or let the caller select the stock. The
exposure bounds are the amount cap, one-conversion-per-block rule, immutable
adapter binding, and delayed roster changes.

The displayed slot/token is an observation, not encoded in calldata. The
inspector rejects a rotation change already visible before submission, but a
conversion ordered ahead can advance the token before this call executes. If
that prior conversion is in the same block, the one-per-block guard reverts this
call; if it is in an earlier block, this call may validly buy the newly next
token. Confirm this automatic-selection rule, not a promise to buy only the
displayed symbol.

Expected completion: `Converted` for the actual execution-time next token and
caller, WETH swap input plus 1% bounty, nonzero stock output,
pot/liability/accounting deltas, accumulator increase, and rotation cursor
advance.

### WETH pot top-up

```bash
node scripts/punktown.mjs plan-weth-topup \
  --wallet 0x… --amount-weth AMOUNT [--source-id TEXT]
```

This is an irreversible WETH donation, not a direct stock purchase and not a
guarantee that the donor earns rewards. Require exact WETH approval to StockLock.
The planner encodes a bounded `bytes32` source ID; do not hash or truncate
arbitrary unreviewed text silently.

If total Crew weight is zero at execution, the amount enters bootstrap
hold-back. Otherwise it enters the convertible pot after bootstrap accrual.
The planner displays the current destination and the inspector rejects a change
already visible, but Crew can empty or become nonempty before mining and flip
the valid destination. The amount and source ID remain fixed. Rewards belong to
positions at conversion time, not deposit time.

Expected completion: `RevenueDeposited` with exact source ID/amount/bootstrap
flag for the execution-time Crew state, exact WETH transfer, and matching WETH
liability plus pot or hold-back increase.

### Advance bootstrap

```bash
node scripts/punktown.mjs plan-poke-bootstrap --wallet 0x…
```

This permissionless call accrues the seven-day active-time bootstrap schedule.
It transfers no user asset. Time advances only while weight exists; if Crew
empties, unconverted pot is returned to hold-back so the next staker cannot
capture it immediately.

The planner emits a transaction only when the call can start/advance an active
schedule, relock a stranded pot after Crew empties, or clear a stale accrual
anchor. Locked bootstrap WETH by itself is not enough while weight and the
anchor are both zero; that state would be a no-op and is rejected.

Expected completion: the `BootstrapReleased` event when a nonzero amount is
released and matching pot/hold-back/time-state deltas. A no-op may emit no
event; the planner must explain why a transaction is or is not useful.

## ERC721-C and wallet receivers

Bario Punks invokes an external, non-view ERC721-C transfer validator. The
collection owner can repoint that validator or raise its security level outside
Punk Town. Such a change can block transfers, including every path by which a
punk leaves Punk Town. Protocol statements that its owner cannot recover a
tracked punk describe Punk Town's own code only; they cannot override the
collection validator.

For every buy, sell, stake, or unstake:

- simulate against fresh Base state;
- never assume a past successful transfer proves the next one;
- verify the intended sender, receiver, token ID, and current ownership;
- for a code-bearing receiver, prove ERC-721 receiver compatibility through the
  planner's simulation; code presence alone is neither proof of support nor a
  reason to bypass the gate;
- if compatibility or validator behavior is ambiguous, stop.

`buyNextNFT` always sends the NFT to `msg.sender`; it cannot redirect to another
recipient. `unstakeTo` is the explicit-recipient escape for a depositor whose
wallet cannot receive an ERC-721. Never work around receiver checks with a
direct NFT transfer to PunkAMM or LockVault.

## Confirmation language

A complete confirmation is short but specific. Example:

> Buy FIFO-head Bario Punk #123 on Base from your Bankr wallet for exactly
> 6,600,000 BAES? This first grants PunkAMM an exact 6,600,000 BAES allowance,
> then re-checks the head and fee quote before buying with a 3% WETH-conversion
> slippage limit. The NFT returns to 0x1234…abcd. Yes/no?

For a stake, include tier, full non-refundable BAES cost, weight, NFT, and
beneficiary. For an exit, state that only the NFT returns. For lossy claim,
forfeit, or top-up, state the maximum loss or irreversible donation explicitly.

## Operation-to-proof matrix

| Operation | Required event | Fresh postcondition |
|---|---|---|
| Buy | `NFTBought` | wallet owns exact head; FIFO/inventory/reserve updated |
| Sell | `NFTSold` | desk owns/tracks token; wallet got exact 5.4M BAES |
| Stake | `PositionOpened` | active position, beneficiary/tier/weight, vault owns token |
| Upgrade | `PositionUpgraded` plus any `CreditWritten` | new tier/weight and exact cost delta |
| Unstake | `PositionClosed` plus any `CreditWritten` | position inactive; recipient owns token |
| Settle | `CreditWritten` when nonzero | checkpoints current; credits match pending delta |
| Strict claim | `Claimed` | credit zero; exact recipient balance increase |
| Lossy claim | `ClaimedLossy` | actual full execution-time credit debited to zero; delivery at least confirmed floor |
| Forfeit | `CreditForfeited` | exact credit/liability decrease; no transfer |
| Convert | `Converted` | execution-time token, pot, bounty, accumulator, liability, cursor all match |
| WETH top-up | `RevenueDeposited` | exact liability and execution-time pot/hold-back destination increase |
| BAES top-up | `ReserveToppedUp` | exact tracked reserve/capacity increase |
| Donation sync | `DonationSynced` | full execution-time surplus reconciled; tracked reserve equals raw BAES balance |
| FIFO eviction | `HeadEvicted` | execution-time unowned head removed |
| Bootstrap poke | `BootstrapReleased` when nonzero | schedule and pot/hold-back match elapsed active time |

If the event or postcondition cannot be proven, report the transaction as
unverified and do not initiate a dependent action.
