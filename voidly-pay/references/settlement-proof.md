# Leg 3 — proving a settlement, and the exact limits of the proof

## The nonce-binding rule

USDC's EIP-3009 authorizations carry a 32-byte nonce, and this rail does not
mint it randomly. It is a pure function of the hire:

```
nonce = sha256("voidly-session-settlement-binding/v1|" + grantHash)
```

The domain string is `SETTLEMENT_BINDING_DOMAIN` in `@voidly/session`
(trailing `|` included); `settlementBindingReference(grantHash)` returns the
same digest as lowercase hex without `0x`, and the typed message's `nonce`
is `0x` + that (`settlementNonce`). The consequences:

- USDC marks `(authorizer, nonce)` spent forever on first use, so at most one
  settlement can ever exist for a given payer and hire.
- `AuthorizationUsed(authorizer, nonce)` is emitted on-chain, so any third
  party holding only `{txHash, grantHash, payer, payee, amount}` can recompute
  the nonce and check the binding against public RPCs — no Voidly surface in
  the loop.
- The two payment variants (`receive` / `transfer`) share this one nonce:
  they are alternatives, never steps. The second signature is a guaranteed
  revert that still costs gas.

## What verify-settlement.mjs checks, in order

1. **The quorum, before any network call.** At least **two** independent,
   HTTPS, allowlisted Base operators — not a default, a requirement. The
   allowlist is `ALLOWED_BASE_RPC_HOSTS` in `scripts/lib/pins.mjs`
   (`mainnet.base.org`, `base.gateway.tenderly.co`, `base.drpc.org`, `base.meowrpc.com`,
   `base-rpc.publicnode.com`); anything else needs an explicit
   `--allow-unpinned-rpc`. Independence is counted by **host**, so naming one
   operator twice is one operator. A plaintext `http://` endpoint, an
   unallowlisted host, or fewer than two distinct operators is refused before
   a single packet leaves — `rpc_not_https`, `rpc_host_not_allowlisted`,
   `insufficient_rpc_quorum`. One endpoint you do not control is one endpoint
   that can lie; a lone RPC is not a quorum no matter what the output calls
   it.
2. **Chain context, per operator.** Every operator must answer `eth_chainId`
   with `0x2105` (Base mainnet, 8453), or the receipt being read came off some
   other chain — `wrong_chain`.
3. **Receipt identity.** Every operator's receipt must say, in its own
   `transactionHash`, that it describes `--tx`. Checked before any other field
   of that document is read, on every operator's answer, case-insensitively.
   No script here used to read `transactionHash` at all, so an operator
   handing back a valid-but-unrelated receipt got a PROVEN block printing a
   transaction hash that appeared nowhere in the evidence actually checked.
4. **Unanimity.** Every operator must return a byte-identical receipt, hashed
   over a fully recursive, key-sorted canonicalization (logs included). An
   unanswered endpoint fails the whole run — an unanswered operator is a
   divergent operator. Unanimity or nothing.
5. **Success.** `status == 0x1`; a reverted transaction proves nothing.
6. **The binding.** **Exactly one** `AuthorizationUsed` event on the canonical
   USDC contract (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) carrying the
   recomputed nonce, whose authorizer is the expected payer. Two is ambiguity,
   and ambiguity refuses (`authorization_ambiguous`).
7. **The PAIRED transfer.** USDC's `FiatTokenV2` marks the authorization used
   immediately *before* it emits the `Transfer` of that same call, so the
   settled transfer is the first canonical-USDC `Transfer` whose `logIndex` is
   greater than the `AuthorizationUsed`'s. Payer, payee and value are asserted
   on **that log and no other**. A canonical-USDC log with no readable
   `logIndex` refuses rather than falling back to array position, which an
   operator controls.
8. **The transfer.** From payer to payee. With `--grant`, the amount must sit
   inside the grant's price band (`amount_outside_grant_band` otherwise); when
   `--amount` is typed — in either mode — it must additionally be **exactly**
   that amount (`exact_value`). Exact equality, deliberately — `>=` is how
   amount checks rot into paying-more-is-fine.
9. **Ambiguity guard.** More than one canonical-USDC payer → payee `Transfer`
   anywhere in the receipt refuses (`transfer_ambiguous`) rather than a first
   match winning.
