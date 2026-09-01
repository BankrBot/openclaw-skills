#!/bin/bash
# ENS Agent Identity - Phase A: publish AuthResolver auth.* records via NameStone
#
# Forward-declaring scaffold for the AuthResolver + Verifier pilot (Phase A,
# read-only verification demo). This script is REAL and runs end-to-end today:
# it publishes auth.credential / auth.capability / auth.revocation records on an
# ENS subname via NameStone. The contracts that *consume* these records (the
# AuthResolverImpl + Verifier) are the unfunded M1 deliverable (target 2026-08-31)
# and are NOT exercised here. See references/auth-record-schema.md.
#
# CLOBBER PREVENTION (critical): NameStone set-name REPLACES the full text_records
# map. This script GETs the existing records, MERGES the new auth.* keys in, and
# POSTs the full merged map — so existing agent:* and ENSIP-25 keys survive.
#
# Phase-A value format is JSON-in-text-record, a deliberate simplification. The
# spec's normative profile is CBOR in the IDataResolver.data slot; that needs the
# M1-deployed AuthResolverImpl. Phase A migrates to setData+CBOR at M1.
#
# Usage:
#   ./publish-auth-records.sh <agent-name> [credential-id]
#
# Example (build credential from fields):
#   AUTH_SIGNER_ADDRESS=0x579bc9... AUTH_SCOPE="swap,bridge,limit-order" \
#     ./publish-auth-records.sh authtest primary
#
# Example (supply raw JSON verbatim):
#   AUTH_CREDENTIAL_JSON='{"scheme":"ECDSA-secp256k1","address":"0x..","notBefore":1747000000,"notAfter":0,"capabilityRef":"primary","schemaVersion":"phase-a/0.1"}' \
#     ./publish-auth-records.sh authtest primary
#
# Environment:
#   NAMESTONE_API_KEY    (required) NameStone API key. NEVER printed by this script.
#   BANKR_ENS_DOMAIN     (default bankrtest.eth) parent domain.
#   AUTH_SUBNAME_ADDRESS (optional) addr record to set IF the subname does not exist
#                        yet. If the subname already exists, its current address is
#                        preserved automatically.
#
#   Credential (auth.credential[<id>]) — REQUIRED. Either:
#     AUTH_CREDENTIAL_JSON   raw JSON, used verbatim (must parse as an object), OR
#     built from fields:
#       AUTH_SIGNER_ADDRESS  (required if no JSON) signer wallet whose signatures
#                            the verifier checks. NOT hard-coded; you pass it.
#       AUTH_SCHEME          (default ECDSA-secp256k1)
#       AUTH_NOT_BEFORE      (default: now, unix seconds)
#       AUTH_NOT_AFTER       (default 0 = no expiry)
#       AUTH_CAPABILITY_REF  (default: <credential-id>)
#
#   Capability (auth.capability[<id>]) — OPTIONAL. Either:
#     AUTH_CAPABILITY_JSON   raw JSON verbatim, OR
#     built from fields (only if AUTH_SCOPE is set):
#       AUTH_SCOPE           comma-separated scope, e.g. "swap,bridge,limit-order"
#       AUTH_EXPIRY          (default 0 = no expiry)
#
#   Revocation (auth.revocation[<id>]) — OPTIONAL (deny-path demo only). Either:
#     AUTH_REVOCATION_JSON   raw JSON verbatim, OR
#     built from fields (only if AUTH_REVOKED_AT is set):
#       AUTH_REVOKED_AT      unix seconds when revoked
#       AUTH_REVOKE_REASON   (default "")
#
# Output: human-readable progress -> stderr; machine-readable JSON result -> stdout.

set -euo pipefail

AGENT_NAME="${1:?Usage: publish-auth-records.sh <agent-name> [credential-id]}"
CRED_ID="${2:-primary}"
DOMAIN="${BANKR_ENS_DOMAIN:-bankrtest.eth}"
NS_BASE="https://namestone.com/api/public_v1"

if [ -z "${NAMESTONE_API_KEY:-}" ]; then
  echo "Error: NAMESTONE_API_KEY environment variable not set" >&2
  echo "Get your API key at https://namestone.com" >&2
  exit 1
fi

# A credential is mandatory: either raw JSON or a signer address to build from.
if [ -z "${AUTH_CREDENTIAL_JSON:-}" ] && [ -z "${AUTH_SIGNER_ADDRESS:-}" ]; then
  echo "Error: no credential supplied." >&2
  echo "Set AUTH_CREDENTIAL_JSON=<json> or AUTH_SIGNER_ADDRESS=<0x...>" >&2
  exit 1
