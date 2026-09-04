# DeFi opportunities playbook (flagship workflow)

Use for: "assess this vault/product", "what is the risk and opportunity makeup of X", "compare these for $N", "find me opportunities". Risk and opportunity are one analysis: an opportunity is a mispricing you can explain, and a risk is a mispricing that explains you. The output is an assessment the user could defend to a risk committee. If the user asked for a pick, it ends with the full-view recommendation of Part 3; otherwise it ends with the discriminating questions and observable triggers.

## Part 1: The twelve-step assessment

1. Identify the full stack. Name all five layers: venue protocol(s), vault infrastructure, curator, underlying assets/counterparties, distribution front end. Products routinely span several protocols and chains; a single-venue view misses most of some managers' books. If the user names a brand ("X's vault"), establish immediately whose contract, whose curation, and whose balance sheet it actually is.

2. Pull live state. Current TVL (total value locked), APY (7-day and 30-day, not spot), holder count, chain(s), and cap headroom, each with an as-of date. Sources in `data-sources.md`. Reconcile the onchain trace with the product's own transparency page or API; each surface catches what the other misses. If a layer is still unresolved after both, give the user the specific retrieval ask (which page, which tab, which question to the issuer) instead of only logging it unverified.

3. Decompose the yield (concepts.md section 4, all four axes) and state the spread over the current short Treasury rate. Then run the four realization filters (gross vs net, denomination, window, size) so the quoted number is what the user would keep. Look through nested vaults: decompose the leaves, not the wrapper.

4. Map allocation and concentration, then look through (concepts.md section 14). Which markets/assets at what weights; the full claim stack down to collateral, wrapper issuer, and liquidation venue; the hidden beta (is this "USDC vault" actually a wrapped-BTC or synthetic-dollar loan book); portfolio overlap with the obvious alternatives (two "different" vaults can share ~95% of exposure); and the demand side: who is borrowing or paying this yield, and is their carry subsidized (concepts.md section 4: rented demand is rented yield). For multichain books, add the chain map: which chain each position sits on, canonical or bridged asset version, and the bridges or messaging layer connecting them.

5. Read the parameters and their owners. Caps, LLTVs (liquidation loan-to-value ratios), oracles per market, timelocks, guardian powers, emergency paths. For each: who can change it, how fast? The manager's unchecked powers are the real risk surface.

6. Oracle and NAV (net asset value) layer. Name the oracle CLASS for every market (concepts.md section 13: hardcoded par, redemption-rate, market TWAP, linear-discount) and answer the taxonomy's questions: what the feed reads, what can move it, whether liquidations can fire on the tape humans see, the percentage move that liquidates at max LTV, and who can re-point the feed. For RWA sleeves: cadence, reporter, sanity bounds, and behavior when a legitimate huge move hits the bounds. Cross-chain balance reporters (whoever feeds remote-chain positions into the share price) are oracles too: ask them the same questions.

7. Exit engineering. Instant capacity in dollars today; queue/epoch worst-case timeline; committed backstops and their fixed-dollar limits versus TVL; utilization traps. For any perp exposure or perp margin: the venue's liquidation waterfall in order (margin, insurance fund size in dollars, then ADL (auto-deleveraging)) and its ADL fairness rules. If assets sit on other chains, the worst-case timeline includes the trip home: add bridge latency, capacity, and health. For exits through AMM liquidity, price impact and expected MEV are exit costs: quote large exits through a protected route (concepts section 16). Illiquidity should pay a visible premium; if it does not, ask why.

8. Holder concentration. If a few addresses control most shares, your exit ranks behind their decision; integrator addresses pool users but concentrate the trigger.

9. Incident and contagion look-through. Has any underlying asset, manager, or venue in the stack had incidents? One upstream asset can contaminate dozens of products whose names reveal nothing.

10. Counterparty and legal chain. For each offchain-touching asset: layers to the cash flows, the legal entity you would face, jurisdiction, the full service provider map (issuer, custodian, fund administrator striking NAV, transfer agent, auditor: concepts.md section 14), eligibility gates (US or non-US, accredited or qualified thresholds, KYC whitelists, and what they do to secondary exit), and the conflict map (manager as backstop buyer; platform running the oracle that triggers its own liquidations).

11. The curator as a manager. Track record with dates, AUM trend, evidenced stress behavior (time-to-exit during the last incident), skin in the game, disclosure quality, fee take versus what you keep. Score their process against references/curation-frameworks.md (mandate filter, graded diligence, disqualification gate, tier-linked caps with downgrade clocks, exploit-wired monitoring, execution controls): a curator who can articulate none of it is a finding.

