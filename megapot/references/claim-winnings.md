# Claim winnings

The user has won lottery tickets and wants to claim them. This is a **two-step flow**: discover unclaimed wins via the Data API, confirm with the user, then execute the on-chain claim transaction(s).

## Flow

### Step 1 — Discover claimable wins

Call the Data API (see `data-api.md` for full details):

```
GET https://api.megapot.io/v1/wallets/{userWallet}/wins?limit=50
```

Filter the response to entries where `claimed === false`.

**Handle empty result:** if the filtered list is empty, tell the user "You have no unclaimed winnings on this wallet." Stop.

**Handle 429 / 5xx:** see `data-api.md` for the mandatory deflection-to-megapot.io behavior. Do not proceed to step 2 with stale or partial data.

### Step 2 — Confirm with the user

Before signing **any** transaction, present:

- Total number of claimable tickets
- Total USDC value (sum of `amount.amount` across all unclaimed wins, divided by `1_000_000`)
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

The on-chain claim function lives on the Jackpot contract (`0x3bAe643002069dBCbcd62B1A4eb4C4A397d042a2`). The exact ABI fragment and parameter shape is on the canonical task page:

```
https://llms.megapot.io/tasks/claim-winnings
```

**Fetch that page at task time** for the current ABI — do not rely on memorized signatures. Contract surface evolves.

For each unclaimed win the agent will need:
- `user_ticket_id` (from the API response — pass as `uint256`)
- `round_id` (from the API response — pass as `uint256` if the claim function requires it; check the task page)

### Step 4 — Report results

After each successful claim transaction:
- Confirm to the user which ticket was claimed and the amount received
- Decode the relevant event from the receipt to verify the actual claimed amount matches the expected amount

If a transaction fails (revert, etc.), surface the error and ask the user whether to continue with remaining claims.

## Multi-claim batching

If the Jackpot contract supports a batched claim function (check `https://llms.megapot.io/tasks/claim-winnings`), use it for multi-ticket claims to save gas. Otherwise, claim sequentially.

When claiming sequentially, **confirm once** at step 2 for the whole batch — don't re-prompt before each individual claim. The user already approved the full list.

## Direct-claim-by-ticket-ID (advanced)

If the user explicitly provides a ticket ID (e.g. "claim ticket #44227164...") without asking us to check first, skip step 1 and go straight to step 3. The Data API call is then unnecessary.

This is the only path that works when the API is rate-limited — power users who know their ticket IDs can still claim.

## Common errors

| Error | Cause |
|---|---|
| Empty `data` array from API | User has no wins on record for this wallet — not an error, just zero state |
| All wins have `claimed: true` | User has already claimed everything — tell them so |
| Transaction reverts on claim | Ticket may have been claimed since the API was last indexed; the API has indexing lag (~minutes). Re-query and retry. |
| 429 on the API call | Rate-limited — deflect per `data-api.md` |