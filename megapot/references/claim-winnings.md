# Claim winnings

The user has won lottery tickets and wants to claim them. This is a **two-step flow**: discover unclaimed wins via the Data API, confirm with the user, then execute the on-chain claim.

## Flow

### Step 1 — Discover claimable wins

Call the Data API (see `data-api.md` for full details):

```
GET https://api.megapot.io/v1/wallets/{userWallet}/wins?claimed=false&limit=50
```

The `?claimed=false` filter is server-side — the response contains only unclaimed wins.

**Handle empty result:** if `data` is an empty array, tell the user "You have no unclaimed winnings on this wallet." Stop.

**Handle 429 / 5xx:** see `data-api.md` for the mandatory deflection-to-megapot.io behavior. Do not proceed to step 2 with stale or partial data.

### Step 2 — Confirm with the user

Before signing **any** transaction, present:

- Total number of claimable tickets
- Total USDC value (sum of `amount.amount` across all wins, divided by `1_000_000`)
- The wallet address tickets will be claimed to (the user's own wallet)
- Per-ticket breakdown if there are 5 or fewer wins; summarize if more

Example confirmation prompt:

> You have 3 unclaimed Megapot winnings totaling 142.50 USDC:
> - Round 47, ticket 4422...6355: 26.75 USDC
> - Round 48, ticket 1192...0044: 89.50 USDC
> - Round 48, ticket 5566...8821: 26.25 USDC
>
> Claim all three to your wallet `0x...`? (yes / no)

**Do not auto-execute.** Lottery claims feel like real money to users; explicit confirmation is mandatory.

### Step 3 — Execute the on-chain claim

Call `claimWinnings` on the Jackpot contract (`0x3bAe643002069dBCbcd62B1A4eb4C4A397d042a2`):

```
function claimWinnings(uint256[] _userTicketIds)

event TicketWinningsClaimed(
  address indexed userAddress,
  uint256 indexed drawingId,
  uint256 userTicketId,
  uint256 matchedNormals,
  bool bonusballMatch,
  uint256 winningsAmount
)

error NoTicketsToClaim()
error NotTicketOwner()
```

Pass the array of `user_ticket_id` values from the API response, cast to `uint256`. Chunk to **~50 ticket IDs per transaction** for gas safety. Confirm once at step 2 for the whole batch — don't re-prompt before each chunk.

### Step 4 — Report results

Decode `TicketWinningsClaimed` events from the receipt. Each event includes `userTicketId`, `matchedNormals`, `bonusballMatch`, and `winningsAmount` (USDC, 6 decimals). Verify total `winningsAmount` across all events matches the expected sum from step 2.

Present a summary to the user: total USDC claimed, number of tickets claimed, and the transaction hash.

If a chunk transaction fails (revert, etc.), surface the error and ask the user whether to continue with remaining chunks.

## Direct-claim-by-ticket-ID (advanced)

If the user explicitly provides a ticket ID (e.g. "claim ticket #47") without asking us to check first, skip step 1 and go straight to step 3. The Data API call is then unnecessary.

This is the only path that works when the API is rate-limited — power users who know their ticket IDs can still claim.

## Common errors

| Error | Cause |
|---|---|
| Empty `data` array from API | User has no unclaimed wins on record for this wallet — not an error, just zero state |
| `NoTicketsToClaim()` | All supplied ticket IDs have already been claimed or have no payout tier |
| `NotTicketOwner()` | A ticket in the array is not owned by the calling wallet |
| Transaction reverts on claim | Ticket may have been claimed since the API was last indexed; the API has indexing lag (~minutes). Re-query and retry. |
| 429 on the API call | Rate-limited — deflect per `data-api.md` |
