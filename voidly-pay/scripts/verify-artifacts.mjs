#!/usr/bin/env node
// verify-artifacts.mjs — verify the artifacts a completed hire hands back: the
// signed delivery receipt, and the rail's redemption attestation. No keys are
// read beyond public keys.
//
//   # Delivery receipt (signed by the PROVIDER, key taken from your own grant):
//   # OFFLINE — no network at all.
//   node scripts/verify-artifacts.mjs receipt \
//     --receipt ./receipt.json --signature <base64> \
//     --grant ./keep.grant.json --grant-hash <64-hex>
//
//   # Redemption attestation. Bound to YOUR grant, and signed by the attestor
//   # key on the VERIFIED manifest — which this script fetches and verifies
//   # itself under the DID pin, rather than believing a key you typed.
//   node scripts/verify-artifacts.mjs attestation \
//     --attestation ./attestation.json --signature <base64> \
//     --grant ./keep.grant.json --grant-hash <64-hex> \
//     [--attestor-key <base64>]        # optional; must EQUAL the verified manifest's
//
// WHY ATTESTATION MODE IS NO LONGER OFFLINE, AND NO LONGER TAKES ITS TRUST
// ROOT FROM ARGV. Until this fix, attestation mode had no subject binding at
// all and was the only script here that did not import lib/pins.mjs: it took
// the attestor key from `--attestor-key`, never compared it to any verified
// manifest, and never looked at provider_did, chain or asset. A forged
// attestation for a hire that never existed — self-signed, with the forger's
// own key passed on the command line — printed VERIFIED. The comment telling
// you to "take that key from the verified manifest" was the only thing
// enforcing it, and a comment claiming a property is not the property.
//
// So attestation mode binds the artifact to YOUR copy of the grant (grant
// hash, offer hash, capsule hash, both DIDs, chain, asset, price band) and
// takes the signing key from the pinned, signature-verified manifest.
// Passing --attestor-key is still allowed, but it is checked AGAINST the
// manifest rather than believed.
//
// RECEIPT MODE ENFORCES THE PINS TOO. Its trust root is the grant file, and a
// grant file is something anyone can hand you: a grant naming a provider
// that is not the pin, carrying that provider's own keys, with a receipt that
// provider signed, verified fine offline — "signed by the provider key YOUR
// grant names" was true and worthless. So before the SDK is asked anything,
// the grant must name the pinned provider DID, Base, and canonical USDC
// (grant_provider_not_pinned / grant_chain_not_base /
// grant_asset_not_canonical_usdc), and must pass the SDK's own validateGrant
// (grant_invalid — <reason>) so a malformed grant is named as such instead
// of surfacing as a receipt-shaped mismatch. Then verifyDeliveryReceipt binds
// the receipt to that grant (hash, offer, provider DID) and verifies the
// provider's Ed25519 signature under the key the grant carries.
//
// Exit 0 VERIFIED / 1 REFUSED, by name.

import { readFileSync, realpathSync, statSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  envelopeHash,
  fetchVerifiedProvider,
  validateGrant,
  validateRedemptionAttestation,
  verifyDeliveryReceipt,
  verifyDetached,
} from "@voidly/session";
import {
  EXPECTED_PRICE_MAX_AMOUNT,
  EXPECTED_PRICE_MIN_AMOUNT,
  EXPECTED_PAYEE_ACCOUNT,
  CANONICAL_USDC_BASE,
  EXPECTED_CHAIN,
  EXPECTED_PROVIDER_DID,
  usableArgValue,
  verifiedProvider,
} from "./lib/pins.mjs";

/**
 * THE SUBJECT BINDING. Pure, so it is testable without a network: does this
 * attestation describe the hire whose grant you hold, on the chain and asset
 * this skill is reviewed for, under the pinned provider?
 *
 * Every field compared here also exists on the grant, which is the document
 * you built and kept. An attestation that agrees with the pins but not with
 * your grant is an attestation about somebody else's hire.
 *
 * @returns {{ok:true} | {ok:false, reason:string, detail:string}}
 */
/**
 * Echo a value from a file someone handed you ONLY when it has the shape the
 * field is supposed to have. A grant file's provider_did carrying a newline
 * and a fake "VERIFIED" block reached stderr verbatim — the class round one
 * closed for the index's `count`, reopened on a different untrusted input.
 * An agent reads stderr as context; a value that is not a DID, a hash, or a
 * CAIP identifier is described, never printed.
 */
