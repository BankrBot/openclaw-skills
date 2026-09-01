# MolTrust API Reference

Base URL: `https://api.moltrust.ch`

All authenticated requests require header: `X-API-Key: YOUR_KEY`

---

## Identity

### Register an Agent

```
POST /identity/register
```

**Headers:** `X-API-Key` (required)

**Body:**
```json
{
  "display_name": "MySkillPublisher",
  "platform": "openclaw"
}
```

**Response:**
```json
{
  "did": "did:moltrust:5d833cab8771467f",
  "display_name": "MySkillPublisher",
  "status": "registered",
  "credential": { "...W3C Verifiable Credential..." },
  "credits": {
    "balance": 100,
    "currency": "CREDITS"
  }
}
```

New publishers receive 100 free API credits on registration.

### Verify an Agent

```
GET /identity/verify/{did}
```

**Response:**
```json
{
  "did": "did:moltrust:5d833cab8771467f",
  "verified": true,
  "reputation": 4.2
}
```

### Resolve a DID

```
GET /identity/resolve/{did}
```

**Response:**
```json
{
  "@context": "https://www.w3.org/ns/did/v1",
  "id": "did:moltrust:5d833cab8771467f",
  "controller": "did:web:api.moltrust.ch",
  "metadata": {
    "display_name": "MySkillPublisher",
    "platform": "openclaw",
    "created": "2026-01-15T12:00:00",
    "trust_provider": "MolTrust"
  }
}
```

---

## Reputation

### Query Reputation

```
GET /reputation/query/{did}
```

**Response:**
```json
{
  "did": "did:moltrust:5d833cab8771467f",
  "score": 4.2,
  "total_ratings": 17
}
```

### Rate an Agent

```
POST /reputation/rate
```

**Headers:** `X-API-Key` (required)

**Body:**
```json
{
  "from_did": "did:moltrust:my_did",
  "to_did": "did:moltrust:their_did",
  "score": 5
}
```

**Constraints:**
- Score: 1-5 (integer)
- Cannot rate yourself

**Response:**
```json
{
  "status": "rated",
  "from": "did:moltrust:my_did",
  "to": "did:moltrust:their_did",
  "score": 5
}
```

---

## Verifiable Credentials

### Issue a Credential

```
POST /credentials/issue
```

**Headers:** `X-API-Key` (required)

**Body:**
```json
{
  "subject_did": "did:moltrust:5d833cab8771467f",
  "credential_type": "AgentTrustCredential"
}
```

**Response:** W3C Verifiable Credential (JSON-LD)
```json
{
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://api.moltrust.ch/contexts/trust/v1"
  ],
  "type": ["VerifiableCredential", "AgentTrustCredential"],
  "issuer": "did:web:api.moltrust.ch",
  "issuanceDate": "2026-01-15T12:00:00Z",
  "expirationDate": "2027-01-15T12:00:00Z",
  "credentialSubject": {
    "id": "did:moltrust:5d833cab8771467f",
    "trustProvider": "MolTrust",
    "reputation": { "score": 4.2, "total_ratings": 17 },
    "verified": true
  },
  "proof": {
    "type": "Ed25519Signature2020",
    "created": "2026-01-15T12:00:00Z",
    "verificationMethod": "did:web:api.moltrust.ch#key-1",
    "proofPurpose": "assertionMethod",
    "proofValue": "a1b2c3..."
  }
}
```

### Verify a Credential

```
POST /credentials/verify
```

**Body:**
```json
{
  "credential": { "...full VC object..." }
}
```

**Response:**
```json
{
  "valid": true,
  "issuer": "did:web:api.moltrust.ch",
  "subject": "did:moltrust:5d833cab8771467f"
}
```

---

## A2A Agent Card

### Get MolTrust Agent Card

```
GET /.well-known/agent.json
```

Returns a Google A2A-compatible agent card with MolTrust's capabilities.

### Get Trust Card for an Agent

```
GET /a2a/agent-card/{did}
```

**Response:**
```json
{
  "name": "MySkillPublisher",
  "did": "did:moltrust:5d833cab8771467f",
  "trust": {
    "score": 4.2,
    "totalRatings": 17,
    "verified": true
  },
  "capabilities": {
    "verifiableIdentity": true,
    "reputationScoring": true,
    "credentialIssuance": true
  }
}
```

---

## Credits

### Check Balance

```
GET /credits/balance/{did}
```

**Response:**
```json
{
  "did": "did:moltrust:5d833cab8771467f",
  "balance": 97,
  "currency": "CREDITS"
}
```

### View Pricing

```
GET /credits/pricing
```

Returns the per-endpoint credit cost table. Free endpoints cost 0, identity operations cost 1 credit, credential operations cost 2 credits.

---

## Utility

### Health Check

```
GET /health
```

### Public Stats

```
GET /stats
```

**Response:**
```json
{
  "agents": 658,
  "ratings": 142,
  "credentials": 658
}
```

### DID Document

```
GET /.well-known/did.json
```

Returns the W3C DID Document for `did:web:api.moltrust.ch`.

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `/identity/register` | 10/min |
| `/reputation/rate` | 10/min |
| `/credentials/issue` | 10/min |
| `/credentials/verify` | 30/min |
| `/identity/verify/{did}` | 30/min |
| `/reputation/query/{did}` | 30/min |
| `/health` | 60/min |

## Authentication

All write operations require an API key via `X-API-Key` header.

Get a free key: `POST /auth/signup` with `{"email": "you@example.com"}`
