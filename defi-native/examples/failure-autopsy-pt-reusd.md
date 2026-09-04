# Failure autopsy: the PT-reUSD liquidation cascade (August 25, 2026)

A real, verified event, analyzed with this skill's tools. Use this file to learn how the taxonomy catches things, and as the shape to imitate when a user asks "what happened with X".

## The facts (verified against primary reporting)

Between 04:28 and 04:37 UTC, one wallet routed roughly $320,000 into eleven consecutive Pendle trades converting SY-reUSD into over 9.5M YT-reUSD. Buying YT lifts implied yield and cheapens PT (the identity: PT + YT approximately equals the underlying). The burst pushed the market's implied annual yield past 20% and cut PT-reUSD's mark about 3%. The Morpho market pricing that PT used min(15-minute market TWAP, fixed ~6% discount curve) as its oracle, so the TWAP leg followed the shove. Between 04:37 and 04:51, 33 liquidation events repaid $36.14M of debt from loopers holding PT at high loan-to-value. The protocol took no bad debt; the attacker cleared at least $360K; the borrowers ate the losses. Pendle's clarification was accurate and is the lesson: the oracle worked as designed. Design working as designed is not the same as borrowers surviving it.

## Run it through the skill

Oracle class (concepts 13): class 3, market TWAP of the token itself, with a class 4 cap (min with the discount curve). The taxonomy's questions would have surfaced the exposure ex ante: what can move the mark? Answer: the PT's own thin pool, at a cost any funded attacker can pay. What percentage move liquidates at max LTV? About 3%, reachable with ~$320K. Can liquidations fire on the tape humans see? Yes: which is why this was a borrower wipeout, not a protocol insolvency (contrast Resolv, where a blind class 2 oracle meant liquidations never fired and the protocol layer ate it).

Failure shapes (concepts 9): PT-looping at ~1.01 to 1.03 health factor on a TWAP mark, plus thin-pool manipulation. The checklist rows that catch it: "buffer at advertised max LTV (pct move to liquidation)" and "max implied yield of the Pendle pool (TWAP lower bound)".

The distribution of losses follows the oracle class: visible-tape oracles put losses on levered borrowers; blind oracles put losses on lenders and the protocol. Neither is "safe"; they choose different victims.

## The ex-ante questions that would have priced this

1. What does the oracle read, and what does it cost to move it 3%?
2. Who loops this PT, at what health factor, in what size, versus the pool's depth?
3. Is the min(curve, TWAP) switch documented, and which leg binds today?
4. If I am the lender: do I want borrowers who can be liquidated by $320K of hostile flow?

Sources: CryptoBriefing, CryptoTimes, Pendle's post-incident clarification, Allez Labs incident notes (all August 25-26, 2026).