const DID_SHAPE = /^did:voidly:[1-9A-HJ-NP-Za-km-z]{1,64}$/;
const HASH_SHAPE = /^(0x)?[0-9a-fA-F]{64}$/;
const CAIP_SHAPE = /^[-a-z0-9]{3,8}:[-_a-zA-Z0-9]{1,32}(\/[-a-z0-9]{3,8}:[-.%a-zA-Z0-9]{1,128})?$/;
/** CAIP-10: a chain plus an account. The shape the payer/payee fields carry. */
const CAIP10_SHAPE = /^[-a-z0-9]{3,8}:[-_a-zA-Z0-9]{1,32}:[-.%a-zA-Z0-9]{1,128}$/;
/** Receipts, grants and attestations are a few KB; a FIFO or a device is not one. */
const MAX_ARTIFACT_FILE_BYTES = 64 * 1024;
const DECIMAL_SHAPE = /^[0-9]{1,78}$/;
export const shown = (value, shape) =>
  typeof value === "string" && shape.test(value) ? value : `(not a well-formed value: ${value === undefined ? "absent" : typeof value})`;

export function bindAttestationToGrant({ attestation: a, grant: g, grantHash }) {
  const bad = (reason, detail) => ({ ok: false, reason, detail });
  const norm = (v) => String(v ?? "").replace(/^0x/, "").toLowerCase();
  if (g === null || typeof g !== "object") return bad("grant_unreadable", "grant is not an object");

  if (norm(a.grant_hash) !== norm(grantHash)) {
    return bad("attestation_grant_mismatch", `attests grant ${shown(a.grant_hash, HASH_SHAPE)}, you asked about ${shown(grantHash, HASH_SHAPE)}`);
  }
  for (const [field, mine, shape] of [
    ["offer_hash", g.offer_hash, HASH_SHAPE],
    ["capsule_hash", g.capsule_hash, HASH_SHAPE],
    ["hirer_did", g.hirer_did, DID_SHAPE],
    ["provider_did", g.provider_did, DID_SHAPE],
  ]) {
    if (String(a[field]) !== String(mine)) {
      return bad(
        "attestation_grant_mismatch",
        `attestation ${field} is ${shown(a[field], shape)}, your grant says ${shown(mine, shape)}`,
      );
    }
  }
  // The pins, enforced here too: an attestation is a claim about money, and
  // this skill is reviewed for exactly one chain and one asset.
  if (a.provider_did !== EXPECTED_PROVIDER_DID) {
    return bad("attestation_provider_not_pinned", `provider_did ${shown(a.provider_did, DID_SHAPE)}`);
  }
  if (a.settled_chain !== EXPECTED_CHAIN || String(g.price_chain) !== EXPECTED_CHAIN) {
    return bad(
      "attestation_chain_not_base",
      `attestation settled_chain ${shown(a.settled_chain, CAIP_SHAPE)}, grant price_chain ${shown(g.price_chain, CAIP_SHAPE)}, expected ${EXPECTED_CHAIN}`,
    );
  }
  const canonicalAsset = `${EXPECTED_CHAIN}/erc20:${CANONICAL_USDC_BASE}`;
  if (a.settled_asset !== canonicalAsset || String(g.price_asset) !== canonicalAsset) {
    return bad(
      "attestation_asset_not_canonical_usdc",
      `attestation settled_asset ${shown(a.settled_asset, CAIP_SHAPE)}, grant price_asset ${shown(g.price_asset, CAIP_SHAPE)}`,
    );
  }
  // The settled amount must sit inside the band YOUR grant froze. Outside it
  // is either a different hire or a price nobody agreed to.
  let settled, min, max;
  try {
    settled = BigInt(a.settled_amount);
    min = BigInt(g.price_min_amount);
    max = BigInt(g.price_max_amount);
  } catch {
    return bad("attestation_amount_unreadable", `settled_amount ${shown(a.settled_amount, DECIMAL_SHAPE)}`);
  }
  if (settled < min || settled > max) {
    return bad(
      "attestation_amount_outside_grant_band",
      `settled ${settled} is outside your grant's ${min}..${max}`,
    );
  }
  return { ok: true };
}

/**
 * THE PINS, ON THE GRANT ITSELF. Pure. A grant is the trust root of receipt
 * mode, so the grant has to be one this skill is reviewed for: the pinned
 * provider, Base, canonical USDC. Anything else verifies nothing this skill
 * can vouch for, however well it is signed.
 */
