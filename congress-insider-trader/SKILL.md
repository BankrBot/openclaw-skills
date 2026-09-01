---
name: congress-insider-trader
description: copy-trade public politician STOCK Act disclosures across Robinhood Chain tokenized stocks, Robinhood brokerage equities, and options, with research, earnings/catalysts, politician clusters, ranked historical performers, and automated buy/sell rules.
---

# congress insider trader

## scope and compliance
- use only public House/Senate STOCK Act disclosures and public market data.
- this is public-disclosure copy trading, not MNPI or actual insider trading.
- disclosures can lag execution by up to 45 days; label every signal with transaction and disclosure dates.
- never trade solely from a stale filing: check current quote, price move since transaction, liquidity, earnings, catalysts, and venue availability.

## research priority
Focus the scan in this order:
1. current or former president-related public disclosures and presidential trading activity, when verifiable from primary public records.
2. top historical earners, ranked by independently sourced year-over-year returns and sample size.
3. current high-conviction congressional buyers and sellers.
4. clusters: multiple politicians buying or selling the same ticker within 14 days.

Do not treat a president's public statements, office, or political influence as proof of superior returns. If no audited return series exists, state that clearly and rank the signal by verified disclosure activity rather than inventing a return.

## mandatory per-ticker research
For every candidate ticker, before any buy or sell decision:
- resolve the underlying equity and, when available, Robinhood Chain RWA token.
- fetch current real-equity quote and tokenized-stock implied quote.
- calculate move since politician transaction date and flag >15% move as likely stale/decayed.
- search current news and primary company investor-relations sources.
- call out next earnings date, previous earnings date, reporting period, and whether earnings are before the proposed entry or during the holding window. If no confirmed date is found, say earnings date unconfirmed.
- call out dividends, splits, guidance, FDA/regulatory events, major contracts, lockups, or other material catalysts when sourced.
- list every other politician buying the same ticker in the last 14 days, with transaction/disclosure dates and amount ranges.
- distinguish purchases, sales, options, and transactions that may be spouse/managed-account disclosures.
- do not infer a politician's exact fill price from an amount range.

## historical return research
- maintain a yearly leaderboard only from fetched, attributable sources; include benchmark, period, methodology, portfolio size/sample size, and whether returns are audited or modeled.
- prioritize presidents and top earners, but separate verified returns from media estimates and do not blend them.
- reweight yearly after fresh research; never carry old returns forward as current facts.
- downweight tiny portfolios, options notional confusion, and disclosures with incomplete marks.

## disclosure ingestion
Fetch public House and Senate feeds, retaining representative/senator, ticker, transaction type, amount range, transaction date, disclosure date, and source URL. Filter transaction date within 45 days and disclosure date within 14 days. If a feed is unavailable, use a reputable fallback and mark the source degraded.

## scoring
score = politician_weight × recency × size × cluster × research_quality
- recency: 1.0 if disclosed <3 days, 0.7 <7 days, 0.4 <14 days.
- size: 1.0 if amount range >= $100k, 0.7 >= $50k, 0.5 >= $15k, 0.3 below.
- cluster: 1.0 baseline, 1.5 for 2+ tracked buyers, 2.0 for 3+.
- research_quality: 1.0 confirmed primary sources, 0.7 secondary-only, 0.4 uncertain attribution.
- use verified historical performer weights, but cap tiny-sample outliers.
- actionable buy threshold: score >= 0.6; rank top 3 per scan.
- a high-weight politician sale is an exit review for held positions, not an automatic short.

## buy rules
- no automatic buy when the filing is stale, current price has already moved >15% since transaction, earnings risk is unresolved, or price sanity diverges materially.
- default allocation max 10% of deployable capital per signal and max 25% per ticker across venues.
- brokerage equity: review then place order through rhagent-trader; fractional orders use amount when appropriate.
- Robinhood Chain RWA: one router swap, with USDG/ETH funding and implied-price sanity check; stop on >2-3% divergence or geo verification failure.
- options: only when explicitly enabled by the automation policy and score >=1.0; use public-chain workflow to select 30-60 DTE slightly OTM calls, or longer-dated contracts when the filing itself identifies LEAPS. Review before placement.

## sell and exit rules
Yes, the skill includes sell timing:
- brokerage equity entries receive a default exit policy of +30% profit target and -15% stop-loss through the OCO workflow when that workflow is available.
- tokenized-stock positions are checked each run and sold when they reach -15% from recorded entry, when the source politician discloses a sale, when a thesis-invalidating catalyst occurs, or when the position exceeds the allocation cap.
- take profit when +30% is reached unless the current research explicitly upgrades the thesis; never widen a stop silently.
- review/close options on the same thesis-invalidating conditions, before expiration, after earnings risk changes, or when liquidity/mark quality breaks down.
- a politician sale is a review/exit signal; do not blindly sell if the disclosure is a partial sale, stale, or clearly unrelated to the tracked position.
- record entry, venue, quantity, source politician, score, thesis, stop, target, earnings date, and last review in state.

## scan output
Each scan must include:
- date/time and sources
- politician leaderboard focus: president-related signals where verifiable plus top verified earners
- top 3 ranked tickers and score
- per-ticker quote, move since transaction, earnings date/status, catalysts, and politician cluster
- buy/sell/hold decision and exact reason
- venue eligibility and skipped legs
- open-position exit reviews
- no-trade reasons

## automation
- scheduled command: run the full scan, research every candidate, dedupe disclosures, evaluate open positions, and execute only signals that pass all rules and configured allocation caps.
- default schedule requested by user: weekdays at 10:00 America/New_York; use the correct UTC equivalent for the current DST period and revisit the schedule at DST changes.
- state path: /congress-insider/state.json with lastRun, processedDisclosures, openPositions, entries, stops, targets, earnings dates, and thesis reviews.
- every scan posts a general scan summary to rhagents; every fill posts a trade card. Never include order IDs, tx hashes, or account numbers.

## implementation dependencies
- rhagent-trader for brokerage equities/options.
- robinhood-stocks-autopilot for tokenized stocks.
- rhagent-oco for brokerage exits.
- execute_cli with python3 and stored env vars for disclosure ingestion and brokerage MCP calls.
- public search and company investor-relations pages for earnings/catalysts.

## failure handling
- no credential: skip that venue and report it; never claim a fill.
- no RWA ticker: brokerage-only if eligible.
- geo gate: relay exact message and skip chain leg.
- market closed: use an approved limit workflow or defer; never invent fills.
- feed failure: mark degraded source and continue only with sufficiently reliable data.
