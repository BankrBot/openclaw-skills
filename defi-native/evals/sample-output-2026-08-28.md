# Sample output: recommendation protocol, run 2026-08-28

This is a full-length REAL run (live data, real products) under playbook Part 3, the recommendation protocol. For the minimum-bar output skeleton on a fictional product, see examples/assessment-example.md. Match depth to the ask.

Query: "Base just launched tokenized stocks. Help me understand what are the best opportunities break it down for me. For example I saw Nvidia Carry trade vault, is this a good one? or something else? [IPOR Fusion vault link] Imagine I have $5000"

Run conditions: public-user simulation (no machine context), skill v1.3.0-rc, live data (the protocol shown is unchanged through the current version). Verbatim agent output below.

POST-RUN VERIFICATION NOTE (2026-08-28, later the same day): the four items the output flagged as unverified were resolved by a follow-up research pass (see ../../research/2026-08-28-nvdac-verification.md). Material updates: NVDAC confers no redemption rights to onchain holders until KYC vesting (US persons excluded entirely); no functioning Euler NVDAC market exists yet, so the carry vault's engine does not exist; superNVDA holds 100% idle NVDAC (no strategy risk today, incentive plus certificate risk only, with a live mandate to deploy later); the IPOR family curator is one anonymous EOA holding all key roles. The output's "not yet" verdict and its unverified-items list are validated; the SuperVault call's risk mix shifts from contract-stack risk toward legal-claim risk.

---

# Base tokenized stocks: the landscape, your $5,000, and a verdict on the Nvidia Carry Trade vault

*All numbers pulled live 2026-08-28 (~15:15 UTC) from keyless public sources: IPOR's API, DefiLlama, Merkl, Base Blockscout, Coingecko, FRED. Risk-free anchor: 3-month T-bill 3.70% (FRED DTB3, Aug 26).*

## What actually launched

The "tokenized stocks on Base" are **Coinbase Tokenized Stocks** (NVDAC = "NVIDIA (Coinbase Tokenized Stock)", verified onchain at `0xb2000...8108c`). It is early and tiny: NVDAC total supply is ~14,025 tokens (~$3.1M) with 318 holders. Around it, a launch-week yield ecosystem has sprung up: DEX pools (Aerodrome, Uniswap v4), Euler lending markets, a Superform SuperVault, and the IPOR Fusion "Carry Trade" vault family you found (NVDA, AAPL, GOOGL, META, MSFT, COIN). Almost all of the yield right now is **incentives with announced end dates**, not organic carry.

One structural fact drives everything here: the token trades 24/7 but the stock does not. Equity oracles go stale from Friday close to Monday open, which is why IPOR pauses deposits and withdrawals every weekend, and why weekend/overnight gap risk is the signature risk of every levered position in this category.

## Your question first: is the Nvidia Carry Trade vault good?

**Verdict: not yet. The APY you saw is not real, current yield is 0.00%.**

What the vault actually is (balance-sheet terms): an ERC-4626 vault on IPOR Fusion infrastructure that takes NVDAC deposits, and *once live* will post them as collateral on Euler, borrow USDC against them at a conservative LTV, and lend that USDC out across Base money markets. You keep full NVDA price exposure; the carry (USDC lending yield minus USDC borrow cost, levered) accrues on top, denominated in NVDA.

What I verified live:

- **It is in pre-deposit phase.** The vault's own page says: "Pre-deposit phase ahead of the ignition of yield generation... no APY is shown yet," and shows **APY 0.00%**. The ~61% "net APY" in the raw API (and any aggregator quoting it) is an annualization artifact: a small vesting reward stream over a $11.5k vault, seven days old. Day one it printed 1,000,000%. Undated, undecomposed APYs on week-old vaults are noise.
- **TVL is $11,457** (50.9 NVDAC) as of Aug 28. 100% of it sits as idle ERC-20 NVDAC; the strategy has never opened a position. First deposits: Aug 24.
- **Five layers:** venue = Euler (Base); infrastructure = IPOR Fusion (established, audited, this is the strongest layer); curator = **unnamed**, the Atomist/owner roles are bare addresses, not managed by IPOR's own team, no track record verifiable; underlying = NVDAC (Coinbase-issued tokenized stock) plus, once live, USDC loan positions; distribution = app.ipor.io.
- **Terms:** 0.30% management fee, 2.00% performance fee, zero entry/exit fees, 1-second redemption delay (but the weekend pause applies), vault cap 2,385 NVDAC (~$535k), 5x Fusion points.
- **Oracle/peg:** NVDAC trades at $224.46 (Coingecko) vs IPOR's oracle mark of $223.78, within ~0.3% today.