fi

echo "=== Phase A: Publish AuthResolver auth.* records ===" >&2
echo "Subname:       ${AGENT_NAME}.${DOMAIN}" >&2
echo "Credential id: ${CRED_ID}" >&2
echo "Format:        JSON-in-text-record (Phase-A only; migrates to setData+CBOR at M1)" >&2
echo "" >&2

# ---------------------------------------------------------------------------
# Step 1: Build the new auth.* record map.
# All user input is passed via environment variables to prevent shell/Node
# injection (matches the hardening in set-agent-records.sh).
# Emits a JSON object: { "auth.credential[id]": "<json-string>", ... }
# ---------------------------------------------------------------------------
echo "Step 1: Building auth.* records..." >&2

AUTH_RECORDS_JSON=$(
  CRED_ID="$CRED_ID" \
  AUTH_CREDENTIAL_JSON="${AUTH_CREDENTIAL_JSON:-}" \
  AUTH_CAPABILITY_JSON="${AUTH_CAPABILITY_JSON:-}" \
  AUTH_REVOCATION_JSON="${AUTH_REVOCATION_JSON:-}" \
  AUTH_SIGNER_ADDRESS="${AUTH_SIGNER_ADDRESS:-}" \
  AUTH_SCHEME="${AUTH_SCHEME:-ECDSA-secp256k1}" \
  AUTH_NOT_BEFORE="${AUTH_NOT_BEFORE:-}" \
  AUTH_NOT_AFTER="${AUTH_NOT_AFTER:-0}" \
  AUTH_CAPABILITY_REF="${AUTH_CAPABILITY_REF:-}" \
  AUTH_SCOPE="${AUTH_SCOPE:-}" \
  AUTH_EXPIRY="${AUTH_EXPIRY:-0}" \
  AUTH_REVOKED_AT="${AUTH_REVOKED_AT:-}" \
  AUTH_REVOKE_REASON="${AUTH_REVOKE_REASON:-}" \
  node -e '
const SCHEMA_VERSION = "phase-a/0.1";
const id = process.env.CRED_ID;
const out = {};

function parseOrFail(raw, label) {
  let v;
  try { v = JSON.parse(raw); }
  catch (e) { console.error("Error: " + label + " is not valid JSON: " + e.message); process.exit(1); }
  if (typeof v !== "object" || v === null || Array.isArray(v)) {
    console.error("Error: " + label + " must be a JSON object"); process.exit(1);
  }
  return v;
}

// --- Credential (required) ---
let credential;
if (process.env.AUTH_CREDENTIAL_JSON) {
  credential = parseOrFail(process.env.AUTH_CREDENTIAL_JSON, "AUTH_CREDENTIAL_JSON");
} else {
  const addr = process.env.AUTH_SIGNER_ADDRESS;
  if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
    console.error("Error: AUTH_SIGNER_ADDRESS must be a 20-byte 0x address, got: " + addr);
    process.exit(1);
  }
  const notBefore = process.env.AUTH_NOT_BEFORE
    ? parseInt(process.env.AUTH_NOT_BEFORE, 10)
    : Math.floor(Date.now() / 1000);
  credential = {
    scheme: process.env.AUTH_SCHEME,                  // string form; on-chain canonical is keccak256(scheme)
    address: addr,                                    // DECISION A1: address, not 64-byte uncompressed pubKey
    notBefore,
    notAfter: parseInt(process.env.AUTH_NOT_AFTER, 10),
    capabilityRef: process.env.AUTH_CAPABILITY_REF || id,
    schemaVersion: SCHEMA_VERSION,
    // TODO(M1): spec §3.2 requires pubKey = 64-byte uncompressed secp256k1 key.
    // Phase A stores the address (what NameStone + Bankr expose); the M1 verifier
    // path needs the full key.
  };
}
out["auth.credential[" + id + "]"] = JSON.stringify(credential);

// --- Capability (optional) ---
if (process.env.AUTH_CAPABILITY_JSON) {
  const cap = parseOrFail(process.env.AUTH_CAPABILITY_JSON, "AUTH_CAPABILITY_JSON");
  out["auth.capability[" + id + "]"] = JSON.stringify(cap);
} else if (process.env.AUTH_SCOPE) {
  out["auth.capability[" + id + "]"] = JSON.stringify({
    scope: process.env.AUTH_SCOPE,
    expiry: parseInt(process.env.AUTH_EXPIRY, 10),
    schemaVersion: SCHEMA_VERSION,
    // revocationKey omitted => verifyAction uses the credential id as revocation key.
    // NOTE: capability records are publishable in v1 but NOT consumed by verifyAction (spec §6.2).
  });
}

