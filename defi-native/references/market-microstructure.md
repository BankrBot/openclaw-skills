# Market microstructure

Load this file when the question involves: thin-market price action, memestocks or memecoins, short squeezes or gamma squeezes, tokenized equities (Robinhood tokenized stocks, xStocks and similar), manipulation reads ("is this a pump", "is this wash traded"), or any comparison between order-book and AMM (automated market maker) venue behavior. It extends concepts.md section 18 (attention assets) from single-pool mechanics to cross-venue dynamics. All frameworks below are original distillations; the sources block at the end names what grounds each and belongs in the manifest.

## 1. Liquidity is a quantity, not a quality

Depth is the dollars resting within a given distance of the current price. Everything else follows from it. The amplification ratio (mcap change divided by net flow, section 18) is depth's inverse fingerprint. Three depth questions settle most thin-market puzzles: how much is within 2% of price, who posted it and can they pull it, and does it replenish after being consumed (resilience). A market with $40K of depth carrying a $600K mark is not "worth" $600K; it is quoting $600K in a size nobody has tested.

Float versus supply: supply is what exists, float is what can actually trade (excludes locked, vested, team, treasury, dead wallets, and in equities, insider and index-locked shares). Price forms on the float; mcap is charged to the supply. Low float plus high attention is the preconditions list for every squeeze and every pump, in both asset classes. Overhang: unrealized profit is stored future sell flow. Estimate it as (current price minus volume-weighted cost basis of holders) times float. A market that has run without turnover carries its correction inside it.

## 2. Venue physics: order book vs AMM

Order books (NYSE, Binance, perp DEXs with books): quotes are discretionary and cancellable, so displayed depth is an option the maker can withdraw, and it disappears fastest exactly when needed (the flicker problem). Regulated equity venues add halts and circuit breakers (single-stock LULD (limit up-limit down) pauses, market-wide breakers), so stress converts into time instead of price. Market makers may have obligations but they are thin in microcaps.

AMMs: the curve is an uncancellable ladder of resting quotes; depth per tick is whatever was deposited and cannot flee, but also cannot grow except by deposits or buys. Impact is deterministic given flow. There are no halts: stress converts entirely into price, instantly, around the clock. Fees leak value from every round trip; where those fees go (compounding into depth vs siphoned to a fee recipient) changes whether trading deepens or thins the market over time.

The stress asymmetry to remember: order books lose depth in stress (quotes pulled), AMMs keep depth but let price gap through the thin ticks. Both amplify; they amplify differently.

## 3. Adverse selection: why spreads and impact exist

Every resting quote is a free option granted to better-informed traders. Makers price this by widening spreads and thinning size when flow turns toxic (one-directional, fast, from wallets or accounts that are historically right). On-chain, toxicity is measurable per wallet: net flow direction versus subsequent price. Snipers and MEV (maximal extractable value) bots are the purest toxic flow; retail chase is the purest benign flow. When analyzing any tape, split flow into these populations before drawing conclusions; concepts.md section 18's role taxonomy (sniper, momentum fleet, exit liquidity) is the crypto instance of this split.

## 4. Manipulation taxonomy, with fingerprints

Original distillation of the classic taxonomy, mapped to what is visible on-chain or on the tape:

- Pump-and-dump: accumulate quietly, ignite attention, distribute into the induced demand. Fingerprint: catalyst-timed volume from a dead tape, accumulation wallets funded from one source, distribution concentrated in minutes at the top. Net-flow-per-wallet tables assign the roles.
- Ramping / painting the tape: small trades at rising prices to print a trend, cheap because thin depth means small size moves the mark. Fingerprint: high trade count, low net flow, rising price; the amplification ratio does the manipulator's work.
- Wash trading: self-dealing volume to fake activity. Fingerprint: round-trip pairs between related wallets, volume with near-zero net flow and near-zero unique-entity count after clustering (fleets, shared funding, shared routers). Always cluster before counting participants.
- Spoofing / layering: displayed orders never meant to fill. Order-book only; impossible on an AMM because AMM quotes cannot be cancelled, which is why crypto manipulation concentrates in the other three plus oracle games.
- Cornering / squeezes as manipulation: acquiring enough float or borrow to force shorts or hedgers to buy from you. See section 5; the line between a manipulative corner and an organic squeeze is intent and concentration, and the tape shows concentration.

## 5. Squeeze anatomy

A short squeeze needs four ingredients: high short interest relative to float, rising borrow cost, a price catalyst, and forced covering (margin calls or borrow recalls) that turns shorts into buyers. It is reflexive by construction: covering raises price, which forces more covering. A gamma squeeze is the options variant: heavy near-dated call buying forces dealers who sold the calls to buy the underlying as price rises (delta hedging), so the dealers become the momentum. The two stack (the canonical memestock episodes were both at once).

Crypto expressions of the same mechanics: perpetual futures replace stock borrow, so short interest reads as negative-skewed open interest, borrow cost reads as funding rate, and forced covering reads as liquidation cascades. A squeeze in a perp market shows as: funding spiking positive, open interest falling while price rises (shorts closing, not longs opening), and liquidation clusters on the short side. Spot AMM markets cannot be squeezed this way (no shorts), but they transmit squeezes from adjacent perp or lending markets through arbitrage, and looped-collateral unwinds (recursive borrowing against the pumping asset) play the role of margin calls.

