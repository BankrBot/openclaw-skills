# Worked example: a full assessment using the output skeleton

ALL NUMBERS CONSTRUCTED FOR TEACHING. This shows the MINIMUM bar: the output skeleton with every line filled, at the shortest defensible length. For a full-length real deliverable under the recommendation protocol, see evals/sample-output-2026-08-28.md. Match depth to the ask: a quick assess can look like this file; a "which one, for $N" ask looks like that one. This is a fictional product ("Northgate USDC Prime") with realistic anatomy, shown so agents imitate the structure and depth. Never reuse these numbers as facts.

Product: Northgate USDC Prime (vault share, Base)
Class: curated stablecoin lending vault
Balance sheet: assets = USDC loans across 6 isolated markets plus a 4% idle sleeve; liabilities = vault shares redeemable in USDC; equity/upside = curator fees; first-loss = depositors (no junior tranche, no insurance named)
Vault layers: 1 venue = Morpho-style isolated markets; 2 infra = ERC-4626 (standard implementation, audited); 3 curator = Northgate Capital (risk-parameter type, 12% performance fee, timelocked caps, no first-loss capital disclosed); 4 underlying = see look-through; 5 distributor = a wallet app's "Earn" tab (took 0.5% wrapper fee, disclosed in-app)

Look-through: 62% of assets lend against wrapped bitcoin (one custodial issuer), 21% against a synthetic dollar's staked share, 13% against staked ETH receipts, 4% idle. The share is not "USDC": it is majority a levered-BTC-borrower loan book. Wrapper custody and BTC liquidation capacity on a violent day are the real tail.

Oracle class per market: BTC markets = market oracle on deep pairs (class 3 on deep liquidity: acceptable); synthetic dollar market = redemption-rate feed (class 2: BLIND to a market depeg; the Resolv pattern; this is the finding); staked ETH = exchange-rate feed with market sanity bound (hybrid).
  Liquidations fire on visible tape? BTC yes; synthetic dollar sleeve NO.

Yield split (as-of date required in real use): advertised 8.1% = 3.9% base borrower interest + 2.7% incentive emissions (program ends in 5 weeks, per the rewards page) + 1.5% from the synthetic-dollar sleeve marked on accrual. Spread over the 4.0% tokenized T-bill proxy: +4.1% advertised, but only −0.1% organic-cash. The spread pays for: smart contract tail, one blind oracle, wrapper custody, and exit risk below.

Redemption: instant up to the idle sleeve (~$3.1M today) plus market liquidity; two BTC markets sit at 91-94% utilization (withdrawal queue risk); no committed backstop.

Holder concentration: top address 38% (the wallet app's omnibus), top ten 71%. One integrator decision outranks all retail exits.

Failure shapes this product can express: incentive cliff (5 weeks out), blind-oracle depeg on the 21% sleeve, utilization trap on exit.

Verdict: this is a BTC-collateral credit fund with a stablecoin name, paying T-bill-equivalent organic yield plus a temporary subsidy, carrying one blind oracle and integrator-concentrated exit risk. Unanalyzed items: curator incident history (no public record located), infra audit recency. Opportunity case: none at current pricing; re-examine if the incentive cliff empties TVL and the organic rate reprices above 6% (reputational-contagion hunting ground).
Exit triggers: incentive program end; synthetic sleeve above 25%; utilization above 95% for 48h; the omnibus address beginning to exit.
Questions for the curator: largest single-market exposure and its liquidation depth; why a redemption-rate feed on the synthetic sleeve; evidenced time-to-exit in any past incident; will they disclose first-loss capital.

That is the bar. If an assessment cannot fill these lines, the verdict is "unanalyzed", not "looks fine".
