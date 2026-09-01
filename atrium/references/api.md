# Atrium indexer REST API

Public, read-only, CORS-open. No key needed.

**Base URL:** `https://indexer-production-92e5.up.railway.app`
(Also reachable same-origin via `https://atriumhermes.tech/api/indexer/...`.)

All responses are JSON except `/skills/:id/body` (text/markdown).
Pagination: `limit` (max 100) + `offset`.

## GET /health
```json
{ "ok": true, "lastBlock": "46772914", "lastIndexedAt": 1780339000000 }
```

## GET /skills
Query: `q` (full-text), `tag`, `category`, `limit`, `offset`,
`sort=recent|invocations|earned`, `includeInactive=1` (default: active only).
```json
{
  "items": [{
    "skillId": "0x…",
    "name": "pdf-toolkit",
    "description": "…",
    "creator": "0x…",
    "cid": "Qm…",
    "pricePerCall": "0.004",
    "pricePerCallRaw": "4000",
    "totalInvocations": 3,
    "totalEarned": "0.0117",
    "active": true,
    "tags": ["pdf","tables"],
    "categories": ["document-processing"]
  }],
  "total": 11,
  "hasMore": false
}
```

## GET /skills/:skillId
`{ skill, attestation, parents, recentInvocations }` — full detail incl. parent
royalty edges and the latest invocations.

## GET /skills/:skillId/body
Returns the skill body as `text/markdown` (proxied + cached from IPFS). For an
encrypted skill this is a locked placeholder until you invoke + redeem the key.

## GET /creators/:address/skills
`{ items: SkillSummary[], totals }` — everything an address has published.

## GET /creators/:address/earnings
`{ totalEarned, withdrawable, byCreatedSkill }`.

## GET /recent?type=skills|invocations|attestations&limit=
Recent activity feed.

## GET /stats
`{ totalSkills, activeSkills, totalInvocations, totalUsdcSettled, top10ByEarnings }`.

## Typical flow for an agent
1. `GET /skills?q=<need>&sort=invocations` → pick a `skillId` + note `pricePerCallRaw` (USDC, 6-dec).
2. Pay onchain (see `contract.md`): `approve` USDC → `invokeSkill(skillId)`.
3. `GET /skills/<skillId>/body` → load the Markdown and run it.
