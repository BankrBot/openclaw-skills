# Assessment checklist

Run every product through this. Unanswered items are findings.

## Balance sheet
- [ ] Assets: what does it hold, in what form, at which venue
- [ ] Liabilities: what it owes, to whom, redeemable how
- [ ] Equity: who profits
- [ ] First-loss: who absorbs damage before the depositor
- [ ] Seniority / attachment points if tranched

## Vault stack (if a vault)
- [ ] Layer 1 venue (Morpho, Euler, Aave, Kamino, Fluid, Hyperliquid, …)
- [ ] Layer 2 vault infra (ERC-4626, BoringVault, custom)
- [ ] Layer 3 curator (named entity, not a logo)
- [ ] Layer 4 underlying assets and counterparties
- [ ] Layer 5 distributor brand the user sees
- [ ] Instant vs queued redemption; sleeve capacity in dollars
- [ ] Vault age and TVL at creation (empty 4626 inflation surface)

## Look-through
- [ ] Collateral token behind the share
- [ ] Wrapper issuer (cbBTC, WBTC, LBTC, wstETH, sUSDe, PT-*)
- [ ] Underlying book (BTC, staked ETH, perp hedge, T-bills, private credit)
- [ ] Hidden beta: is this "USDC vault" actually a BTC loan book
- [ ] Share concentration (top address / top 10)
- [ ] Restaking / slashing sitting under a receipt token

## Chain and cross-chain (layer 0)
- [ ] Chain(s) each position actually sits on; sequencer or validator concentration; finality
- [ ] Bridges and messaging layers in the path (deposits in AND exits home)
- [ ] Canonical vs bridged version of each asset (same ticker on two chains = two claims)
- [ ] Who reports cross-chain balances into the share price (treat as an oracle)
- [ ] Exit worst-case includes bridge latency, capacity, and health

## Underlying type and demand side
- [ ] Each underlying classified: crypto-native / receipt (slashing) / wrapper / strategy token / offchain-yield token
- [ ] Offchain-yield tokens walked inside: tranche, attachment point, what is in the pool, servicer
- [ ] Service provider map for RWA sleeves: issuer entity, custodian, fund administrator (NAV striker), transfer agent, auditor, insurance, settlement banks
- [ ] Demand side traced: who borrows or pays the yield, and is their carry subsidized (rented demand = rented yield)
- [ ] Eligibility: US / non-US / accredited or qualified only / KYC whitelist; secondary market limited to eligible buyers?
- [ ] Layer clocks listed: vault redemption vs fund redemption vs underlying settlement cadence (mismatch = duration risk)
- [ ] Parameter owners named per layer (venue governance / curator / issuer), each with its timelock

## Curator
- [ ] Parameter curation vs discretionary deployment
- [ ] What can change without a timelock
- [ ] Skin in the game (first-loss, own deposits)
- [ ] Time-to-exit in a past incident
- [ ] Fees: management, performance, effective take
- [ ] Published process? (mandate filter, graded DD, disqualification gate, tier-linked caps, engagement loop: curation-frameworks.md)
- [ ] Role in THIS product: curator, allocator, or both; self-dealing (allocator into own vaults), fee stacking, proprietary-book conflicts
- [ ] Downgrade mechanics: what a risk-tier drop DOES to position size, and on what clock
- [ ] Monitoring wired to exit on critical alerts, or alert-only?
- [ ] Legal classification questions: Howey / adviser / ICA / Reves : facts only, no legal opinion

## Yield
- [ ] Who pays
- [ ] Organic vs incentives (token emissions named and sized)
- [ ] Endogenous vs exogenous
- [ ] Cash vs accrual; last cash conversion
- [ ] Advertised APY vs base vs T-bill / tokenized T-bill spread
- [ ] Enumerated risks the spread is paying for
- [ ] Gross vs net: fees off, entry and exit costs at the user's size
- [ ] Denomination: paid in what asset; principal float; impermanent loss if LP
- [ ] Window: spot vs 7-day vs 30-day trailing, stated
- [ ] Rate dilution: pool size vs intended deposit size

