#!/usr/bin/env node
// verify-artifacts.mjs — OFFLINE verification of the artifacts a completed
// hire hands back: the signed delivery receipt, and the rail's redemption
// attestation. No network. No keys read beyond the public keys you pass in.
//
//   # Delivery receipt (signed by the PROVIDER, key taken from your own grant):
//   node scripts/verify-artifacts.mjs receipt \
//     --receipt ./receipt.json --signature <base64> \
//     --grant ./grant.json --grant-hash <64-hex>
//
//   # Redemption attestation (signed by the RAIL's attestor — pass the
//   # attestor key you saw on the VERIFIED manifest, via discover.mjs):
//   node scripts/verify-artifacts.mjs attestation \
//     --attestation ./attestation.json --signature <base64> \
//     --attestor-key <base64-from-verified-manifest>
//
// The receipt check calls @voidly/session's verifyDeliveryReceipt — it binds
// the receipt to YOUR copy of the grant (hash, offer, provider DID) and
// verifies the provider's Ed25519 signature under the key the grant already
// carries. No second trust root appears: a receipt about a different hire, or
// signed by anyone else, is refused by name.
//
// The attestation check validates shape (validateRedemptionAttestation) and
// the rail's signature (verifyDetached) under the attestor key — which MUST
// come from the manifest you verified with the DID pin, never from the
// artifact itself and never from chat.
//
// Exit 0 VERIFIED / 1 REFUSED, by name.

import { readFileSync } from "node:fs";
import {
  validateRedemptionAttestation,
  verifyDeliveryReceipt,
  verifyDetached,
} from "@voidly/session";

const [mode, ...rest] = process.argv.slice(2);
const flag = (name) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};
const refuse = (name, detail) => {
  console.error(`REFUSED  ${name}${detail ? ` — ${detail}` : ""}`);
  process.exit(1);
};
const loadJson = (path, what) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    refuse(`${what}_unreadable`, e.message);
  }
};

if (mode === "receipt") {
  const receiptPath = flag("--receipt");
  const signature = flag("--signature");
  const grantPath = flag("--grant");
  const grantHash = flag("--grant-hash");
  if (!receiptPath || !signature || !grantPath || !grantHash) {
    refuse("missing_arguments", "need --receipt --signature --grant --grant-hash");
  }
  const receipt = loadJson(receiptPath, "receipt");
  const grant = loadJson(grantPath, "grant");
  const verified = verifyDeliveryReceipt({
    receipt,
    signatureBase64: signature,
    grant,
    grantHash,
    nowMs: Date.now(),
  });
  if (!verified.ok) refuse(verified.reason);
  console.log("VERIFIED  delivery receipt");
  console.log(`  grant_hash: ${grantHash}`);
  console.log("  signed by the provider key YOUR grant names, about THIS hire.");
  process.exit(0);
}

if (mode === "attestation") {
  const attestationPath = flag("--attestation");
  const signature = flag("--signature");
  const attestorKeyBase64 = flag("--attestor-key");
  if (!attestationPath || !signature || !attestorKeyBase64) {
    refuse("missing_arguments", "need --attestation --signature --attestor-key");
  }
  const raw = loadJson(attestationPath, "attestation");
  const shaped = validateRedemptionAttestation(raw, Date.now());
  if (!shaped.ok) refuse(shaped.reason);
  let key;
  try {
    key = Uint8Array.from(Buffer.from(attestorKeyBase64, "base64"));
  } catch {
    refuse("attestor_key_undecodable");
  }
  if (key.length !== 32) refuse("attestor_key_wrong_length", `${key.length} bytes, need 32`);
  if (!verifyDetached(shaped.env, signature, key)) {
    refuse("attestation_signature_invalid");
  }
  console.log("VERIFIED  redemption attestation");
  console.log(`  grant_hash: ${shaped.env.grant_hash}`);
  console.log("  signature valid under the attestor key YOU passed — take that key from the VERIFIED manifest (discover.mjs).");
  process.exit(0);
}

refuse("unknown_mode", 'first argument must be "receipt" or "attestation"');