// --- Revocation (optional; deny-path demo only) ---
if (process.env.AUTH_REVOCATION_JSON) {
  const rev = parseOrFail(process.env.AUTH_REVOCATION_JSON, "AUTH_REVOCATION_JSON");
  out["auth.revocation[" + id + "]"] = JSON.stringify(rev);
} else if (process.env.AUTH_REVOKED_AT) {
  out["auth.revocation[" + id + "]"] = JSON.stringify({
    revokedAt: parseInt(process.env.AUTH_REVOKED_AT, 10),
    reason: process.env.AUTH_REVOKE_REASON || "",
    schemaVersion: SCHEMA_VERSION,
  });
}

console.log(JSON.stringify(out));
'
)

# Show which auth.* keys we're about to write (values are short JSON; safe to echo).
AUTH_RECORDS_JSON="$AUTH_RECORDS_JSON" node -e '
const r = JSON.parse(process.env.AUTH_RECORDS_JSON);
for (const k of Object.keys(r)) console.error("  + " + k);
' >&2
echo "" >&2

# ---------------------------------------------------------------------------
# Step 2: GET existing records (the read half of read-merge-write).
# ---------------------------------------------------------------------------
echo "Step 2: Reading existing records (clobber prevention)..." >&2

ENCODED=$(AGENT_NAME="$AGENT_NAME" DOMAIN="$DOMAIN" node -e '
console.log(encodeURIComponent(process.env.AGENT_NAME));
console.log(encodeURIComponent(process.env.DOMAIN));
')
ENCODED_NAME=$(echo "$ENCODED" | head -1)
ENCODED_DOMAIN=$(echo "$ENCODED" | tail -1)

GET_RESPONSE=$(curl -s "${NS_BASE}/get-names?domain=${ENCODED_DOMAIN}&name=${ENCODED_NAME}" \
  -H "Authorization: $NAMESTONE_API_KEY")

# Extract existing address + existing text_records map. Defaults: "" and {}.
EXISTING=$(GET_RESPONSE="$GET_RESPONSE" AGENT_NAME="$AGENT_NAME" node -e '
let data;
try { data = JSON.parse(process.env.GET_RESPONSE); } catch { data = []; }
// NameStone get-names returns ALL names under the domain as an array; the `name`
// query param is NOT honored server-side. Filter client-side by exact label, or we
// would read (and merge) the wrong subname'"'"'s records.
const rec = Array.isArray(data) ? data.find(r => r && r.name === process.env.AGENT_NAME) : null;
const addr = rec && rec.address ? rec.address : "";
const tr = rec && rec.text_records && typeof rec.text_records === "object" ? rec.text_records : {};
console.log(addr);
console.log(JSON.stringify(tr));
')
EXISTING_ADDR=$(echo "$EXISTING" | head -1)
EXISTING_RECORDS_JSON=$(echo "$EXISTING" | tail -1)

EXISTING_COUNT=$(EXISTING_RECORDS_JSON="$EXISTING_RECORDS_JSON" node -e '
console.log(Object.keys(JSON.parse(process.env.EXISTING_RECORDS_JSON)).length);
')

if [ -n "$EXISTING_ADDR" ]; then
  echo "  Found existing subname. address=$EXISTING_ADDR, existing text_records=$EXISTING_COUNT" >&2
  EXISTING_RECORDS_JSON="$EXISTING_RECORDS_JSON" node -e '
const r = JSON.parse(process.env.EXISTING_RECORDS_JSON);
for (const k of Object.keys(r)) console.error("    keep: " + k);
' >&2
  TARGET_ADDR="$EXISTING_ADDR"
else
  echo "  Subname does not exist yet (no records to preserve)." >&2
  if [ -z "${AUTH_SUBNAME_ADDRESS:-}" ]; then
    echo "Error: subname ${AGENT_NAME}.${DOMAIN} not found and AUTH_SUBNAME_ADDRESS not set." >&2
    echo "Register it first (e.g. ./set-agent-records.sh ...) or pass AUTH_SUBNAME_ADDRESS=<0x...>." >&2
    exit 1
  fi
  TARGET_ADDR="$AUTH_SUBNAME_ADDRESS"
fi
echo "" >&2

# ---------------------------------------------------------------------------
# Step 3: Merge (existing keys preserved; auth.* keys added/overwritten) and POST.
# ---------------------------------------------------------------------------
echo "Step 3: Merging and publishing (read-merge-write)..." >&2

REQUEST_BODY=$(
  AGENT_NAME="$AGENT_NAME" \
  DOMAIN="$DOMAIN" \
  TARGET_ADDR="$TARGET_ADDR" \
  EXISTING_RECORDS_JSON="$EXISTING_RECORDS_JSON" \
  AUTH_RECORDS_JSON="$AUTH_RECORDS_JSON" \
  node -e '
const existing = JSON.parse(process.env.EXISTING_RECORDS_JSON);
const auth = JSON.parse(process.env.AUTH_RECORDS_JSON);
// Existing first, then auth.* — preserves all prior keys, overwrites only the
// auth.* keys being (re)published this run.
const merged = { ...existing, ...auth };
console.log(JSON.stringify({
  name: process.env.AGENT_NAME,
  domain: process.env.DOMAIN,
  address: process.env.TARGET_ADDR,
  text_records: merged,
}));
'
)

POST_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${NS_BASE}/set-name" \
  -H "Authorization: $NAMESTONE_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$REQUEST_BODY")

HTTP_CODE=$(echo "$POST_RESPONSE" | tail -1)
POST_BODY=$(echo "$POST_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -lt 200 ] || [ "$HTTP_CODE" -ge 300 ]; then
  echo "Error (HTTP $HTTP_CODE): $POST_BODY" >&2
  exit 1
fi
echo "  set-name OK (HTTP $HTTP_CODE)" >&2
echo "" >&2

# ---------------------------------------------------------------------------
# Step 4: Re-read and prove the merge (before/after clobber proof).
# ---------------------------------------------------------------------------
echo "Step 4: Verifying merge (auth.* present AND prior keys survived)..." >&2
sleep 2

VERIFY_RESPONSE=$(curl -s "${NS_BASE}/get-names?domain=${ENCODED_DOMAIN}&name=${ENCODED_NAME}" \
  -H "Authorization: $NAMESTONE_API_KEY")

RESULT=$(
  VERIFY_RESPONSE="$VERIFY_RESPONSE" \
  EXISTING_RECORDS_JSON="$EXISTING_RECORDS_JSON" \
  AUTH_RECORDS_JSON="$AUTH_RECORDS_JSON" \
  AGENT_NAME="$AGENT_NAME" \
  DOMAIN="$DOMAIN" \
  node -e '
let data;
try { data = JSON.parse(process.env.VERIFY_RESPONSE); } catch { data = []; }
// Filter by exact label — get-names ignores the `name` query param (returns all names).
const rec = (Array.isArray(data) ? data.find(r => r && r.name === process.env.AGENT_NAME) : null) || {};
const now = rec.text_records && typeof rec.text_records === "object" ? rec.text_records : {};
const before = JSON.parse(process.env.EXISTING_RECORDS_JSON);
const auth = JSON.parse(process.env.AUTH_RECORDS_JSON);

const nowKeys = Object.keys(now);
const authKeys = Object.keys(auth);

// Did every prior (non-auth) key survive?
const preserved = Object.keys(before).filter(k => !(k in auth));
const survived = preserved.filter(k => now[k] === before[k]);
const lost = preserved.filter(k => now[k] !== before[k]);

// Did every auth.* key land with the value we set?
const authLanded = authKeys.filter(k => now[k] === auth[k]);
const authMissing = authKeys.filter(k => now[k] !== auth[k]);

console.error("  --- before/after ---");
console.error("  preserved keys: " + preserved.length + " expected, " + survived.length + " survived" + (lost.length ? (", LOST: " + lost.join(", ")) : ""));
console.error("  auth.* keys:    " + authKeys.length + " set, " + authLanded.length + " landed" + (authMissing.length ? (", MISSING: " + authMissing.join(", ")) : ""));
console.error("  total keys now: " + nowKeys.length);

const ok = lost.length === 0 && authMissing.length === 0;
console.error("");
console.error(ok ? "  CLOBBER CHECK PASSED: no prior keys lost; all auth.* keys present." : "  CLOBBER CHECK FAILED.");

console.log(JSON.stringify({
  success: ok,
  name: process.env.AGENT_NAME + "." + process.env.DOMAIN,
  authKeysWritten: authKeys,
  preservedKeys: preserved,
  lostKeys: lost,
  totalKeys: nowKeys.length,
  format: "json-in-text-record",
  note: "Phase-A scaffold; records consumed by AuthResolverImpl + Verifier at M1 (not yet deployed).",
}));
'
)

echo "$RESULT"
