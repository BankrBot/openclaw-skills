# Bankr catalog submission — x402-precheck

## One-line catalog description (for the README table row)

**x402agentic · precheck** — Pre-pay risk firewall for x402 agents, the flagship
of the x402 Agentic payment-trust suite. Before paying any x402 endpoint, get an
allow/warn/block verdict: validates the payee, screens it against the OFAC
sanctioned-address list, flags price gouging, checks asset/network, and enforces
your spend policy. Companion endpoints: `/screen`, `/spend-guard`, `/token-check`, `/verify-payment`, `/reputation`.
From $0.01 USDC/call on Base (precheck $0.10, verify-payment $0.05, screen/token-check/reputation $0.02, spend-guard $0.01).

## Install string (works from any public repo, once pushed)

```
install the x402-precheck skill from https://github.com/<your-org>/x402agentic-firewall/tree/main/skill
```

After the catalog PR is merged, it also resolves from the official catalog:

```
install the precheck skill from https://github.com/BankrBot/skills/tree/main/x402agentic/precheck
```

## PR description (paste into the BankrBot/skills pull request)

Adds a new provider `x402agentic` with one skill, `precheck`.

**What it does:** a pre-pay risk gate for autonomous agents. An agent calls it
right before settling any x402 payment and receives an allow/warn/block verdict
with a 0–100 risk score and itemized reasons. Checks: envelope integrity, payee
address validity, denylist screen, community-flagged reports, price-vs-category
gouging, absolute ceiling, asset/network sanity, facilitator reputation, and the
caller's own spend policy.

**Hosting:** self-hosted on Cloudflare Workers, x402-paid (from $0.01 USDC; precheck $0.10),
settled via the Coinbase CDP facilitator on Base mainnet. The service hosts six
endpoints — `/precheck` (full risk verdict), `/screen` (focused OFAC check),
`/spend-guard` (per-agent budget enforcement), `/token-check` (canonical asset
verification), `/verify-payment` (on-chain settlement proof), and `/reputation`
(payee reputation score) — each `discoverable: true` with the x402 Bazaar extension.

**Live endpoints:**
- https://api.x402agentic.ai/precheck
- https://api.x402agentic.ai/screen
- https://api.x402agentic.ai/spend-guard
- https://api.x402agentic.ai/token-check
- https://api.x402agentic.ai/verify-payment
- https://api.x402agentic.ai/reputation

**Homepage:** https://x402agentic.ai

No Bankr API key or wallet write access required to use — the consuming agent
pays per call from its own wallet through the standard x402 flow.