Discriminating question, squeeze vs pump: whose buying is forced? A squeeze's marginal buyer is someone losing money (a short, a dealer, a liquidator); a pump's marginal buyer is someone hoping to make money. Forced buying exhausts when positions are closed (check open interest and borrow data); hope exhausts when attention moves. The tape plus positioning data answers it.

## 6. Tokenized stocks: three prices, two clocks

Tokenized equities bolt 24/7 crypto markets onto an underlying that trades limited hours on deep, haltable order books. For one reference stock there are now up to three observable prices: the underlying U on its national exchange (roughly 6.5 hours a weekday plus extended sessions), the tokenized spot S (secondary trading 24/7, primary mint/redeem 24/5 during US market hours), and the perp F (24/7, tethered to an oracle index by funding). The mismatch between the clocks plus the funding mechanism is where basis, dislocation, and squeeze transmission live. State which of the three prices a question is about before answering it.

The landscape, verified Aug 31, 2026; re-verify quarterly, this moves fast:
- Backed Finance xStocks: 1:1 collateralized, shares custodied at Clearstream Banking and InCore Bank, weekly attestations, issued on Solana, Ethereum, Arbitrum, Mantle, TON, and Ink. Mint and redeem are gated to KYC'd (know-your-customer) participants at a $100K primary minimum, operate only 24/5 while the US market is open, and retail on secondary venues (Kraken, Bybit, Solana DEXs) cannot redeem at all. Corporate actions handled by a rebasing multiplier. Sector scale: xStocks ~$250M+ issued (early 2026); tokenized stocks overall ~$1B by end of 2025.
- Robinhood Stock Tokens: launched EU June 30, 2025 on Arbitrum One (now 2,000+ tokens), migrated to permissionless Robinhood Chain (Arbitrum Orbit L2, 100ms blocks, single Robinhood-run sequencer) at mainnet July 1, 2026, available in 120+ countries with DEXs (Uniswap, Arcus, Lighter) on-chain. Legally these are DEBT instruments issued by a Jersey subsidiary, a contractual claim on custodied shares with no shareholder rights; SEC guidance (Jan 2026) distinguishes issuer-sponsored tokenized securities from custodial-claim wrappers and scrutinizes the latter. Depth reality check: 240K new stock-token holders in 30 days but only ~$12.66M of RWA (real-world asset) market cap on the chain (July 21, 2026), so per-name on-chain depth is tiny relative to the equities.

Structural consequences, each checkable:
- Hours asymmetry: nights and weekends, the token IS the only price, formed on a sliver of the equity's depth. Weekend prints are a thin-market forecast with a huge amplification ratio, not a better price; the equity open then corrects or gaps to them.
- Halt asymmetry: when the equity halts (LULD (limit up-limit down), news pending), tokens and perps keep trading with the anchor removed. Dislocation and manipulation are cheapest during underlying halts and weekends, precisely when the mint/redeem rail is also closed.
- The arb rail is the peg: S tracks U only as well as mint/redeem works. The rail's three gates: who (KYC'd participants only), when (24/5, US market hours; closed exactly when dislocations are largest), and size ($100K minimum at Backed). Rail closed = the token floats free like a closed-end fund; premiums can run unbounded until Monday 9:30 ET.
- Squeeze spillover checklist, in order: (1) token premium to the last equity print, (2) token-side depth versus arriving flow (compute the amplification ratio), (3) is mint open (arbitrageurs can manufacture supply to sell the premium) or closed (they cannot), (4) perp funding, open interest, and liquidation clusters on the same name, (5) who provides token-side liquidity and whether they hedge on the equity venue; if they do, an equity halt or weekend forces them to widen or pull, thinning the token at the exact peak.
- Legal claim quality varies by issuer (direct collateral claim vs debt instrument vs synthetic); it does not matter minute to minute but is the whole game in an issuer stress, so name the structure in any due-diligence answer.

## 7. Task playbook

"Why did X move so much": compute depth and the amplification ratio first; most of the answer is usually there. "Is this manipulated": net flow per clustered entity, catalyst timing, role assignment (section 4 fingerprints). "Is this a squeeze": positioning data (short interest or open interest and funding), forced-buyer test (section 5). "Tokenized stock is trading weird": hours, halts, and the mint/redeem rail, in that order (section 6). Always state which venue's physics apply, and never read a 24/7 thin-market print as a forecast of the deep market's open without saying how thin it was.

## Sources (manifest candidates; cite, never reproduce)

- Harris, "Trading and Exchanges: Market Microstructure for Practitioners" (Oxford UP): the manipulation taxonomy and market-maker mechanics in section 4 are distilled from its frameworks.
- Hasbrouck, "Empirical Market Microstructure" (Oxford UP): measuring impact and flow from tapes.
- Foucault, Pagano, Roell, "Market Liquidity: Theory, Evidence, and Policy" (Oxford UP): depth and resilience, section 1's spine.
- Cartea, Jaimungal, Penalva, "Algorithmic and High-Frequency Trading" (Cambridge UP): the execution and market-making math.
- Dhawan and Putnins, "A New Wolf in Town? Pump-and-Dump Manipulation in Cryptocurrency Markets," Review of Finance (open working version on SSRN).
- Kamps and Kleinberg, "To the moon: defining and detecting cryptocurrency pump-and-dumps," Crime Science (open access).
- Milionis, Moallemi, Roughgarden, Zhang, "Automated Market Making and Loss-Versus-Rebalancing" (arXiv, open access): the rigorous form of the uncancellable-quote-ladder analogy.
- SEC microcap fraud and pump-and-dump investor alerts (sec.gov, public): the pre-crypto playbook.
