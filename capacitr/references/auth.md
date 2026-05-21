# Capacitr auth

Capacitr accepts two non-x402 credentials for user-state endpoints:

1. **Privy access token** (browser-issued, short-lived)
2. **Capacitr skill key** (long-lived, mintable in user settings)

x402 is a third path used only by `/api/analyze-link` and is documented
in `x402-flow.md`.

## Skill key — recommended for agents

A skill key is the right choice for any long-running agent. Mint one
in the Capacitr dashboard at `/settings/skill-keys` (Privy login
required). The plaintext is shown exactly once at mint time and is
never recoverable from the server — store it immediately.

Format: `csk_live_<48 hex chars>`. The first 8 hex chars after the
prefix form the public lookup half; the remaining 40 are the secret.

Use:
```bash
curl -sS -H "X-Capacitr-Skill-Key: $CAPACITR_SKILL_KEY" \
     "$CAPACITR_BASE_URL/api/user"
```

Rotation: revoke the old key, mint a new one. No atomic rotate endpoint
exists in v1.

Programmatic mint (Privy JWT required — skill keys cannot mint other
skill keys):
```bash
curl -sS -X POST \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $PRIVY_ACCESS_TOKEN" \
     -d '{"label":"my agent"}' \
     "$CAPACITR_BASE_URL/api/skill-keys"
```

Response includes `key`, `prefix`, `id`. Store the `key`; you'll need
the `id` to revoke later.

Revoke:
```bash
curl -sS -X DELETE \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $PRIVY_ACCESS_TOKEN" \
     -d '{"id":"<uuid>"}' \
     "$CAPACITR_BASE_URL/api/skill-keys"
```

## Privy JWT

Privy access tokens are issued by Privy in the browser and typically
expire within ~1 hour. They are not suitable for headless agents
because there is no programmatic refresh path without holding the
user's credentials.

Use only when the agent is operating in the same browser context as a
signed-in human (e.g., a userscript or a Privy-embedded-wallet flow).

```bash
curl -sS -H "Authorization: Bearer $PRIVY_ACCESS_TOKEN" \
     "$CAPACITR_BASE_URL/api/user"
```

## Header precedence and conflict

If both `Authorization: Bearer` and `X-Capacitr-Skill-Key` are
presented and resolve to the **same** Privy DID, the request is
accepted (skill-key path wins for diagnostics). If they resolve to
different DIDs, the request is rejected with `403 Conflicting
credentials`.

Skill keys are explicitly **disallowed** on:

- `POST /api/auth/sync` — bootstrap endpoint; the users row doesn't
  exist yet so a skill key has nothing to resolve to.
- `POST/GET/DELETE /api/skill-keys` — privilege loop closure.

## Strict mode

The Capacitr server may run with `STRICT_AUTH=1`, in which case any
endpoint that calls `requireUser` rejects unauthenticated requests
with `401`. The skill assumes strict mode in production; if you see a
`200` from an endpoint that should require auth, you are talking to a
non-production deployment.
