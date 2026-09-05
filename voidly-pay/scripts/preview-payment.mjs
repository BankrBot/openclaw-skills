#!/usr/bin/env node
// preview-payment.mjs — the Leg 2 gates as a PROGRAM, not a paragraph.
// Standard Node (Node 20+) helper using pinned ethers for local signature recovery; no wallet
// keys, no writes, no money. The separate settlement verifier stays dependency-free. Reads
// your grant file and, in the three check modes, a JSON document you hand it.
//
//   node scripts/preview-payment.mjs preview --grant ./keep.grant.json [--lane a|b] [--amount <atomic>]
//       Renders EVERY field the EIP-712 signature commits to, from the grant:
//       chain + USDC contract, amount in atomic units AND decimal USDC (the
//       SDK signs the band's floor), payer, payee, the EIP-712 domain, the
//       full typed message, the nonce beside its derivation, the validity
//       window as UNIX seconds and clock time, and (Lane B) the submission
//       shape. Show this to the human; get the yes on THIS.
//
//   node scripts/preview-payment.mjs check-sign-response --grant ./keep.grant.json \
//       --lane a|b --response ./sign-response.json [--amount <atomic>]
//       The /wallet/sign response: `signer` must be the grant's payer, the
//       signature must recover the payer over the exact lane/domain/message
//       and unexpired grant. The response must report successful EIP-712 signing.
//       Exit 0 = hand the signature string back to the SDK verbatim.
//
//   node scripts/preview-payment.mjs check-request --grant ./keep.grant.json \
//       --request ./request.json --sign-response ./sign-response.json [--signer 0x<40-hex>] [--amount <atomic>] \
//       [--rpc https://mainnet.base.org --rpc https://base.drpc.org]
//       Inside the `broadcast` callback, BEFORE /wallet/submit: decodes the
//       SDK's TransactionRequest (`to`, `chainId`, `value`, `data`) — the
//       selector and all nine arguments — against the grant and refuses any
//       mismatch by name. The amount must be the one the preview rendered
//       (the band's floor) unless --amount names another in-band value.
//       THE SIGNED CALLDATA NEVER LEAVES THIS MACHINE: the fee line is a
//       typical gas figure times the current gas price read from the
//       two-operator quorum — eth_gasPrice carries no calldata. A live
//       eth_estimateGas would hand the bearer `transfer` authorization to an
//       RPC operator, who could broadcast it first.
//
//   node scripts/preview-payment.mjs check-submit-response --grant ./keep.grant.json \
//       --response ./submit-response.json
//       The /wallet/submit response: success true, status "success" (pending
//       is not evidence; reverted is a refusal), a well-formed transactionHash,
//       chainId 8453, `signer` equal to the payer. Exit 0 prints the exact
//       verify-settlement command to run next.
//
// The grant itself is held to the pins before any of this: pinned provider,
// Base, canonical USDC, and the reviewed price band. A grant is a file
// somebody can hand you; the preview it renders must be one this skill is
// reviewed for.
//
// Exit 0 = the document passed every check named above / 1 = refused, by
// name. Nothing here signs, submits, or authorizes value. No document,
// argv or operator text is ever printed verbatim into a refusal.

