# Leg 1 walkthrough — verify, pin, seal

Everything on this page runs with zero funds, and nothing here signs a payment
or transmits a brief. It is not keyless: "The hirer identity comes FIRST"
below mints an Ed25519 signing identity with `--mint-identity`, writes it
`0600`, and seals with it. That key names you; it moves no money.

## The walkthrough

```bash
# Installing runs third-party code on the machine: ask the human first, name
# the three packages (@voidly/session, tweetnacl, tweetnacl-util) and the
# registry (registry.npmjs.org), and only then run this.
cd voidly-pay && npm ci --ignore-scripts   # exact locked versions, no install scripts
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
enc_key:      BC4/bHqUQHnwt593WsVhgz1loPpUyESJV/Oy6SU5h1k=
services:
  "voidly.observatory.query/v1"  chain=eip155:8453  asset=eip155:8453/erc20:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913
    payee=eip155:8453:0xb0b3fca940e04f99367f08e665e1c2cb4ebd4912  amount=50000..5000000 (atomic)
payment_buys: an attempt, not an outcome
```

(followed by a blank line and a three-line reminder that every money field
above comes from the verified signed manifest — captured elsewhere on this
page rather than repeated here.)

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
{"ok":false,"reason":"manifest_did_not_pinned","detail":"manifest_did_not_pinned"}
```

## The hirer identity comes FIRST, and this is not optional

The rail resolves BOTH parties from the agent registry at *redemption* — which
happens after settlement — and answers 403 `session_identity_unresolved` for a
DID it does not know. So an unregistered hirer can seal, and pay, and never
redeem: money gone, brief sealed, no result. This script used to mint a fresh
ephemeral identity on every run and seal with it, which is exactly that trap.

`@voidly/session@1.0.0` exports no registration call, and this skill does
not POST for you by design, so the script does the other thing: it refuses to
seal until the DID actually resolves, and prints the request for you to run.

```bash
node scripts/seal-hire.mjs --mint-identity ./hirer.json
```

Captured:

```
MINTED   did:voidly:VnnJqQKF1jDgenuNCGfQtn
kept:    ./hirer.json (0600 — signing AND encryption identity, never transmitted by this skill)

REGISTER IT BEFORE YOU SEAL — AFTER THE HUMAN SAYS YES. This skill will not POST
for you; nothing it transmits goes beyond one registry lookup. The command below
publishes a PERSISTENT, UNAUTHENTICATED record on Voidly's rail: this DID, both
public keys, the name, and an active status (anyone can read it back). The index
says so itself: "REGISTRATION ON THIS RAIL IS OPEN". Ask the human to choose the
name — the placeholder below is not a default — and run it only on an explicit yes:

  curl -X POST https://api.voidly.ai/v1/agent/register \
    -H 'content-type: application/json' \
    -d '{"name":"<NAME THE HUMAN CHOSE>","signing_public_key":"6SRGG+s8Bw0rOzOZytd992dXgzwLyT4gnhCdRPEKviI=","encryption_public_key":"N/Uni5cSbEmLhy95B9hDOedVIeFxiaARNghrr+HZ8HY="}'

