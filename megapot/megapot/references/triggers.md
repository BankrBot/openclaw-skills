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

## Wallet history / past wins / leaderboards — NOT SUPPORTED

The following requests are **out of scope** for this skill:

- "did i win anything?"
- "how many tickets have i bought total?"
- "show me my megapot history"
- "what are the biggest wins this round?"
- "show me the megapot leaderboard"

For these, tell the user to check `https://megapot.io` directly — their account page has the full history. **Do not attempt to scan past drawings via RPC** — it's slow, unreliable, and the user has a better answer one click away.

If the user knows a specific ticket ID and wants to know whether it won, that's answerable on-chain via the settled drawing's `winningTicket` field — but route them through `claim-winnings` (below) since the natural follow-on is to claim, not just to check.

## Claim winnings

- "claim my megapot winnings"
- "i won, get my payout"
- "claim ticket #12345"

→ `https://llms.megapot.io/tasks/claim-winnings`. The user needs to know the specific ticket ID(s) they're claiming for — this skill does not look up winning tickets for them; that's a megapot.io feature. Confirm the tickets and amount before signing.

## LP

- "deposit USDC into the megapot LP"
- "i want to be a liquidity provider on megapot"
- "withdraw my megapot LP position"

→ `https://llms.megapot.io/tasks/lp-deposit` or `lp-withdraw`. Note: LP yield is not risk-free — explain that the LP earns from ticket sales but absorbs payouts.

## Ambiguous → ask

If the user says something like "I want to do megapot stuff" or "help me with the lottery", ask one clarifying question before routing — "buy tickets, check the jackpot, claim winnings, or LP?". Don't guess.
