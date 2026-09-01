# Authentication Reference

## Overview

OpenSea API supports two authentication layers:

| Layer | Header | Purpose |
|-------|--------|---------|
| API Key | `X-API-KEY: <key>` | App identity — required for all requests |
| Bearer Token | `Authorization: Bearer <token>` | Wallet identity — required for wallet-specific endpoints |

API keys identify your application. Bearer tokens prove wallet ownership via SIWE (Sign-In With Ethereum) and grant access to scoped, wallet-specific operations.

## Getting a Token

### Using opensea-js

```typescript
import { OpenSeaAuth } from "@opensea/sdk"

const auth = new OpenSeaAuth({
  authBaseUrl: "https://auth.opensea.io", // default
})

// Authenticate with a signer (ethers or viem)
const token = await auth.authenticate(signer, {
  scopes: ["read:eligibility", "write:orders"],
})
// token = { accessToken, refreshToken, expiresAt, scopes }

// Auto-refresh before expiry
const freshToken = await auth.getValidToken()

// Revoke when done
await auth.revoke(token.accessToken)
```

### Using opensea-cli

```bash
# Login with private key
opensea auth login --private-key $WALLET_KEY --scopes read:eligibility,write:orders

# Check token status
opensea auth status

# Force refresh
opensea auth refresh

# Revoke
opensea auth revoke

# List all stored tokens
opensea auth tokens

# List available scopes
opensea auth scopes
```

Tokens are stored in `~/.opensea/auth.json` with `0600` permissions.

### Manual (cURL)

```bash
# 1. Get a nonce
NONCE=$(curl -s https://auth.opensea.io/api/nonce | jq -r '.nonce')

# 2. Build SIWE message and sign it (app-specific)

# 3. Exchange signature for token
curl -X POST https://auth.opensea.io/api/token \
  -H "Content-Type: application/json" \
  -d '{"message": "<siwe_message>", "signature": "<signature>"}'

# 4. Use token in requests
curl https://api.opensea.io/api/v2/drops/eligibility/my-drop \
  -H "X-API-KEY: $OPENSEA_API_KEY" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# 5. Refresh before expiry
curl -X POST https://auth.opensea.io/api/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "<refresh_token>"}'
```

## Scopes

| Scope | Description |
|-------|-------------|
| `read:eligibility` | Check drop eligibility for the authenticated wallet |
| `write:orders` | Cancel orders on behalf of the authenticated wallet |
| `read:favorites` | Read favorite items for the authenticated wallet |
| `read:rewards` | Read rewards data for the authenticated wallet |

## Auth-Gated Endpoints

| Endpoint | Method | Required Scope |
|----------|--------|---------------|
| `/api/v2/drops/eligibility/{slug}` | GET | `read:eligibility` |
| `/api/v2/orders/{chain}/seaport/cancel` | POST | `write:orders` |
| `/api/v2/accounts/{address}/favorites` | GET | `read:favorites` |
| `/api/v2/accounts/{address}/rewards` | GET | `read:rewards` |

All auth-gated endpoints also require the `X-API-KEY` header.

## Auth Server Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `https://auth.opensea.io/api/nonce` | GET | Request a nonce for SIWE message |
| `https://auth.opensea.io/api/token` | POST | Exchange signed SIWE message for JWT |
| `https://auth.opensea.io/api/refresh` | POST | Refresh an expired access token |
| `https://auth.opensea.io/api/revoke` | POST | Revoke an access token |

## Token Format

```json
{
  "access_token": "eyJ...",
  "refresh_token": "...",
  "expires_in": 3600,
  "scopes": ["read:eligibility"]
}
```

Access tokens are JWTs. The `expires_in` field is in seconds.

## Patterns for AI Agents

1. **Auto-detect auth requirements**: If an endpoint returns `401` or `403`, check if a Bearer token is needed and authenticate.
2. **Cache and refresh**: Store the token and use `getValidToken()` (SDK) or `opensea auth refresh` (CLI) to avoid re-authenticating.
3. **Handle expiry gracefully**: Tokens expire. Always check `expiresAt` before making a request, or catch `401` and refresh.
4. **Request minimal scopes**: Only request the scopes you need for your current task.
5. **Revoke when done**: Revoke tokens when the agent session ends.

```typescript
// Agent pattern: authenticate once, auto-refresh
const auth = new OpenSeaAuth()
const token = await auth.authenticate(signer, {
  scopes: ["read:eligibility"],
})

const sdk = new OpenSeaSDK(provider, {
  chain: Chain.Mainnet,
  apiKey: "YOUR_API_KEY",
  authToken: token.accessToken,
})
```
