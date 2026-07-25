# AI2Human Task Router Bankr Skill

This folder is the Bankr-ready skill package for AI2Human.

The skill teaches an agent how to create and track AI2Human human-execution
tasks:

```text
agent request -> human execution -> structured proof -> verification -> settlement
```

## Files

- `SKILL.md` — the Bankr skill to submit or install from GitHub.
- `catalog.json` — Bankr catalog metadata for discovery and installation.
- `references/payment-policy.md` — fixed x402 payment terms and confirmation rules.
- `examples/mobile-page-review.json` — remote UI / landing-page review input.
- `examples/local-price-check.json` — reality-bound local verification input.
- `examples/x-community-proof.json` — X/community proof verification input.
- `scripts/smoke.mjs` — endpoint smoke test.

## Install From GitHub

Once merged, tell a Bankr/OpenClaw-style agent:

```text
install the ai2human-task-router skill from https://github.com/BankrBot/skills/tree/main/ai2human-task-router
```

## Smoke Test

```bash
node integrations/bankr-ai2human-task-router/scripts/smoke.mjs
```

The smoke test only validates the x402 challenge by default. It does not create
a task or incur an x402 charge.

Creating an API-key smoke task is explicit and may create a real task:

```bash
AI2HUMAN_API_KEY="a2h_live_..." \
AI2HUMAN_CREATE_SMOKE_TASK=1 \
node ai2human-task-router/scripts/smoke.mjs
```

Keep `AI2HUMAN_API_KEY` in the approved secret store only. Do not paste it into
chat, issue comments, screenshots, or task content. The x402 check does not
require an API key; the optional API-key create test does.

For a local mock endpoint only, set `AI2HUMAN_BASE_URL=http://localhost:<port>`
and also `AI2HUMAN_ALLOW_LOCAL_KEY=1`. The script rejects every non-local URL
override and never permits one by default.

## Submission Scope

Bankr v1 should be submitted as:

```text
AI2Human Task Router
```

Scope:

- Create a human-execution task.
- Return `taskUrl`, `statusUrl`, and `proofSchema`.
- Make the async boundary explicit.

Out of scope for v1:

- Fully automated reward-campaign funding.
- Immediate human proof delivery.
- Automatic final settlement without proof verification.