10. **Block binding, per operator.** `eth_getBlockByNumber` at the receipt's
    height must return the receipt's own `blockHash`, on every operator. A
    receipt agreed on by RPCs but hanging off no block either of them has is
    not a settlement — `block_hash_mismatch`; a receipt whose own `blockHash`
    is unreadable refuses `block_hash_unreadable` rather than comparing
    nothing to nothing.
11. **Finality.** At least 12 confirmations, computed from the **lowest** head
    across the quorum — the most conservative operator decides. The heads must
    also agree to within 30 blocks (~1 minute on Base), or one of them is not
    following the chain the other is — `rpc_head_divergence`.

### Why 7 and 9 exist — the batched-transaction hole

The first version of this script did not pair anything. It read:

```js
const auth   = usdcLogs.find(l => l.topics[0] === AUTH && l.topics[2] === nonce);
const paired = transfers.find(l => l.topics[1] === pad(payer));   // named "paired"
```

`find()` returns the *first* Transfer from the payer, which in a transaction
settling two hires for the same payer is very often the other hire's. One
hire's nonce satisfied the binding while a different hire's transfer satisfied
the amount: a real settlement of **1 atomic unit could PROVE as 5,000,000**,
with honest unanimous RPCs and a genuine receipt. The header of the file
claimed the opposite — "A settlement for a DIFFERENT hire cannot fake this" —
which is the exact shape of defect this project keeps paying for: a comment
asserting a property no code enforced.

Both the hole and its fix are pinned by fixture tests in
`tests/verify-settlement.test.mjs`, including one that runs the old two-line
algorithm verbatim against a batched receipt and asserts it returns the wrong
log.

RPC URLs never appear in output beyond their hostnames — an operator-supplied
RPC URL can carry an API key in its path, and a verdict is exactly the
document you hand to a counterparty. For the same reason the PROVEN block
prints the operator **count** (`quorum: 2/2 agreed — …`): a reader should not
have to count hostnames to know how many nodes actually agreed.

Unanimity is over the whole canonical receipt, so two honest operators that
serialize an operator-specific field differently (an L1 fee field, a
`blockTimestamp` on logs) refuse `rpc_divergence` on a genuine settlement —
fails closed, and the remedy is a different pair from the allowlist, never a
looser comparison.

Being allowlisted is permission, not a promise. A non-archive operator will
answer `eth_chainId` happily and then fail or return `null` on an older
receipt; that fails the run closed (`rpc_unanswered` / `rpc_divergence`). It
can cost you a proof, never fake one.

## Captured runs (live, public RPCs)

The PROVEN run on the one settlement on record is in SKILL.md. The refusals,
each a separate live run against that same transaction:

```
$ … --rpc https://mainnet.base.org
REFUSED  insufficient_rpc_quorum — 1 distinct operator(s) [mainnet.base.org] — a quorum needs at least 2. A single endpoint, or the same endpoint named twice, can return whatever it likes

$ … --rpc https://mainnet.base.org --rpc https://mainnet.base.org
REFUSED  insufficient_rpc_quorum — 1 distinct operator(s) [mainnet.base.org] — a quorum needs at least 2. A single endpoint, or the same endpoint named twice, can return whatever it likes

$ … --rpc http://127.0.0.1:8599 --rpc https://base.drpc.org
REFUSED  rpc_not_https — http://127.0.0.1:8599 — a plaintext RPC can be rewritten in flight by anyone on the path

$ … --rpc https://evil.example.com --rpc https://base.drpc.org
REFUSED  rpc_host_not_allowlisted — evil.example.com is not one of the reviewed Base operators in scripts/lib/pins.mjs (mainnet.base.org, base.drpc.org, base.meowrpc.com, base-rpc.publicnode.com) — pass --allow-unpinned-rpc only if you know exactly whose node that is

$ … --amount 49999
REFUSED  exact_value — the paired Transfer moved 50000, expected exactly 49999

$ … --grant-hash aaaaf8c4…31daea6
REFUSED  nonce_not_spent_by_this_tx — no AuthorizationUsed with nonce 0x64cc5f8a… on canonical USDC

$ … --payee 0x000000000000000000000000000000000000dead
REFUSED  transfer_recipient_mismatch — the paired Transfer pays 0xb0b3fca940e04f99367f08e665e1c2cb4ebd4912, not the expected payee 0x000000000000000000000000000000000000dead

$ … --payer 0x000000000000000000000000000000000000dead
REFUSED  authorizer_mismatch — authorizer 0x5cad296e06a976886a5d5bef831520c3d5965af0
```

