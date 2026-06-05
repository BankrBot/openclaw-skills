# 1Claw — MCP and API quick reference

## Authentication

| Credential | Prefix | Used by | Exchange endpoint |
| --- | --- | --- | --- |
| Agent API key | `ocv_` | Agents | `POST /v1/auth/agent-token` → JWT |
| Human API key | `1ck_` | Users/scripts | Direct Bearer token (no exchange) |
| Platform API key | `plt_` | Platform apps | Direct Bearer token (middleware resolves) |

### Agent token exchange (key-only auth)

The `agent_id` field is **optional** — the server resolves the agent by the first 12 characters of the API key (prefix lookup).

```bash
curl -s -X POST https://api.1claw.xyz/v1/auth/agent-token \
  -H "Content-Type: application/json" \
  -d '{"api_key":"ocv_..."}'
```

Response:
```json
{
  "access_token": "<jwt>",
  "token_type": "bearer",
  "expires_in": 3600,
  "agent_id": "<uuid>",
  "vault_ids": ["<uuid>", "..."]
}
```

- `vault_ids` empty = agent may access all org vaults (governed by policies).
- JWT scopes come from `agents.scopes` when set; otherwise derived from active access policies (`secret_path_pattern` globs).
- Empty policies → **no secret access** (safe by default).
- MCP stdio auto-refreshes ~60s before expiry.

### OIDC federation token (RS256, for external services)

```bash
curl -s -X POST https://api.1claw.xyz/v1/auth/federated-token \
  -H "Authorization: Bearer ${AGENT_JWT}" \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "urn:ietf:params:oauth:grant-type:token-exchange",
    "subject_token_type": "urn:ietf:params:oauth:token-type:jwt",
    "audience": "https://api.anthropic.com"
  }'
```

Response: `{ "access_token": "<rs256-jwt>", "issued_token_type": "...", "token_type": "bearer", "expires_in": 900 }`

Discovery: `GET https://api.1claw.xyz/.well-known/openid-configuration` / `GET .../jwks.json`

## Health checks (no auth)

```bash
curl -s https://api.1claw.xyz/v1/health        # API + DB connectivity
curl -s https://api.1claw.xyz/v1/health/hsm     # HSM (KMS) availability
```

## Secret paths

- Validated server-side (no `..`, nulls, zero-width chars, confusable normalization).
- Common layout: `keys/<name>`, `env/<bundle>`, `agents/{id}/...` (system paths restricted).
- `PUT /v1/vaults/{id}/secrets/{path}` creates a new version on each write.
- Types: `api_key`, `password`, `token`, `ssh_key`, `private_key`, `certificate`, `env_bundle`, `generic`.

## MCP environment (stdio)

| Variable | Required | Notes |
| --- | --- | --- |
| `ONECLAW_AGENT_API_KEY` | Yes* | Auto token exchange + refresh |
| `ONECLAW_AGENT_ID` | No | Optional pin (usually auto-discovered) |
| `ONECLAW_VAULT_ID` | No | Pin vault when agent has multiple |
| `ONECLAW_BASE_URL` | No | Default `https://api.1claw.xyz` |
| `ONECLAW_LOCAL_ONLY` | No | `true` = `inspect_content` only (free) |
| `ONECLAW_MCP_EXFIL_PROTECTION` | No | `block` (default) / `warn` / `off` |

\* Not required when `ONECLAW_LOCAL_ONLY=true`.

Each tool invocation rebuilds the HTTP client from **current** `process.env` — changing vars takes effect without restarting.

## Intents API (REST)

Requires `intents_api_enabled` on the agent.

| Endpoint | Purpose |
| --- | --- |
| `POST /v1/agents/{id}/transactions` | Submit (optional `Idempotency-Key` header) |
| `POST /v1/agents/{id}/transactions/sign` | Sign-only (no broadcast) |
| `POST /v1/agents/{id}/sign` | Unified intents (`transaction`, `personal_sign`, `typed_data`) |
| `POST /v1/agents/{id}/transactions/simulate` | Tenderly simulation |
| `POST /v1/agents/{id}/transactions/simulate-bundle` | Tenderly bundle simulation |

Treasury mode: body includes `treasury_id` and `mode: "treasury"` with active **delegation**.

## Signing key management

| Endpoint | Purpose |
| --- | --- |
| `POST /v1/agents/{id}/signing-keys` | Provision per-chain key (`{ chain }`) |
| `GET /v1/agents/{id}/signing-keys` | List all signing keys |
| `POST /v1/agents/{id}/signing-keys/{chain}/rotate` | Rotate key |
| `DELETE /v1/agents/{id}/signing-keys/{chain}` | Deactivate |
| `GET /v1/agents/{id}/signing-keys/{chain}/balance` | Native + ERC-20 balances |

Supported chains: `ethereum`, `bitcoin`, `solana`, `xrp`, `cardano`, `tron`.

## Bankr Dynamic Key Vending

Partner-key secret engine for short-lived Bankr wallet API keys. Requires `BANKR_PARTNER_KEY` on Vault (server-side; never stored in agent vault paths).

| Endpoint | Purpose |
| --- | --- |
| `POST /v1/agents/{id}/bankr-keys/lease` | Issue scoped `bk_usr_` key (default TTL 1h, max 24h) |
| `GET /v1/agents/{id}/bankr-keys` | List active leases |
| `DELETE /v1/agents/{id}/bankr-keys/{lease_id}` | Revoke lease (calls Bankr API) |

MCP: `lease_bankr_key`. CLI: `1claw agent bankr-key lease|list|revoke`. Shroud auto-resolves leased keys when `X-Shroud-Provider: bankr`.

Legacy fallback: static key at `providers/bankr/api-key` or `keys/bankr-api-key`.

Guide: https://docs.1claw.xyz/docs/guides/bankr-key-vending

## Packages

| Package | Purpose |
| --- | --- |
| `@1claw/mcp` | MCP server (stdio / httpStream), 36 tools |
| `@1claw/sdk` | TypeScript API client (zero deps) |
| `@1claw/cli` | CLI (`1claw` command) — device flow + email/password auth |
| `@1claw/openapi-spec` | OpenAPI 3.1 source of truth (generate clients in any language) |

## Links

- Dashboard: https://1claw.xyz
- Docs: https://docs.1claw.xyz
- For AI overview: https://1claw.xyz/for-ai
- Full skill (1300+ lines): https://github.com/1clawAI/1claw-skill/blob/main/SKILL.md
- npm: https://www.npmjs.com/package/@1claw/mcp