12. Verdict template. What this product actually is (one sentence, balance-sheet terms); where the yield comes from (four axes, numbers, dates); the three biggest risks ranked, each tagged with the failure shape it expresses (concepts.md section 9); the opportunity case if one exists (Part 2 lens: why does the mispricing exist and how does it close); exit triggers (specific, observable); and the direct questions for the manager/issuer. No scores without reasons; no "safe"; confidence earned line by line. Every verdict closes with: this is research, not financial advice; DeFi carries total-loss tails (contracts, oracles, depegs, operators).

## Part 2: The opportunity lens

Opportunity = mispricing + a reason it exists + a way to capture it with enumerated risks. If you cannot explain why the opportunity exists, assume you are the exit liquidity. The recurring hunting grounds:

1. Liquidity premia: multi-step redemption products out-yielding instant ones beyond the structural premium; new products pre-distribution.
2. Reputational contagion: post-incident, whole categories trade wide while specific products with verifiable backing and controls did nothing wrong. Underwriting skill gets paid; the twelve steps above ARE the underwriting.
3. Incentive geometry: subsidized rates that participants historically capture only when the exit is sized before entry: incentives end abruptly and the door is smaller than the room.
4. Rate dislocations: the same asset at different rates across venues/chains; funding vs term-rate gaps; fixed-floating basis in young curves (concepts.md sections 10-11 for the curve and spread tools).
5. Curve and spread signals: steep onchain term premia vs flat offchain curves (or vice versa); credit spreads compressed below what the risk decomposition supports (a crowding signal that has repeatedly preceded losses in credit markets; historical pattern, not a law).
6. Cap and listing events: supply caps at 100% signal excess demand (watch the raise); new collateral listings create first-mover lending markets with wide spreads.
7. Structural launches: new primitives (fixed-rate books, RWA collateral types, new venues) reprice adjacent markets before liquidity normalizes.

Scan output format: the opportunity in one line; the current numbers (dated); WHY it exists (whose constraint or fear creates it); how it closes (what normalization looks like); the risks that could make it a trap (checked against concepts.md section 9); the constraints that would cap size (total-loss tails cap size regardless of conviction; budget exposure per CLUSTER, not per product: one contract stack, one oracle class, one curator, one wrapper counts once across everything held, and anything requiring a mint window, queue, or cap raise to unwind counts as illiquid); and the research-not-advice line from the verdict template.

## Part 3: Making the call (the recommendation protocol)

When the user asks for a recommendation, give one. A hedged non-answer after a full assessment is its own failure. But a call is only honest when every component is on the table:

1. The call, stated conditionally: "for capital with horizon H, liquidity need L, and loss tolerance T, the strongest option in this set is X." Recommendations are conditional on constraints; if the user gave none, state the constraints you assumed and invite corrections.
2. The risk view: the assessment's top risks, each tagged with its failure shape, plus the cluster-exposure warning if the pick overlaps holdings.
3. The opportunity view: why the return exists (which hunting ground), and how it likely closes.
4. Probabilities, with their basis declared. Three admissible bases, always labeled: historical base rates (from named events or datasets: "products with this structure have gated in N of M comparable stress episodes"), structural odds (mechanical facts: an incentive program with an announced end date WILL end), and calibrated judgment (a labeled subjective prior: "my estimate, low confidence"). Use ranges, not false-precision points. An unlabeled probability is a vibe wearing a number.
5. Risk:reward, honestly computed: expected upside over the horizon (after fees, after the incentive decay you projected) against expected downside INCLUDING the total-loss branch (contracts, oracles, operators: small probability, 100% severity: it dominates naive R:R at size). Show the arithmetic; a ratio without the tail branch is marketing.
6. Invalidation triggers: the observable events that would flip the call (oracle repointing, utilization threshold, incentive end, holder-concentration shift, curator change). A recommendation without invalidation criteria is a belief, not a position.
7. The runner-up and why it lost: forces the comparison to be real, and gives the user a fallback if a trigger fires.
8. The ROI mechanics at the user's size: entry and exit costs (gas, spread, exit discount) as a percent of the position; lockup or queue terms against the stated horizon; size against today's instant exit capacity in dollars; and the net expected yield after all of it. A 2% edge that costs 1.5% to enter and exit is a 0.5% edge.
9. The opportunity's expected lifespan: what decays it (incentive end dates, cap raises, crowding, normalization) and a stated estimate of how long the window plausibly lasts, labeled by basis like any probability.
10. The watch plan: what to re-check, how often, and where. Tie each invalidation trigger from step 6 to a concrete check (endpoint, page, or onchain read) and a cadence (daily for oracle gaps and utilization, weekly for incentives and holder concentration, monthly for league tables). Offer to set it up as a scheduled job or recurring agent task when the environment supports one; otherwise give the user the checklist to run by hand.
11. The close, always: research, not financial advice; total-loss tails cap size regardless of conviction.

## Output skeleton (use it: unfilled lines are findings)

