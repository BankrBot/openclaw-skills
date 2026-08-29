# Analogs: the TradFi Rosetta stone

The bridge chapter. Everything onchain has a traditional-finance ancestor, and every analogy hides something. This file gives the mapping AND the hiding place, so a reader from either side can cross. Load it whenever the user is learning, and consult it during assessments whenever an analogy will carry the explanation better than jargon.

Two cautions before the table. First, the columns are not two dialects: DeFi uses much of the left column natively (haircut, margin, repo, collateral, tranche all appear onchain with their TradFi meanings), so the table maps OBJECTS and their differences, never vocabulary ownership. Second, some rows are design-dependent: where one onchain object comes in several claim types (stablecoins above all), the right analogy depends on the design, so classify the claim first (chapter 6) and then pick the row.

## The Rosetta stone

| TradFi object | Onchain object | What the analogy hides |
|---|---|---|
| Balance sheet | Every product | Nothing; this one is exact. Unknown first-loss = unanalyzed |
| Investment fund | Vault (ERC-4626/7540) | No fiduciary duty, no custody rule; code-enforced mandates instead of law |
| Asset manager | Curator | No registration or obligations; roles may split across four keys |
| Repo desk | Lending pool | No dealer relationship; a bounty liquidates you, not a phone call |
| Haircut / advance rate | Max borrow LTV | Same number from two sides (an 80% advance is a 20% haircut). The liquidation LTV is a separate, higher trigger: the gap between them is your only cure period |
| Margin call | Liquidation + penalty | No time to post collateral; it executes atomically |
| Banknote (par claim; issuer keeps the yield) | Payment stablecoin (USDC-style) | No deposit insurance, no discount window; par is an equilibrium; issuer holds freeze power |
| MMF share (yield to the holder) | Tokenized MMF / yield-bearing dollar | Transfer and eligibility gates; securities-adjacent; same no-backstop caveat |
| Hedge-fund basis book | Synthetic dollar | Funding has no circuit breaker and can invert in hours |
| ETF create/redeem | Mint/redeem at NAV | The arb only exists for whitelisted or vested actors |
| Zero-coupon bond | PT (principal token) | Marked by an oracle someone chose, not a deep tape |
| Bond strip (IO) | YT (yield token) | Also a weapon against the PT's oracle |
| Credit spread | Yield above the T-bill proxy | Unnamed slices are marketing, not compensation |
| Junior/senior tranche | First-loss structure | The junior can already be gone while the senior is still marketed |
| Price vendor (pricing service) | Oracle | The oracle CLASS chooses who dies in stress |
| Custodian + transfer agent | Wrapper issuer + registrar | Layers between you and the cash flow, each with keys |
| Clearinghouse (CCP) | Insurance fund + ADL | The waterfall is shallow: no defaulter fund contribution, no mutualized member layer; hitting winners (ADL) is routine, not last-resort |
| Overnight rate | Perp funding | Set per hour by crowd positioning, not by a committee |
| Shadow-bank run | Utilization trap, depeg, gates | Runs move at block speed; first movers are rewarded |
| Margin loan, releveraged | Looping | Self-service leverage on your own collateral, liquidated by bots; the borrower runs the machine |
| Rehypothecation | Collateral-as-liquidity; receipt-token reuse | The PROTOCOL reuses your collateral (as AMM inventory, or a wrapper re-staking your asset); a different party bears the reuse risk |

## 1. The hierarchy of money

Money is a pyramid of promises, and each layer down is a promise to deliver the layer above. TradFi: central-bank reserves and cash at the top; bank deposits hold par because of deposit insurance and the central bank's discount window (the lender of last resort, LOLR); money market fund shares sit just below, promising par on demand ("breaking the buck" is their failure: NAV printing under $1), and T-bills beside them: not par claims but discount securities that mature at par, held up by sovereign credit and the deepest market on earth; then commercial paper and repo. Onchain rebuilt the lower floors with no top: payment stablecoins, then tokenized MMFs, then savings rates like sUSDS, then synthetic dollars, then strategy notes. Every onchain layer is a promise to deliver the layer above it, and there is NO lender of last resort, no insurance, no discount window anywhere in the stack. That is why exit design dominates onchain analysis: the only backstop is being early. When you meet a "USDC vault at 7%," first place it on the pyramid: it is a strategy note built on a payment stable, two floors below anything par-protected.

## 2. What "risk-free" actually means

