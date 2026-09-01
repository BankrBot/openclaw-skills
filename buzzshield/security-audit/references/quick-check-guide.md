# BuzzShield V6 — Quick Check Usage Guide

A practical guide to running pre-trade security scans, interpreting results, and respecting the limits of any pre-flight scanner.

## How to Run a Pre-Trade Scan

### EVM (Ethereum, Base, Arbitrum, Optimism, BSC)

Web UI:

```
https://shield.buzzbd.ai
```

Paste the contract address. Pick the chain. Hit scan. The Quick Check (H.2c) returns in seconds; Deep Audit takes 20–30 minutes.

API (read-only, no auth):

```bash
curl -X POST https://api.buzzbd.ai/api/v1/buzzshield/scan \
  -H "Content-Type: application/json" \
  -d '{"address":"0xABCDEF...", "chain":"base", "depth":"quick"}'
```

Set `"depth":"deep"` for the full 12-phase analyzer. Deep audits queue and return a `scanId` you can poll.

### Solana

```bash
curl -X POST https://api.buzzbd.ai/api/v1/buzzshield/scan \
  -H "Content-Type: application/json" \
  -d '{"address":"BNS48CGg...Zn9A", "chain":"solana", "depth":"quick"}'
```

For native programs the scanner pulls the IDL and binary, decompiles when source isn't published, and matches against Pattern A–H Solana variants (mostly G.x capability injection and B.x identity trust on Anchor accounts).

### What you can ask in conversation

```
"scan 0xABC... on base"
"is BNS48...Zn9A safe to swap into?"
"check 0xDEF... for uninitialized admin"
"deep audit 0xGHI... on arbitrum"
```

## Risk Levels

| Level        | Meaning                                                                           | What to do                                                          |
| ------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **SAFE**     | No known patterns matched. No high-confidence findings.                           | Standard caution still applies — SAFE is not insurance.             |
| **LOW**      | Minor anti-patterns flagged, no exploit path identified.                          | Proceed with normal due diligence.                                  |
| **MEDIUM**   | Plausible vulnerability detected, no working PoC.                                 | Scan with `depth=deep`. Don't size up until reviewed.               |
| **HIGH**     | High-confidence vulnerability with sketched exploit path. Skeptic layer accepted. | Do not interact with significant size. Wait for fix or move on.     |
| **CRITICAL** | Exploit path verified, asymmetric cost in Skeptic met.                            | **Do not interact.** Report to the project team if it's a live bug. |

CRITICAL findings cannot be REJECTed by LLM review alone — they always escalate. HIGH requires Skeptic confidence ≥ 0.97 to be REJECTed (asymmetric cost: a real bug costs more than a noisy ACCEPT).

## Limitations

- **Source code required for full coverage.** Verified-on-explorer contracts get the deepest analysis. Unverified bytecode falls back to symbolic execution + heuristic, which catches less.
- **Anti-patterns are not exploits.** A pattern match means _this looks like a class of bug we've seen before_ — it does not always mean an attacker can drain funds today. Pre-trade scans are triage, not guarantees.
- **Off-chain trust patterns (Class H) need protocol context.** A single-DVN finding on a canonical bridge config might be intentional; the same config on a brand-new project is a red flag. The scanner reports the finding; humans (or follow-up audits) judge intent.
- **Capability injection (Class G) hides in upgrade paths.** A safe deployed contract today can become a Grok-class G.1 victim tomorrow if an upgrade adds an NFT-gated capability. Re-scan after every proxy upgrade.
- **Solana programs without IDL get a degraded scan.** Reach out and we'll prioritise IDL fetch via Anchor explorer.
- **No financial advice.** A SAFE result is not a buy recommendation; a CRITICAL is not a short setup. Use scans to avoid unforced losses, not to size positions.

## Disclaimers

- BuzzShield reports observations, not legal opinions. Findings are not endorsements or condemnations of any project, team, or token.
- Free public scans are best-effort; we make no SLA on response time.
- API access via x402 micropayment (USDC on Base) ships with explicit SLOs once available.
- Known false positives are tracked publicly in the Layer 9 feedback ledger; submit a counter-finding via the API and we'll recalibrate Skeptic.
- Built by an autonomous agent (Buzz, running Claude Opus 4.7) and verified by human review on CRITICAL findings before public posting.

## When to escalate to a Deep Audit

- Token TVL > $1M and you're sizing > 1% of TVL
- Contract was deployed in the last 7 days (speedrunner window)
- Contract was upgraded in the last 24 hours (Watchman window — re-scan)
- Quick Check returned MEDIUM or HIGH
- The protocol fits the high-bounty target profile (complex, innovative, under-audited)

Deep audits run all 9 layers (inventory, semgrep, Pashov, Skeptic, Z3, Pentest, Reporter, Amplifier, Feedback) and produce a submission-ready Markdown report.

---

Last updated: 2026-05-07