export function bindGrantToPins(g) {
  const bad = (reason, detail) => ({ ok: false, reason, detail });
  if (g === null || typeof g !== "object" || Array.isArray(g)) return bad("grant_unreadable", "grant is not an object");
  if (g.provider_did !== EXPECTED_PROVIDER_DID) {
    return bad("grant_provider_not_pinned", `your grant names provider ${shown(g.provider_did, DID_SHAPE)}; this skill is reviewed for exactly ${EXPECTED_PROVIDER_DID}`);
  }
  if (g.price_chain !== EXPECTED_CHAIN) {
    return bad("grant_chain_not_base", `your grant prices on ${shown(g.price_chain, CAIP_SHAPE)}, expected ${EXPECTED_CHAIN}`);
  }
  const canonicalAsset = `${EXPECTED_CHAIN}/erc20:${CANONICAL_USDC_BASE}`;
  if (g.price_asset !== canonicalAsset) {
    return bad("grant_asset_not_canonical_usdc", `your grant's asset is ${shown(g.price_asset, CAIP_SHAPE)}, expected ${canonicalAsset}`);
  }
  if (g.price_payee_account !== EXPECTED_PAYEE_ACCOUNT) {
    return bad("grant_payee_not_pinned", `your grant pays ${shown(g.price_payee_account, CAIP10_SHAPE)}, not the pinned ${EXPECTED_PAYEE_ACCOUNT} — a grant naming another payee is a hire this skill was not reviewed for`);
  }
  if (g.price_min_amount !== EXPECTED_PRICE_MIN_AMOUNT || g.price_max_amount !== EXPECTED_PRICE_MAX_AMOUNT) {
    return bad("grant_band_not_pinned", `your grant's price band is not the reviewed ${EXPECTED_PRICE_MIN_AMOUNT}..${EXPECTED_PRICE_MAX_AMOUNT} — a repriced hire is one this skill was not reviewed for`);
  }
  return { ok: true };
}

const refuse = (name, detail) => {
  console.error(`REFUSED  ${name}${detail ? ` — ${detail}` : ""}`);
  process.exit(1);
};

/**
 * A usable flag value: a non-empty string once whitespace AND zero-width
 * characters are removed, not beginning with any dash-like character. `-`,
 * `-k.json`, `‐‐hirer` (U+2010) and a string of U+200B all used to become
 * filenames in the working directory.
 */
export const usableValue = usableArgValue;

const loadJson = (path, what) => {
  // A FIFO hung this read forever and /dev/zero was read until memory ran
  // out; only a regular file of plausible size is read.
  let st;
  try {
    st = statSync(path);
  } catch (e) {
    refuse(`${what}_unreadable`, `--${what} could not be read (${e && e.code ? e.code : "error"})`);
  }
  if (!st.isFile()) refuse(`${what}_unreadable`, `--${what} is not a regular file`);
  if (st.size > MAX_ARTIFACT_FILE_BYTES) refuse(`${what}_unreadable`, `--${what} is ${st.size} bytes; these documents are small`);
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    refuse(`${what}_unreadable`, `--${what} could not be read (${e && e.code ? e.code : "error"})`);
  }
  try {
    return JSON.parse(text);
  } catch {
    // The parser's message quotes the file's own bytes; a file someone handed
    // you is not text to relay.
    refuse(`${what}_unreadable`, `--${what} is not valid JSON`);
  }
};

/**
 * --grant-hash was argv, and nothing ever tied it to --grant.
 *
 * Both modes loaded the grant file AND took a grant hash on the command line,
 * then compared the ARTIFACT to the argv string — so the "binds this to YOUR
 * grant" leg was satisfied by whatever the caller typed. An attacker who
 * supplies both the artifact and the hash makes them agree trivially, and the
 * grant file is decoration. `envelopeHash` was exported by the SDK the whole
 * time and called nowhere in this skill.
 *
 * The hash is now DERIVED from the grant you loaded. --grant-hash stays
 * accepted, as a cross-check the user can make against what they recorded at
 * sealing, but it is no longer the thing that binds.
 */
