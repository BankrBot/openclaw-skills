# Market pulse: keeping a nose on where it is going

DeFi's league tables rotate in months, incentives end without notice, and structural shifts announce themselves in filings before they show in prices. This reference is the monitoring discipline: what to check on a cadence, which indicators lead, and which structural signals mean the map itself is changing. Use it when the user asks "what's happening", "what changed", "where is this going", or on any recurring briefing task.

## The weekly pulse (30 minutes of pulls)

1. The rate anchor: current 3-month T-bill and the large tokenized T-bill fund yields. Every onchain spread re-prices off this; a moving anchor changes every judgment downstream.
2. Stablecoin float: total supply and week-over-week change, split by top issuers, plus any yield-bearing dollar growth. Float is the system's money supply; expansion funds risk-taking, contraction precedes stress.
3. Curated vault state: total curated TVL, top-curator shares, new vault launches this week, and any vault with warnings. Launch pace and concentration shifts are the industry's hiring-and-firing tape.
4. Rates and utilization hotspots: major money-market borrow rates, markets above ~90% utilization (exit traps forming), caps at 100% (demand exceeding risk limits: raise coming or spread available).
5. Funding regime: perp funding levels on majors (positive/negative, trend). Funding is the risk-appetite thermometer and the revenue driver for every basis strategy and synthetic dollar.
6. Fixed-rate curve points: where term rates sit vs floating on the main fixed-rate venues; curve steepness change week over week.
7. Incident feed: exploits, depegs, oracle events, curator disputes: and trace each into your holdings map via the contagion look-through (one upstream asset can touch dozens of products).
8. Unlock and emissions calendar: token unlocks and incentive program end-dates for anything the user holds or watches.

## Leading indicators (what moves before the headline)

- Spread compression + leverage growth in the same product = crowding; the exit door shrinks while the room fills. A recurring pre-loss pattern across credit markets (historical pattern, not a law).
- Incentive share of APY rising while organic share falls = the product is buying TVL; expect an air pocket at program end.
- Discretionary-management share rising vs risk-parameter curation = the industry taking more mandate risk (more RWA, more judgment, more opsec surface).
- Multi-step redemption premium narrowing toward zero = illiquidity is being underpriced; late-cycle tell.
- Holder concentration rising in a growing vault = growth from a few integrators, not adoption; exit risk masquerading as traction.
- Same-asset rate gaps widening across venues = fragmentation returning or a venue-specific fear; both are information.
- Stablecoin float flat while "RWA TVL" grows = usually rotation, not new money; check whether the product accepts direct fiat subscriptions before concluding, since institutional inflows can arrive by wire and never touch float. Onchain growth claims should reconcile to one of the two.

## Structural signals (the map is changing)

Track these in primary sources (filings, official announcements, governance forums), because they re-price categories, not products:

- Regulatory clocks: rule proposals and their comment/effective dates in the user's jurisdictions (market-structure bills, stablecoin regimes, tokenized-securities rules, perps frameworks). A comment deadline is an action item; an effective date is a repricing event.
- Incumbent rails milestones: exchange tokenization launches, settlement-utility pilots (tokenized entitlements, collateral rails), 24/7 cash legs (tokenized deposits, always-on clearing). Each one moves the boundary between walled-garden and open rails.
- Fee-switch and buyback activations: a governance vote flipping revenue to a token converts narrative into cash flow and re-prices the whole category's tokens.
- Collateral acceptance events: a new asset class accepted as margin at a major venue or clearinghouse (the collateral-mobility story) is the strongest institutional adoption signal there is.
- New primitive launches: fixed-rate books, portfolio-collateral markets, RWA perps, compliance-as-parameter designs: adjacent markets reprice before liquidity normalizes.
- The two demand engines check: for any "adoption" claim, ask which durable engine it reduces to: dollars-as-utility (savings/payments demand) or speculation (leverage/launch demand). Claims that reduce to neither usually deflate.

## The X feed (where it surfaces first)

Incidents, curator disputes, census threads, and admissions against interest surface on X hours to days before they reach dashboards or press. Watch by category, not by name (accounts rotate): the vault registries and their researchers, the curators themselves (their threads are a book being talked), independent oracle and lending-risk analysts, and the postmortem writers. Discipline: X is a leading indicator and a bias minefield at once; verify every claim onchain or against an API before citing it, and weight admissions of loss over launch threads. Agents with a live X data tier (Kaito or xAI keys, see data-sources.md) can quantify narrative rotation directly; agents without one should ask the user to paste the thread rather than trusting memory of it.

## Cadence and outputs

Weekly: the pulse (1-8) as a dated brief with deltas, not levels ("what changed" beats "what is"). Monthly: re-run the league tables (curators, venues, issuers) and update any registry/watchlist the user keeps; check which watched structural signals fired. Quarterly: re-verify every evergreen "fact" the user's materials rely on (fees, mechanics, leadership, parameters), because docs change silently. Always: when a pulse item fires against a user holding, escalate it into the full opportunities-playbook assessment rather than a headline.

## Setting up a nose (if the user wants automation)

Offer: a recurring scheduled brief that runs the weekly pulse; a watchlist file (assets, vaults, curators, signals with trigger thresholds) kept in the user's workspace with a dated changelog; and calendar entries for known dates (unlocks, program ends, comment deadlines, effective dates). The nose is a system, not a memory.
