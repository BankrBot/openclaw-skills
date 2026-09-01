---
name: polymarket-context
description: |
  Live Polymarket odds for any real-world event your agent is reasoning about, returned as ZER0's
  superforecaster read: the current market-implied probability, a base rate, and whether the price
  looks mispriced. Read-only market intelligence, no keys, no wallet, no trades. Use it when an
  agent needs a grounded, market-implied probability for a future event (elections, crypto prices,
  policy, macro, sports) instead of guessing from priors.
  Triggers: "what does Polymarket say about X", "what are the odds on X", "is X priced in",
  "is there a market on X", "scan Polymarket for mispriced markets".
---

# polymarket-context

ZER0 ([atzer0.xyz](https://atzer0.xyz)) is an autonomous superforecaster that lives on Polymarket.
This skill drops ZER0's read into your agent's context: given any event the agent is thinking about,
it finds the relevant prediction market, pulls the live price, and frames it the way ZER0's brain
does: base rate, mispricing test, and an honest side + conviction call.

Everything runs off Polymarket's public Gamma API. No API key, no wallet, no trades. Context only.

## When to use
- The agent is reasoning about a future event and wants the market-implied probability.
- A user asks "what are the odds on X" or "is X already priced in".
- You want to check a narrative against the money: does the market agree with the discourse?

## Signal sources
1. **Find the market** with Gamma full-catalog search:
   `GET https://gamma-api.polymarket.com/public-search?q=<topic>&limit_per_type=20&events_status=active`
   Results come back as events with nested `markets[]`. Pick the binary (Yes/No) market whose
   question best matches the event; drop legs that are closed, archived, or non-binary.
2. **Or scan for mispricing** with the discovery feed (top markets, no query):
   `GET https://gamma-api.polymarket.com/markets?active=true&closed=false&archived=false&enableOrderBook=true&limit=100`
3. **Read the fields.** Note: `outcomes`, `outcomePrices`, and `clobTokenIds` arrive as JSON-encoded
   strings, so parse them to arrays first.
   - `question`, `outcomes`, `outcomePrices` (the **Yes** price is the implied probability)
   - `liquidity`, `volumeNum` / `volume24hr`, `endDate`, `resolutionSource`, `category`

## Filters (only speak to clean markets)
- Liquidity > $5k, 24h volume > $1k.
- Binary Yes/No only, with a price between 0.05 and 0.95 (skip near-resolved markets).
- Resolution must be deterministic: a named, verifiable source (AP race call, FOMC statement,
  on-chain price, official vote tally). Skip subjective markets ("will X be *successful /
  meaningful / permanent*") and routine sports fixtures.
- Resolves roughly 6 hours to 45 days out.

If nothing clean matches, say so ("no liquid Polymarket market on this") rather than stretching to a
bad match.

## The read (how ZER0 frames it)
Reason like Tetlock's best superforecasters, briefly:
1. **Base rate** from comparable past events (the outside view).
2. **Inside view**: what's specific to this market that moves it off the base rate.
3. **Strongest disconfirming evidence**, considered before committing.
4. **Edge test**: only call a side if your estimate differs from the market price by more than
   10 percentage points. Otherwise it's fairly priced and the answer is "no edge".
5. Stay honest about uncertainty; conviction above ~0.9 is rarely warranted.

## Output
Return a compact context block per market. ZER0's voice: direct, specific, no hedging, tweet-shaped
reasoning — one load-bearing reason, no preamble.

```
MARKET: <question>
  price: Yes <p> / No <1-p>   (implied <p x 100>% Yes)
  liquidity: $<liq>  vol 24h: $<vol>  resolves: <date> (<source>)
READ: <SIDE or NO EDGE>  conviction <0.0-1.0>
  <one line: my estimate vs the price, and the single reason it moves me>
```

Example:

```
MARKET: Will the Fed cut rates at the June 2026 meeting?
  price: Yes 0.18 / No 0.82   (implied 18% Yes)
  liquidity: $240,118  vol 24h: $61,402  resolves: 2026-06-17 (FOMC statement)
READ: NO EDGE  conviction 0.30
  18% matches my read. Hot CPI and no dot-plot signal; a cut needs a labor shock that isn't in the data. Fairly priced, no trade.
```

## Rules
- **Read-only.** Never instruct anyone to place a trade, size a position, or move funds. This is
  market context, not advice.
- Not financial advice; educational use. Polymarket trading is geo-blocked in some regions (US, UK,
  France, and others).
- Quote real numbers from Gamma. Never invent a price, volume, or resolution date.
- If a market's resolution is subjective, or the event isn't covered, say so instead of forcing a
  take.
- No essays, no preamble like "Looking at this market...", one load-bearing reason per read.

---
Built by **ZER0**, an autonomous superforecaster on Polymarket. https://atzer0.xyz
MIT licensed, paper-trade / research only.
