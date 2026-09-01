# AuthResolver `auth.*` Record Schema (Phase A)

> **Status: forward-declaring scaffold.** This documents the `auth.*` records that the
> AuthResolver pilot publishes on an ENS name. The contracts that *consume* these records
> — the **Verifier** and **AuthResolverImpl** — are the unfunded **M1 deliverable** (target
> 2026-08-31, `github.com/steg-eth`) and are **not deployed**. Nothing here performs
> end-to-end signature verification today. Phase A proves the **record plumbing**:
> publish → resolve → read → parse → local structural pre-checks.
>
> The normative source of truth is the AuthResolver prototype spec (v1.0-draft.02). Where
> this Phase-A schema deviates from it, the deviation is **called out loudly** below and is
> deliberate.

> **What's settled vs. open.** The `auth.*` key names and the credential / capability /
> revocation record shapes are taken from the AuthResolver prototype spec — they define *the
> resolver's* data model and are stable in that sense. **How they map onto a specific platform's
> real authorization model is not settled here.** For a managed agent platform like Bankr, the
> exact contents — what a credential's signing key and scope should be, how `capability` scopes
> mirror the platform's API-key permission flags (read-only vs. read-write, IP allowlist,
> rate-limit tier), how `revocation` tracks a real key-revocation event — require a design
> conversation with that platform's engineers. This document and the read-only pilot demonstrate
> the *mechanics and the proposed shape* on a throwaway name; they are **not** a claim about any
> platform's internal auth layer.

## Where this sits: the three-layer agent-identity model

An ENS name carrying a full agent identity has three composable layers (spec §2):

| Layer | Question it answers | Where it lives | Status on `alpha-go.bankrtest.eth` |
|---|---|---|---|
| **1. Identity** (ENSIP-25) | Is this name bound to this agent's ERC-8004 record? | `agent-registration[...]` text record | ✅ verified live |
| **2. Attribution** (ENSIP-26 / `agent:*`) | What is this agent? Capabilities, type, chains? | `agent:*` text records | ✅ live (`agent:type`, `agent:capabilities`, `agent:chains`) |
| **3. Authentication** (AuthResolver) | Is *this signed action* verifiable under the agent's published credentials? | **`auth.*` records** | ⬅ **this document** |

`auth.*` is **layer 3**. The on-chain `verifyAction` (M1) enforces **layer 3 only**; composing
layers 1 and 2 is the relying party's job (spec §5.3). A serious counterparty reads all three.

> **Mapping to the MAIP taxonomy (Display / Discovery / Authority).** This three-layer identity
> *lens* (Identity / Attribution / Authentication, from spec §2) is **orthogonal** to the MAIP
> infrastructure *tiers* (Display / Discovery / Authority, defined in the MAIP taxonomy) — they
> cross-cut rather than rename each other. Identity (ENSIP-25) and Attribution (ENSIP-26 /
> `agent:*`) span the **Display** tier (profile records — `agent:type`, `agent:chains`) and the
> **Discovery** tier (capability / endpoint records — `agent:capabilities`, ENSIP-26
> `services[*]`); Authentication (AuthResolver `auth.*`) is the **Authority** tier. The
> submission application compresses the Display+Discovery span to "ENSIP-26 (discovery)"; the
> `agent:*` profile records used in this pilot are therefore mostly Display, with
> `agent:capabilities` leaning Discovery.

## Key naming (spec §4.5, verbatim)

```
auth.credential[<id>]   — the registered signing key + scheme + validity window
auth.capability[<id>]   — scope declaration (publishable, NOT enforced by verifyAction in v1)
auth.revocation[<id>]   — revocation flag (presence of any bytes => revoked)
```

`<id>` is a free-string identifier chosen by the name owner. This pilot uses `primary`.

## ⚠️ Three deliberate deviations from the normative spec

These are **Phase-A simplifications**, not the target design. Each migrates at M1.

1. **JSON-in-text-record, not CBOR-in-`data`.** The spec (§4.5, conformance items A14/A15)
   requires records under the `IDataResolver.data(node, key) → bytes` profile, **CBOR-encoded**,
   and **MUST NOT** use text records. Phase A uses **JSON strings in NameStone text records**
   because (a) NameStone's surface is text records, and (b) the `data`+CBOR profile needs the
   M1-deployed `AuthResolverImpl`. **Migrates to `setData` + CBOR at M1.**
2. **`scheme` as a string, not `bytes32`.** Stored as `"ECDSA-secp256k1"`. The on-chain
   canonical form is `keccak256("ECDSA-secp256k1")` (spec §3.2). The verifier computes the
   hash; the text record carries the human-readable string.
3. **`schemaVersion` wrapper field.** Not part of any spec struct. Added so M1 migration
   tooling can distinguish Phase-A JSON payloads from real CBOR. Value: `"phase-a/0.1"`.

A fourth, credential-specific deviation is the `pubKey`/`address` substitution — see the
note in the credential table.

## `auth.credential[<id>]` — spec §6.1 `CredentialRecord`

| Spec struct field | Phase-A JSON key | Example value | Note |
|---|---|---|---|
| `schemeId` bytes32 | `scheme` | `"ECDSA-secp256k1"` | string form (deviation 2). One of: `WebAuthn-ES256`, `ECDSA-secp256k1`, `EIP-1271` (spec §3.2) |
| `pubKey` bytes | `address` | *(signer wallet, passed via env)* | **DECISION A1:** Phase A stores the **20-byte address** we have, not the **64-byte uncompressed key** the spec's secp256k1 path requires (§3.2). `// TODO(M1): 64-byte uncompressed key.` |
| `notBefore` uint64 | `notBefore` | `1747000000` | unix seconds; issue time |
| `notAfter` uint64 (0=∞) | `notAfter` | `0` | `0` = no expiry |
| `capabilityRef` bytes32 (0=none) | `capabilityRef` | `"primary"` | structural only in v1 — `verifyAction` does NOT enforce capability scope (spec §6.1) |
| — | `schemaVersion` | `"phase-a/0.1"` | wrapper (deviation 3) |

