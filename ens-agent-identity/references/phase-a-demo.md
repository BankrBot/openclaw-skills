# Phase A Demo — AuthResolver Read-Only Pilot (5 minutes)

> **Forward-declaring scaffold.** The publish half runs end-to-end today against a real ENS
> subname via NameStone. The verify half is **read-only** and the on-chain
> `AuthResolver.verifyAction` step is **STUBBED** — the Verifier + AuthResolverImpl contracts
> are the unfunded M1 deliverable (target 2026-08-31, `github.com/steg-eth`), not deployed.
> Nothing here performs end-to-end signature verification. It proves the **record plumbing**.

## What this demo proves

1. You can publish `auth.credential` / `auth.capability` records on an ENS name **without
   clobbering** the name's existing `agent:*` (attribution) and ENSIP-25 (identity) records.
2. A counterparty can resolve the name, read the `auth.*` records, and run the spec's §5.2
   verification ordering as local structural pre-checks.
3. The exact seam where the M1 on-chain `verifyAction` call slots in is marked and honest —
   the verifier prints `verified: null` and `"contract not deployed yet; record plumbing verified"`.

## Prerequisites

```bash
export NAMESTONE_API_KEY="…"        # required for the publish half; never printed by the scripts
cd ens-agent-identity/scripts        # viem is installed in ens-agent-identity/; Node 24+
```

- **Read half needs nothing but an RPC** (default `https://eth.drpc.org`).
- **Publish half needs `NAMESTONE_API_KEY`.** No Bankr API spend in this demo (we pass the
  signer address explicitly rather than querying the Bankr CLI).
- Validation target is the throwaway **`authtest.bankrtest.eth`** — we do NOT touch
  `alpha-go.bankrtest.eth` (its records are cited live elsewhere).

---

## Step 1 — Seed the subname with layer-1/2 records (so the clobber proof has something to preserve)

Register `authtest.bankrtest.eth` with `agent:*` attribution records and an address. (Uses the
existing `set-agent-records.sh`; `BANKR_ENS_DOMAIN` overrides the default `bankr.eth`.)

```bash
BANKR_ENS_DOMAIN=bankrtest.eth \
  ./set-agent-records.sh authtest trading-bot "swap,bridge,limit-order" \
  0x579bc9f36e339bbc8f2580a792e4db4bcff39105
```

This sets `agent:type`, `agent:capabilities`, `agent:chains` and the addr record. These are the
keys the next step must preserve.

## Step 2 — Publish `auth.*` (layer 3) WITHOUT clobbering layers 1/2

```bash
BANKR_ENS_DOMAIN=bankrtest.eth \
AUTH_SIGNER_ADDRESS=0x579bc9f36e339bbc8f2580a792e4db4bcff39105 \
AUTH_SCOPE="swap,bridge,limit-order" \
  ./publish-auth-records.sh authtest primary
```

What it does (read → merge → write):
1. **GET** the current records (finds the `agent:*` keys from step 1).
2. **MERGE** `auth.credential[primary]` + `auth.capability[primary]` into the existing map.
3. **POST** the full merged map back (NameStone `set-name` replaces the whole map, so the merge
   is what keeps the `agent:*` keys alive).
4. **Re-GET** and print a before/after **clobber check**:
   ```
   CLOBBER CHECK PASSED: no prior keys lost; all auth.* keys present.
   ```

## Step 3 — Verify (read-only; on-chain step stubbed)

```bash
NODE_NO_WARNINGS=1 node verify-action.ts authtest.bankrtest.eth primary
```

Expected: resolves the name, reads the `auth.*` records, runs local pre-checks (credential
present → validity window → revocation → scheme recognized), then:

```
Step 4: On-chain AuthResolver.verifyAction (signature verify + scheme dispatch)...
  AUTH_RESOLVER_ADDRESS unset => contract not deployed yet; record plumbing verified
```

and prints JSON with `"verified": null` and `"reason": "ContractNotDeployed"`.

---

## Deny-path example (revocation)

Publish a revocation record for the same id, then re-run the verifier. The local pre-check now
short-circuits at the revocation step (spec §5.2 step 4 — presence of any bytes ⇒ revoked):

```bash
BANKR_ENS_DOMAIN=bankrtest.eth \
AUTH_SIGNER_ADDRESS=0x579bc9f36e339bbc8f2580a792e4db4bcff39105 \
AUTH_SCOPE="swap,bridge,limit-order" \
AUTH_REVOKED_AT=$(date +%s) AUTH_REVOKE_REASON="key rotation" \
  ./publish-auth-records.sh authtest primary

NODE_NO_WARNINGS=1 node verify-action.ts authtest.bankrtest.eth primary
# local pre-check: ... revoked=true ... would DENY ... : Revoked
```

> **CCIP-Read propagation lag (observed ~30–40s).** NameStone's CCIP-Read gateway
> negative-caches a key that was *absent* at first read. After you add
> `auth.revocation[primary]`, the publish script's own re-GET (NameStone REST) sees it
> immediately, but `verify-action.ts` (viem CCIP-Read) may still read it as empty for
> ~30–40s until the negative cache expires. Re-run the verifier after a short wait, or read
> the authoritative published state directly via the NameStone REST `get-names` endpoint.

> To return `authtest` to a clean happy-path state afterward, re-run step 2 without the
> `AUTH_REVOKED_AT`/`AUTH_REVOKE_REASON` vars. (NameStone `set-name` replaces the map; the merge
> only re-writes the `auth.*` keys you pass, so the revocation key persists until you clear it
> with NameStone's `delete-name`/`set-name` — note this when resetting.)

## Fail-path examples (input validation)

```bash
# Missing credential source -> clean error, no write attempted:
BANKR_ENS_DOMAIN=bankrtest.eth ./publish-auth-records.sh authtest primary
# Error: no credential supplied. Set AUTH_CREDENTIAL_JSON=<json> or AUTH_SIGNER_ADDRESS=<0x...>

# Missing API key -> clean error:
unset NAMESTONE_API_KEY; ./publish-auth-records.sh authtest primary
# Error: NAMESTONE_API_KEY environment variable not set

# Verifier against a name with no auth.* records -> Unverified (read-only, no error):
NODE_NO_WARNINGS=1 node verify-action.ts somename.bankrtest.eth primary
```

---

## Toward Phase B

Phase A is the read-only counterparty observer. Phase B (post-M1, contingent on Bankr
engagement) integrates `verifyAction` at a real action boundary — e.g., a Bankr Skill that
gates an external action on AuthResolver verification. That requires the deployed M1 contracts
plus Bankr-side dev. See `bankr-compatibility-test.md` §"Day-zero integration design" for the
Phase A → B → C → D sequencing.

## Known limitations / TODOs

- `verify-action.ts`'s `verifyAction` ABI is a **design sketch** (spec §5.1), not a deployed
  ABI — `// TODO(M1)` markers flag the swap-in points.
- Records are **JSON-in-text**, not CBOR-in-`data` — migrates to `setData`+CBOR at M1 (see
  `references/auth-record-schema.md`).
- The credential stores the signer **address**, not the 64-byte uncompressed secp256k1 key the
  spec's verifier path requires — `// TODO(M1)`.
- No on-chain write infrastructure for auth records; no core Bankr product code is touched.
- **NameStone `get-names` ignores the `name` query param** — it returns *all* names under
  the domain as an array. `publish-auth-records.sh` filters client-side by exact label; do the
  same in any tooling, or you will read/merge the wrong subname's records.
- **CCIP-Read negative-cache lag** (~30–40s) on newly-added keys — see the deny-path note above.
