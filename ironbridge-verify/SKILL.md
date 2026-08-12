---
name: ironbridge-verify
description: |
  Verify what an AI agent actually did — for free, with no wallet and no account. Given an
  IronBridge receipt id or seal id, recompute its hashes and re-walk the public seal chain to
  confirm it links end-to-end. Nothing to install, nothing to pay.
  Use when one agent must check another agent's claimed output before trusting it, or to
  independently confirm any IronBridge proof without trusting IronBridge.
  Triggers: "verify this agent's result", "is this receipt real", "re-walk this proof",
  "did this agent actually do the work", "check this seal", "recompute these hashes".
---

# IronBridge — Verify (free, no trust)

This is the zero-cost half of IronBridge. You can confirm any receipt or seal yourself with a
hash function — no wallet, no account, no permission, no trust in IronBridge.

**Base URL:** `https://ironbridge.foundation`

## Verify a receipt

```bash
curl -s https://ironbridge.foundation/api/receipt/<rid>
```

The record binds `request_sha256` (the exact input), `data_sha256` (the exact response bytes),
`txHash` (the Base USDC payment) and `payer`. Recompute the two SHA-256 hashes over the raw
bytes yourself and compare — the receipt cannot claim a result that was not actually returned.

- Malformed id → `400 {"error":"invalid receipt id"}`
- Well-formed but unknown id → `404 {"error":"receipt not found","receipt":"<rid>"}`

## Verify a seal / re-walk the chain

```bash
# one seal proof by id
curl -s https://ironbridge.foundation/api/seal/<seal_id>

# the public chain: tip, rows, and any disclosed historical breaks
curl -s "https://ironbridge.foundation/api/chain/page?limit=20"
```

Each row carries `seq`, `prev_hash`, `entry_hash`, `leaf`, `content_sha256`. Re-walk it by
asserting every row's `prev_hash` equals the previous row's `entry_hash`, skipping any `seq`
listed in `known_breaks`. The chain discloses discontinuities rather than rewriting history.

## Shareable proof

Every seal has a human-readable page at `https://ironbridge.foundation/proof/<seal_id>`. Share
that link in a chat, a dispute, or a dashboard and anyone can open it and re-walk the proof —
no wallet, no account. That URL *is* the portable evidence.

## Pairs with

- `ironbridge-receipt` — get a result-bound receipt for a paid call (then verify it here).
- `ironbridge-seal` — notarize an action, then hand anyone this skill to check it.
- `erc-8004` — register agent identity/reputation; use IronBridge as the recomputable
  validation source an 8004 validator can independently check.