The PROVEN run on that same transaction names the pair it used:
`paired logs: AuthorizationUsed #131 -> Transfer #132`.

Two more live runs, both against that same transaction, show what
`--allow-unpinned-rpc` does and does not buy. Tenderly's public gateway is a
real Base operator that is not on the allowlist; it agreed byte-for-byte, and
the verdict still says so on its first line and in its exit code:

```
$ … --rpc https://mainnet.base.org --rpc https://base.gateway.tenderly.co --allow-unpinned-rpc
PROVEN-UNPINNED  (exit 2 — operators you chose, not the reviewed allowlist)
  …
  quorum:        2/2 agreed — mainnet.base.org + base.gateway.tenderly.co, receipts byte-identical
  caution:       base.gateway.tenderly.co — NOT on the reviewed allowlist (--allow-unpinned-rpc); this proof is only as strong as those operators
```

And 1rpc.io, another real operator, answered `null` for this older receipt —
the digest `74234e98` in the refusal is the hash of `null` — which is the
non-archive case `scripts/lib/pins.mjs` describes, refused rather than voted
on. When that operator rate-limits first, the refusal is `rpc_unanswered`
instead; either way no verdict is built on it:

```
$ … --rpc https://mainnet.base.org --rpc https://1rpc.io/base --allow-unpinned-rpc
REFUSED  rpc_divergence — mainnet.base.org=78a60665 1rpc.io=74234e98
```

`receipt_not_for_this_tx`, `authorization_ambiguous`, `transfer_ambiguous`,
`paired_transfer_missing` and `log_index_unreadable` cannot be produced
against a real honest transaction — they need a dishonest operator or a
batched receipt. They are captured instead as fixture tests, which is the
honest way to exercise a branch that mainnet will not hand you:
`npm test` inside this skill's folder.

Exit code is 1 on every refusal, 0 only on PROVEN, and **2** on
`PROVEN-UNPINNED` — the same checks passed but at least one operator was
named with `--allow-unpinned-rpc` rather than taken from the reviewed
allowlist. Two operators one party controls can agree on anything, so that
verdict is only as strong as those operators and is not transferable. An
unexpected failure inside the verifier is also a named refusal
(`verifier_exception`, exit 1), never a stack trace.

Every value an operator sends is checked for TYPE before it is compared —
a chain id that is an array, a head that is a boolean, a receipt that is a
string, logs that are not an array, a document nested past 64 levels — each
refuses by name (`wrong_chain`, `rpc_head_unreadable`,
`receipt_not_for_this_tx`, `receipt_logs_malformed`, `receipt_unparseable`).
Every canonical-USDC log must name this transaction AND the receipt's own
block (`log_not_for_this_tx`, `log_not_in_this_block`), carry exactly three
32-byte topics (`log_topics_malformed`), and a Transfer's data must be one
32-byte word (`transfer_value_unreadable`). The transport refuses redirects
and bodies over 4 MiB.

## Scope limits — what PROVEN does not say

- **Not the grant's terms — unless you pass `--grant`.** The nonce binds the
  transaction to the grant HASH. With `--grant ./keep.grant.json` the script
  recomputes that hash from the envelope (byte-for-byte the SDK's
  `envelopeHash`, pinned by a test that compares the two over random
  envelopes), reads payer and payee off the grant — the `from` and `to` the
  SDK's authorization builders sign — and requires the settled amount to sit
  inside the grant's price band `price_min_amount..price_max_amount` (the
  builders sign the floor; the SDK's provider-side binding accepts the whole
  band, `authorization_below_floor` / `authorization_over_ceiling` outside
  it). PROVEN then means *this* grant's payer moved an amount *this* grant
  permits to *this* grant's payee under *this* grant's nonce
  (`amount_outside_grant_band` otherwise). Without `--grant`, the
  payer, payee and amount are asserted exactly as typed — true of the chain,
  silent about whether they are the grant's terms — and the `terms:` and
  `scope:` lines say so.
