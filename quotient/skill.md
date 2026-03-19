---
name: quotient-api
description: Accesses Quotient market intelligence through either x402 micropayments or API key auth, with explicit 402 challenge/settle handling when using x402.
---

# Quotient API Skill

Use this skill when an agent needs Quotient market intelligence and must execute x402 payment flows correctly.

## Base URLs and Responsibilities

- `QUOTIENT_API_BASE_URL`: `https://dev.quotient.social`
  - Use for docs/schema/pricing lookup only.
- `QUOTIENT_GATEWAY_BASE_URL`: `https://q-api.quotient.social`
  - Execute runtime API requests here.

## Access Model

- Use x402 or API key for monetized requests.
- Prefer Bankr wallet tooling when available.
- Support vanilla SIWE/SIWX x402 clients as a first-class fallback.
- Include `x-quotient-api-key` when available; runtime requests can be authorized via either x402 payment handling or API key auth.
- If using Bankr signing (`/agent/sign`), provide a Bankr API key via `X-API-Key` with Agent API access enabled and signing permissions (not read-only).

## Getting a Quotient API Key

- Sign up (or log in) at `https://dev.quotient.social`.
- Account creation supports:
  - email login
  - Google login
- New accounts include free credits, so users can try the API before paying.
- After signup/login, create or copy a Quotient API key from the Quotient account settings/developer area.
- Pass the key to the agent via config/secrets as `x-quotient-api-key` (or equivalent env/secret wiring used by your client).

## Operator vs Agent Signup Path

- Preferred: human operator completes signup/login and key creation, then injects the API key into agent config.
- Optional self-serve agent path: if your runtime supports browser automation plus secure secret storage, the agent can perform signup/login at `https://dev.quotient.social`, generate a key, and store it for later requests.
- If interactive auth (email verification, Google OAuth, CAPTCHA, 2FA, policy prompts) cannot be completed programmatically, fall back to the human-operator path.

## x402 API Call Checklist

1. Send request to Quotient gateway without payment headers.
2. If response is `402`, parse `PAYMENT-REQUIRED`.
3. Sign payment and retry with `PAYMENT-SIGNATURE`.
4. On success, parse `PAYMENT-RESPONSE`.
5. Apply retry/backoff rules for `429` and transient `5xx`.

## Required Preflight (Deterministic)

Before the first API call in a session, fetch these discovery endpoints from `QUOTIENT_API_BASE_URL`:

- `/api/v1/openapi.json`
- `/api/public/pricing`
- Treat OpenAPI as the schema/parameter source of truth.
- Treat pricing endpoint response as the gateway-backed runtime cost source of truth.
- Before each monetized request, refresh pricing if your cached pricing data is older than 5 minutes.

## Canonical Endpoints and Discovery

Discovery endpoints below are served from `QUOTIENT_API_BASE_URL`:

- API docs UI: `/docs`
- OpenAPI: `/api/v1/openapi.json`
- Pricing discovery endpoint: `GET /api/public/pricing`
- AI index: `/llms.txt`

## Core Endpoints

All endpoint paths below are relative to `QUOTIENT_GATEWAY_BASE_URL`.

- `GET /api/v1/markets` - covered markets with forecast status
- `GET /api/v1/markets/mispriced` - markets where Q diverges from market odds
- `GET /api/v1/markets/lookup` - batch lookup by slugs or condition IDs
- `GET /api/v1/markets/{slug}/intelligence` - full intelligence on a single market
- `GET /api/v1/markets/{slug}/signals` - paginated analyst signals for a market
- `GET /api/v1/equities` - equities affected by Q-forecasted markets
- `GET /api/v1/equities/{slug}` - full detail on an equity entity

## References

Reference docs below are served from `QUOTIENT_API_BASE_URL`:

- API reference: `/skill/references/api-reference.md`
- Bankr-preferred x402 flow: `/skill/references/bankr-preferred-flow.md`
- Vanilla x402 flow: `/skill/references/vanilla-x402-flow.md`
- Error handling: `/skill/references/error-handling.md`
