---
name: aeon-schedule-ads
description: |
  Schedule paid ads across Meta / TikTok / Snapchat / Pinterest / LinkedIn via the AdManage.ai API,
  driven by a declarative config file. Launches PAUSED by default — never auto-activates live
  spend. Use when an agent should drive paid acquisition without manual click-throughs and without
  the risk of auto-spend mistakes.
  Triggers: "schedule ads", "launch this campaign", "pause ad set X", "set up Meta ads",
  "create ads across platforms".
---

# aeon-schedule-ads

Agent-driven paid marketing across Meta, TikTok, Snapchat, Pinterest, and LinkedIn — all through one declarative config, executed via the AdManage.ai API. Critically, everything launches **PAUSED by default**. The agent never spends money without explicit human activation.

## Why PAUSED-by-default

Live ad spend has no idempotency. A second run of a skill that auto-activates is a second budget burned. The skill provisions campaigns, creatives, and audience targeting, but launching live spend is a separate, explicit operator action.

## Config

```yaml
campaigns:
  - id: "q2-launch-base"
    platforms: [meta, tiktok]
    objective: "TRAFFIC"        # or CONVERSIONS, ENGAGEMENT, etc.
    budget_daily_usd: 25
    geo: ["US", "CA"]
    age: "25-44"
    placements: ["feed", "stories"]
    creatives:
      - type: "single_image"
        image_url: "https://..."
        primary_text: "..."
        headline: "..."
        cta: "LEARN_MORE"
        destination: "https://..."
      - type: "video"
        video_url: "https://..."
        ...
    state: paused              # always paused on creation
```

Each campaign maps to N platform-specific ad sets and creatives. The skill resolves the cross-platform mapping at provision time.

## Operations

| Operation | Description |
|---|---|
| `provision` | Create the campaigns + ad sets + creatives on each platform in PAUSED state. Write IDs back to state. |
| `dry-run` | Print the plan without creating anything. |
| `status` | Pull current state of every provisioned campaign — paused, active, completed, rejected. |
| `pause --campaign=ID` | Pause an active campaign. |
| `report --campaign=ID` | Pull performance metrics. |

`activate` is intentionally **not** an operation in this skill. Live activation happens through the AdManage.ai dashboard or via a separate, explicit `aeon-activate-ads` skill that requires operator authorization.

## AdManage.ai API surface

```bash
# Create a campaign (returns IDs for the cross-platform entities)
curl -fsS -X POST "https://api.admanage.ai/v1/campaigns" \
  -H "Authorization: Bearer ${ADMANAGE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "q2-launch-base",
    "platforms": ["meta", "tiktok"],
    "objective": "TRAFFIC",
    "budget_daily_usd": 25,
    "state": "paused",
    ...
  }'

# Status check
curl -fsS "https://api.admanage.ai/v1/campaigns/${id}" \
  -H "Authorization: Bearer ${ADMANAGE_API_KEY}"

# Pause
curl -fsS -X POST "https://api.admanage.ai/v1/campaigns/${id}/pause" \
  -H "Authorization: Bearer ${ADMANAGE_API_KEY}"
```

## State file

`state/ads-schedule.json`:

```json
{
  "campaigns": {
    "q2-launch-base": {
      "provisioned_at": "2026-05-12T10:00:00Z",
      "state": "paused",
      "platform_ids": {
        "meta": {"campaign_id": "...", "adset_ids": ["..."]},
        "tiktok": {"campaign_id": "...", "adset_ids": ["..."]}
      },
      "creative_ids": ["...", "..."]
    }
  }
}
```

Idempotent — re-running `provision` against an existing config ID is a no-op for already-created entities.

## Output

```
*Schedule Ads — provisioned 2026-05-12*

Campaign: q2-launch-base
  Platforms: meta, tiktok
  Budget: $25/day across both
  Objective: TRAFFIC
  State: PAUSED (review before activating)
  Provisioned entities:
    meta: 1 campaign, 2 ad sets, 4 creatives
    tiktok: 1 campaign, 1 ad set, 2 creatives

  Activate at: https://app.admanage.ai/campaigns/...
  Or: aeon-activate-ads --campaign=q2-launch-base

⚠ Live spend requires explicit activation. The skill has not started any spend.
```

## Guardrails

- **PAUSED by default.** No exceptions.
- **No `activate` operation in this skill** — separated for blast radius isolation.
- **Idempotent provisioning** — re-runs don't duplicate campaigns.
- **Budget caps** — declared per campaign. Total fleet-wide spend is monitored by `aeon-spend-monitor` (paired skill).
- **Geo / age targeting** — required, never empty. Eliminates an entire class of misconfiguration.

## Required keys

`ADMANAGE_API_KEY` — AdManage.ai dashboard, account-level.

## Pairs with

- `aeon-spend-monitor` (running weekly spend vs budget cap).
- `aeon-create-campaign` (generates the config from a brief).
- `aeon-operator-scorecard` (weekly economic-layer aggregate).
