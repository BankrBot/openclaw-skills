---
name: agent-wormhole
description: Use Agent Wormhole for one-time sealed handoffs between autonomous agents, including encrypted mission briefs, scoped secrets, temporary artifacts, receipts, config drops, CLI/API usage, ECHO holder access, and Bankr x402 paid opens.
emoji: 🕳️
tags: [agents, handoff, encrypted, x402, base, echo]
visibility: public
---

# Agent Wormhole

Agent Wormhole opens a temporary encrypted passage for agent handoffs. The payload can be claimed once, then the channel collapses.

## Links

- Website: `https://www.builtbyecho.xyz`
- Product page: `https://www.builtbyecho.xyz/agent-wormhole.html`
- Source: `https://github.com/BuiltByEcho/agent-wormhole`
- Package: `https://www.npmjs.com/package/@builtbyecho/agent-wormhole`
- Hosted skill file: `https://www.builtbyecho.xyz/skills/agent-wormhole/SKILL.md`

Use this skill when a task involves:

- sending or receiving one-time agent handoffs
- passing mission briefs, configs, receipts, files, or scoped secrets
- using the `agent-wormhole` CLI or HTTP API
- checking ECHO holder sponsored access
- checking Bankr x402 paid open status
- deploying or operating the VPS service

## Quick Commands

From a project that has the package installed:

```bash
agent-wormhole send --text "mission brief" --ttl 10m
agent-wormhole send --file ./artifact.tgz --note "handoff bundle"
agent-wormhole inspect <code>
agent-wormhole receive <code> --out ./received
agent-wormhole cleanup --delete-claimed-older-than 15m
```

For one-off use without installing globally:

```bash
npx @builtbyecho/agent-wormhole send --text "mission brief"
```

## Mental Model

- Codes are `id.secret`.
- `id` locates stored metadata.
- `secret` derives the AES-256-GCM decrypt key and is not stored.
- Default TTL is 10 minutes.
- Max TTL is 24 hours unless explicitly configured lower.
- Default max payload is 5 MB.
- Receipts are written for opens and claims.

## Access Paths

- Local CLI/library opens record `access.path = local`.
- Direct API holder opens require an EIP-191 signature from a wallet holding at least `50,000,000 ECHO` on Base and record `access.path = echo_holder`.
- Bankr x402 paid opens are handled by `agent-wormhole-open` and record `access.path = x402_paid`.
- Claiming is free.

## Live Endpoints

- Direct holder/API route: `https://storage.builtbyecho.xyz/agent-wormhole`
- Bankr x402 paid open: `https://x402.bankr.bot/0x2a16625fad3b0d840ac02c7c59edea3781e340ae/agent-wormhole-open`
- Self-hosted local service default: `http://127.0.0.1:8791`

## Verification

From the package root:

```bash
npm test
node --check src/cli.js
node --check src/index.js
node --check src/server.js
npm pack --json --dry-run
```

For live health:

```bash
curl -sS https://storage.builtbyecho.xyz/agent-wormhole/health
```

For Bankr status, check both registry and execution:

```bash
bankr --config "$BANKR_OWNER_CONFIG" x402 list
bankr x402 schema https://x402.bankr.bot/0x2a16625fad3b0d840ac02c7c59edea3781e340ae/agent-wormhole-open
bankr --config "$BANKR_PAYER_CONFIG" x402 call -X POST -d '{"payload":"dGVzdA=="}' --max-payment 0.01 -y --raw https://x402.bankr.bot/0x2a16625fad3b0d840ac02c7c59edea3781e340ae/agent-wormhole-open
```

Set `BANKR_OWNER_CONFIG` to the endpoint owner/operator config and `BANKR_PAYER_CONFIG` to a separate payer config. Do not treat registry active status alone as proof that paid x402 execution works. A real paid call from a non-owner wallet is the proof.

## Safety

- Do not paste wormhole codes into public channels unless the user explicitly wants the payload claimable by anyone there.
- Do not log plaintext secrets or payloads.
- Prefer short TTLs for secrets.
- Use local cleanup commands for received artifacts when they are no longer needed.
- Do not test Bankr paid endpoints with the same wallet that owns/deployed the endpoint.
