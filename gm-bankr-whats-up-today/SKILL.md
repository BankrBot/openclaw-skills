---
name: gm-bankr-whats-up-today
description: Produce a sub-30-second Bankr morning briefing when the user sends "GM" or asks "GM Bankr, what's up today?", using formal Bankr Runtime tools, saved preferences, citations, and non-advisory safety rules.
---

# GM Bankr, what's up today?

## Overview

Create a concise daily Bankr briefing when the user sends `GM`. Use only verified data from the formal Bankr Runtime tools listed below. Do not invent tool names, values, positions, leaderboard ranks, market data, or news.

This skill is designed to become the user's daily GM habit and reduce repetitive morning checks.

This MVP is text-only. Do not build a web app, iframe app, trading flow, signing flow, x402 flow, weekly report, monthly report, or Builder Score analysis.

## Runtime Rules

- Trigger on an exact or conversational `GM`.
- Example conversational trigger on X: `GM @bankrbot` followed by `What's up today?`.
- Read user memory before fetching data. See `references/memory-schema.md`.
- Respect section toggles and hidden topics.
- Use only formally available runtime tools. If no official tool is available for an item, omit that item naturally.
- Never display guessed values or stale news as current.
- Confirm each news or highlight item is from the last 24 hours before including it.
- Include source links or source names for price, leaderboard, positions, highlight, and watch items when shown.
- Match the disclaimer language to the user's language. Use `これは投資助言ではありません。` in Japanese and `This is not investment advice.` in English.
- Do not execute trades, approvals, signatures, deposits, withdrawals, or orders.

## Official Tool Policy

Use these formal Bankr Runtime tool identifiers exactly:

- BNKR price: `gettokenpriceinusd`
  - Inputs: `chain: base`, `tokenAddress: 0x22af33fe49fd1fa80c7149773dde5890d3c76f3b`
  - Outputs: `price`, `confidence`
- Hyperliquid positions: `gethyperliquidpositions`
  - Inputs: none
  - Outputs: `positions`, `orders`
- Avantis positions: `getavantisopen_positions`
  - Inputs: none
  - Outputs: `positions`
- Polymarket positions: `viewpolymarketpositions`
  - Inputs: `userAddress` optional, `includeLost`
  - Outputs: `live`, `claimable`, `recentlyResolvedLost`
- News/search: `search_tool`
  - Inputs: `queries`, `searchType`
  - Outputs: `results`

There is no formal Bankr Runtime tool for Bankr Leaderboard. Use `search_tool` only when it can retrieve the current rank from a public page. If the current rank cannot be verified, omit Leaderboard naturally. Do not infer the current rank from memory and do not ask the user to enter their rank every morning.

## Workflow

1. Load memory from `/.memory/gm-bankr-settings.json` and `/.memory/gm-bankr-history.json`.
2. Initialize missing memory with defaults from `references/memory-schema.md`.
3. Fetch BNKR, Hyperliquid, Avantis, Polymarket, and `search_tool` data in parallel whenever the runtime allows it.
4. Fetch BNKR with `gettokenpriceinusd` using `chain: base` and `tokenAddress: 0x22af33fe49fd1fa80c7149773dde5890d3c76f3b`.
5. Fetch Hyperliquid with `gethyperliquidpositions`.
6. Fetch Avantis with `getavantisopen_positions`.
7. Fetch Polymarket with `viewpolymarketpositions`. Pass `includeLost: false` for normal `GM`, `short`, and `normal` modes. Pass `includeLost: true` only in `detailed` mode or when the user explicitly asks for lost/resolved-lost Polymarket history.
8. Use `search_tool` for Highlight, Watch, and Leaderboard lookup. Include `today` and `last 24 hours` in the queries. Check `publishedDate` and exclude items older than 24 hours from Highlight and Watch.
9. Apply safety and freshness rules from `references/safety-rules.md`.
10. Choose one watch item using `references/watch-selection.md`.
11. Create Today's Mission from safe read-only actions only.
12. Update streak, last check date, previous leaderboard rank, and previous BNKR price after generating the briefing.
13. Save memory back to the same user-specific files.
14. Return a concise briefing using `references/output-format.md`.

## Default Sections

- Greeting: short morning greeting with the current date.
- BNKR: current BNKR price from `gettokenpriceinusd` and confidence when available. Show 24-hour change only when the runtime data or verified source provides it.
- Leaderboard: current Bankr leaderboard rank from public-page search via `search_tool` when verified. Omit when not verified.
- Open Positions: combine Hyperliquid positions, Avantis positions, Polymarket live positions, and Polymarket claimable winnings when available.
- Polymarket lost history: show `recentlyResolvedLost` only when `includeLost: true` was used and the tool actually returned it. Do not infer it from memory or prior outputs.
- Today's Highlight: one to three important items from the last 24 hours about Bankr, Base, or Robinhood Chain.
- Today's Watch: exactly one item from Token, Chain, Protocol, or Event. Keep it observational and non-advisory.
- Today's Mission: one to three safe read-only actions, such as checking the latest Bankr Season update, reviewing open position risk, or researching today's Watch item.
- GM Streak: current consecutive-day count and whether it changed today. GM Streak uses UTC day boundaries. JST users: the day changes at 9:00 AM.

## Customization

Support these user settings:

- Leaderboard ON/OFF
- BNKR ON/OFF
- Open Positions ON/OFF
- Highlight ON/OFF
- Watch ON/OFF
- Today's Mission ON/OFF
- Streak ON/OFF
- Preferred Chains
- Hidden Topics
- Report Length: `short`, `normal`, or `detailed`

If the user changes a setting in natural language, update memory and confirm briefly. If the user only says `GM`, do not ask setup questions.

## Omission Behavior

If a section cannot be fetched, is disabled, is hidden by preference, or lacks credible sources, omit only that section without an error block. Keep the response natural and short. Continue showing other sections that fetched successfully. Do not show raw errors. Do not say a value is unavailable unless the user specifically asks why a section is missing.

## References

- Read `references/output-format.md` before composing the response.
- Read `references/memory-schema.md` before reading or writing memory.
- Read `references/watch-selection.md` before selecting Today's Watch.
- Read `references/safety-rules.md` before including financial, position, news, or watch content.