T-bills anchor every spread not because their yield is low but because of three properties: sovereign credit (the issuer prints the currency the debt is in), the deepest market on earth (exit without moving the price), and near-zero duration at 3 months. Tokenized T-bill funds (BUIDL, USYC, BENJI) are risk-free PROXIES: same underlying cash flow, plus issuer risk, whitelist and eligibility gates, smart-contract risk, and a slower redemption clock. Savings rates like sUSDS are one floor further down: the rate is set by governance and paid from a mixed balance sheet, not a T-bill passthrough, so treat it as an administered rate, never as the bill curve. Those additions are why a proxy paying 20 to 40 basis points over T-bills is not free money; it may not even cover the tail it adds. Rule: quote spreads against the true T-bill, and treat the proxy's own spread as the price of its wrapper.

## 3. Money markets vs capital markets, and duration

Money markets are short and constantly refinanced: T-bills, repo, overnight funding, and almost every floating-rate lending pool. The on-demand par PROMISE belongs to MMF shares and deposits; a T-bill just matures at par and trades at a small discount until then. Capital markets are term: instruments with duration whose PRICE moves when rates move: bonds, equities, PTs, fixed-rate books. Onchain spent its first decade as a pure money market (everything floating, repriced per block) and is now growing a capital market. The one formula worth memorizing: price change is approximately minus duration times the yield change. A 6-month PT is not "a vault with a lockup"; it is a zero-coupon bond: a 100 basis point jump in implied yield cuts the mark about half a percent instantly, which costs a levered position several percent of equity without liquidating it. The real liquidation print needed a ~3% mark move (roughly a 600 basis point implied-yield shock) to clear loops sitting at 1.01 to 1.03 health factors. The PT liquidation events read as oracle exploits, but a bond desk would read them as rates risk bought at leverage: both readings are true, and the skill requires both.

## 4. Primary vs secondary, and the create/redeem arb

Primary market: new claims are minted against the issuer (an IPO, a fund subscription, a stablecoin mint). Secondary market: existing claims change hands (an exchange, a DEX, an RFQ desk). The ETF mechanism is the master analog for 2026 onchain products: authorized participants (APs) create and redeem ETF shares at NAV, and their arbitrage is what pins the market price to the portfolio's value. Onchain mint/redeem at NAV plays the same role, WHEN it exists for someone. When mint/redeem is gated (KYC, whitelist, vesting, authorised participants only), the token trades like a closed-end fund: its price can sit at a persistent discount or premium to NAV because nobody you can become is allowed to do the arb. That single lens explains why some tokenized stocks trade 24/7 while conferring no redemption right, why gated fund shares hold NAV only for whitelisted wallets, and why "it trades near $1" is evidence of arbitrage capacity, not of safety.

## 5. Settlement, and why queues exist

TradFi assets settle on calendars: US cash equities T+1, Treasuries T+1 (same-day possible by agreement), futures settle variation margin daily. DVP (delivery versus payment) means the asset and the cash move together or not at all. Tokens settle in seconds, but the assets UNDER tokenized products still live on banking calendars: that mismatch is why ERC-7540 (request-then-claim queued deposits and redemptions) exists at all. A queued vault is not clunky UX; it is the settlement mismatch wearing a token standard, the same reason a mutual fund pays redemptions in days, an interval fund quarterly. Equity-oracle freezes are the same fact from the price side: the token trades 24/7 while the underlying prints on an exchange calendar with a nightly halt and a weekend halt, and someone owns every gap; the weekend is just the longest one. Always ask what actually settles when, and whether asset and cash legs move together.

## 6. The four claim types (what you own)

Every token confers one of roughly four right-bundles, and the ticker never tells you which:
1. Payment-stable claim: par claim on an issuer's reserves; issuer usually keeps the float yield and holds freeze power.
2. Fund share: pro-rata claim on a portfolio (tokenized MMFs, savings tokens); transfer often gated; yield flows to the holder.
3. Equity: residual claim with dividends and votes. Most "tokenized stocks" are NOT this.
4. Certificate or debt exposure: economic tracking only: tracker certificates, unvested trust certificates, tokenized debt referencing a stock. No vote, often no redemption right for you.
Beneficial ownership vs street name vs omnibus applies onchain unchanged: the address holding the token is often an integrator's omnibus wallet, and the human behind it holds a claim on THAT, not on the underlying. Identify the claim type before any other analysis; concepts section 17 applies this to tokenized equities.

