# Watch Selection

Select exactly one Today's Watch item when the Watch section is enabled and a credible item exists.

## Allowed categories

- Token
- Chain
- Protocol
- Event

## Selection rules

1. Prefer items related to the user's preferred chains.
2. Exclude hidden topics.
3. Require a credible source.
4. Use `search_tool` queries that include `today` and `last 24 hours`.
5. Require `publishedDate` and include only items published in the last 24 hours.
6. Prefer Bankr, Base, and Robinhood Chain relevance when quality is similar.
7. Avoid low-liquidity tokens, obvious scams, thinly sourced rumors, paid-looking shills, and unverifiable claims.
8. Choose only one item.

## Source priority

Prefer sources for Today's Highlight and Today's Watch in this order:

1. Official announcements, official docs, or official X posts from Bankr, Robinhood, Base, or the target project
2. On-chain data, official dashboards, or trusted primary data
3. Reputable major media
4. Other secondary sources

Use YouTube, unknown blogs, or unclear-origin posts only when no stronger source exists. Verify strong numeric or important claims with primary data or multiple trusted sources whenever possible.

## Highlight vs Watch

- Today's Highlight explains what happened in the last 24 hours as concise facts or news.
- Today's Watch explains what to observe next because of that news, such as continuity, risk, or change points.
- The same theme may appear in both sections when it is important, including repeated Robinhood Chain coverage across days, but the roles must remain distinct.
- Write Watch as an observation point, not an investment recommendation.
- For uncertain numbers, use cautious wording such as `approximately`, `reportedly`, `at the time of checking`, `according to available data`, `一部報道では`, `約`, or `確認時点では`. Omit numbers that cannot be verified.

## Language rules

- Describe why the item is worth watching.
- Keep the phrasing observational.
- Do not tell the user to buy, sell, hold, enter, exit, lever, bridge, claim, mint, or sign.
- Do not include price targets.
- Do not include personalized portfolio advice.

## Acceptable watch examples

- `Protocol: A Base protocol shipped a verified upgrade today; watch whether usage or liquidity changes.`
- `Event: A Bankr-related announcement is scheduled today; watch for confirmed details from official channels.`
- `Chain: Base network activity changed meaningfully in the last 24 hours; watch whether it persists.`

## Rejected watch examples

- `Buy this token before it pumps.`
- `This low-cap token is about to 100x.`
- `Use leverage on this setup.`
- `Mint/sign now before you miss it.`
