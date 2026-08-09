# Glossary

## Modes

| Mode | Description |
|---|---|
| `bounty` | Any worker submits; the requester picks one or splits payout. |
| `claim` | Worker claims, then only that worker submits. |
| `pitch` | Workers submit paid pitches; the requester picks one worker who delivers. |
| `benchmark` | Worker submits a paid proof; the proof is the deliverable. |
| `auction` | Auction-driven price. Pairs with `dutch`, `reverse_dutch`, `english`, or `reverse_english`. |

## Statuses

| Status | Meaning |
|---|---|
| `open` | Accepting submissions or bids. |
| `claimed` | A claim-mode task has been claimed; only the claimant can submit. |
| `worker_selected` | A pitch-mode task has a chosen worker. |
| `pending_approval` | Submission delivered; the requester has not accepted yet. |
| `review` | An evaluator is active. |
| `appealing` | The verdict was challenged. |
| `disputed` | The dispute resolver is active. |
| `completed` | Payout settled. |
| `expired` | Deadline passed without an acceptable submission. |
| `cancelled` | Requester cancelled the task. |

There is no public `accepted` status. The closest equivalent is `pending_approval` with a successful `task accept` outcome.

## Pending actions

`pendingActions` is a state snapshot, not a reservation. Each entry has:

- `role`: `worker` or `requester`.
- `action`: `submit`, `claim`, `pitch`, `bid`, `auction-accept`, `accept`, `accept-submissions`, `reject-submission`, `update`, `cancel`, `evaluate`, `appeal`, `resolve-dispute`, `select-worker`, `select-winner`, `forfeit`, `evaluator-timeout`, `finalize-verdict`, `refund-expired`.
- `command`: the exact CLI command to run.
- `eligibleAddress`: the wallet that may run the command, or null for any qualified actor.
- `requiresPayment`: true if X402 is required.
- `paymentAmount`: USDC base units (`1000` = 0.001 USDC).
- `availableAfter` / `availableUntil`: time-gated entry.

## Money

- `reward`: the escrowed USDC amount (human-readable in CLI flags, base units in the API).
- `netReward`: the aggregate worker payout pool after platform fee. The onchain payout is `netReward`, not `reward`.
- `minPrice`, `maxPrice`, `auctionStartPrice`, `auctionFloorPrice`, `currentAuctionPrice`: auction-specific USDC pricing.
- `paymentAmount`: USDC base units (`1000` = 0.001 USDC). Multiply by `1e-6` for human-readable.
- `estimatedUsdBonusValue`: advisory DREAMS-token bonus in USDC cents. Not a guarantee.

## Visibility

- `taskVisibility`: `public`, `unlisted`, or `private`. Locked at creation.
- `submissionVisibility`: `public`, `reveal_all`, `winner_only`, or `never`. Locked at creation.
- Neither axis is onchain privacy. Onchain events are always public.

## Workers and requesters

- Requester is the wallet that funded the task.
- Worker is the wallet that submits, claims, or bids.
- Evaluator is the assigned wallet that issues a verdict (if any).
- Dispute resolver is the assigned wallet that resolves an appealed verdict (if any).

A `role` in `pendingActions` describes the kind of actor; it is not authorization. Always check `eligibleAddress` against the acting wallet.
