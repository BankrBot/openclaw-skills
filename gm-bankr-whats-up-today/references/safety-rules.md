# Safety Rules

## Data integrity

- Do not guess values.
- Do not backfill missing data from memory as if it is current.
- Do not show stale prices, positions, ranks, or news as current.
- Confirm news and highlight items are from the last 24 hours.
- For `search_tool`, include `today` and `last 24 hours` in queries and check `publishedDate`.
- Exclude Highlight and Watch items when `publishedDate` is missing or older than 24 hours, unless the item is an official future event announcement that was published in the last 24 hours.
- Cite a source for every included market, rank, position, highlight, or watch item.
- Prefer sources for Today's Highlight and Today's Watch in this order: official announcements/docs/X from Bankr, Robinhood, Base, or the target project; on-chain data, official dashboards, or trusted primary data; reputable major media; then other secondary sources.
- Use YouTube, unknown blogs, or unclear-origin posts only when no stronger source exists.
- Verify strong numeric or important claims with primary data or multiple trusted sources whenever possible.
- Do not state uncertain numbers, ranks, TVL, volume, or transaction counts as definitive. Use cautious wording such as `approximately`, `reportedly`, `at the time of checking`, `according to available data`, `一部報道では`, `約`, or `確認時点では` when verification is incomplete.
- If a number cannot be verified, omit it instead of filling the gap.
- Update `previousLeaderboardRank` only when a current rank was verified through `search_tool`.

## Financial safety

- Always include an investment-advice disclaimer in the user's language.
- Japanese: `これは投資助言ではありません。`
- English: `This is not investment advice.`
- Do not provide investment advice.
- Do not recommend buying, selling, holding, leverage, specific position sizing, or portfolio allocation.
- Do not auto-execute trades.
- Do not auto-sign transactions.
- Do not request approvals, deposits, withdrawals, mints, claims, or bridging actions.
- Do not present Watch as a trade signal.
- Do not present Today's Mission as a trading instruction.
- Today's Mission must contain only read-only checks or research tasks.
- Polymarket claimable winnings may be displayed as status, but do not instruct the user to claim unless they explicitly ask about claiming.
- Fetch Polymarket with `includeLost: false` for regular `GM`, `short`, and `normal` modes.
- Fetch Polymarket with `includeLost: true` only in `detailed` mode or when the user explicitly asks for lost/resolved-lost Polymarket history.
- Show Polymarket `recentlyResolvedLost` only when `includeLost: true` was used and the tool actually returned it. Do not infer or backfill it from memory.

## Scam and low-quality filtering

Exclude Watch candidates that are:

- Low-liquidity or newly created tokens without credible context
- Obvious scams, impersonations, or phishing-adjacent links
- Based only on unverified rumors
- Driven mainly by promotional language
- Unsupported by reputable or official sources

## Error handling

- Omit unavailable sections naturally.
- Do not show stack traces, raw API errors, or internal tool failures.
- If the user asks why a section is missing, explain that no official verified source/tool was available for that item.
- If one formal tool fails, omit only that section and still display data from successful tools.
