# RWA fund mechanics: the primary market

Load this for: how a tokenized fund actually mints and redeems, NAV (net asset value) timing questions, "is this RWA (real world asset) APY real", issuer fee questions, and take-rate questions at the issuance layer. The wrapper taxonomy and the redemption waterfall are concepts.md section 7 and the service provider map is concepts.md section 14; this file is the plumbing underneath both: how the token gets its price, how orders settle against that price, how the displayed APY (annual percentage yield) is generated, and what the issuer clips. Every named implementation detail below is a calibration print from a July 2026 survey of public contract code and live APIs; re-verify against the current code before citing.

## 1. The mint is a subscription, not a swap

A secondary trade swaps existing tokens at a market price. Primary flows (mint and redeem) are fund subscriptions: someone strikes a price, the order settles against it, and the TIMING between order and price strike decides who holds a free option. TradFi solved this in 1968 with forward pricing (SEC Rule 22c-1): a mutual fund order executes at the NEXT computed NAV after the order arrives, never an earlier one, because letting anyone transact at a price struck before their order lets them pick off the fund (the 2003 late-trading and market-timing cases were this failure at industrial scale). Nothing forces forward pricing onchain. Grade every RWA mint and redeem path against it.

## 2. The four settlement classes

Survey of public implementations, verified in code July 2026 (Nest, Midas, Centrifuge, OnRe, Securitize):

1. Atomic at a posted rate: the deposit executes instantly at a rate an authorized reporter posted earlier. Nest (on Plume) is the reference: a keeper posts the exchange rate roughly hourly, each update bounded to 0.05 percent with a one hour minimum delay, reverting on breach; redemptions are instant for a fee, with a request queue beside them. Midas instant deposits mint at the oracle rate. Fast UX, and the whole stale-rate surface of section 3.
2. Request queue, priced at fulfillment: the user requests, an operator fulfills later at a fulfillment-time price. Midas request approvals carry the rate as an argument, and its guarded approval path enforces a variation tolerance against the oracle while an unguarded admin path exists beside it (which path the operator actually uses is a live question); OnRe's redemption admin fulfills per request at a formula price with declared but unenforced bounds. The tolerance check is the load-bearing part: a queue whose operator can fulfill at any number is a trust rail wearing a queue costume.
3. Epoch batch at one price: orders accumulate, the manager strikes one price per epoch, the chain computes every amount from it and fills pro rata. Centrifuge v3 is the reference: deposit approval and share issuance take the PRICE as the argument and the chain does the arithmetic, with no onchain check on the submitted price. ERC-7540 request-then-claim is the generic standard for this shape. Structurally closest to forward pricing when the price is struck after the window closes.
4. Transfer-agent book entry: a regulated transfer agent computes amounts off chain and mints them raw, amounts in calldata. Securitize's classic rail is the reference (the offchain shareholder register is authoritative; the chain mirrors it). The same platform also runs an atomic ramp at a posted rate, and its Circle BUIDL off-ramp is hardcoded one to one, which is only coherent for a stable-NAV fund.

The universal primitive across classes 1 to 3: an authorized party posts a PRICE and the chain computes the amounts. Raw per-investor amounts appear only on the regulated transfer-agent rail, where an offchain register is the legal book of record. A design where an operator hand-enters token amounts per settlement WITHOUT that register is nonstandard: it removes the chain's ability to sanity-check anything and makes every settlement a fat-finger and insider surface. Treat it as a finding.

## 3. Stale-rate arbitrage: the option in the mint path

When minting is atomic against a rate posted earlier, and the underlying moved after the post, the subscriber mints rich or redeems rich against existing holders. That is a free option paid by the fund, and it scales with underlying volatility times rate staleness. Rate-of-change caps and minimum delays (the Nest bounds above) shrink the option; they do not remove it. For a stable-NAV T-bill fund the option is tiny; for anything marked daily off a volatile book it is the design flaw. The clean fix is class 3 with the price struck after the order window closes, which is why volatile-underlying products should look like queues, not swaps. The reverse conflict also exists: a pricing authority who strikes AFTER seeing the pending order book can pick the print that favors the house. So ask both directions: can the subscriber see the price before committing (their option), and can the price-setter see the orders before striking (the house's option). Forward pricing is the design where neither side holds the option.

Who strikes the price is the same question as concepts 13's oracle taxonomy wearing primary-market clothes: the pricing authority is usually the fund administrator (concepts 14's service provider map), and their independence from the issuer and from the settling operator is a first-class check, not a formality.

## 4. The APY print: ask which formula made the number

Four formula classes generate the yield number on an RWA product page (same survey, July 2026):

