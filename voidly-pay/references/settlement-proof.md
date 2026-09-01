# Leg 3 — proving a settlement, and the exact limits of the proof

## The nonce-binding rule

USDC's EIP-3009 authorizations carry a 32-byte nonce, and this rail does not
mint it randomly. It is a pure function of the hire:

```
nonce = sha256("voidly-session-settlement-binding/v1|" + grantHash)
```

The domain string is `SETTLEMENT_BINDING_DOMAIN` in `@voidly/session`
(trailing `|` included); `settlementBindingReference(grantHash)` computes the
same bytes. The consequences:

- USDC marks `(authorizer, nonce)` spent forever on first use, so at most one
  settlement can ever exist for a given payer and hire.
- `AuthorizationUsed(authorizer, nonce)` is emitted on-chain, so any third
  party holding only `{txHash, grantHash, payer, payee, amount}` can recompute
  the nonce and check the binding against a public RPC — no Voidly surface in
  the loop.
- The two payment variants (`receive` / `transfer`) share this one nonce:
  they are alternatives, never steps. The second signature is a guaranteed
  revert that still costs gas.

## What verify-settlement.mjs checks, in order

1. **Quorum.** Every RPC you name (default `mainnet.base.org` +
   `base.drpc.org`) must return a byte-identical receipt. An unanswered
   endpoint fails the whole run — an unanswered operator is a divergent
   operator. Unanimity or nothing.
2. **Success.** `status == 0x1`; a reverted transaction proves nothing.
3. **The binding.** An `AuthorizationUsed` event on the canonical USDC
   contract (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) whose nonce equals
   the recomputed hash and whose authorizer is the expected payer.
4. **The transfer.** A `Transfer` on that same contract from payer to payee of
   **exactly** `--amount`. Exact equality, deliberately — `>=` is how amount
   checks rot into paying-more-is-fine.
5. **Finality.** At least 12 confirmations.

RPC URLs never appear in output beyond their hostnames — an operator-supplied
RPC URL can carry an API key in its path, and a verdict is exactly the
document you hand to a counterparty.

## Captured runs (live, public RPCs)

The PROVEN run on the one settlement on record is in SKILL.md. The refusals,
each a separate live run against that same transaction:

```
$ … --amount 49999
REFUSED  exact_value — transfer moved 50000, expected exactly 49999

$ … --grant-hash aaaaf8c4…31daea6
REFUSED  nonce_not_spent_by_this_tx — no AuthorizationUsed with nonce 0x64cc5f8a… on canonical USDC

$ … --payee 0x000000000000000000000000000000000000dead
REFUSED  transfer_recipient_mismatch — the paired Transfer pays 0xb0b3fca940e04f99367f08e665e1c2cb4ebd4912, not the expected payee 0x000000000000000000000000000000000000dead
```

Exit code is 1 on every refusal, 0 only on PROVEN.

## Scope limits — what PROVEN does not say

- **Not delivery.** The chain proves a payment was bound to a hire. Whether
  the work was done, done well, or delivered at all is proven by the sealed
  result capsule, the provider-signed delivery receipt, and the rail's
  redemption attestation — `verify-artifacts.mjs`, offline.
- **Not endorsement.** The provider index says it itself: a listed DID is not
  an honest DID. Verification is about bindings, not about quality.
- **Not demand.** The one settlement on record is Voidly's own first-party
  proving payment, and both the receipt file
  (`https://voidly.ai/pay-first-settlement.json`, `agreement_class:
  "arranged-first-party"`) and the provider index's `limits` say so in-band.
  Relay the disclosure with the proof.
- **No refunds.** Payment buys an attempt, not an outcome. Once redemption
  succeeds the grant is spent; a failed attempt arrives as a sealed, signed
  failure result — auditable, and not your money back.

## Offline artifacts

```bash
node scripts/verify-artifacts.mjs receipt \
  --receipt ./receipt.json --signature <base64> --grant ./grant.json --grant-hash <hex64>

node scripts/verify-artifacts.mjs attestation \
  --attestation ./attestation.json --signature <base64> --attestor-key <base64>
```

- The **receipt** check runs `verifyDeliveryReceipt` from `@voidly/session`:
  it binds the receipt to *your* copy of the grant (grant hash, offer hash,
  provider DID) and verifies the provider's Ed25519 signature under the key
  the grant already carries — no second trust root. A fabricated receipt
  refuses by name — `delivery_schema_mismatch` or `delivery_grant_mismatch`,
  depending on what is fabricated (the grant binding is checked before the
  schema, so arbitrary junk hits the binding refusal first).
- The **attestation** check validates the exact key-set shape
  (`validateRedemptionAttestation` — an unexpected field is a refusal, never
  elided) and the rail's signature (`verifyDetached`) under the attestor key.
  Take that key from the *verified* manifest — `discover.mjs` prints it —
  never from the artifact or from chat. Both directions were exercised: a
  locally-signed attestation VERIFIED under its matching key, and the same
  artifact refused `attestation_signature_invalid` under the real attestor
  key.
- Known gap: a green `receipt` run requires artifacts only a *paid* hire
  produces, and the only settlement on record is first-party — so the receipt
  path's positive branch is exercised by the provider's own artifacts, not yet
  by a third party's. The refusal branches above are captured; the positive
  branch on your artifacts would be the first third-party run.
