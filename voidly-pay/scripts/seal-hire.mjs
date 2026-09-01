#!/usr/bin/env node
// seal-hire.mjs — build and seal a hire LOCALLY. Zero funds required.
//
//   node scripts/seal-hire.mjs --brief ./brief.json [--keep ./keep.json]
//
// brief.json:
//   {
//     "brief":  "the question you are paying the provider to answer",
//     "payer":  "0x… the Base account the money WOULD leave (no funds needed to seal)",
//     "service": "voidly.observatory.query/v1"        // optional, defaults to the pin
//   }
//
// What this does: verifies the pinned provider (same as discover.mjs), mints
// an EPHEMERAL Ed25519 hirer identity, seals the brief to the provider's
// verified encryption key, and prints the resulting wire envelopes. What it
// does NOT do: it never POSTs anything, never signs a payment, never touches a
// wallet. The brief is unreadable to everyone but the pinned provider from the
// moment this process exits.
//
// The session key is the ONE secret this mints that later opens the paid-for
// result. Without --keep it is destroyed on exit (fine for a demo). With
// --keep FILE, the session key AND the ephemeral hirer identity are written to
// FILE (0600) — both are required to later submit this exact hire and read
// back its result. The keep file is worth at most one payment; treat it like a
// ticket, not like a wallet key.
//
// Exit 0 sealed / 1 refused, by name.

import { readFileSync, writeFileSync, chmodSync } from "node:fs";
import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";
const { encodeBase64 } = naclUtil;
import {
  buildHire,
  deriveDidFromSigningKey,
  exportSessionKeyBytes,
  destroySessionKey,
  fetchVerifiedProvider,
  x402SessionAccountCaip10,
} from "@voidly/session";
import {
  CANONICAL_USDC_BASE,
  EXPECTED_CHAIN,
  SERVICE_REF,
  verifiedProvider,
} from "./lib/pins.mjs";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const briefPath = flag("--brief");
const keepPath = flag("--keep");
if (!briefPath) {
  console.error("REFUSED  missing_brief — usage: node scripts/seal-hire.mjs --brief ./brief.json [--keep ./keep.json]");
  process.exit(1);
}

let spec;
try {
  spec = JSON.parse(readFileSync(briefPath, "utf8"));
} catch (e) {
  console.error(`REFUSED  brief_unreadable — ${e.message}`);
  process.exit(1);
}
if (typeof spec.brief !== "string" || spec.brief.length === 0) {
  console.error("REFUSED  brief_missing_text — brief.json needs a non-empty \"brief\" string");
  process.exit(1);
}
if (typeof spec.payer !== "string") {
  console.error("REFUSED  payer_missing — brief.json needs \"payer\": the 0x account the money would leave. No funds are needed to seal.");
  process.exit(1);
}
const serviceRef = spec.service ?? SERVICE_REF;

// 1. VERIFY the provider. The brief is sealed to whatever key this returns —
//    which is exactly why an unverified manifest is a refusal, not a warning.
const out = await verifiedProvider(fetchVerifiedProvider);
if (!out.ok) {
  console.error(`REFUSED  ${out.reason}${out.detail ? ` — ${out.detail}` : ""}`);
  process.exit(1);
}
const provider = out.provider;
const offering = provider.manifest.services.find((s) => s.ref === serviceRef);
if (!offering) {
  console.error(`REFUSED  service_not_offered — verified manifest does not offer ${serviceRef}`);
  process.exit(1);
}
// SKILL.md pledges Base mainnet + canonical USDC on every leg. Enforce it
// here, before anything is sealed against the offering.
if (offering.price.chain !== EXPECTED_CHAIN) {
  console.error(`REFUSED  chain_not_base — offering is on ${offering.price.chain}, this skill is reviewed only for ${EXPECTED_CHAIN}`);
  process.exit(1);
}
if (offering.price.asset !== `${EXPECTED_CHAIN}/erc20:${CANONICAL_USDC_BASE}`) {
  console.error(`REFUSED  asset_not_canonical_usdc — offering asset is ${offering.price.asset}`);
  process.exit(1);
}

// 2. EPHEMERAL hirer identity. Minted here, used to sign the hire envelopes,
//    never sent anywhere on its own. deriveDidFromSigningKey takes the RAW
//    Uint8Array public key — not base64.
const kp = nacl.sign.keyPair();
const did = deriveDidFromSigningKey(kp.publicKey);
const sign = (bytes) => nacl.sign.detached(bytes, kp.secretKey);

// 3. SEAL. Every money field is copied VERBATIM off the verified manifest —
//    chain, asset, payee, both bounds. The one field that is ours is the payer
//    account, and it goes through x402SessionAccountCaip10, which lowercases:
//    a checksummed address written by hand is refused at redemption, not here.
const payerAccount = x402SessionAccountCaip10(offering.price.chain, spec.payer);
if (payerAccount === null) {
  console.error("REFUSED  payer_account_unusable — not a plain 0x…40-hex EVM address");
  process.exit(1);
}

const hire = await buildHire({
  hirer: { did, signingPublicKeyBase64: encodeBase64(kp.publicKey), sign },
  provider,
  service: { ref: serviceRef },
  task: { brief: spec.brief },
  price: {
    chain: offering.price.chain,
    asset: offering.price.asset,
    payerAccount,
    payeeAccount: offering.price.payee_account,
    minAmount: offering.price.min_amount,
    maxAmount: offering.price.max_amount,
  },
  ttl: { offerMs: 30 * 60_000, grantMs: 10 * 60_000 },
  nowMs: Date.now(),
});
if (!hire.ok) {
  console.error(`REFUSED  ${hire.reason}`);
  process.exit(1);
}

console.log(`SEALED   grant_hash ${hire.keep.grant_hash}`);
console.log(`hirer:   ${did} (ephemeral, minted by this run)`);
console.log(`sealed to: ${provider.manifest.provider_did} (verified)`);
console.log("");
console.log("wire (transmit-safe — the brief inside is sealed):");
console.log(JSON.stringify(hire.wire, null, 2));
console.log("");

if (keepPath) {
  const sessionKeyBytes = exportSessionKeyBytes(hire.keep.sessionKey);
  if (sessionKeyBytes === null) {
    console.error("REFUSED  session_key_unexportable");
    process.exit(1);
  }
  const keep = {
    _what:
      "Everything needed to later submit THIS hire and open THIS result: the session key and the ephemeral hirer identity. Local file, never transmitted. Worth at most one payment.",
    version: 1,
    grant_hash: hire.keep.grant_hash,
    endpoint_base_url: provider.manifest.worker_base_url,
    wire: hire.wire,
    session_key_base64: encodeBase64(sessionKeyBytes),
    hirer: {
      did,
      signing_public_key_base64: encodeBase64(kp.publicKey),
      signing_secret_key_base64: encodeBase64(kp.secretKey),
    },
  };
  writeFileSync(keepPath, JSON.stringify(keep, null, 2), { mode: 0o600 });
  chmodSync(keepPath, 0o600);
  console.log(`kept:    ${keepPath} (0600 — session key + ephemeral identity)`);
} else {
  destroySessionKey(hire.keep.sessionKey);
  console.log(
    "kept:    nothing — no --keep given, session key destroyed. This sealed hire\n" +
      "         can never be opened by anyone, including you. Pass --keep FILE\n" +
      "         before building a hire you intend to pay for.",
  );
}
console.log("");
console.log("Nothing was transmitted. Sealing is local and costs nothing.");