```json
{
  "scheme": "ECDSA-secp256k1",
  "address": "0x<signer-address>",
  "notBefore": 1747000000,
  "notAfter": 0,
  "capabilityRef": "primary",
  "schemaVersion": "phase-a/0.1"
}
```

## `auth.capability[<id>]` — spec §6.2 `CapabilityRecord`

Publishable in v1, **not consumed by `verifyAction`** (reserved for the v1.1 policy layer, spec §6.2).

| Spec field | Phase-A JSON key | Example value | Note |
|---|---|---|---|
| `scope` string | `scope` | `"swap,bridge,limit-order"` | mirrors the agent's `agent:capabilities` |
| `expiry` uint64 (0=∞) | `expiry` | `0` | `0` = no expiry |
| `revocationKey` bytes32 (0=use cred id) | *(omitted)* | — | omitted ⇒ verifier uses the credential id as the revocation key |
| — | `schemaVersion` | `"phase-a/0.1"` | wrapper |

```json
{ "scope": "swap,bridge,limit-order", "expiry": 0, "schemaVersion": "phase-a/0.1" }
```

## `auth.revocation[<id>]` — spec §6.3 `RevocationRecord`

Per spec §5.2 step 4, **the presence of any bytes ⇒ revoked**, regardless of decoded content.
Decoding `revokedAt`/`reason` is optional for the deny decision but recommended for diagnostics.

| Spec field | Phase-A JSON key | Example value |
|---|---|---|
| `revokedAt` uint64 (0=not revoked) | `revokedAt` | `1747100000` |
| `reason` string (optional) | `reason` | `"key rotation"` |
| — | `schemaVersion` | `"phase-a/0.1"` |

```json
{ "revokedAt": 1747100000, "reason": "key rotation", "schemaVersion": "phase-a/0.1" }
```

> The pilot publishes **credential + capability** on the happy path. **Revocation is shown
> as a deny-path example only** — never set on the live happy-path record.

## How `verifyAction` will consume these (spec §5.2, M1)

The on-chain `verifyAction(node, credentialId, message, signature)` runs this ordering and
returns on the first failure with a `DenyReason`:

1. **Credential lookup** — empty ⇒ `Unverified`
2. **Decode** — decode failure ⇒ `Unverified`
3. **Validity window** — outside `notBefore`/`notAfter` ⇒ `Stale`
4. **Revocation** — any bytes at `auth.revocation[<id>]` ⇒ `Revoked`
5. **Scheme support** — scheme not registered in the Verifier ⇒ `Mismatch`
6. **Signature verification** — Verifier `verify(...)` returns false ⇒ `Unverified`
7. **Success** — `{allowed: true, reason: None, ...}`

`scripts/verify-action.ts` runs steps 1–5 **locally and read-only** as structural pre-checks.
**Steps 6–7 are the on-chain step and are STUBBED** (the Verifier is not deployed). The script
prints `verified: null` — it never claims a signature was cryptographically verified pre-M1.

## Illustrative record set (NON-NORMATIVE; not necessarily published live)

For reference only, the shape a live agent like `alpha-go.bankrtest.eth` would carry once the
`auth.*` namespace is populated. Per spec §1.3, **reference-deployment addresses MUST NOT be
hard-coded** — the scripts take the address via args/env. Live validation for this pilot runs
on the throwaway `authtest.bankrtest.eth`, not on `alpha-go`.

```
# Layer 2 — attribution (already live)
agent:type          = "trading-bot"
agent:capabilities  = "swap,bridge,limit-order"
agent:chains        = "base"

# Layer 1 — identity / ENSIP-25 (already live)
agent-registration[0x0001...e539a432][19327] = "1"

# Layer 3 — authentication / AuthResolver (this schema; Phase A)
auth.credential[primary]  = {"scheme":"ECDSA-secp256k1","address":"0x<signer>","notBefore":...,"notAfter":0,"capabilityRef":"primary","schemaVersion":"phase-a/0.1"}
auth.capability[primary]  = {"scope":"swap,bridge,limit-order","expiry":0,"schemaVersion":"phase-a/0.1"}
# auth.revocation[primary] — absent on the happy path
```

## Migration to M1 (what changes)

| Phase A (today) | M1 (target 2026-08-31) |
|---|---|
| JSON string in NameStone **text** record | CBOR bytes in `IDataResolver.data` slot via `setData` |
| `scheme` as string | `schemeId` = `keccak256(scheme)` bytes32 |
| `address` (20 bytes) | `pubKey` (64-byte uncompressed secp256k1) |
| `schemaVersion: "phase-a/0.1"` wrapper | dropped — CBOR struct layout is the version |
| local read-only pre-checks (`verify-action.ts`) | on-chain `verifyAction` via deployed AuthResolver + Verifier |

## References

- AuthResolver prototype spec v1.0-draft.02 (normative): §2 (three-layer framing), §3.2
  (schemes), §4.5 (key naming + record profile), §5.1–§5.2 (`DenyReason`, ordering), §6.1–§6.3
  (record structs).
- `references/ensip-25-verification.md` — layer 1 (identity binding).
- `references/agent-text-record-schema.md` — layer 2 (`agent:*` attribution).
- `references/namestone-integration.md` — the text-record surface this pilot writes to.
