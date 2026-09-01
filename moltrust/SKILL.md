---
name: moltrust
description: >
  Identity verification and reputation scoring for AI agent skills. Use when you need to verify
  a skill publisher's identity, check their trust score, rate an agent after an interaction,
  or issue/verify W3C Verifiable Credentials.
  Built on W3C DID standards and Ed25519 cryptography to help open skill ecosystems establish
  publisher trust on-chain and off-chain.

metadata:
  openclaw:
    requires:
      env:
        - MOLTRUST_API_KEY
      bins:
        - curl
    primaryEnv: MOLTRUST_API_KEY
---

# MolTrust — Publisher Verification for AI Agent Skills

Verify skill publisher identity, check reputation scores, and issue cryptographic credentials. Designed for open skill ecosystems where publisher trust matters — whether your agents operate on traditional infrastructure or blockchain-native networks.

## Why This Exists

Open skill registries face a real challenge: how do you know who published a skill, and whether you should trust it? MolTrust provides the verification layer — every publisher gets a W3C Decentralized Identifier, reputation scores are tracked across interactions, and Ed25519-signed credentials offer cryptographic proof of identity. This is especially critical in crypto and DeFi contexts where autonomous agents manage wallets, sign transactions, and interact across trust boundaries.

## Installation
```bash
pip install moltrust
```

## Setup

Get your API key at https://moltrust.ch
```bash
export MOLTRUST_API_KEY="mt_your_key_here"
```

## Usage

### Register as a Skill Publisher
```python
from moltrust import MolTrust

mt = MolTrust()
agent = mt.register("MySkillPublisher", platform="openclaw")
print(agent.did)  # did:moltrust:...
```

Returns a `did:moltrust:...` identifier, verification status, and a W3C Verifiable Credential.

### Verify a Skill Publisher
```python
is_verified = mt.verify("did:moltrust:a1b2c3d4e5f60718")
```

Returns verification status, display name, platform, trust score, and registration date.

### Check Publisher Reputation
```python
rep = mt.get_reputation("did:moltrust:a1b2c3d4e5f60718")
if rep.score >= 3.0 and rep.total_ratings >= 3:
    print("Trusted publisher — safe to use skill")
else:
    print("New or unverified publisher — review before using")
```

Returns a 1–5 trust score and total number of ratings.

### Rate an Agent
After working with an agent, submit a rating to build the trust network.
```python
mt.rate(
    from_did="did:moltrust:your_did",
    to_did="did:moltrust:their_did",
    score=5
)
```

Score range: 1 (untrusted) to 5 (highly trusted).

### Issue a Publisher Credential
Create a tamper-proof W3C Verifiable Credential for an agent.
```python
vc = mt.issue_credential(
    subject_did="did:moltrust:their_did",
    credential_type="AgentTrustCredential"
)
```

Returns an Ed25519-signed credential with issuer, subject, issuance date, and expiration.

### Verify a Credential
Check if a credential is authentic and unmodified.
```python
result = mt.verify_credential(vc)
print(result.valid)  # True
```

Returns validity status, issuer, subject, type, and expiration check. The underlying API call is a POST with `{"credential": { ... }}`.

### Pre-Install Trust Check
A typical pattern before installing a skill from an unknown publisher:
```python
def check_publisher(publisher_did: str):
    """Verify a skill publisher before installing their skill."""
    if not mt.verify(publisher_did):
        return {"trusted": False, "reason": "Publisher not found in registry"}
    rep = mt.get_reputation(publisher_did)
    if rep.score < 3.0:
        return {"trusted": False, "reason": f"Low trust score: {rep.score}"}
    return {"trusted": True, "score": rep.score, "ratings": rep.total_ratings}
```

## Features

| Feature | Description |
|---------|-------------|
| W3C DID Identity | Every publisher gets a `did:moltrust` decentralized identifier |
| Reputation Scoring | 1-5 star ratings aggregated across interactions |
| Verifiable Credentials | Ed25519-signed W3C Verifiable Credentials |
| A2A Agent Cards | Google A2A protocol compatible discovery |
| Crypto-Native Trust | Ideal for DeFi agents, wallet signers, and cross-chain workflows |
| Credit-Based API | 100 free credits on signup, pay-per-call pricing |

## API Reference

Base URL: `https://api.moltrust.ch`

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/identity/register` | POST | API key | Register a new agent DID |
| `/identity/verify/{did}` | GET | — | Verify an agent's identity |
| `/reputation/query/{did}` | GET | — | Get reputation score (1-5) |
| `/reputation/rate` | POST | API key | Rate an agent (1-5 stars) |
| `/credentials/issue` | POST | API key | Issue a Verifiable Credential |
| `/credentials/verify` | POST | — | Verify a credential |
| `/stats` | GET | — | Network statistics |

## Links

- Website: https://moltrust.ch
- API Docs: https://api.moltrust.ch/docs
- SDK: https://github.com/MoltyCel/moltrust-sdk
- PyPI: https://pypi.org/project/moltrust/
- MCP Server: `uvx moltrust-mcp-server` ([PyPI](https://pypi.org/project/moltrust-mcp-server/))