Product / class / balance sheet (assets, liabilities, equity, first-loss) / vault layers 1-5 / look-through (what the share is actually exposed to) / oracle class per market (reads what, moved by what, liquidations fire on visible tape?) / yield split (source, organic vs incentives, endo vs exo, cash vs accrual, spread vs T-bill and the risks it pays for) / redemption (instant sleeve $, queue, gate) / failure shapes this product can express / what could not be verified / sources, primary first. If balance sheet, oracle class, first-loss, or look-through is missing, the verdict is "unanalyzed," not "looks fine."

## Composed positions (vault-in-vault, collateral chains, loops)

Some opportunities are not one vault but a construction: deposit into vault A, use A's share token as collateral or deposit in vault B, optionally borrow and repeat. Evaluate the construction as ONE position, never as separate legs:

1. Net carry, shown as arithmetic: the sum of every leg's yield, minus every borrow leg's cost, times effective leverage, minus entry/exit/gas for ALL legs. Run the realization filters on the net number, not per leg.
2. Yields add; risks compound. Every leg's failure shapes apply simultaneously, and the position fails when ANY leg fails: the composed position is only as strong as its weakest oracle, thinnest exit, and lowest-quality collateral.
3. Oracle class per leg (concepts 13). A loop's liquidation fires on the mark of the collateral leg; a levered position on a TWAP or redemption-rate feed inherits that feed's whole attack surface at leverage.
4. Liquidation distance, stated: at the position's LTV, what percent move in the collateral leg liquidates it? Quote it against realistic moves (and weekend gaps where markets close).
5. The unwind path, in reverse order: exiting requires unwinding B before A, so the worst-case exit time is the SUM of the legs' queues, and a gate on any leg traps the whole construction.
6. Double-count check: composed TVL is counted at every layer; your own position is too. Cluster exposure budgets count the underlying once.

A composed position with positive net carry after all six lines is a real opportunity (often the structural-launch or rate-dislocation hunting grounds in layered form). One that only works at maximum LTV on a shovable oracle is the PT-loop failure shape volunteering.

## The depth floor: no seat named without its numbers

The recommendation protocol above governs the call. This floor governs EVERY alternative, runner-up, and row in an opportunity table, because a shallow row is a recommendation wearing a disclaimer:

1. Every named seat carries, minimum: what the instrument actually IS (one line), live size and liquidity with a date, the return split (or the word "unanalyzed" plus the specific retrieval ask), and one trigger that would flip the read.
2. Adjectives are not verdicts. "Weak", "strong", or "fine parking" must cite the microstructure fact it rests on: for tokens, market cap, float vs FDV, holder concentration, who controls supply, and whether any cash flow claim exists; for venues, depth, open interest, spreads, or utilization. No number available = say so and ask the user for it, never grade on vibes.
3. When the user asks WHICH pools, vaults, or markets: pull candidates live (GeckoTerminal by network, the DEX's own pages, Merkl for boosts, Morpho GraphQL for vaults) and name the top 2 or 3 with TVL, 7-day volume and turnover, fee tier, and the volatility or IL context at the user's size. A class recommendation ("LP blue-chip pairs") without named candidates is homework left undone.
4. Endorsing a venue requires that venue's own numbers first: an options venue's depth and open interest before calling it the safer seat; a lending product's actual vault, curator, and composition before quoting its rate. A rate with no look-through is a rumor with a percent sign.
5. Every recommended seat gets its watch plan line (what to check, where, how often), and offer automation where the user's environment supports scheduled tasks. This skill stays read-only: design the alert conditions and hand them off; never wire automations that execute.

## Red flags bank

Immediate deeper-scrutiny triggers: APY far above its decomposable sources; yield paid in the product's own token; 100% utilization on an exit-relevant market; NAV oracle controlled by the party being priced, unbounded; backstop provided by an affiliate of the manager; "diversified" naming over concentrated composition; loss recognition that requires a manual action never yet taken; recently changed redemption terms; anonymous manager with no inspectable incident history; incentives masking the organic rate; resistance to reproducing numbers from public data.

## Worked example shape (structure to imitate)

"Assess Platform X's RWA vault and USD vault, curated by Manager Y, holding assets from Counterparties Z1/Z2: what is the risk and opportunity makeup?"

Stack (five layers, with Manager Y classified risk-parameter vs discretionary and their other mandates); live pull (both vaults, dated); yield decomposition per vault with T-bill spread; then the steps with emphasis on Z1/Z2 concentration and what those exposures actually are (senior tranches? basis books? credit lines? layers to cash flows), exit waterfall capacity in dollars, NAV cadence on the RWA sleeve, holder concentration, manager incident history. Close with ranked risks, the opportunity case (which hunting ground, why it exists, how it closes), exit triggers, and direct questions for Manager Y (largest single-name exposure and its cushion; evidenced time-to-exit; what changes without a timelock; who buys in stress and at what haircut).
