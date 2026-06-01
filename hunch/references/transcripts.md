# Worked transcripts

### 1. Cashtag → bet

> **user:** @bankrbot take YES on $BNKR hitting $100M, $5

1. `GET /api/partner/discover?q=$BNKR` → match `bankr-100m-mcap-2026-06-30`.
2. `GET /api/partner/quote?marketId=bankr-100m-mcap-2026-06-30&side=yes&sizeUsd=5`
   → YES 12¢, fee 2%.
3. Reply:
   > **Will $BNKR reach a $100M market cap by June 30, 2026?**
   > YES 12¢ · NO 88¢ · closes Jun 30
   > _Resolves from DexScreener market cap on Base. Not financial advice._
   > [Take YES] [Take NO]
4. On confirm → `POST /api/partner/trade` (x402, `idemKey`=mention id, `ref=bankr`)
   → receipt + `proofUrl`.

### 2. Raw post → claim-LLM

> **user:** (quoting a post) "bankr launchpad is cooking, gonna pass pump.fun this week fr"

1. `GET /api/partner/discover?post=<text>` → claim-LLM extracts facets
   (`$BNKR`, launchpad, volume) → match `bankr-pumpfun-3d-…`.
2. Quote + reply with `launchpad-race` disclosure. Confirm → trade.

### 3. Silence (no offer)

> **user:** "gm frens, wagmi"

`discover` → `count: 0`. **Reply normally; offer no market.** Same for opinions
("$X is going to zero lol"), settled facts, and airdrop/scam shills.

### 4. Browse

> **user:** @bankrbot what can I bet on about launchpads?

`GET /api/partner/catalogue` → render the `launchpad-race` group (questions +
deadlines), each with its disclosure line. User taps one → quote → trade.

### 5. Multi-market (one token, several markets)

> **user:** @bankrbot what can I bet on about $LFI?

1. `GET /api/partner/discover?q=$LFI` → ≥2 exact matches, ranked deterministically
   (e.g. the `$LFI` strike-ladder **and** the "Will $HUNCH flip $LFI?" market).
2. List each: question · live odds · deadline · disclosure. User taps one → quote
   → trade. (Discovery indexes both sides of a flip, so the token's flip market
   surfaces as an exact match, not a weak lexical one.)

---

## Proactive injection — fire vs silent

These are the **unprompted** cases (the user didn't ask to bet). Run
`GET /api/partner/discover?post=<message>` first; only the non-silent ones get a
market appended. See SKILL.md → "Proactive injection".

### Fire 1 — price / TA question

> **user:** what's $BNKR looking like today?

1. Answer the price/TA normally.
2. `discover?post=...` → `count > 0` → top match `bankr-100m-mcap-2026-06-30`.
3. `quote?marketId=…` → read `tokenSnapshot` (e.g. current ~$52M, target $100M).
4. Append **one** line:
   > Want skin in the game? **Will $BNKR reach $100M by Jun 30?** — it's ~$52M
   > now (+92% to go). YES 12¢ · NO 88¢. _Resolves from DexScreener mcap on Base.
   > Not financial advice._ [Take YES] [Take NO]

### Fire 2 — comparison / "will it beat" question

> **user:** you think bankr passes pump.fun on volume this week?

`discover?post=...` → launchpad-volume match → append the `bankr-pumpfun-…` market
with its odds + `launchpad-race` disclosure. The bet *is* the answer to "you think".

### Fire 3 — chart hype about a token with a ladder

> **user:** $LFI chart looks ready to send fr

`discover?post=...` → `$LFI` strike-ladder match → append it ("pick the closing
range"), one line, with disclosure.

### Silent 1 — greeting

> **user:** gm frens, wagmi 🌞

`discover?post=...` → `silent: true`. **Reply normally. Append no market.**

### Silent 2 — settled / historical fact

> **user:** what was $BNKR's all-time high?

Answer the fact. `discover?post=...` → silent (no resolvable *future* claim).
**No market.**

### Silent 3 — scam / airdrop shill

> **user:** 🚀 free $AIRDROP, claim now at sketchy-link.xyz

`discover?post=...` → silent (scam/airdrop gate). **Never offer a market**, never
echo the link.

---

## Track + result

### 6. Portfolio lookup

> **user:** @bankrbot show my Hunch bets

1. `GET /api/partner/positions?wallet=<the user's paying wallet>`.
2. Render the summary + each position:
   > **Your Hunch bets** (1 open · 1 resolved · PnL +$1.42)
   > • **$BNKR → $100M** — YES, $5 @ 12¢ → 15¢ · +$1.25 · open
   > • **$HUNCH flips $LFI** — YES, $3 · resolved-lost

Unknown wallet / no bets → empty list; reply "no Hunch positions yet" + offer
`discover`.

### 7. Result read

> **user:** @bankrbot did the $HUNCH $10M market resolve?

1. `GET /api/partner/result?marketId=hunch-10m-mcap-2026-05-31`.
2. `status: "resolved"` → report outcome + payout + proof:
   > **Resolved: NO.** $HUNCH didn't reach $10M (closed ~$142K). Winning shares
   > paid $1.00 each. Proof → playhunch.xyz/markets/hunch-10m
3. `status: "pending"` → "still open, resolves <deadline>"; offer to bet.