const grantHashOf = async (grant, claimed) => {
  // Being hashable is not being a grant. keep.json — the file every hirer
  // actually holds — hashes fine and then dies with a hash mismatch that
  // names no remedy, so the likelier mistake refuses FIRST, by name. The
  // real grant schema is the one @voidly/session's validateGrant requires.
  if (
    typeof grant !== "object" ||
    grant === null ||
    Array.isArray(grant) ||
    grant.schema !== "voidly-task-grant/v1"
  ) {
    refuse(
      "grant_not_a_grant_envelope",
      "--grant is not a task-grant envelope (schema voidly-task-grant/v1). " +
        "seal-hire.mjs --keep writes it beside the keep file as <keep>.grant.json, " +
        "and it also lives inside keep.json at wire.grant — do not pass keep.json itself.",
    );
  }
  let derived;
  try {
    derived = await envelopeHash(grant);
  } catch (e) {
    refuse("grant_unhashable", `the grant file is not a hashable envelope: ${e.message}`);
  }
  // `0x` and case are spelling, not disagreement — the same normalization
  // bindAttestationToGrant applies, so one script does not refuse a hash the
  // other accepts.
  const normClaimed = String(claimed ?? "").trim().replace(/^0x/i, "").toLowerCase();
  if (normClaimed && normClaimed !== String(derived).toLowerCase()) {
    refuse(
      "grant_hash_mismatch",
      `--grant-hash ${shown(String(claimed ?? ""), HASH_SHAPE)} is not the hash of --grant (${derived}). ` +
        `The hash that binds is the one derived from the grant file; a hash you type binds nothing.`,
    );
  }
  return derived;
};

