# Webhooks Reference

Deploy your own TypeScript handlers that turn an external event into a Bankr agent run. A Slack message, a GitHub push, a Stripe event, or anything that can POST to a URL becomes a prompt the agent executes on your wallet.

Managed with `bankr webhooks` (or `/webhooks/*` over REST). This is a sibling of [x402 Cloud](x402-cloud.md) — same deploy/list/logs/env shape, minus the pricing and revenue semantics.

## How It Works

1. You write a handler in TypeScript and deploy it with `bankr webhooks deploy`
2. Bankr gives it a public trigger URL: `https://webhooks.bankr.bot/u/<walletAddress>/<name>`
3. The external service POSTs to that URL
4. **Your handler verifies the request** and returns `{ prompt, threadId?, context? }`
5. The Bankr agent runs that prompt on your wallet

Returning anything else — a `401`, a plain `Response`, nothing at all — means no agent run. Verification failures never reach the agent.

## CLI Commands

```bash
bankr webhooks init                      # Scaffold webhooks/ + bankr.webhooks.json
bankr webhooks add notify                # Add a handler (generic template)
bankr webhooks add slack-bot --provider slack   # slack | github | stripe | generic
bankr webhooks deploy                    # Deploy every handler in the config
bankr webhooks deploy notify             # Deploy just one
bankr webhooks list                      # List deployed webhooks
bankr webhooks logs notify               # Recent invocations
bankr webhooks pause notify              # Stop accepting triggers
bankr webhooks resume notify             # Resume
bankr webhooks delete notify             # Delete (cannot be undone)

bankr webhooks env set SLACK_SIGNING_SECRET=...   # Encrypted env vars
bankr webhooks env list                           # Names only, never values
bankr webhooks env unset SLACK_SIGNING_SECRET
```

## Handler Contract

```typescript
export default async function handler(req: Request): Promise<Response> {
  // 1. Verify the request came from who you think it did
  // 2. Return the prompt for the agent to run
  return Response.json({
    prompt: "Summarize the deploy that just went out and tell me if I should roll back.",
    threadId: "thr_XYZ",        // optional — continue an existing conversation
    context: { repo: "acme/api" }, // optional — extra structured context
  });
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `prompt` | Yes | What the agent should do. Write it as if you were typing it yourself |
| `threadId` | No | Continue an existing conversation thread instead of starting a new one |
| `context` | No | Structured data passed alongside the prompt |

## Security — Read This Before Deploying

**The trigger URL is public.** Anyone who guesses or learns it can POST to it, and every accepted POST is an agent run on your wallet. Verification is your handler's job.

- The **`slack`**, **`github`**, and **`stripe`** templates ship with real signature verification — Slack's signing secret (with URL-verification handling), GitHub's HMAC-SHA256, Stripe's timestamped `v1` signatures — and return `401` without ever invoking the agent.
- The **`generic`** template does **not** verify anything. It is a starting point, not a deployable webhook. Add a verifier before you deploy it.
- Store signing secrets with `bankr webhooks env set`, never in the handler source.
- GitHub's signature has no timestamp, so it carries no replay protection. If you need it, dedupe on the `X-GitHub-Delivery` header.
- A webhook you no longer trust can be paused (`bankr webhooks pause`) or deleted outright.

Because a webhook run is a real agent run on your wallet, everything in [safety.md](safety.md) still applies underneath it — wallet-level pause, spending limits, permitted recipients, and the read-only flag on the key all hold. A webhook cannot exceed what the wallet itself allows.

## Provider Templates

| Provider | Verifies | Typical use |
|----------|----------|-------------|
| `slack` | Signing secret + URL verification challenge | Reply in a channel or thread — the agent has a Slack skill bound and can use the channel and `thread_ts` from the prompt |
| `github` | HMAC-SHA256 over the body | Summarize a push, PR, or release and flag anything that needs action |
| `stripe` | Timestamped `v1` signatures | React to a payment, dispute, or subscription event |
| `generic` | **Nothing — add your own** | Anything else |

## REST API

All routes require API key authentication (`X-API-Key`). The public trigger endpoint is served separately, at `webhooks.bankr.bot`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/webhooks/deploy` | Deploy from raw TypeScript source (`{ config, bundles }`) |
| `GET` | `/webhooks` | List your deployed webhooks |
| `GET` | `/webhooks/:name` | Webhook detail |
| `PATCH` | `/webhooks/:name` | Update (pause/resume and config) |
| `DELETE` | `/webhooks/:name` | Delete |
| `GET` | `/webhooks/:name/logs` | Recent invocations |
| `GET` | `/webhooks/:name/stats` | Invocation stats |
| `POST` | `/webhooks/env` | Set an encrypted env var |
| `GET` | `/webhooks/env` | List env var names |
| `DELETE` | `/webhooks/env/:key` | Remove an env var |

## Limits

| Resource | Limit |
|----------|-------|
| Raw handler source | 1 MB |
| Name format | Letters, digits, `-` and `_` only |
| Name length | 47 characters |

## Common Issues

| Issue | Resolution |
|-------|------------|
| Agent never runs | Handler returned a non-JSON response or failed verification — check `bankr webhooks logs <name>` |
| `401` on every trigger | Signing secret missing or wrong; check `bankr webhooks env list` and the provider's configured secret |
| Unexpected agent runs | The URL leaked and your handler doesn't verify — pause the webhook, add a verifier, redeploy |
| Deploy rejected | Name is over 47 characters or has characters outside `[a-zA-Z0-9_-]`, or the bundle exceeds 1 MB of source |
