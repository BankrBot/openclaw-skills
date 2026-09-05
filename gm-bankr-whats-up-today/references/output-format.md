# Output Format

Use short headings and compact bullets. The whole response should be readable in under 30 seconds.

## Section order

1. Greeting
2. BNKR
3. Leaderboard
4. Open Positions
5. Today's Highlight
6. Today's Watch
7. Today's Mission
8. GM Streak
9. Disclaimer

## Length modes

### short

- Use at most one bullet per available section.
- Prefer one-line bullets.
- Include only one highlight and one watch item.
- Include one mission item.

### normal

- Use one to two bullets per available section.
- Include up to two highlights.
- Include one watch item.
- Include up to three mission items.

### detailed

- Use up to three bullets per available section.
- Include up to three highlights.
- Include one watch item with slightly more context.
- Include up to three mission items.

## Required style

- Use Japanese when the user writes Japanese; otherwise match the user's language.
- Keep headings plain and scannable.
- Cite sources inline with short source labels or links.
- Do not show raw tool errors.
- Do not include unavailable sections.
- If one fetch fails, omit only that section and keep successful sections.
- Match the disclaimer language to the user's language.
- Japanese disclaimer: `これは投資助言ではありません。`
- English disclaimer: `This is not investment advice.`

## Today's Mission rules

- Include read-only actions only.
- Do not auto-execute mission items.
- Do not ask the user to buy, sell, claim, mint, bridge, sign, approve, deposit, withdraw, or place an order.
- Do not recommend buying, selling, or using leverage.
- Prefer concrete checks based on shown sections: Bankr Season/update check, open position risk review, source review for Highlight, research for Watch.
- If no verified data is available, use a generic safe mission such as checking official Bankr updates.

## Open Positions rules

- Combine Hyperliquid `positions`, Avantis `positions`, Polymarket `live`, and Polymarket `claimable`.
- Show Polymarket claimable winnings as a read-only status item.
- For regular `GM`, `short`, and `normal` modes, Polymarket must be fetched with `includeLost: false`.
- For `detailed` mode or when the user explicitly asks for lost/resolved-lost Polymarket history, Polymarket may be fetched with `includeLost: true`.
- Show Polymarket `recentlyResolvedLost` only when `includeLost: true` was used and the tool actually returned it.
- Do not infer `recentlyResolvedLost` from memory or previous outputs.

## Example skeleton

```text
GM. 今日のBankrチェックです。

BNKR
- $BNKR: $0.00000000, 24h +0.0%（Source）

Leaderboard
- Rank: #000（前回 #000）

Open Positions
- Hyperliquid: BTC long, size, PnL（Source）
- Avantis: open positionsなし（Source）
- Polymarket: live positions / claimable winnings（Source）

Today's Highlight
- Bankr/Base/Robinhood Chainの24時間以内の重要情報（Source）

Today's Watch
- Protocol: 観察ポイント。売買推奨ではありません。（Source）

Today's Mission
- 最新のBankr Season/updateを確認
- Open Positionsのリスクを確認
- Today's Watchの根拠を読む

GM Streak
- 2日連続GM。

これは投資助言ではありません。
```

Use the skeleton only as a shape. Do not include placeholder values.