/** Is this file the program? Realpathed on both sides — see seal-hire.mjs. */
export const invokedAsMain = (argv1, metaUrl) => {
  try {
    return typeof argv1 === "string" && realpathSync(argv1) === realpathSync(fileURLToPath(metaUrl));
  } catch {
    return false;
  }
};
const isMain = invokedAsMain(process.argv[1], import.meta.url);
if (!isMain) {
  // imported for its pure helpers (tests) — nothing below runs
} else {
  const [mode, ...rest] = process.argv.slice(2);
  // The same argv contract as seal-hire.mjs: `--name=value` is refused rather
  // than ignored, a flag given twice refuses, a value that is missing, empty,
  // or itself a flag is a usage error — never a filename — and an argument
  // that is neither a known flag nor the value after one refuses rather than
  // being ignored (a typo'd flag used to vanish silently).
  const VALUED = ["--receipt", "--attestation", "--signature", "--grant", "--grant-hash", "--attestor-key"];
  // Each mode reads its own flags and no other's: a `--attestor-key` in
  // receipt mode, or `--attestation` in receipt mode, used to be silently
  // ignored — the user believed a check they asked for had run.
  const PER_MODE = {
    receipt: ["--receipt", "--signature", "--grant", "--grant-hash"],
    attestation: ["--attestation", "--signature", "--grant", "--grant-hash", "--attestor-key"],
  };
  if (mode !== "receipt" && mode !== "attestation") refuse("unknown_mode", 'first argument must be "receipt" or "attestation"');
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i];
    if (/^--[a-z-]+=/.test(a)) refuse("flag_form_unsupported", `${a.split("=")[0]}=… is not read; write ${a.split("=")[0]} VALUE with a space`);
    if (VALUED.includes(a)) {
      if (!PER_MODE[mode].includes(a)) refuse("flag_conflict", `${a} has no meaning in ${mode} mode and was not silently ignored`);
      i += 1; // its value, checked by flag()
      continue;
    }
    refuse("unknown_argument", `argument ${i + 2} is neither a flag this script reads nor the value after one (value withheld)`);
  }
  for (const name of VALUED) {
    if (rest.filter((a) => a === name).length > 1) refuse("flag_duplicated", `${name} was given more than once; which value binds is not guessable`);
  }
  const flag = (name) => {
    const i = rest.indexOf(name);
    if (i < 0) return undefined;
    const value = rest[i + 1];
    if (!usableValue(value)) {
      refuse("flag_value_missing", `${name} was given with no usable value after it (missing, empty, or something that looks like a flag)`);
    }
    return value;
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
    const boundGrantHash = await grantHashOf(grant, grantHash);
    // The pins, on the grant, BEFORE the SDK is asked anything.
    const pinned = bindGrantToPins(grant);
    if (!pinned.ok) refuse(pinned.reason, pinned.detail);
    // A malformed grant is named as such. verifyDeliveryReceipt folds every
    // validateGrant failure into delivery_grant_mismatch, which reads as
    // "the receipt is about another hire" when the defect is your own file.
    const shapedGrant = validateGrant(grant, Date.now());
    if (!shapedGrant.ok) refuse("grant_invalid", `your grant file does not validate: ${shapedGrant.reason}`);
    const verified = verifyDeliveryReceipt({
      receipt,
      signatureBase64: signature,
      grant,
      grantHash: boundGrantHash,
      nowMs: Date.now(),
    });
    if (!verified.ok) refuse(verified.reason);
    console.log("VERIFIED  delivery receipt");
    console.log(`  grant_hash: ${boundGrantHash} (derived from --grant, not taken from argv)`);
    console.log("  signed by the provider key YOUR grant names, about THIS hire.");
    process.exit(0);
  }

  if (mode === "attestation") {
    const attestationPath = flag("--attestation");
    const signature = flag("--signature");
    const grantPath = flag("--grant");
    const grantHash = flag("--grant-hash");
    const suppliedKey = flag("--attestor-key");
    if (!attestationPath || !signature || !grantPath || !grantHash) {
      refuse(
        "missing_arguments",
        "need --attestation --signature --grant --grant-hash (the grant is the subject binding; without it an attestation is a claim about nothing)",
      );
    }
    const raw = loadJson(attestationPath, "attestation");
    const grant = loadJson(grantPath, "grant");

    // 1. Shape.
    const shaped = validateRedemptionAttestation(raw, Date.now());
    if (!shaped.ok) refuse(shaped.reason);

    // 2. SUBJECT BINDING — is this about the hire you hold?
    // The hash is derived from the grant you loaded, never taken from argv:
    // otherwise "is this about YOUR hire" is answered by what you typed.
    const boundGrantHash = await grantHashOf(grant, grantHash);
    // The same grant checks receipt mode runs, in the same place: pins on the
    // grant, then the SDK's own validation — BEFORE the network. A grant with
    // a null-valued extra key hashes identically (canonicalize drops nulls)
    // and used to reach two GETs before anything noticed it was malformed.
    const pinned = bindGrantToPins(grant);
    if (!pinned.ok) refuse(pinned.reason, pinned.detail);
    const shapedGrant = validateGrant(grant, Date.now());
    if (!shapedGrant.ok) refuse("grant_invalid", `your grant file does not validate: ${shapedGrant.reason}`);
    const bound = bindAttestationToGrant({ attestation: shaped.env, grant, grantHash: boundGrantHash });
    if (!bound.ok) refuse(bound.reason, bound.detail);

    // 3. The trust root: the attestor key on the PINNED, VERIFIED manifest.
    const out = await verifiedProvider(fetchVerifiedProvider);
    if (!out.ok) {
      refuse(out.reason, `${out.detail} — the attestor key is read from the verified manifest, so an unverified manifest is a refusal, not a fallback to --attestor-key`);
    }
    const manifestKeyBase64 = out.provider.manifest.attestor_public_key_base64;
    if (typeof manifestKeyBase64 !== "string" || manifestKeyBase64.length === 0) {
      refuse("manifest_carries_no_attestor_key");
    }
    if (suppliedKey !== undefined && suppliedKey !== manifestKeyBase64) {
      refuse(
        "attestor_key_not_the_manifest_key",
        "you passed a key the verified manifest does not publish; the manifest is the trust root, argv is not",
      );
    }
    let key;
    try {
      key = Uint8Array.from(Buffer.from(manifestKeyBase64, "base64"));
    } catch {
      refuse("attestor_key_undecodable");
    }
    if (key.length !== 32) refuse("attestor_key_wrong_length", `${key.length} bytes, need 32`);

    // 4. The signature, under that key and no other.
    if (!verifyDetached(shaped.env, signature, key)) {
      refuse("attestation_signature_invalid");
    }

    console.log("VERIFIED  redemption attestation");
    console.log(`  grant_hash:   ${shaped.env.grant_hash}`);
    console.log(`  bound to:     your grant (offer, capsule, both DIDs, chain, asset, price band)`);
    console.log(`  provider_did: ${shaped.env.provider_did} (the pin)`);
    console.log(`  settled:      ${shaped.env.settled_amount} atomic on ${shaped.env.settled_chain}`);
    console.log(`  attestor key: from the VERIFIED manifest, not from argv.`);
    process.exit(0);
  }

  refuse("unknown_mode", 'first argument must be "receipt" or "attestation"');
}