import { closeSync, constants as fsConstants, fstatSync, lstatSync, openSync, readSync, realpathSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { verifyTypedData } from "ethers";
import {
  ALLOWED_BASE_RPC_HOSTS,
  CANONICAL_USDC_BASE,
  EXPECTED_CHAIN_ID_HEX,
  EXPECTED_PRICE_MAX_AMOUNT,
  EXPECTED_PRICE_MIN_AMOUNT,
  EXPECTED_PROVIDER_DID,
  usableArgValue,
} from "./lib/pins.mjs";
import {
  DEFAULT_RPCS,
  MAX_GRANT_FILE_BYTES,
  MIN_OPERATORS,
  bindingNonce,
  grantTermsOf,
  host,
  httpRpc,
  operatorKeyOf,
} from "./verify-settlement.mjs";

/** The same operator policy the settlement proof applies: https, allowlisted, >= 2 distinct. No unpinned arm here. */
export function operatorsFor(rpcUrls) {
  const refuse = (reason, detail = "") => ({ ok: false, reason, detail });
  const seen = new Set();
  const operators = [];
  for (const raw of rpcUrls) {
    let u;
    try {
      u = new URL(String(raw).trim());
    } catch {
      return refuse("bad_rpc_url", "an --rpc value is not a URL (value withheld)");
    }
    if (u.protocol !== "https:") return refuse("rpc_not_https", `${u.protocol}//${u.host}`);
    if (!ALLOWED_BASE_RPC_HOSTS.includes(u.host)) return refuse("rpc_host_not_allowlisted", `${u.host} is not one of the reviewed Base operators`);
    const key = operatorKeyOf(u);
    if (seen.has(key)) continue;
    seen.add(key);
    operators.push({ url: String(raw).trim(), host: u.host });
  }
  if (operators.length < MIN_OPERATORS) return refuse("insufficient_rpc_quorum", `${operators.length} distinct operator(s) — a fee estimate for a payment needs at least ${MIN_OPERATORS}`);
  return { ok: true, operators };
}

/** EIP-712 domain of USDC on Base, exactly as @voidly/session builds it. */
export const USDC_BASE_DOMAIN = Object.freeze({
  name: "USD Coin",
  version: "2",
  chainId: 8453,
  verifyingContract: CANONICAL_USDC_BASE,
});
export const TRANSFER_WITH_AUTHORIZATION_SELECTOR = "0xe3ee160e";
export const RECEIVE_WITH_AUTHORIZATION_SELECTOR = "0xef55bec6";
/** transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,uint8,bytes32,bytes32) */
export const EIP3009_CALLDATA_BYTES = 4 + 9 * 32;
/**
 * A transferWithAuthorization on Base costs roughly 60–90k gas. This is the
 * figure the fee line multiplies the live gas price by. It is TYPICAL, not
 * measured: measuring (eth_estimateGas) would send the signed authorization —
 * bearer material — to an RPC operator, who could broadcast it first.
 */
export const TYPICAL_TRANSFER_WITH_AUTHORIZATION_GAS = 90000n;
/** Above this gas price the fee line is not a fee line, it is a symptom. */
export const GAS_PRICE_SANITY_CEILING_WEI = 1_000_000_000_000n; // 1000 gwei
/** A hex quantity longer than this is not a gas price any chain has. */
const MAX_QUANTITY_HEX_DIGITS = 32;
/** The SDK's own timestamp shape: YYYY-MM-DDTHH:MM:SS(.mmm)Z, nothing else. */
export const ISO_UTC_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?Z$/;

const HEX = /^0x[0-9a-f]*$/;
const ADDR = /^0x[0-9a-f]{40}$/;
const HASH32 = /^0x[0-9a-f]{64}$/;
const DECIMAL = /^[0-9]{1,78}$/;
const lower = (v) => (typeof v === "string" ? v.toLowerCase() : "");
const isStr = (v) => typeof v === "string";
const usdc = (atomic) => {
  const s = BigInt(atomic).toString().padStart(7, "0");
  return `${s.slice(0, -6)}.${s.slice(-6)} USDC`;
};
/**
 * Echo a document value ONLY when it has the shape the field is supposed to
 * have; otherwise describe it. A chainId carrying a newline and a forged
 * CHECKED block reached stderr verbatim; a 60 KB signer was echoed whole.
 */
const shown = (value, shape) =>
  isStr(value) && shape.test(value) ? value : `(not a well-formed value: ${value === undefined ? "absent" : Array.isArray(value) ? "array" : typeof value})`;
const shownChain = (v) => (typeof v === "number" && Number.isInteger(v) ? String(v) : isStr(v) && /^(0x[0-9a-f]{1,8}|[0-9]{1,10})$/i.test(v) ? v : "(not a chain id)");

/** The SDK's timestampMs, as a value in milliseconds or null. */
export function isoUtcMs(value) {
  if (!isStr(value)) return null;
  const m = ISO_UTC_RE.exec(value);
  if (!m) return null;
  const [year, month, day, hour, minute, second] = m.slice(1, 7).map(Number);
  const milli = m[7] === undefined ? 0 : Number(m[7]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
  const ms = Date.UTC(year, month - 1, day, hour, minute, second, milli);
  if (!Number.isFinite(ms)) return null;
  // The SDK round-trips the calendar: Feb 30 rolls to Mar 2 in Date.UTC and
  // is refused there, so it is refused here too — a preview of a validBefore
  // the SDK will never sign is not a preview.
  const d = new Date(ms);
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return ms;
}

/**
 * The pins, on the grant. grantTermsOf checks chain and asset; the provider
 * DID and the price band are pins too, and a grant that names another
 * provider or another band previews a payment this skill was not reviewed
 * for. Pure.
 */
export function bindGrantTermsToPins(grant, terms) {
  const refuse = (reason, detail = "") => ({ ok: false, reason, detail });
  if (grant?.provider_did !== EXPECTED_PROVIDER_DID) {
    return refuse("grant_provider_not_pinned", `the grant names a provider that is not the pinned ${EXPECTED_PROVIDER_DID}`);
  }
  if (terms.band.min !== EXPECTED_PRICE_MIN_AMOUNT || terms.band.max !== EXPECTED_PRICE_MAX_AMOUNT) {
    return refuse("grant_band_not_pinned", `the grant's price band is not the reviewed ${EXPECTED_PRICE_MIN_AMOUNT}..${EXPECTED_PRICE_MAX_AMOUNT} — a changed price is a reviewed skill update, not a runtime surprise`);
  }
  return { ok: true };
}

/** The typed message the SDK signs for this grant: value is the band's floor. */
export function typedMessageFor(terms, expiresAtIso) {
  const expiresMs = isoUtcMs(expiresAtIso);
  if (expiresMs === null) {
    return { ok: false, reason: "grant_expires_at_malformed", detail: "expires_at is not the SDK's YYYY-MM-DDTHH:MM:SS(.mmm)Z shape — the SDK would refuse authorization_expiry_mismatch, so nothing is previewed" };
  }
  return {
    ok: true,
    message: {
      from: terms.payer,
      to: terms.payee,
      value: terms.band.min,
      validAfter: "0",
      validBefore: String(Math.floor(expiresMs / 1000)),
      nonce: bindingNonce(terms.grantHash),
    },
    expiresMs,
  };
}

/** Derive only the exact authorization this human-reviewed grant permits. */
export function typedAuthorizationFor(terms, expiresAt, lane, typedAmount = null) {
  if (lane !== "a" && lane !== "b") return { ok: false, reason: "signature_lane_required", detail: "name the approved lane explicitly: a or b" };
  const typed = typedMessageFor(terms, expiresAt);
  if (!typed.ok) return typed;
  const amount = typedAmount === null ? terms.band.min : typedAmount;
  if (!isStr(amount) || !DECIMAL.test(amount)) return { ok: false, reason: "bad_amount", detail: "amount must be a decimal atomic integer" };
  if (BigInt(amount) < BigInt(terms.band.min) || BigInt(amount) > BigInt(terms.band.max)) {
    return { ok: false, reason: "request_amount_outside_grant_band", detail: "the approved amount is outside this grant's band" };
  }
  const primaryType = lane === "a" ? "ReceiveWithAuthorization" : "TransferWithAuthorization";
  return {
    ok: true, expiresMs: typed.expiresMs, primaryType,
    domain: USDC_BASE_DOMAIN,
    types: { [primaryType]: [
      { name: "from", type: "address" }, { name: "to", type: "address" },
      { name: "value", type: "uint256" }, { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" },
    ] },
    message: { ...typed.message, value: BigInt(amount).toString() },
  };
}

/**
 * Decode an EIP-3009 call. Pure. Returns the nine arguments or a refusal.
 */
export function decodeEip3009Calldata(data) {
  const refuse = (reason, detail = "") => ({ ok: false, reason, detail });
  if (!isStr(data)) return refuse("calldata_not_hex", "data is not a string");
  const d = data.toLowerCase();
  if (!HEX.test(d)) return refuse("calldata_not_hex", "data is not a 0x hex string");
  if ((d.length - 2) / 2 !== EIP3009_CALLDATA_BYTES) {
    return refuse("calldata_wrong_length", `data is ${(d.length - 2) / 2} bytes; transferWithAuthorization is exactly ${EIP3009_CALLDATA_BYTES}`);
  }
  const selector = d.slice(0, 10);
  const words = [];
  for (let i = 0; i < 9; i += 1) words.push(d.slice(10 + i * 64, 10 + (i + 1) * 64));
  const asAddress = (w) => (/^0{24}[0-9a-f]{40}$/.test(w) ? "0x" + w.slice(24) : null);
  const from = asAddress(words[0]);
  const to = asAddress(words[1]);
  if (from === null || to === null) return refuse("calldata_address_malformed", "from/to words are not zero-padded addresses");
  const v = BigInt("0x" + words[6]);
  return {
    ok: true,
    selector,
    from,
    to,
    value: BigInt("0x" + words[2]).toString(),
    validAfter: BigInt("0x" + words[3]).toString(),
    validBefore: BigInt("0x" + words[4]).toString(),
    nonce: "0x" + words[5],
    v: Number(v),
    r: "0x" + words[7],
    s: "0x" + words[8],
  };
}

/**
 * Compare the SDK's request to the grant. Pure. `typedAmount` defaults to
 * the band's floor — the value the preview rendered and the SDK signs — so a
 * request moving any other in-band amount is refused unless the caller names
 * that amount explicitly. Every field is type-checked before it is compared:
 * an array or a number where a string belongs is a refusal, never a coercion.
 */
export function checkRequestAgainstGrant({ request, terms, expiresAt, typedAmount = null, signer = null, signResponse }) {
  const refuse = (reason, detail = "") => ({ ok: false, reason, detail });
  if (request === null || typeof request !== "object" || Array.isArray(request)) return refuse("request_not_object");
  const chainOk =
    (typeof request.chainId === "number" && request.chainId === 8453) ||
    (isStr(request.chainId) && (request.chainId === "8453" || request.chainId.toLowerCase() === EXPECTED_CHAIN_ID_HEX));
  if (!chainOk) return refuse("request_wrong_chain", `chainId ${shownChain(request.chainId)} is not Base mainnet (8453)`);
  if (!isStr(request.to) || request.to.toLowerCase() !== CANONICAL_USDC_BASE) {
    return refuse("request_wrong_target", `to is not canonical USDC ${CANONICAL_USDC_BASE}`);
  }
  const valueOk =
    request.value === undefined ||
    (isStr(request.value) && ["0", "0x0", "0x"].includes(request.value.toLowerCase())) ||
    request.value === 0;
  if (!valueOk) return refuse("request_carries_value", "value must be zero (gas is ETH, the payment moves in USDC)");
  const decoded = decodeEip3009Calldata(request.data);
  if (!decoded.ok) return decoded;
  if (decoded.selector !== TRANSFER_WITH_AUTHORIZATION_SELECTOR) {
    return refuse("request_wrong_selector", `selector ${decoded.selector} is not transferWithAuthorization ${TRANSFER_WITH_AUTHORIZATION_SELECTOR}`);
  }
  const typed = typedMessageFor(terms, expiresAt);
  if (!typed.ok) return typed;
  const m = typed.message;
  if (decoded.from !== m.from) return refuse("request_payer_mismatch", `from ${decoded.from} is not the grant's payer ${m.from}`);
  if (decoded.to !== m.to) return refuse("request_payee_mismatch", `to ${decoded.to} is not the grant's payee ${m.to}`);
  const inBand = BigInt(decoded.value) >= BigInt(terms.band.min) && BigInt(decoded.value) <= BigInt(terms.band.max);
  if (!inBand) return refuse("request_amount_outside_grant_band", `value ${decoded.value} is outside ${terms.band.min}..${terms.band.max}`);
  const previewed = typedAmount === null ? terms.band.min : typedAmount;
  if (!isStr(previewed) || !DECIMAL.test(previewed)) return refuse("bad_amount", "--amount is not a decimal atomic amount");
  if (BigInt(decoded.value) !== BigInt(previewed)) {
    return refuse("request_amount_not_the_previewed", `value ${decoded.value} is not the previewed ${BigInt(previewed).toString()} — the preview rendered the band's floor; name another in-band amount with --amount only if the human approved THAT number`);
  }
  if (decoded.validAfter !== "0") return refuse("request_valid_after_not_zero", `validAfter ${decoded.validAfter}`);
  if (decoded.validBefore !== m.validBefore) return refuse("request_valid_before_mismatch", `validBefore ${decoded.validBefore} is not the grant's ${m.validBefore}`);
  if (decoded.nonce !== m.nonce) return refuse("request_nonce_mismatch", `nonce ${decoded.nonce.slice(0, 12)}… is not this grant's binding nonce`);
  if (decoded.v !== 27 && decoded.v !== 28) return refuse("request_signature_malformed", `v ${decoded.v}`);
  if (/^0x0{64}$/.test(decoded.r) || /^0x0{64}$/.test(decoded.s)) return refuse("request_signature_malformed", "r or s is zero — not a signature");
  if (signer !== null && (!isStr(signer) || signer.toLowerCase() !== m.from)) {
    return refuse("signer_not_the_payer", `signer ${shown(lower(signer), ADDR)} is not the grant's payer ${m.from}`);
  }
  if (Math.floor(Date.now() / 1000) >= Number(m.validBefore)) return refuse("grant_expired", "the signed validity window has passed; re-seal and preview again");
  if (signResponse === undefined) return refuse("sign_response_required", "the approved Lane B signing response is required before checking a submission");
  const signed = checkSignResponse({ response: signResponse, terms: { ...terms, expiresAt }, lane: "b", typedAmount });
  if (!signed.ok) return signed;
  const signature = signed.signature.toLowerCase();
  if (decoded.r !== signature.slice(0, 66) || decoded.s !== `0x${signature.slice(66, 130)}` || decoded.v !== parseInt(signature.slice(130, 132), 16)) {
    return refuse("request_signature_mismatch", "the submission signature differs from the approved signing response; do not submit");
  }
  return { ok: true, decoded, message: { ...m, value: BigInt(previewed).toString() } };
}

/** /wallet/sign response → the signature string, or a refusal. Pure. */
export function checkSignResponse({ response, terms, lane, typedAmount = null }) {
  const refuse = (reason, detail = "") => ({ ok: false, reason, detail });
  const typed = typedAuthorizationFor(terms, terms.expiresAt, lane, typedAmount);
  if (!typed.ok) return typed;
  if (Math.floor(Date.now() / 1000) >= Number(typed.message.validBefore)) return refuse("grant_expired", "the signed validity window has passed; re-seal and preview again");
  if (response === null || typeof response !== "object" || Array.isArray(response)) return refuse("response_not_object");
  if (response.success !== true) return refuse("sign_not_success", "the response does not report successful signing");
  if (response.signatureType !== "eth_signTypedData_v4") return refuse("sign_type_mismatch", "the response is not an EIP-712 signing response");
  if (!isStr(response.signature)) return refuse("signature_malformed", "signature is not a string");
  // The SDK's SIGNATURE_RE is /^0x[0-9a-fA-F]{130}$/ — a lowercase `0x`
  // prefix, any-case hex. "Hand it back verbatim" must mean the SDK will
  // take it verbatim, so the same shape is required here, before lowering.
  if (!/^0x[0-9a-fA-F]{130}$/.test(response.signature)) return refuse("signature_malformed", "signature is not 0x + 130 hex (the 0x prefix must be lowercase, as the SDK requires)");
  const sig = response.signature.toLowerCase();
  const v = parseInt(sig.slice(-2), 16);
  if (v !== 27 && v !== 28) return refuse("signature_malformed", `recovery id ${v} is not 27 or 28 — do not repair it; the SDK refuses it by name`);
  if (/^0x0{64}/.test(sig) || /^0{64}$/.test(sig.slice(66, 130))) return refuse("signature_malformed", "r or s is zero — not a signature; a wallet that returns this has not signed");
  if (!isStr(response.signer) || !ADDR.test(response.signer.toLowerCase())) return refuse("signer_missing", "the response names no usable signer address");
  if (response.signer.toLowerCase() !== terms.payer) {
    return refuse("signer_not_the_payer", `signer ${response.signer.toLowerCase()} is not the grant's payer ${terms.payer} — a different wallet signed; do not hand this to the SDK`);
  }
  let recovered;
  try {
    recovered = verifyTypedData(typed.domain, typed.types, typed.message, response.signature).toLowerCase();
  } catch {
    return refuse("signature_not_recoverable", "the signature does not recover over the exact approved EIP-712 request");
  }
  if (recovered !== terms.payer || recovered !== response.signer.toLowerCase()) {
    return refuse("signature_not_from_payer", "the recovered wallet is not the grant payer for these exact approved terms");
  }
  return { ok: true, signature: response.signature };
}

/** /wallet/submit response → the transaction hash, or a refusal. Pure. */
export function checkSubmitResponse({ response, terms }) {
  const refuse = (reason, detail = "") => ({ ok: false, reason, detail });
  if (response === null || typeof response !== "object" || Array.isArray(response)) return refuse("response_not_object");
  if (response.success !== true) return refuse("submit_not_success", "success is not true");
  if (!isStr(response.transactionHash)) return refuse("submit_hash_malformed", "transactionHash is not a string");
  const hash = response.transactionHash.toLowerCase();
  if (!HASH32.test(hash)) return refuse("submit_hash_malformed", "transactionHash is not 0x + 64 hex");
  if (response.status === "pending") return refuse("submit_pending", `${hash} was submitted but is not confirmed — not evidence yet; wait, then run the settlement proof`);
  if (response.status === "reverted") return refuse("submit_reverted", `${hash} reverted on-chain; the nonce may be spent — look it up before any re-sign`);
  if (response.status !== "success") return refuse("submit_status_unknown", `status is ${isStr(response.status) ? "an unrecognised word" : typeof response.status}`);
  const chainOk = (typeof response.chainId === "number" && response.chainId === 8453) || response.chainId === "8453";
  if (!chainOk) return refuse("submit_wrong_chain", `chainId ${shownChain(response.chainId)}`);
  if (!isStr(response.signer) || !ADDR.test(response.signer.toLowerCase())) return refuse("signer_missing", "the response names no usable signer address");
  if (response.signer.toLowerCase() !== terms.payer) {
    return refuse("signer_not_the_payer", `signer ${response.signer.toLowerCase()} paid the gas; it is not the grant's payer ${terms.payer}`);
  }
  return { ok: true, transactionHash: hash };
}

// ── CLI ─────────────────────────────────────────────────────────────────────

const MODES = {
  preview: ["--grant", "--lane", "--amount"],
  "check-request": ["--grant", "--request", "--sign-response", "--signer", "--amount", "--rpc"],
  "check-sign-response": ["--grant", "--response", "--lane", "--amount"],
  "check-submit-response": ["--grant", "--response"],
};

/** A path printed back is argv: plainly spelled paths print, anything else is described. */
const safePath = (p) => (/^[A-Za-z0-9._~\/\-]{1,512}$/.test(String(p)) ? String(p) : `(a path with unusual characters, ${String(p).length} chars - not printed)`);

/** Every refusal is one bounded line: a 5 MB detail is not a refusal, and a >64 KB one is cut by the pipe anyway. */
const MAX_DETAIL = 1024;
const die = (name, detail) => {
  const d = detail ? String(detail) : "";
  console.error(`REFUSED  ${name}${d ? ` — ${d.length > MAX_DETAIL ? d.slice(0, MAX_DETAIL) + "…" : d}` : ""}`);
  process.exit(1);
};

const loadSmallJson = (path, what, { requirePrivate = false } = {}) => {
  let fd = null;
  let value;
  let failure;
  const refuse = (reason, detail) => { throw { reason, detail }; };
  try {
    const before = lstatSync(path);
    if (before.isSymbolicLink()) refuse(`${what}_symlink_refused`, `--${what} must not be a symlink`);
    if (!before.isFile()) refuse(`${what}_unreadable`, `--${what} must be a regular file`);
    if (before.size > MAX_GRANT_FILE_BYTES) refuse(`${what}_unreadable`, `--${what} exceeds the byte limit`);
    if (requirePrivate && (before.mode & 0o077) !== 0) refuse(`${what}_permissions_too_open`, `--${what} carries signature material; use mode 0600 or stricter`);
    // A concurrent replacement by a no-writer FIFO must reach the descriptor
    // type/identity check rather than blocking in open before that check.
    fd = openSync(path, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0) | (fsConstants.O_NONBLOCK ?? 0));
    const opened = fstatSync(fd);
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino) refuse(`${what}_changed_while_opening`, `--${what} changed while opening`);
    if (requirePrivate && (opened.mode & 0o077) !== 0) refuse(`${what}_permissions_too_open`, `--${what} must be private`);
    const bytes = Buffer.alloc(MAX_GRANT_FILE_BYTES + 1);
    let size = 0;
    while (size < bytes.length) {
      const n = readSync(fd, bytes, size, bytes.length - size, null);
      if (n === 0) break;
      size += n;
    }
    if (size > MAX_GRANT_FILE_BYTES) refuse(`${what}_unreadable`, `--${what} exceeds the byte limit`);
    const after = fstatSync(fd);
    if (after.size !== opened.size || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs) refuse(`${what}_changed_while_reading`, `--${what} changed while reading`);
    value = JSON.parse(bytes.subarray(0, size).toString("utf8"));
  } catch (error) {
    failure = error?.reason ? error : { reason: `${what}_unreadable`, detail: `--${what} could not be read as bounded JSON` };
  } finally {
    if (fd !== null) try { closeSync(fd); } catch { failure ??= { reason: `${what}_unreadable`, detail: `--${what} could not be closed` }; }
  }
  if (failure) die(failure.reason, failure.detail);
  return value;
};

export const invokedAsMain = (argv1, metaUrl) => {
  try {
    return typeof argv1 === "string" && realpathSync(argv1) === realpathSync(fileURLToPath(metaUrl));
  } catch {
    return false;
  }
};

if (invokedAsMain(process.argv[1], import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  if (!(mode in MODES)) die("unknown_mode", `first argument must be one of ${Object.keys(MODES).join(", ")}`);
  const allowed = MODES[mode];
  const flags = { "--rpc": [] };
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i];
    if (/^--[a-z-]+=/.test(a)) die("flag_form_unsupported", `${a.split("=")[0].slice(0, 20)}=… is not read; write the flag and its value separated by a space`);
    if (!allowed.includes(a)) die("unknown_argument", `argument ${i + 2} is neither a flag ${mode} reads nor the value after one (value withheld)`);
    const v = rest[i + 1];
    if (!usableArgValue(v)) die("flag_value_missing", `${a} was given with no usable value after it`);
    if (a === "--rpc") flags["--rpc"].push(v);
    else if (a in flags) die("flag_duplicated", `${a} was given more than once`);
    else flags[a] = v;
    i += 1;
  }
  if (!flags["--grant"]) die("missing_arguments", `${mode} needs --grant ./keep.grant.json`);
  const grant = loadSmallJson(flags["--grant"], "grant");
  const terms = grantTermsOf(grant);
  if (!terms.ok) die(terms.reason, terms.detail);
  const pinned = bindGrantTermsToPins(grant, terms);
  if (!pinned.ok) die(pinned.reason, pinned.detail);
  const typed = typedMessageFor(terms, terms.expiresAt);
  if (!typed.ok) die(typed.reason, typed.detail);
  const m = typed.message;
  const clock = (sec) => new Date(Number(sec) * 1000).toISOString();

  if (mode === "preview") {
    const lane = (flags["--lane"] ?? "a").toLowerCase();
    if (lane !== "a" && lane !== "b") die("unknown_lane", "--lane must be a or b");
    if (Math.floor(Date.now() / 1000) >= Number(typed.message.validBefore)) die("grant_expired", `the signed validity window ended ${clock(typed.message.validBefore)}; re-seal and preview again`);
    const approved = typedAuthorizationFor(terms, terms.expiresAt, lane, flags["--amount"] ?? null);
    if (!approved.ok) die(approved.reason, approved.detail);
    const { primaryType, message: m } = approved;
    console.log("PREVIEW  every field the signature commits to, from the grant file");
    console.log(`  grant_hash:      ${terms.grantHash}`);
    console.log(`  chain:           eip155:8453 (Base mainnet)   USDC: ${CANONICAL_USDC_BASE}`);
    console.log(`  amount:          ${m.value} atomic = ${usdc(m.value)}   (default: the SDK signs the band's floor; band ${terms.band.min}..${terms.band.max}, the reviewed pin)`);
    console.log(`  payer (from):    ${m.from}   <- the wallet that signs MUST be this address`);
    console.log(`  payee (to):      ${m.to}   (frozen into the grant at sealing; the pinned provider's manifest named it then)`);
    console.log(`  provider:        ${EXPECTED_PROVIDER_DID} (the pin; the grant names it)`);
    console.log(`  EIP-712 domain:  ${JSON.stringify(USDC_BASE_DOMAIN)}`);
    console.log(`  primaryType:     ${primaryType}   (Lane ${lane.toUpperCase()})`);
    console.log(`  typed message:   ${JSON.stringify(m)}`);
    console.log(`  nonce:           ${m.nonce}`);
    console.log(`                   = 0x + sha256("voidly-session-settlement-binding/v1|" + grant_hash)`);
    console.log(`  validAfter:      0 (immediately)`);
    console.log(`  validBefore:     ${m.validBefore} = ${clock(m.validBefore)}   (the grant's expires_at; cannot be re-minted — re-seal past it)`);
    if (lane === "b") {
      console.log(`  submission:      POST /wallet/submit  to=${CANONICAL_USDC_BASE}  chainId=8453  value="0"`);
      console.log(`                   selector ${TRANSFER_WITH_AUTHORIZATION_SELECTOR} transferWithAuthorization(from,to,value,validAfter,validBefore,nonce,v,r,s)`);
      console.log(`                   calldata exists only AFTER signing — check-request decodes it inside the broadcast callback; the fee line there is typical gas (${TYPICAL_TRANSFER_WITH_AUTHORIZATION_GAS}) × the live gas price, and the signed calldata is never sent to any RPC`);
      console.log(`                   Bankr control: "Arbitrary contract calls" is on by default today; if effectively disabled, stop. Timers are optional; never loosen a control automatically.`);
    } else {
      console.log(`  submission:      none by you — the provider redeems a receive authorization in its own transaction`);
      console.log(`                   Bankr spend-limit coverage of provider redemption is unverified; do not promise it.`);
    }
    console.log("  Bankr policy:    walletApiEnabled and a non-read-only key are required. A configured allowedRecipients restriction blocks EIP-712 signing on BOTH lanes and all raw submissions. Stop; never relax it or switch lanes to bypass it.");
    console.log("  after settling:  node scripts/verify-settlement.mjs --tx <hash> --grant " + safePath(flags["--grant"]));
    process.exit(0);
  }

  if (mode === "check-sign-response") {
    if (!flags["--response"]) die("missing_arguments", "check-sign-response needs --response ./sign-response.json");
    if (!flags["--lane"]) die("signature_lane_required", "check-sign-response requires --lane a or --lane b");
    const r = checkSignResponse({ response: loadSmallJson(flags["--response"], "response", { requirePrivate: true }), terms, lane: flags["--lane"], typedAmount: flags["--amount"] ?? null });
    if (!r.ok) die(r.reason, r.detail);
    console.log("ACCEPTED  signature — recovered the grant payer over the exact approved lane, domain and message; hand the checked signature back to the SDK verbatim");
    process.exit(0);
  }

  if (mode === "check-submit-response") {
    if (!flags["--response"]) die("missing_arguments", "check-submit-response needs --response ./submit-response.json");
    const r = checkSubmitResponse({ response: loadSmallJson(flags["--response"], "response"), terms });
    if (!r.ok) die(r.reason, r.detail);
    console.log(`ACCEPTED  submission ${r.transactionHash} — mined, success, signer is the payer. Not yet settlement: run`);
    console.log(`  node scripts/verify-settlement.mjs --tx ${r.transactionHash} --grant ${safePath(flags["--grant"])}`);
    process.exit(0);
  }

  // check-request
  if (!flags["--request"]) die("missing_arguments", "check-request needs --request ./request.json (the SDK's TransactionRequest)");
  if (!flags["--sign-response"]) die("sign_response_required", "check-request needs the approved Lane B --sign-response ./sign-response.json");
  const request = loadSmallJson(flags["--request"], "request", { requirePrivate: true });
  const signResponse = loadSmallJson(flags["--sign-response"], "sign_response", { requirePrivate: true });
  const typedAmount = flags["--amount"] !== undefined ? flags["--amount"] : null;
  if (typedAmount !== null && !DECIMAL.test(typedAmount)) die("bad_amount", "--amount must be a decimal atomic amount");
  const checked = checkRequestAgainstGrant({ request, terms, expiresAt: terms.expiresAt, typedAmount, signer: flags["--signer"] ?? null, signResponse });
  if (!checked.ok) die(checked.reason, checked.detail);
  const policy = operatorsFor(flags["--rpc"].length ? flags["--rpc"] : DEFAULT_RPCS);
  if (!policy.ok) die(policy.reason, policy.detail);
  // The fee line: typical gas × the live gas price. eth_gasPrice takes no
  // arguments — nothing about this request, least of all its signature,
  // leaves the machine. Every operator must answer; the highest price is the
  // conservative one.
  const prices = [];
  for (const op of policy.operators) {
    let price;
    try {
      price = await httpRpc(op.url, "eth_gasPrice", []);
    } catch {
      die("gas_price_unavailable", `${host(op.url)} did not answer eth_gasPrice — a fee that cannot be read is a fee the human cannot approve`);
    }
    if (!isStr(price) || !/^0x[0-9a-f]+$/i.test(price) || price.length - 2 > MAX_QUANTITY_HEX_DIGITS) {
      die("gas_price_unreadable", `${host(op.url)} answered a non-quantity`);
    }
    const wei = BigInt(price);
    if (wei > GAS_PRICE_SANITY_CEILING_WEI) die("gas_price_implausible", `${host(op.url)} reports a gas price above ${GAS_PRICE_SANITY_CEILING_WEI} wei — not a fee a human should approve blind`);
    prices.push({ host: host(op.url), wei });
  }
  const worst = prices.reduce((a, b) => (b.wei > a.wei ? b : a));
  const feeWei = TYPICAL_TRANSFER_WITH_AUTHORIZATION_GAS * worst.wei;
  console.log("CHECKED  the SDK's request is THIS grant's transfer authorization and nothing else");
  console.log(`  to/chain/value:  ${CANONICAL_USDC_BASE} / 8453 / 0`);
  console.log(`  selector:        ${checked.decoded.selector} transferWithAuthorization`);
  console.log(`  from -> to:      ${checked.decoded.from} -> ${checked.decoded.to}`);
  console.log(`  value:           ${checked.decoded.value} atomic = ${usdc(checked.decoded.value)}   (= the previewed amount)`);
  console.log(`  window:          ${checked.decoded.validAfter}..${checked.decoded.validBefore} (${clock(checked.decoded.validBefore)})`);
  console.log(`  nonce:           ${checked.decoded.nonce} (this grant's binding nonce)`);
  console.log("  signature:       cryptographically recovered and byte-bound to the approved response (bytes withheld)");
  console.log(`  gas:             ~${TYPICAL_TRANSFER_WITH_AUTHORIZATION_GAS} (typical for transferWithAuthorization; NOT measured — measuring would hand the signed authorization to an RPC operator)`);
  console.log(`  fee estimate:    ~${feeWei} wei ≈ ${(Number(feeWei) / 1e18).toFixed(9)} ETH at ${prices.map((p) => `${p.host} ${p.wei} wei/gas`).join(", ")} (highest used)`);
  console.log("  submit with:     transaction { to, chainId, data } from the SDK request, value \"0\", waitForConfirmation true — then check-submit-response, then the proof");
  process.exit(0);
}