## Asset identity
- [ ] Every named asset identified in one line: type (base / stablecoin / wrapper / vault share / LP token / PT), issuer, claim

## Market architecture
- [ ] Shared pool / isolated pair / modular vault network (EVC) / offer-book / collateral-as-liquidity / underwritten credit / hub-and-spoke
- [ ] If underwritten credit: who underwrites, junior cushion size, recovery path (legal, not liquidation)
- [ ] Isolation real on the graph, or shared collateral + shared oracle + shared allocator
- [ ] LLTV, borrow LTV vs liq LTV, penalty, caps, utilization
- [ ] Public allocator or other cross-market liquidity pipe
- [ ] Position sized within the venue's free-liquidity buffer ((100% minus kink) x pool liquidity), or beyond it
- [ ] If AMM/LP: fees vs emissions vs IL split; JIT and LVR dilution; exit route protected or public mempool

## Oracle
- [ ] Class: hardcoded par / redemption-rate / market TWAP / linear-discount / other
- [ ] What it reads
- [ ] What can move the mark
- [ ] Switch condition if min(curve, TWAP)
- [ ] Liquidations fire on the tape humans see
- [ ] Buffer at advertised max LTV (pct move to liquidation)
- [ ] Who can re-point the feed; timelock

## PT / YT (if present)
- [ ] Underlying SY
- [ ] Maturity
- [ ] Implied APY vs underlying APY
- [ ] PT used as collateral? Which oracle class
- [ ] Looped? Health factor
- [ ] Max implied yield of the Pendle pool (TWAP lower bound)

## Stable / synthetic dollar / RWA
- [ ] Claim type (fiat-reserve, tokenized MMF, synthetic, CDP, strategy note)
- [ ] Reserve composition and attestation cadence
- [ ] Perp venue + funding + house vault if synthetic
- [ ] Redemption waterfall: instant / facility / OTC / slow path / gate
- [ ] Issuer-operator vs agent-model if RWA
- [ ] Settlement class: atomic at posted rate / request queue priced at fulfillment / epoch batch at one price / transfer-agent book (rwa-fund-mechanics.md)
- [ ] Forward pricing test, both directions: price struck after the order commits; price-setter cannot see pending orders before striking
- [ ] Posted-price bounds: independent-oracle tolerance, rate-of-change caps, staleness checks, or none
- [ ] APY print: formula class (two-point compound / simple / declared / administrator-fed), window, measured vs declared, what feeds the NAV
- [ ] Issuer fee stack: management / performance (high-water mark, hurdle) / redemption / offering-document fees not in the app / spread take if the rate is declared

## Strategy products (if the product runs trades: neutral, basis, OTC, options, LP)
- [ ] What is the book SHORT (funding, tail, counterparties), and is that leg pre-funded (reserve sized how, contributing at what current rate)
- [ ] Each live position's shape vs the documented strategy taxonomy (locked is not spot; OTC inventory is not basis) : strategy drift check
- [ ] Illiquid positions: marked how, in or out of NAV, gated how (side-pocket sequence: exclude, gate, disclose)
- [ ] Terms of Use: who can amend, what notice, when did redemption/freeze language last change
- [ ] Any OTC discount decomposed: cliff / hedge carry / adverse selection / mark risk
- [ ] Crowding: funded or borrowed bid (five-test scorecard, tokens file); recovery quality after the last shock
- [ ] If options or LP yield: who is short what; premium priced by implied volatility or by flow; writer liquidation/exercise mechanics; net of LVR and JIT

## Failure shapes
- [ ] Looping / PT-looping
- [ ] Incentive cliff
- [ ] Blind oracle
- [ ] Utilization trap
- [ ] Depeg spiral
- [ ] Privileged signer / uncapped mint / no timelock
- [ ] Shared-graph contagion
- [ ] 4626 inflation
- [ ] Junior tranche already gone

## Bias
- [ ] Who pays the source
- [ ] Reproducible onchain / public API
- [ ] Admission against interest
- [ ] Conflicting sources kept visible
- [ ] TVL / volume / supply / AUM : what is actually being counted
