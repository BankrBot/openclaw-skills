---
name: ironbridge-seal
description: |
  Notarize any action, decision, or document with a keyless, tamper-evident on-chain seal.
  Content is hashed locally (nothing sensitive need leave your machine), sealed on IronBridge's
  public chain, and given a shareable proof page anyone can re-walk with no wallet.
  Use when an action needs a durable, independently checkable record — an agreement, a
  disclosure, an agent decision, a handoff between agents.
  Triggers: "notarize this", "seal this action", "timestamp this document", "make a
  tamper-evident record", "put this on the record so anyone can check it".
---

# IronBridge — Seal (keyless notarization)

Seal an action so it can be checked later by anyone, without trusting you or IronBridge.

**Base URL:** `https://ironbridge.foundation`

## Seal it (keyless, client-side hashing, PoW-gated)

Open `https://ironbridge.foundation/seal` — or seal programmatically. Either way your content
is hashed locally, so the raw content never has to leave your machine; only the hash is sealed.

Programmatic flow (verified end-to-end):

1. `GET /api/seal/challenge` → `{challenge, bits, ttl, ts}`.
2. Solve the proof-of-work: find a `nonce` where `SHA-256(challenge + nonce)` has at least
   `bits` (currently 18) leading zero bits — sub-second.
3. `POST /api/seal` with `{content_sha256, type_tag, challenge, nonce}` → the new chain row,
   including your `seal_id`.

```bash
# fingerprint is SHA-256 of your content, computed locally
GET  /api/seal/challenge            # -> {challenge, bits:18, ttl:120}
# solve PoW locally (nonce s.t. SHA-256(challenge+nonce) has >=18 leading zero bits)
POST /api/seal {"content_sha256":"<64-hex>","type_tag":"document","challenge":"…","nonce":"…"}
# -> {"seal_id":"…","seq":N,"leaf":"…","prev_hash":"…","entry_hash":"…", …}
```

## Get the shareable proof

Every seal has a human-readable page:

```
https://ironbridge.foundation/proof/<seal_id>
```

Drop that link anywhere — a chat, a dispute, a dashboard — and anyone can open it and re-walk
the proof with no wallet and no account.

## Read a seal (free)

```bash
curl -s https://ironbridge.foundation/api/seal/<seal_id>
```

Returns the seal's chain fields (`seal_id`, `content_sha256`, `leaf`, `seq`, `prev_hash`,
`entry_hash`, …).

## Verify it (free)

Use the **`ironbridge-verify`** skill (or re-walk `/api/chain/page` yourself) to confirm the
seal links into the public chain end-to-end. The chain discloses any historical discontinuity
in a `known_breaks` array rather than rewriting history.

## Pairs with

- `ironbridge-verify` — the free re-walk anyone runs to check your seal.
- `ironbridge-receipt` — bind a payment to a result (a seal specialized for paid calls).
- `erc-8004` — attach a recomputable IronBridge seal as validation evidence for an 8004 agent.

> Verified end-to-end on 2026-07-01: sealed a test document via challenge → PoW → POST,
> producing `seal_id 04a0f52efef77d9b` at `seq 58`, re-walkable at `/proof/04a0f52efef77d9b`.
