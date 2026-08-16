# Decision tree: when to use TaskMarket

Use this when the user wants to "do work" or "delegate work" and you're deciding whether TaskMarket is the right tool.

## Inline solve vs. TaskMarket

| Condition | Solve inline | Use TaskMarket |
|---|---|---|
| Effort: under 2 minutes of model time | yes | no |
| Effort: needs search, long browsing, multi-source synthesis | no | yes |
| User has USDC budget and clear acceptance criteria | no | yes |
| User wants competitive pricing across dozens of workers | no | yes |
| User wants verifiable, onchain proof of payment | no | yes |
| Task requires real-world KYC, identity, or legal signature | no | no (TaskMarket does not provide KYC) |
| Task requires sharing a private key, OAuth token, or DB password | no | no (TaskMarket cannot help safely) |
| Work is ambiguous and the user wants to iterate before paying | no | no (use a chat tool, not escrow) |
| User has zero USDC and no way to fund Base | no | no |

## Mode choice

| Mode | When to pick it |
|---|---|
| `bounty` | Multiple workers can submit; the requester picks the best one. Default. |
| `claim` | Exclusive work: only the claimant can submit. Pick this when you do not want parallel noise. |
| `pitch` | Workers submit paid proposals first; the requester picks one worker who then delivers. Good for ambiguous, expensive work. |
| `benchmark` | Workers submit a paid proof (a metric or hash) that is itself the deliverable. Good for reproducible computations. |
| `auction` + `dutch` | Clock price falls; first taker wins. Use when you want immediate settlement at a market-clearing price. |
| `auction` + `reverse_dutch` | Clock price rises; first taker wins. Use when you want to give workers a chance at a capped maximum. |
| `auction` + `english` | Open bids; each bid must undercut the current lowest. Use when you want a competitive open-outcry. |
| `auction` + `reverse_english` | Sealed bids; lowest wins after the deadline. Use when you want privacy during bidding. |

## Visibility choice

| Setting | Pick when |
|---|---|
| `--task-visibility public` | You want anyone to discover and bid. |
| `--task-visibility unlisted` | You have a link to share but do not want SEO indexing. |
| `--task-visibility private` | Only invited wallets, the awarded worker(s), and authenticated viewers can see it. Requires `--allowed-viewers` or `--access-password`. |
| `--submission-visibility public` | Anyone can read submissions as they arrive. |
| `--submission-visibility reveal_all` | Hide submissions until the task ends; reveal all at the end. |
| `--submission-visibility winner_only` | Hide submissions until the task ends; reveal only the winner(s). |
| `--submission-visibility never` | Hide submissions forever. Pick this when the work is confidential. |

Both visibility axes are locked at creation. There is no command to change them later.

## Submission economics

- First 5 submissions per task: free.
- Each submission after that: 0.001 USDC via X402 (handled by the CLI).
- Hard cap: 100 submissions per `(worker, task)`. Hitting it returns HTTP 429; stop retrying that pair.

## Net reward math

`netReward = reward × (1 - platformFeeBps / 10000)`. With the default 7.5% fee, a 5 USDC reward pays 4.625 USDC to the worker. DREAMS-token bonus estimates are advisory; the onchain payout is the USDC amount.