The three biggest risks, ranked, with failure shapes: (1) **weekend gap liquidation** once levered: NVDA gaps down over a weekend while the equity oracle is frozen and the token trades; this is the oracle-staleness shape and it is structural, not hypothetical; (2) **anonymous curator on a thin, week-old vault**: curator-opsec shape, plus the thin-vault ERC-4626 caveat: treat near-empty vaults as hostile until seasoned; (3) **the carry itself is unproven**: Euler's NVDAC market parameters (LLTV, borrow rate, oracle class, depth) could not be verified this session, and a carry that borrows USDC to lend USDC only clears fees when the spread is real.

**What would change the verdict:** strategy ignition with 2-3 weeks of realized (not vesting-artifact) APY, positions visible on Euler, a named curator, and TVL growth past the low six figures. It costs nothing to wait; pre-deposit gets you 0% plus points.

## The opportunity table (Base tokenized-stock yield, dated Aug 28, 2026)

| Opportunity | Yield (as of Aug 28) | Yield source | Exposure | Key date |
|---|---|---|---|---|
| **NVDA SuperVault** (Superform, `0xC441...7BfC`) | ~36% APR (Merkl rewards; 100% incentive, 0% organic) | Merkl campaign, $105/day fixed | 100% NVDA + contract stack | Ends **Sep 23** |
| **IPOR Nvidia Carry Trade** (your link) | **0.00%** now (pre-launch); 5x points | Future: levered USDC carry on Euler | 100% NVDA + leverage once live | Ignition TBD |
| **Aerodrome USDC-NVDAC LP** ($1.74M TVL) | spot ~731% (107% fees + 624% AERO), 30d mean 478% and falling | Launch-week fees + AERO emissions | ~50% NVDA / 50% USDC, **impermanent loss** | Beefy CLM Merkl boost (32% APR) ends **Sep 7** |
| **Uniswap v4 USDC-NVDAC** ($360k TVL) | spot 25.8% fees; 30d mean 328% (decaying fast) | Trading fees only | 50/50 + IL | Fee APY normalizing now |
| **Sibling Beefy CLM stock pools** (METAc 40%, AAPLc 40%, GOOGLc 24% APR) | Merkl campaigns | Incentives | 50/50 + IL per stock | All end **Sep 7** |
| **Boring baseline: Steakhouse USDC (Morpho, Base)** | ~2.9% APR Merkl on top of native lending yield; $348M TVL | Organic borrower interest + small incentive | USDC only, no stock risk | Ends Sep 21 |

Why these yields exist (the honest answer): this is a **structural launch plus incentive geometry** window. Coinbase, Aerodrome, Beefy, Superform, and the vault curators are paying to bootstrap liquidity in a brand-new asset class, and launch-week trading volume inflated LP fee yields that are already normalizing (Uniswap: 328% 30d mean vs 26% spot). Everyone farming it is the reason it closes: fixed daily rewards ($105/day on the SuperVault) dilute as TVL arrives, and every campaign has a published end date.

## The recommendation for your $5,000

**The call, conditionally:** for $5,000 with a ~1-month horizon, need for exit on any weekday, and tolerance for full NVDA price exposure, the strongest option in this set today is the **NVDA SuperVault on Superform (36% APR, paying now, ends Sep 23)**, not the IPOR carry vault, which pays 0% until ignition. If you do NOT actively want NVDA price exposure, skip this whole category: park in a large boring USDC vault (~4-7% all-in) and revisit. I assumed those constraints since you gave none; correct me and the call changes.

**The decision that actually matters at your size:** a month of 36% APR on $5,000 is ~$130. A normal NVDA weekly move is +-5-10%, i.e. +-$250-500. The stock exposure dominates the farm tenfold. Only enter if you'd be happy holding tokenized NVDA anyway.

