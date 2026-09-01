# deployer-intelligence

Every token screen your agent runs — price, volume, liquidity, momentum — returns identical results for a legitimate project and for the seventh launch from a wallet that abandoned the last six.
Deployer history is the only signal that distinguishes them before the chart does.
This skill is that signal.

## What it does

Resolves a Base token's deployer wallet via Routescan API. Pulls the wallet's full contract creation history. Checks each prior deployment against DexScreener for survival, liquidity, and market cap. Outputs a 0–100 deployer score.

Designed as a **veto layer**, not a buy signal. Score below threshold = hard pass, regardless of how the token looks.

## Scoring

Base score: 50 (neutral). Six adjustments:

| Signal | Condition | Weight |
|--------|-----------|--------|
| 30-day survivor | Any prior token active 30+ days | +10 |
| 7-day survivors | Per token active 7+ days | +5 each (max +20) |
| Market cap quality | Avg peak mcap > $500K | +10 |
| Fast deaths | Per token dead < 72h | -10 each (max -30) |
| Serial failure | 5+ deploys, zero 7-day survivors | -20 |
| Ghost contracts | 10+ deploys, < 30% with market data | -15 |

Range: 0–100. Details in `references/scoring-methodology.md`.

## Integration

This skill sits between inference and execution in the Bankr stack. An agent queries the LLM Gateway, gets a BUY signal, then checks whether the deployer has earned the right to be trusted.

| Score | Read | Action |
|-------|------|--------|
| 0–30 | Serial failure or rug pattern | Veto. Skip. |
| 30–50 | Unknown or mixed record | Reduce position size |
| 50–70 | Some survivors, moderate credibility | Proceed if other signals align |
| 70–100 | Proven builder | Full conviction from deployer side |

### In practice

```bash
# Install
openclaw skills install lexispawn/deployer-intelligence

# Configure
export ROUTESCAN_API_KEY="your_key"

# Scan a token's deployer
node scripts/deployer-scanner.js 0x1bc0c42215582d5A085795f4baDbaC3ff36d1Bcb

# Decision loop:
# 1. Bankr LLM returns BUY on $TOKEN
# 2. deployer-intelligence → score 22 → veto, next token
# 3. Next candidate → score 71 → proceed to position sizing
```

## Data sources

- **Routescan API** — `getcontractcreation`, `txlistinternal` (Base chain 8453)
- **DexScreener API** — token pairs, mcap, liquidity, volume, pair age

## Limitations

**ERC-4337 wallets.** Most 2026 Base tokens deploy via Account Abstraction. UserOp-embedded deployments are invisible to `txlistinternal`. These deployers return 0 history.

**Dead-on-arrival tokens.** Contracts that never got a DexScreener pair are counted but not scored.

**No time weighting.** A token that died six months ago penalizes the same as one that died yesterday.

**Base only.**

## Install

Requires Node.js 18+ and a [Routescan API key](https://routescan.io/api) (free tier).

```bash
openclaw skills install lexispawn/deployer-intelligence
```

## Author

Built by [Lexispawn](https://lexispawn.xyz) · [@lexispawn](https://x.com/lexispawn)
Part of the 15 MINDS intelligence system on Base.

## License

MIT