1. Two-point compound: APY = (P_t / P_(t-n))^(365/n) minus 1 over a lookback of n days. Nest: 30 day headline plus 7 day and a month-end-frozen 30 day variant, computed off chain in their API, with admin target-APY overrides available. Midas: same form, n of 7 or 30, interface defaults to 7 day; their DefiLlama adapter floors the print at zero, so the aggregator never shows the negative days the raw formula produces.
2. Simple annualization: (P_end / P_start minus 1) times 365/days. Centrifuge's indexer computes 1, 7, 15, 30, 90, and 180 day variants this way.
3. Declared rate: the number is an input, not a measurement. OnRe's admin posts the rate onchain and the NAV then ramps deterministically FROM it; Centrifuge's flagship pools display a hardcoded issuer target. Nothing in either print measures realized performance.
4. Administrator-fed: no formula in the app at all; the fund administrator supplies the metric (Securitize funds surface administrator numbers, such as a money-market style 7 day yield for the flagship fund).

Nobody smooths: no exponential moving average, no median, no averaging of windows appeared anywhere in the surveyed code. Displayed RWA APYs look stable because the NAV INPUTS are smooth by construction (administrator marks or a deterministic ramp), not because a formula filters noise. Three consequences. An APY computed from an administrator-posted NAV measures the administrator, and inherits the oracle questions (who reports it, what checks it, concepts 13). A declared rate is a promise wearing a percent sign: decompose it like an incentive until realized book earnings are shown. And two products' prints are not comparable until you know window and compounding convention: a 7 day compound print and a 180 day simple print can sit hundreds of basis points apart on the same book. Add to every RWA assessment: which formula, which window, measured or declared, and what feeds the NAV.

## 5. The issuer fee map

Fee norms by asset class, from a survey of issuer fee schedules and offering documents (primary sources, July 29 2026; calibration, re-verify):

- Tokenized treasuries and money market funds: management fee only, commonly 0 to 50 basis points, several stating zero performance fee explicitly (Superstate, Spiko; Ondo's OUSG management fee was waived at survey time). The exception: USYC charges 10 percent of yield and no management fee.
- Curated and managed strategy tokens: performance fees are standard, around 20 percent with a high-water mark, hurdles rare. Midas ranges 5 to 30 percent by product with management mostly zero, plus fees that appear only in the legal Final Terms documents and never in the app (an issuer interest fee and a redemption fee): the offering documents, not the interface, carry the full stack.
- Onchain private credit: 10 to 20 percent of gross interest is the norm, sometimes labeled a management fee (Maple's take is a percentage of interest split between delegate and treasury; several older protocols standardized at 10 percent).
- The spread take: distribution-layer products with a declared APY and no fee line take their margin as the spread between what the book earns and what the token pays (USDY-style accumulating dollars, declared-rate products). Rule: a declared rate plus no fee table means the fee IS the spread; ask what the book actually earned.

Realization filter tie-in (concepts 4): quote net. A treasuries token quoting gross of a 50 basis point management fee overstates carry by exactly the fee, and a performance fee without a high-water mark charges twice for the same gain.

## 6. The issuance-layer take rate: the first audited print

The take-rate map (concepts 8) got its first audited calibration print for the RWA issuance layer when Securitize filed a Form S-1 (July 31 2026, NYSE: SECZ). Tokenization revenue over average tokenized assets: 119 basis points FY2024, 116 FY2025, 141 Q1 2026 annualized. The all-in figure including their acquired fund-administration arm reads 193 to 247 basis points but is inflated, because servicing revenue is earned partly on funds outside the AUM (assets under management) denominator: quote the tokenization-only column. The caveat that changes how to use it: Securitize prices integrations, maintenance, and transfer-agent software, not a percentage of assets, so the basis-point figures are derived, never charged, and no performance fee appears anywhere in the filing (corroborating section 5's treasuries pattern). The filing also shows what normal looks like at this stage: one fund was over 60 percent of tokenized assets (September 30 2025 figure) on a platform agreement terminable on 90 days notice, so for issuance platforms the moat is contract terms and switching costs, not client count.

## 7. The discriminating questions (run these on any RWA product)

- Settlement class: atomic at posted rate, request queue priced at fulfillment, epoch batch at one price, or transfer-agent book entry?
- Forward pricing test, both directions: is the price struck after my order commits, and can the price-setter see pending orders before striking?
- What bounds the posted price: tolerance against an independent oracle, rate-of-change caps, staleness checks, or nothing?
- Between request and settlement: are funds escrowed, are shares locked, are orders cancelable, and at whose discretion?
- The APY print: which formula, which window, measured or declared, and what feeds the NAV?
- The fee stack: management, performance (high-water mark? hurdle?), redemption fee, offering-document fees not shown in the app, and the spread take if the rate is declared?
- The pricing authority: who strikes the number, and are they independent of the issuer and of the settling operator?