**ROI mechanics at $5,000:**
- Entry: swap USDC to NVDAC on Base (~$1.7M Aerodrome pool): ~0.15-0.3% slippage+fee, about $10-15; gas on Base is cents. Deposit to Superform: cents.
- Carry: 36.2% APR x 26 days (to Sep 23) is about 2.6%, roughly **$129 gross**, IF the APR holds. It won't fully: rewards are a fixed $105/day, so APR = $105x365/TVL. If TVL doubles from $106k, APR halves. Estimate for the realized average: **15-30% APR** (calibrated judgment, low confidence).
- Exit: withdraw (reduces accrual in real time, no lock verified) plus swap back: another ~$10-15.
- **Net expected farm yield: roughly $60-110 on the month, ~1.2-2.2%**, against T-bills at 3.70%/yr. The edge is real but small in dollars; the NVDA leg is the real position.

**Risk:reward, with the tail:** upside ~+$100 farm yield plus whatever NVDA does. Downside branches: NVDA -10% month = -$500 (market risk, you chose it); NVDAC depeg/redemption friction (Coinbase claim structure **unverified this session**, a first-class open item); and the total-loss branch: Superform contracts + whatever venue superNVDA deploys into (unverified) + NVDAC issuer + Base bridge, small probability, 100% severity. At even 2% annualized on that stack (calibrated judgment, low confidence: none of these components has a public incident history found, but none is seasoned either), it consumes most of a 2% monthly edge at size. That is why this is a $5k trade, not a $50k trade, and why exposure budgets count per cluster: NVDAC + Euler + Base counts once across everything you hold here.

**Invalidation triggers (any one flips the call):**
1. Merkl campaign APR on the SuperVault drops below ~15% (dilution): exit or don't enter.
2. Sep 23 campaign end: structural certainty, the reward yield goes to ~0 unless renewed.
3. NVDAC market price deviates more than 1-2% from NVDA's last close for more than a day (peg/redemption stress).
4. Superform or underlying venue incident chatter, or a change in where superNVDA deploys.
5. For the IPOR vault specifically: ignition + 2-3 weeks of realized APY + a named curator = re-run this analysis; that is your entry trigger there, not today.

**The runner-up and why it lost:** the **IPOR Nvidia Carry Trade** is genuinely the more interesting *structure* (levered carry, low fees, real infrastructure, and the eventual organic yield could outlive every incentive campaign). It lost purely on timing: 0% APY today, $11.5k TVL, unproven strategy, unnamed curator. The Aerodrome LP (478% 30d mean) lost despite the headline because it is the incentive-geometry trap in its purest form: IL on a volatile single stock, emissions-dependent, and the boost dies Sep 7. The door is smaller than the room.

**Opportunity lifespan:** short. Basis: structural (announced end dates Sep 7 and Sep 23; fixed daily reward math) plus historical base rates (launch fee APYs on these very pools already decayed ~10x in three weeks). Plausible window: **2-4 weeks** for the incentive capture; the durable opportunity, if any, emerges after, in whichever carry/lending structures show real organic spread once the confetti settles.

**Watch plan** (can be set up as a scheduled job; otherwise run by hand):
- Weekly and before Sep 7/23: Merkl APRs and campaign status: `curl "https://api.merkl.xyz/v4/opportunities?chainId=8453&name=nvda"`.
- Weekly: IPOR vault state (TVL, real APY, positions appearing): `curl --compressed "https://api.ipor.io/fusion/vaults"` filtered to the vault address; ignition is the trigger to reassess it.
- Daily while holding: NVDAC price vs NVDA close (Coingecko token price vs any equity quote): the peg is the tail.
- Weekly: NVDAC holder count and vault holder concentration on Basescan/Blockscout.

**What could not be verified this session, and you should before sizing up:** the exact legal claim behind Coinbase Tokenized Stocks (who can redeem, against what, in which jurisdictions); the Euler NVDAC market's LLTV, oracle class, and rates (the carry vault's entire engine); where superNVDA actually deploys; and the identity of the Carry Trade vaults' curator. Direct questions for the curator when they surface: who are you, what target LTV and what is the liquidation buffer against a 15% weekend gap, and what is the projected organic carry after fees at today's USDC rates?

*This is research, not financial advice, and I don't execute transactions. DeFi carries total-loss tails (contracts, oracles, depegs, issuers, operators) and in a category this young (the entire NVDAC float is ~$3M, seven weeks of history at most), those tails cap position size regardless of conviction.*
