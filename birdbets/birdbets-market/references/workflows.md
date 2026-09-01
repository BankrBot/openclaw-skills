# BirdBets Workflows

These workflows assume a Bankr wallet on Base mainnet.

## Get Context

Fetch:

```text
GET https://birdbets.mykclawd.xyz/api/bankr/context
```

Use this response for chain ID, market contract address, MYKCLAWD token address, token decimals, endpoint URLs, and the current Today/Tomorrow market IDs.

If the context endpoint returns no `contracts.predictionMarket`, stop and explain that BirdBets has not published a prediction market address.

## Read Tomorrow Odds And Payouts

Fetch:

```text
GET https://birdbets.mykclawd.xyz/api/markets/snapshot?market=Tomorrow
```

To preview a bet, include `side` and `stake`:

```text
GET https://birdbets.mykclawd.xyz/api/markets/snapshot?market=Tomorrow&side=YES&stake=10
GET https://birdbets.mykclawd.xyz/api/markets/snapshot?market=Tomorrow&side=NO&stake=10
```

Report:

- `market.threshold`
- `market.isOpen`
- `market.yesPoolFormatted`, `market.noPoolFormatted`, and `market.totalPoolFormatted`
- `odds.yesPercent` and `odds.noPercent`
- `payoutPreview.estimatedPayoutFormatted`, `estimatedProfitFormatted`, and `estimatedProfitPercent` when present
- `market.bettingClosesAtIso`

If `odds.historyUnavailableReason` is present, explain that historical odds are unavailable but current on-chain odds may still be valid.

## Bet YES Or NO On Tomorrow

Inputs required from the user:

- Side: `YES` or `NO`
- Amount: human-readable MYKCLAWD, for example `10`

Workflow:

1. Identify the Bankr wallet address (`from`).
2. Call the bet preparation endpoint:

```text
GET https://birdbets.mykclawd.xyz/api/base-mcp/prepare/bet?from=<wallet>&side=<YES|NO>&stake=<amount>
```

3. If the response has `ok: false`, surface `error` to the user and stop.
4. If `wallet.balance` is below `bet.stake`, acquire MYKCLAWD on Base using Bankr swap tooling first (swap only the requested amount plus a small slippage cushion), then call the prepare endpoint again.
5. Submit each transaction in the `transactions` array **in order**, using the exact `to`, `data`, `value`, and `chainId` from each entry. Do not re-encode or modify the calldata.
6. After the bet transaction confirms, reply to the user with `share.url` from the prepare response so the BirdBets share image renders inline. See "Share The Bet" below.
7. Summarize `bet.side`, `bet.stakeFormatted`, `market.marketDate`, and `market.threshold` from the response alongside the transaction hash.

Do not build or encode contract calldata manually — the prepare endpoint handles `approve` and `betYes`/`betNo` encoding. If the prepare endpoint is unavailable, fall back to manual `approve` + `betYes(marketId, amountWei)` / `betNo(marketId, amountWei)` using `references/contracts.md`.
Do not place a bet if the user has not explicitly chosen side and amount.

## Share The Bet

The bet preparation response includes a `share` object — the same share link the BirdBets web app uses for posting to X/Twitter:

- `share.url` — the BirdBets share page. Posting it unfurls into the bet's share image card (side, amount, market date, threshold). Prefer this so the card renders with title and description.
- `share.image` — the direct share image (`/og/bet.png`) if you need the raw PNG.
- `share.text` — suggested share copy.
- `share.twitterUrl` — a ready-to-use X/Twitter intent link.

After a bet succeeds, reply to the user with `share.url` so they immediately see the share image for the bet they just placed.

## Acquire MYKCLAWD

Use Bankr's swap capability on Base. Prefer swapping from the wallet's most liquid available Base asset into MYKCLAWD.

Before swapping:

- Fetch context for the MYKCLAWD address.
- Check whether the wallet already has enough MYKCLAWD.
- Avoid swapping more than needed for the intended bet plus a small cushion.

After swapping:

- Re-check `balanceOf(wallet)`.
- Continue to approval and betting only if the requested amount is available.

## Get Today's Market Stats

Fetch:

```text
GET https://birdbets.mykclawd.xyz/api/markets/snapshot?market=Today
GET https://birdbets.mykclawd.xyz/api/birdbuddy/visits?days=7
```

Summarize:

- Today's market ID and date
- Threshold and current bird visit count
- Whether YES is currently ahead based on current visits
- Current YES/NO odds and pools
- Recent visit history
- Whether betting is open, closed, or resolved

Remember: the live BirdBuddy count may lag actual feeder activity.

## Fallback If Snapshot Fails

If `/api/markets/snapshot` fails:

1. Fetch `/api/bankr/context`.
2. Compute the market ID from the context response if present, or use `YYYYMMDD` in the BirdBets timezone.
3. Read the prediction market contract directly:
   - `markets(marketId)`
   - `oddsBps(marketId)`
4. For payout preview, use post-bet pools:
   - `sidePoolAfter = sidePoolBefore + stake`
   - `totalPoolAfter = yesPool + noPool + stake`
   - `estimatedPayout = stake * totalPoolAfter / sidePoolAfter`

If direct chain reads fail too, stop and explain that market state is unavailable.