## 7. Clearinghouses vs the onchain waterfall

TradFi derivatives cleared through a CCP (central counterparty): the CCP steps between every trade (novation), collects variation margin daily, and absorbs a member default through a waterfall in this order: the defaulter's initial margin, then the defaulter's own default-fund contribution, then a tranche of the CCP's OWN capital (skin in the game, drawn before anyone innocent pays, so the CCP's incentives stay aligned), then the mutualized default fund of surviving members, then further assessments. Winners are not immune: end-of-waterfall recovery tools (variation margin gains haircutting, partial tear-ups) do reach winning positions, but getting there is a resolution event. The onchain perp waterfall: position margin, then the venue's insurance fund or house pool (HLP-style), then ADL (auto-deleveraging), which closes WINNING traders' positions at venue-set prices. The honest contrast is depth and frequency, not presence: a CCP puts several layers ahead of touching winners and treats it as last resort; ADL can trigger on a normal bad day. Read an HLP-style pool as a CCP waterfall that is ALL skin-in-the-game with no mutualized layer behind it, whose depositors sold that backstop for an APY.

## 8. Market liquidity vs funding liquidity

Two different liquidities, and crises are their spiral. Market liquidity: can I SELL the asset without moving the price? Funding liquidity: can I keep BORROWING against it? They kill each other in both directions: a thin market lets a small trade move the mark, which triggers liquidations, which removes lenders (a market-liquidity event destroying funding). A utilization trap is the reverse: lenders cannot exit because everything is borrowed (funding evaporates while the asset itself is fine). Name which liquidity a product's exit depends on; the answer decides which stress kills it.

## 9. Nominal vs real

A 7% vault against 3.7% T-bills against 2% inflation is three sentences, not one: 7% nominal, a 3.3-point spread over risk-free (the part paying for enumerated risks), and roughly 5% real (the purchasing-power change). Yields onchain are quoted nominal, in the denomination asset. Always name the denomination (concepts 4's realization filters) and, for any holding-period judgment, subtract inflation in the holder's actual unit of account.

## 10. Repo, literally

Repo is selling a security today with a contract to buy it back tomorrow at a slightly higher price: a collateralized loan wearing a trade. Overnight, term, or open (rolling until cancelled). The haircut is the lender's cushion and scales with the collateral's volatility and market liquidity: exactly what LLTV is. Variation margin is the daily true-up: exactly what a health factor drifting toward 1.0 is. Rehypothecation is the dealer reusing your collateral for its own borrowing: exactly what looping is, self-service. And collateral-as-liquidity designs are the dealer admitting your repo collateral is also its trading inventory. The lending-pool analogy stops being a metaphor once you see every parameter has a repo name.

## 11. Corporate actions

Stocks pay dividends, split, spin off, and get taxed at the border (withholding on dividends to foreign holders). Tokenized equities handle these with onchain multipliers or rebases: the token quantity or an index adjusts instead of a cash payment arriving. Check: how the multiplier is published and by whom (it is an oracle), what withholding is taken before it (commonly 30% for US dividends to offshore structures, plus issuer fees), and what happens on a split or delisting. A stock token whose corporate-action mechanics you have not read is a claim with undefined cash flows.

## 12. Options, one page

A call is the right to buy at a strike; a put is the right to sell. Selling options collects premium in exchange for taking the buyer's tail: that premium is what many "structured yield" products actually are. A covered call vault sells upside on assets it holds; a cash-secured put vault (dual-investment products) sells the obligation to buy the dip; in both, the APY is option premium, priced by implied volatility, and the cost is showing up exactly when the market moves against the short option. Rule: when a yield cannot be traced to a borrower, a coupon, funding, or fees, look for a sold option; then the analysis is strike, expiry, implied vs realized volatility, and what you are left holding after the bad week, not "APY."

## 13. Who the borrower is

"Who pays this yield" (concepts 4, axis 1) ends at a borrower type, and the types behave differently: market makers financing inventory (rate-sensitive, flighty, creditworthy); basis and arbitrage books (leave the moment the spread closes); loopers farming incentives (rented demand; leave at the cliff); directional speculators (pay up in bull markets, vanish in bear); RWA issuers smoothing redemptions (sticky, structural); treasuries and funds managing working capital (sticky, rate-sensitive). A lending market's "organic" rate is the blend of these organisms; name the dominant one, because the rate's durability is the borrower's durability.