Then: node scripts/seal-hire.mjs --brief ./brief.json --hirer ./hirer.json --keep ./keep.json
```

Sealing without `--hirer` refuses, and writes nothing. Captured:

```
$ node scripts/seal-hire.mjs --brief ./brief.json --keep ./keep.json
REFUSED  hirer_identity_required — sealing needs a REGISTERED hirer identity, because the rail resolves both parties from the agent registry at redemption — after settlement. A fresh ephemeral identity seals fine and then cannot redeem, which means paying for something unreadable. Run: node scripts/seal-hire.mjs --mint-identity ./hirer.json, register the printed key, then pass --hirer ./hirer.json
```

Sealing with an identity that was minted but never registered refuses too —
this is the run that proves the preflight is real, not a comment:

```
$ node scripts/seal-hire.mjs --brief ./brief.json --hirer ./hirer.json --keep ./keep.json
REFUSED  hirer_did_unregistered — did:voidly:ESP1G4MWLaeqgC6uf93k4w has no identity on the rail. The rail resolves BOTH parties from the agent registry at REDEMPTION — after settlement — and answers 403 session_identity_unresolved for a DID it does not know. Register this identity first (see --mint-identity), then re-run.
```

No `keep.json` is written on either refusal.

The preflight asks the same three questions the rail asks at redemption —
does a row exist, is it active, does its registered key derive the DID — plus
one the rail cannot: is that the key you are about to sign with. Measured
against the live registry, all four branches:

```
registered DID, real key   -> ok name=voidly-session-provider-1
registered DID, wrong key  -> hirer_key_not_the_registered_key
freshly minted DID         -> hirer_did_unregistered
path-injection DID         -> hirer_did_malformed
```

(The DID is shape-checked rather than percent-encoded: the rail routes on the
raw DID, and `did%3Avoidly%3A…` is a 404 there — encoding would turn every
registered identity into "unregistered".)

## Then seal

```bash
cat > brief.json <<'EOF'
{
  "brief": "Is twitter.com currently blocked in Iran, and by what method?",
  "payer": "0x000000000000000000000000000000000000dEaD"
}
EOF
node scripts/seal-hire.mjs --brief ./brief.json --hirer ./hirer.json --keep ./keep.json
```

(Mixed-case `dEaD` is fine here — `seal-hire.mjs` routes the payer through
`x402SessionAccountCaip10`, which lowercases. Gotcha (c) below is about
assembling accounts by hand.)

The successful branch prints `SEALED`, the grant hash, the registered hirer
DID, the provider it sealed to, and the whole transmit-safe wire. It is not
captured here because it requires a registered identity on the live rail, and
the only settlement on record is first-party — the same known gap the receipt
path has in [settlement-proof.md](settlement-proof.md). The two refusal
branches above are captured, live, and are what a reader can reproduce today.

The `payer` field needs no funds to seal — it only becomes binding when a
payment authorization is signed over the grant (leg 2, Bankr's side). The
`keep.json` file holds the session key that opens the eventual result,
points at the identity file that must sign the submission, and records the
provider's `accept_url` and worker base (key `endpoint_base_url`) as read off
the verified manifest at sealing — `submitHire` posts to the former, not the latter, and
an older keep file that recorded only the worker base sent a user to the
wrong host. The signing secret stays in the identity file rather than being
copied, so one leaked keep file cannot impersonate the identity across other
hires. Beside it the script
writes `keep.grant.json` — the task-grant envelope, a copy of the keep file's
`wire.grant` — which is the `--grant` file every `verify-artifacts.mjs`
invocation takes. An older keep file without the sibling is still usable: the
grant is inside it at `wire.grant`. A keep, grant or identity path that is
already occupied refuses `keep_file_exists` / `grant_file_exists` /
`identity_file_exists` before anything is fetched, minted or sealed.

`--keep` is required. A run without it refuses `keep_required` before
anything is read, sealed or printed, because the session key destroyed on
exit is the only hirer-side way to open the paid-for result — pass
`--discard-session-key` instead only for a deliberate dry run. The sealed
hire itself would not be affected: the capsule carries that key wrapped to
the provider's X25519 key (`wrapped_session_key_base64`), so the provider
opens the brief with its own secret and nothing of yours. Destroying your
copy blinds you, not them. An existing `--keep` (or sibling grant) file also
refuses up front, before the wire is printed — a wire on the terminal whose
session key went nowhere is a hire you could pay for and never read.

## The SDK gotchas

Each refusal below is captured, not paraphrased.

**(a) `deriveDidFromSigningKey` takes a `Uint8Array`, not base64.** The DID is
`did:voidly:{base58(pubkey[0..16])}` over the *raw* 32-byte Ed25519 public
key. Hand it the base64 string and the call throws before any DID exists:
`toBase58` takes the first 16 *characters* and feeds them to `BigInt("0x…")`,
which refuses at the first non-hex character — `SyntaxError: Cannot convert
0x0a0y0s0K0F0C0g0b0l0w040n020L0Y06 to a BigInt`, on all 200 real keys tried.
It fails loudly at the call, not quietly downstream. Decode first:

```js
const did = deriveDidFromSigningKey(keypair.publicKey);        // Uint8Array — right
// deriveDidFromSigningKey(encodeBase64(keypair.publicKey))    // string — throws
```

**(b) `chain` / `asset` / `payeeAccount` are copied verbatim off the verified
manifest offering.** `buildHire` compares them to the offering with `===` and
no normalization, before anything is signed, and refuses each mismatch by
name — `provider_price_chain_not_offered`, `provider_price_asset_not_offered`,
`provider_payee_not_manifested`, `provider_price_below_manifest_floor`,
`provider_price_above_manifest_ceiling`. The SDK's README calls this "the
price is not yours to type"; the rail re-checks the grant against the offer
at redemption as well. Copy `offering.price.*` field-for-field as
`seal-hire.mjs` does.

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

The brief is sealed **to the provider's** verified encryption key. The
provider decrypts and reads it — that is how the work gets done. What the seal
keeps the brief from is the relay and anyone on the wire; the manifest's claim
is about the relay only, verbatim: "The relay operator sees both DIDs, the
grant/offer/capsule hashes, the price band, the settlement pointer and the
timings. It does NOT see the brief or the result."

The only pinned provider is Voidly's own first-party daemon, so on this
skill's reviewed path the party that reads your brief is Voidly. Do not read
"end-to-end encrypted" as "private from the provider" — it is not, and this
skill has no provider-blind mode to offer.

What matters next is the order of operations: the brief is sealed to that key
*before* any wire, which is why an unverified manifest is a refusal and not a
warning — and why the replay limit in SKILL.md's security model matters here.
A genuinely-signed but stale manifest verifies identically (it carries no
`issued_at`, `expires_at`, nonce or key epoch), so a replayed one seals your
brief to a retired key. **Refusing to pay does not un-disclose a brief**: the
disclosure happens at sealing, before any money moves.

The chain publishes payer, payee, amount and time, permanently.
