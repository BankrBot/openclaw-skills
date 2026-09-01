# Leg 1 walkthrough — verify, pin, seal

Everything on this page runs keyless with zero funds. Nothing here signs a
payment or transmits a brief.

## The walkthrough

```bash
cd voidly-pay && npm install          # @voidly/session from the public registry
node scripts/discover.mjs
```

Literal output, captured live (the amounts are that run's data; re-run for
current values):

```
index:        https://api.voidly.ai/v1/session/providers
listed as:    "First-party: this is Voidly's own session provider daemon. It is in this index because the operator of the index runs it, which is a conflict of interest and not a recommendation."

VERIFIED      provider_did did:voidly:6rGTFa5apSnKNF14bGXZfu
accept_url:   https://intelligence.voidly.ai:8443/session/accept
worker_base:  https://api.voidly.ai
attestor_key: Tnte/kj2Hod56mJtvT37BPNkWlyYGfdzDWA4x6/5p1Y=
services:
  voidly.observatory.query/v1  chain=eip155:8453  asset=eip155:8453/erc20:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913
    payee=eip155:8453:0xb0b3fca940e04f99367f08e665e1c2cb4ebd4912  amount=50000..5000000 (atomic)
payment_buys: an attempt, not an outcome
```

Wrong pin refuses, by name. Captured with this exact call against the live
manifest — note that `fetchVerifiedProvider` takes ONE options object, not
positional arguments:

```js
await fetchVerifiedProvider({
  fetchImpl: fetch,
  manifestUrl,                                      // from the index entry
  expectedProviderDid: "did:voidly:2222222222222222", // deliberately wrong
})
```

```
{"ok":false,"reason":"manifest_did_not_pinned"}
```

Then seal:

```bash
cat > brief.json <<'EOF'
{
  "brief": "Is twitter.com currently blocked in Iran, and by what method?",
  "payer": "0x000000000000000000000000000000000000dEaD"
}
EOF
node scripts/seal-hire.mjs --brief ./brief.json --keep ./keep.json
```

(Mixed-case `dEaD` is fine here — `seal-hire.mjs` routes the payer through
`x402SessionAccountCaip10`, which lowercases. Gotcha (c) below is about
assembling accounts by hand.)

Captured (abridged — the full run prints the whole transmit-safe wire):

```
SEALED   grant_hash 82af9d171fb0c8dc73f704fa94768a232ac5b96a849096e27df5592f3aeeef77
hirer:   did:voidly:mPJNnvvYiKrFuY96NeESb (ephemeral, minted by this run)
sealed to: did:voidly:6rGTFa5apSnKNF14bGXZfu (verified)
...
kept:    ./keep.json (0600 — session key + ephemeral identity)

Nothing was transmitted. Sealing is local and costs nothing.
```

The `payer` field needs no funds to seal — it only becomes binding when a
payment authorization is signed over the grant (leg 2, Bankr's side). The
`keep.json` file holds the session key that opens the eventual result plus the
ephemeral identity that must sign the submission; it is worth at most one
payment. Without `--keep`, the session key is destroyed on exit and the sealed
hire can never be opened by anyone, including you.

## The three SDK gotchas

Each refusal below is captured, not paraphrased.

**(a) `deriveDidFromSigningKey` takes a `Uint8Array`, not base64.** The DID is
`did:voidly:{base58(pubkey[0..16])}` over the *raw* 32-byte Ed25519 public
key. Hand it the base64 string and you derive a DID from the wrong bytes — the
hire then fails identity checks downstream. Decode first:

```js
const did = deriveDidFromSigningKey(keypair.publicKey);        // Uint8Array — right
// deriveDidFromSigningKey(encodeBase64(keypair.publicKey))    // string — wrong bytes
```

**(b) `chain` / `asset` / `payeeAccount` are copied verbatim off the verified
manifest offering.** The redemption gate compares them with `===` and no
normalization. A price you type yourself is refused by name — the SDK calls
this "the price is not yours to type". Copy `offering.price.*` field-for-field
as `seal-hire.mjs` does.

**(c) EVM accounts lowercase, or the grant is refused.** Wallet libraries
return EIP-55 checksummed addresses by default; the grant demands canonical
lowercase. Captured live, by building a hire with a hand-written checksummed
payer account:

```
{"ok":false,"reason":"grant_payer_account_not_canonical"}
```

Route every account through `x402SessionAccountCaip10(chain, address)` — it
lowercases at the one place both directions go through and returns `null` for
anything malformed — and never assemble `"eip155:8453:0x…"` by hand.

## What the counterparties see

SKILL.md lists what the relay and the chain see. What matters here is the
order of operations: the brief is sealed to the verified provider key before
any wire — which is why an unverified manifest is a refusal and not a
warning. Refusing to pay does not un-disclose a brief.
