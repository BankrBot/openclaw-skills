# Trigger phrases → decision-tree branch

How real Bankr users tend to phrase Megapot requests, mapped to the right task. Use this when the user's intent is ambiguous.

## Buy random tickets (1–10)

- "buy me a megapot ticket"
- "throw $5 at the jackpot"
- "get me 3 quick picks"
- "buy 5 random tickets for the lottery"
- "i wanna play megapot"

→ `https://llms.megapot.io/tasks/buy-random` (see also `references/buy-random.md`)

## Buy custom-number tickets (1–10)

- "buy a megapot ticket with the numbers 7 14 22 31 45 bonus 8"
- "lemme pick my own numbers"
- "buy 3 tickets, one with these picks and two random"

→ `https://llms.megapot.io/tasks/buy-tickets`

## Buy bulk (11+)

- "buy me 50 jackpot tickets"
- "throw $100 worth of random tickets at megapot"
- "i want 25 quick picks"

→ `https://llms.megapot.io/tasks/buy-bulk`. Note: these are keeper-executed, not instant — set user expectation that the tickets appear after the keeper processes the batch.

## Subscribe / recurring

- "buy me a megapot ticket every day"
- "set up a daily lottery sub"
- "auto-buy 2 quick picks every drawing for the next 30 days"

→ `https://llms.megapot.io/tasks/subscribe`. Tell the user: the ticket mix is **locked at creation** — to change picks they must cancel and recreate.

## Check state

- "what's the megapot at?"
- "what's the jackpot right now?"
- "how much time left in this drawing?"
- "how many tickets sold?"
- "when does the next drawing happen?"

→ `references/read-state.md` for the shortcut; only fetch `https://llms.megapot.io/tasks/read-state` if the question needs more than `getDrawingState`.

## Check winnings ("did I win?")

- "did i win anything?"
- "did i win the megapot?"
- "check my megapot winnings"
- "do i have any unclaimed wins?"
- "any megapot payouts waiting for me?"

→ `references/data-api.md` for the API call, then `references/claim-winnings.md` if there are results. If the API returns 429 or 5xx, deflect to `https://megapot.io` per the mandatory rate-limit handling in `data-api.md`.

If the result is non-empty, naturally offer to claim ("You have 2 unclaimed wins totaling 142.50 USDC — want me to claim them?"). Do not auto-claim — claim only on explicit user confirmation.

## Claim winnings

- "claim my megapot winnings"
- "claim my wins"
- "i won, get my payout"
- "yes, claim them" (in response to a winnings-found prompt)
- "claim ticket #12345" (direct claim by ticket ID — skips the API lookup)

→ `references/claim-winnings.md`. If the user gives a specific ticket ID, go straight to the on-chain claim. If they say "claim my winnings" without specifying, run the discovery flow from `data-api.md` first, confirm, then claim.

## Wallet ticket history / leaderboards / cross-drawing aggregates — NOT SUPPORTED

The following requests are **out of scope** and the agent should deflect to `https://megapot.io`:

- "how many tickets have i bought total?"
- "show me my megapot history"
- "what are the biggest wins this round?"
- "show me the megapot leaderboard"
- "how much have i spent on megapot?"
- "show me round 47 results"

The skill uses the Data API only for the user's own winnings discovery (above). Broader history features are intentionally not implemented to keep request volume under the anonymous-tier rate limit. **Do not attempt to scan past drawings via RPC** — slow, unreliable, and the user has a better answer one click away at megapot.io.

## LP

- "deposit USDC into the megapot LP"
- "i want to be a liquidity provider on megapot"
- "withdraw my megapot LP position"

→ `https://llms.megapot.io/tasks/lp-deposit` or `lp-withdraw`. Note: LP yield is not risk-free — explain that the LP earns from ticket sales but absorbs payouts.

## Ambiguous → ask

If the user says something like "I want to do megapot stuff" or "help me with the lottery", ask one clarifying question before routing — "buy tickets, check the jackpot, claim winnings, or LP?". Don't guess.