- **Not delivery.** The chain proves a payment was bound to a hire. Whether
  the work was done, done well, or delivered at all is a separate check on
  separate artifacts: the sealed result capsule, the provider-signed delivery
  receipt, and the rail's redemption attestation. Two of those are
  `verify-artifacts.mjs`, and only one of them is offline —
  `verify-artifacts.mjs receipt` needs no network at all, while
  `verify-artifacts.mjs attestation` fetches the pinned index and manifest so
  that the attestor key comes from a verified source rather than from argv.
  Verifying an attestation therefore tells Voidly's index host that you are
  verifying one.
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

## Artifact checks — one offline, one not

```bash
node scripts/verify-artifacts.mjs receipt \
  --receipt ./receipt.json --signature <base64> --grant ./keep.grant.json --grant-hash <hex64>

node scripts/verify-artifacts.mjs attestation \
  --attestation ./attestation.json --signature <base64> \
  --grant ./keep.grant.json --grant-hash <hex64>
```

- The **receipt** check runs `verifyDeliveryReceipt` from `@voidly/session`:
  it binds the receipt to *your* copy of the grant (grant hash, offer hash,
  provider DID) and verifies the provider's Ed25519 signature under the key
  the grant already carries — no second trust root. A fabricated receipt
  refuses by name, and the order decides which name you see: both files are
  parsed first (`receipt_unreadable`, then `grant_unreadable`), then the
  `--grant` document is checked (`grant_not_a_grant_envelope`,
  `grant_unhashable`, then `grant_hash_mismatch` against `--grant-hash`),
  then the pins are checked on
  the grant itself (`grant_provider_not_pinned`, `grant_chain_not_base`,
  `grant_asset_not_canonical_usdc`, `grant_payee_not_pinned`,
  `grant_band_not_pinned` — a grant is the trust root here, and a grant naming
  another provider, another payee or another price band verifies nothing this
  skill can vouch for),
  then the SDK validates it (`grant_invalid — <reason>`), and only then is the
  receipt looked at; then the receipt's
  shape (`delivery_schema_mismatch` and its siblings); then the receipt-to-grant
  binding, also `delivery_grant_mismatch`; then the signature,
  `invalid_delivery_signature`. So with a good grant, arbitrary junk hits the
  *schema* refusal — the binding is checked after the shape, not before it.
- The **attestation** check does three things, in order. (1) Shape:
  `validateRedemptionAttestation` — an unexpected field is a refusal, never
  elided. (2) **Subject binding**: the attestation must describe the hire whose
  grant you hold — `grant_hash`, `offer_hash`, `capsule_hash`, `hirer_did`,
  `provider_did` all compared to *your* grant, plus the pins (provider DID,
  Base mainnet, canonical USDC) and a `settled_amount` inside the price band
  your grant froze. (3) The rail's signature (`verifyDetached`) under the
  attestor key **read from the pinned, signature-verified manifest** — which
  this script now fetches and verifies itself, importing the same
  `lib/pins.mjs` every other script here uses.

  This is a fix, not a description of what shipped. Attestation mode had **no
  subject binding at all** and was the one script that did not import the
  pins: it took the attestor key from `--attestor-key`, never compared it to
  any manifest, and never looked at `provider_did`, chain or asset. A forged
  attestation for a hire that never existed, self-signed and verified against
  the forger's own key passed on the command line, printed **VERIFIED**. The
  only thing enforcing "take that key from the verified manifest" was a
  comment saying so.

  `--attestor-key` is still accepted and is now checked *against* the
  manifest: a key the manifest does not publish refuses
  `attestor_key_not_the_manifest_key`. Missing `--grant` refuses
  `missing_arguments` — the binding is not optional. Every binding branch is
  pinned in `tests/verify-artifacts.test.mjs`.
- Known gap: a green `receipt` run requires artifacts only a *paid* hire
  produces, and the only settlement on record is first-party — so the receipt
  path's positive branch is exercised by the provider's own artifacts, not yet
  by a third party's. The refusal branches above are captured; the positive
  branch on your artifacts would be the first third-party run.
