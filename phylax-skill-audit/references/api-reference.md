# Phylax API Reference

## Hosted audit endpoint (fast — free)

```
POST https://usephylax.com/api/audit
Content-Type: application/json
```

### Request body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `skill_source` | string | yes | GitHub-style path or HTTPS URL to SKILL.md |
| `skill_md` | string | no | Raw SKILL.md content (skips remote fetch) |
| `contracts` | string[] | no | `0x... (chainId:8453)` — auto-extracted if omitted |
| `endpoints` | string[] | no | HTTPS URLs — auto-extracted if omitted |
| `chain_id` | number | no | Default `8453` (Base) |
| `mode` | string | no | `fast` only on free tier |

### Response

```jsonc
{
  "skill": "github.com/owner/repo/SKILL.md",
  "verdict": "ALLOW",       // ALLOW | WARN | DENY
  "score": 97,              // 0–100
  "findings": [
    { "id": "PI-001", "severity": "Critical", "message": "...", "evidence": "..." }
  ],
  "summary": "One-paragraph human summary.",
  "ttl": "24h"
}
```

Rate limit: 20 requests/min per IP.

`GET https://usephylax.com/api/audit` returns self-describing usage docs.

### Deep mode → HTTP 402

Requesting `mode=deep` on the free API returns **402** with the Bankr x402 endpoint URL and pricing.

## Deep audit (x402 — $0.05 USDC)

Bankr x402 collects payment; the handler proxies to Vercel with a shared internal key (rules + Base RPC run on `usephylax.com`, not in the x402 sandbox). See `x402/README.md`.

```
POST https://x402.bankr.bot/0x7fc2987df6e0fb7567d64838696a5bac4d220b91/audit-deep
```

Same request fields (`skill_source`, optional `skill_md`, `contracts`, `endpoints`, `chain_id`). Always deep mode. Payment via x402 on Base.

- Terminal: https://bankr.bot/terminal/x402
- Docs: https://docs.bankr.bot/x402-cloud/overview/

## Verdict badge

```
GET https://usephylax.com/api/badge?skill=owner/repo&mode=fast
```

Returns SVG: `phylax | ALLOW 97`

## Security (v0.2.3+)

- Blocks SSRF targets (localhost, private IPs, cloud metadata)
- Requires HTTPS for remote fetches in production
- Rejects local file paths as `skill_source` on hosted API
- Validates redirect chains on endpoint probes
- **PI-006:** flags GitHub Actions script injection (`github.event` interpolated into shell)
- Live playground: https://usephylax.com/#playground

## npm / CLI

```bash
npx phylax@0.2.3 --skill ./SKILL.md
npx phylax@0.2.3 --skill ./SKILL.md --mode deep   # local deep (free)
```

Exit codes: `0` = ALLOW, `1` = WARN, `2` = DENY

## Bankr positioning

Phylax is a **security layer** for skills and x402 endpoints on Bankr — complements x402 Cloud, does not compete.
