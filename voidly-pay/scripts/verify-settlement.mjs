#!/usr/bin/env node
// verify-settlement.mjs — prove (or refuse, by name) that a Base-mainnet
// transaction settled ONE specific hire. Pure Node: no npm dependencies (the
// reviewed constants come from lib/pins.mjs), no keys, no writes. The only
// network calls are read-only JSON-RPC to the public Base endpoints you name.
//
//   node scripts/verify-settlement.mjs \
//     --tx 0x<64-hex> --grant ./keep.grant.json \
//     [--rpc https://mainnet.base.org --rpc https://base.drpc.org] \
//     [--allow-unpinned-rpc]
//
//   or, without the grant file (the terms are then YOURS, not the grant's):
//
//   node scripts/verify-settlement.mjs \
//     --tx 0x<64-hex> --grant-hash <64-hex> \
//     --payer 0x<40-hex> --payee 0x<40-hex> --amount <atomic-usdc> ...
//
// Two modes, and the verdict names which one it is in:
//   --grant FILE   reads the task-grant envelope seal-hire.mjs wrote beside
//                  your keep file, recomputes its hash exactly as
//                  @voidly/session's envelopeHash does (no dependency needed),
//                  takes payer and payee FROM THE GRANT (the from/to the SDK
//                  signs into the authorization), and requires the settled
//                  amount to sit inside the grant's price band
//                  price_min_amount..price_max_amount — the builders sign the
//                  floor, the SDK's provider-side binding accepts the band.
//                  This is the mode in which "settled THIS hire" is literally
//                  what was checked. --grant-hash/--payer/--payee/--amount may
//                  still be given; each must agree with the grant or the run
//                  refuses grant_terms_mismatch.
//   typed          no --grant: the nonce still binds the transaction to the
//                  grant HASH you typed, but payer, payee and amount are
//                  asserted exactly as you typed them. True of the chain;
//                  silent about whether those are the grant's terms.
//
// What "PROVEN" means here, and nothing more:
//   0. The quorum, decided BEFORE a single packet leaves: HTTPS only,
//      allowlisted hosts only (ALLOWED_BASE_RPC_HOSTS in lib/pins.mjs, unless
//      --allow-unpinned-rpc), and at least two DISTINCT operators once
//      duplicates collapse — independence is counted by host, so naming one
//      operator twice is one operator. Every operator must also report Base
//      mainnet (eth_chainId 0x2105) before anything else it says is believed.
//   1. Receipt identity. Every operator's receipt must say, in its own
//      `transactionHash`, that it describes the hash you asked about. A
//      receipt that cannot identify itself proves nothing about --tx, and a
//      valid-but-unrelated receipt handed over by an operator is exactly the
//      shape this check exists to refuse.
//   2. The nonce binding. The EIP-3009 nonce is a pure function of the hire:
//      sha256("voidly-session-settlement-binding/v1|" + grantHash) — the same
//      SETTLEMENT_BINDING_DOMAIN @voidly/session exports. EXACTLY ONE
//      AuthorizationUsed event on canonical USDC must carry that nonce,
//      authorized by the payer. Two is ambiguity, and ambiguity refuses.
//   3. The PAIRED Transfer — pairing by log index, not by search. USDC's
//      FiatTokenV2 marks the authorization used immediately BEFORE it emits
//      the Transfer of that same call, so the settled Transfer is the first
//      canonical-USDC Transfer whose logIndex is greater than the
//      AuthorizationUsed's. Payer, payee and value are asserted on THAT log
//      and on no other. This is the check the first version of this file did
//      not have: it searched the whole receipt for any Transfer from the
//      payer, so in a batched transaction hire A's nonce could satisfy the
//      binding while hire B's transfer satisfied the amount. A settlement for
//      a DIFFERENT hire cannot fake this any more.
//      Belt and braces: more than one canonical-USDC payer -> payee Transfer
//      anywhere in the receipt refuses too, rather than a first match winning.
//   4. Exact value on the paired log — `>=` is how amount checks rot.
//   5. Block binding, per operator: eth_getBlockByNumber at the receipt's
//      height must return the receipt's own blockHash on every operator. A
//      receipt agreed on by RPCs but hanging off no block either of them has
//      is not a settlement.
//   6. Finality: at least 12 confirmations, measured from the LOWEST head
//      across the quorum — and the heads must agree to within
//      MAX_HEAD_DIVERGENCE blocks, or one operator is not following the
//      chain the other is.
//   7. Quorum: every RPC you name must return a byte-identical receipt.
//      An unanswered endpoint fails the run — unanimity or nothing.
//
// What it does NOT prove: that the work was done, delivered, or any good.
// Payment buys an attempt; delivery is proven by the sealed result and its
// receipt (see verify-artifacts.mjs), never by the chain alone. Nor does it
// prove that --payer, --payee and --amount are the TERMS of the grant whose
// hash you passed: the nonce binds the transaction to the grant hash, and the
// money assertions are made against the values you typed. Read those values
// off your keep file's wire, not off a chat.
//
// Exit 0 PROVEN / 1 REFUSED, with the failed check named / 2 PROVEN-UNPINNED:
// the same checks passed, but at least one operator was one YOU chose with
// --allow-unpinned-rpc rather than one on the reviewed allowlist. That verdict
// is only as strong as those operators and is not a transferable proof.

import { createHash } from "node:crypto";
import { readFileSync, realpathSync, statSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  EXPECTED_PAYEE_ACCOUNT,
  ALLOWED_BASE_RPC_HOSTS,
  CANONICAL_USDC_BASE,
  EXPECTED_CHAIN_ID_HEX,
  usableArgValue,
} from "./lib/pins.mjs";

export const SETTLEMENT_BINDING_DOMAIN = "voidly-session-settlement-binding/v1|";
// keccak256("AuthorizationUsed(address,bytes32)") — EIP-3009, from the USDC ABI.
export const TOPIC_AUTHORIZATION_USED =
  "0x98de503528ee59b575ef0c0a2576a82497bfc029a5685b209e9ec333479b10a5";
// keccak256("Transfer(address,address,uint256)")
export const TOPIC_TRANSFER =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
export const MIN_CONFIRMATIONS = 12;
// A quorum of one is not a quorum. Two independent operators is the floor.
export const MIN_OPERATORS = 2;
// Base produces a block every ~2s, so honest operators sit within a handful of
// blocks of each other. Further apart than this and one of them is not
// following the chain the other is.
export const MAX_HEAD_DIVERGENCE = 30;
export const DEFAULT_RPCS = ["https://mainnet.base.org", "https://base.drpc.org"];

const HEX64 = /^[0-9a-f]{64}$/;
const ADDR = /^0x[0-9a-f]{40}$/;
// Strict JSON-RPC shapes. Every value an operator sends is checked for TYPE
// before it is compared: `String(["0x2105"])` is "0x2105", `BigInt(true)` is
// 1n and `BigInt([])` is 0n, so coercion turned an array into a chain id and a
// boolean into a block height. A value of the wrong type is a refusal by
// name, never a coincidence that happens to compare equal.
const HASH32 = /^0x[0-9a-f]{64}$/;
const QUANTITY = /^0x(0|[1-9a-f][0-9a-f]*)$/;
const BYTES = /^0x([0-9a-f]{2})*$/;
const isStr = (v) => typeof v === "string";
const isHash32 = (v) => isStr(v) && HASH32.test(v.toLowerCase());
const isQuantity = (v) => isStr(v) && QUANTITY.test(v.toLowerCase());
const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

// ── The task-grant envelope, read without the SDK ────────────────────────────
// `grant_hash` IS `envelopeHash(grant)` in @voidly/session, and that function
// is sha256 over a specific canonical JSON: keys sorted, null/undefined keys
// dropped, strings JSON-quoted, integers in decimal, no whitespace. It is
// reimplemented here so this file stays dependency-free, and pinned to the
// SDK's own output by tests/verify-settlement.test.mjs (which CAN import the
// SDK) over random envelopes — a hash that drifted from the SDK's would bind
// a payment to the wrong hire, silently.
export const GRANT_SCHEMA = "voidly-task-grant/v1";
export const GRANT_KEYS = Object.freeze([
  "schema", "hirer_did", "provider_did", "provider_signing_pubkey_base64", "provider_enc_pubkey_base64",
  "offer_hash", "capsule_hash", "brief_commitment", "price_chain", "price_asset",
  "price_payer_account", "price_payee_account", "price_min_amount", "price_max_amount",
  "nonce", "issued_at", "expires_at",
]);
const CAIP2 = /^[-a-z0-9]{3,8}:[-_a-zA-Z0-9]{1,32}$/;
const CAIP10 = /^[-a-z0-9]{3,8}:[-_a-zA-Z0-9]{1,32}:[-.%a-zA-Z0-9]{1,128}$/;
const CAIP19 = /^[-a-z0-9]{3,8}:[-_a-zA-Z0-9]{1,32}\/[-a-z0-9]{3,8}:[-.%a-zA-Z0-9]{1,128}(\/[-.%a-zA-Z0-9]{1,78})?$/;
const POSITIVE_DECIMAL = /^[1-9][0-9]{0,77}$/;
export const EXPECTED_PRICE_CHAIN = "eip155:8453";
export const EXPECTED_PRICE_ASSET = `${EXPECTED_PRICE_CHAIN}/erc20:${CANONICAL_USDC_BASE}`;

/** @voidly/session's canonicalize(), byte for byte. Throws on what it throws on. */
export function sdkCanonicalize(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value)) throw new Error("canonicalize: only finite integers supported");
    return value.toString(10);
  }
  if (typeof value === "bigint") return value.toString(10);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(sdkCanonicalize).join(",") + "]";
  if (typeof value === "object") {
    return (
      "{" +
      Object.keys(value)
        .filter((k) => value[k] !== null && value[k] !== undefined)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + sdkCanonicalize(value[k]))
        .join(",") +
      "}"
    );
  }
  throw new Error(`canonicalize: unsupported type ${typeof value}`);
}

/** sha256 hex over the SDK canonical form — what the SDK calls envelopeHash. */
export function grantHashOf(grant) {
  return createHash("sha256").update(sdkCanonicalize(grant)).digest("hex");
}

/**
 * Read the money terms OFF THE GRANT: from = price_payer_account and
 * to = price_payee_account, exactly as buildTransferPaymentAuthorization and
 * buildReceivePaymentAuthorization sign them, plus the price BAND
 * price_min_amount..price_max_amount that the SDK's bindAuthorizationToGrant
 * accepts (the builders sign the floor). Refuses, by name, a document that is
 * not a task-grant envelope for Base USDC.
 */
export function grantTermsOf(grant) {
  try {
    return grantTermsOfInner(grant);
  } catch (e) {
    // A getter that throws, or any other hostile object shape: a named
    // refusal, never a crash. The message is withheld — it is the file's.
    return { ok: false, reason: "grant_not_a_grant_envelope", detail: "the grant could not be read as a plain JSON document" };
  }
}

function grantTermsOfInner(grant) {
  const refuse = (reason, detail = "") => ({ ok: false, reason, detail });
  if (!isPlainObject(grant) || grant.schema !== GRANT_SCHEMA) {
    return refuse(
      "grant_not_a_grant_envelope",
      `--grant is not a task-grant envelope (schema ${GRANT_SCHEMA}); seal-hire.mjs --keep writes it as <keep>.grant.json, and it is keep.json's wire.grant — do not pass keep.json itself`,
    );
  }
  const keys = Object.keys(grant).filter((k) => grant[k] !== null && grant[k] !== undefined).sort();
  const want = [...GRANT_KEYS].sort();
  if (keys.length !== want.length || keys.some((k, i) => k !== want[i])) {
    return refuse("grant_not_a_grant_envelope", `the grant's field set is not the task-grant field set (${keys.length} fields, expected ${want.length})`);
  }
  for (const k of GRANT_KEYS) if (typeof grant[k] !== "string") return refuse("grant_not_a_grant_envelope", `grant.${k} is not a string`);
  if (!CAIP2.test(grant.price_chain)) return refuse("grant_not_a_grant_envelope", "price_chain is not CAIP-2");
  if (!CAIP19.test(grant.price_asset)) return refuse("grant_not_a_grant_envelope", "price_asset is not CAIP-19");
  if (!CAIP10.test(grant.price_payer_account) || !CAIP10.test(grant.price_payee_account)) {
    return refuse("grant_not_a_grant_envelope", "price_payer_account / price_payee_account are not CAIP-10");
  }
  if (!POSITIVE_DECIMAL.test(grant.price_min_amount) || !POSITIVE_DECIMAL.test(grant.price_max_amount)) {
    return refuse("grant_not_a_grant_envelope", "price_min_amount / price_max_amount are not positive decimal strings");
  }
  // The band must be a band. validateGrant refuses an inverted one, so a
  // grant shaped that way never came out of the SDK.
  const a = grant.price_min_amount, b = grant.price_max_amount;
  if (a.length > b.length || (a.length === b.length && a > b)) {
    return refuse("grant_not_a_grant_envelope", "price_min_amount exceeds price_max_amount — not a band the SDK would issue");
  }
  if (grant.price_chain !== EXPECTED_PRICE_CHAIN) {
    return refuse("grant_chain_not_base", `the grant prices on ${grant.price_chain}; this skill is reviewed only for ${EXPECTED_PRICE_CHAIN}`);
  }
  // Exact spelling, as the SDK binds it (`authorization.asset !== grant.price_asset`
  // is a string compare there): an upper-case contract is a different asset
  // string to the SDK and would refuse at payment.
  if (grant.price_asset !== EXPECTED_PRICE_ASSET) {
    return refuse("grant_asset_not_canonical_usdc", `the grant's asset is a CAIP-19 identifier that is not canonical Base USDC (expected ${EXPECTED_PRICE_ASSET})`);
  }
  // Accounts are lowercase by construction (x402SessionAccountCaip10 lowercases
  // at sealing) and the SDK refuses any other spelling as unpayable — so does
  // this, rather than quietly folding case.
  const accountOf = (caip10) => {
    const addr = caip10.slice(EXPECTED_PRICE_CHAIN.length + 1);
    return ADDR.test(addr) ? addr : null;
  };
  const payer = accountOf(grant.price_payer_account);
  const payee = accountOf(grant.price_payee_account);
  if (!grant.price_payer_account.startsWith(EXPECTED_PRICE_CHAIN + ":") || payer === null) {
    return refuse("grant_not_a_grant_envelope", "price_payer_account is not a Base EVM account");
  }
  if (!grant.price_payee_account.startsWith(EXPECTED_PRICE_CHAIN + ":") || payee === null) {
    return refuse("grant_not_a_grant_envelope", "price_payee_account is not a Base EVM account");
  }
  // The payee is a pin. A grant that pays anyone else is a hire this skill
  // was not reviewed for — and it is a file somebody can hand you.
  if (grant.price_payee_account !== EXPECTED_PAYEE_ACCOUNT) {
    return refuse("grant_payee_not_pinned", `the grant pays an account that is not the pinned ${EXPECTED_PAYEE_ACCOUNT}`);
  }
  let grantHash;
  try {
    grantHash = grantHashOf(grant);
  } catch (e) {
    return refuse("grant_unhashable", `the grant is not a hashable envelope: ${String(e && e.message ? e.message : "").slice(0, 120)}`);
  }
  // The grant's amount is a BAND. The SDK's builders sign the floor
  // (value: price_min_amount), and its provider-side binding accepts anything
  // inside [min, max] (authorization_below_floor / authorization_over_ceiling).
  // A proof that asserted the floor exactly refused an honest settlement above
  // it — fail-closed, but wrong about what the grant permits.
  return {
    ok: true,
    grantHash,
    payer,
    payee,
    band: { min: grant.price_min_amount, max: grant.price_max_amount },
    chain: grant.price_chain,
    asset: grant.price_asset,
    expiresAt: grant.expires_at,
  };
}
const inBand = (value, band) => BigInt(value) >= BigInt(band.min) && BigInt(value) <= BigInt(band.max);
/** A response body larger than this is not a receipt. The archive receipt
 *  with its two logs is ~2.5 KB; a receipt with hundreds of logs is well
 *  under 1 MB. */
export const MAX_RPC_BODY_BYTES = 4 * 1024 * 1024;
/** Deeper than this is not a receipt either. `canonical()` is recursive, and
 *  a hostile operator answering 200k nested arrays used to blow the stack —
 *  an UNCAUGHT RangeError, not a refusal by name. */
export const MAX_CANONICAL_DEPTH = 64;
/** A task-grant envelope is ~1 KB. */
export const MAX_GRANT_FILE_BYTES = 64 * 1024;

/**
 * Who runs the node — the identity two --rpc values are deduplicated on.
 * `u.host` keeps a non-default port, so one box on two ports was "2/2
 * agreed" under --allow-unpinned-rpc, and `localhost` beside `127.0.0.1` was
 * two operators. Hostname only, with every loopback spelling folded into one.
 */
export const operatorKeyOf = (u) => {
  // Hostname, brackets off, trailing dots off (`mainnet.base.org.` is the
  // same name in the DNS). The URL parser has already canonicalized IPv6
  // spellings (`[0:0:0:0:0:0:0:1]` → `::1`, `[::ffff:127.0.0.1]` →
  // `::ffff:7f00:1`), so the loopback test is on the canonical forms.
  const name = String(u.hostname ?? "").toLowerCase().replace(/^\[|\]$/g, "").replace(/\.+$/, "");
  if (
    name === "localhost" ||
    name.endsWith(".localhost") ||
    name === "::1" ||
    name === "::" ||
    name === "0.0.0.0" ||
    /^127\.\d+\.\d+\.\d+$/.test(name) ||
    /^::ffff:7f[0-9a-f]{2}:[0-9a-f]{1,4}$/.test(name) ||
    /^::ffff:127\.\d+\.\d+\.\d+$/.test(name) ||
    name === "::ffff:0:0" ||
    name === "::ffff:0.0.0.0"
  ) {
    return "loopback";
  }
  return name;
};

/** Host names only — an RPC URL can carry an API key in its path. */
export const host = (u) => {
  try {
    return new URL(u).host;
  } catch {
    return "unparseable";
  }
};

/**
 * host() redacts the URL; interpolating the transport's own message beside it
 * un-redacts it. Measured on the shipped CLI, with no injection: undici quotes
 * the whole URL in both of the errors it raises before a request is made —
 *
 *   --rpc https://user:KEY@host/     -> "Request cannot be constructed from a
 *                                        URL that includes credentials: <url>"
 *   --rpc host/v2/KEY  (no scheme)   -> "Failed to parse URL from <url>"
 *
 * so `KEY` was printed verbatim in a REFUSED line. A verdict is exactly the
 * document you hand a counterparty, which is the whole reason host() exists.
 * Ordinary network and HTTP failures never carried the URL; these two did, and
 * nothing pinned the property.
 */
export const redactUrls = (message, url) => {
  let out = String(message ?? "");
  const raw = String(url ?? "");
  // The exact value we handed the transport, first — it is the only one that
  // can be matched with certainty, and the no-scheme case has no other handle.
  //
  // But ONLY when that value is long enough to be a URL. `--rpc a` turned this
  // into a find-and-replace over ordinary words: "connect ECONNREFUSED at a
  // place a request failed" came out as "connect ECONNREFUSED unparseablet
  // unparseable plunparseablece …". Over-redaction destroys the reason the
  // verification failed, which is its own kind of dishonest output — and a
  // value that short cannot be hiding a key anyway.
  if (raw.length >= 8) {
    const h = host(raw);
    out = out.split(raw).join(h && h !== "unparseable" ? h : "<redacted>");
  }
  // Any URL-shaped remnant is reduced to its host rather than trusted to be
  // secret-free: a normalized form or a redirect target can differ by a byte.
  // `host()` can return "" (e.g. "file:///x"), which would splice nothing into
  // the sentence and read as if no URL had been there.
  return out.replace(/[a-z][a-z0-9+.-]*:\/\/[^\s"']+/gi, (m) => host(m) || "<redacted>");
};

/** The binding nonce, recomputed from the hire — never taken from anywhere. */
export function bindingNonce(grantHash) {
  return (
    "0x" +
    createHash("sha256")
      .update(SETTLEMENT_BINDING_DOMAIN + String(grantHash).replace(/^0x/, "").toLowerCase())
      .digest("hex")
  );
}

// Fully recursive, key-sorted canonicalization. An array replacer here would
// silently strip every log's address/topics/data from the digest — one
// dishonest RPC could then forge agreement on a settlement that never
// happened. Every nested field, logs included, goes into the hash.
// Depth-limited: a document nested past MAX_CANONICAL_DEPTH throws a named
// error, which verifySettlement turns into a refusal instead of a crash.
export const canonical = (v, depth = 0) => {
  if (depth > MAX_CANONICAL_DEPTH) {
    throw new Error(`document nested deeper than ${MAX_CANONICAL_DEPTH} levels`);
  }
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map((x) => canonical(x, depth + 1)).join(",")}]`;
  return `{${Object.keys(v)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(v[k], depth + 1)}`)
    .join(",")}}`;
};

const bodyTooLarge = (n) => Object.assign(new Error(`rpc body too large (${n} bytes, cap ${MAX_RPC_BODY_BYTES})`), { code: "RPC_BODY_TOO_LARGE" });
const bodyTooDeep = () => Object.assign(new Error(`rpc body nested deeper than ${MAX_CANONICAL_DEPTH} levels`), { code: "RPC_BODY_TOO_DEEP" });

/** Does this JSON text open more than `limit` nested arrays/objects? Strings
 *  are skipped (a bracket inside a string is data). Linear, allocation-free. */
export function nestingDepthExceeds(text, limit) {
  let depth = 0;
  let inString = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    if (inString) {
      if (c === 0x5c) i += 1; // backslash: skip the escaped char
      else if (c === 0x22) inString = false;
      continue;
    }
    if (c === 0x22) inString = true;
    else if (c === 0x5b || c === 0x7b) {
      depth += 1;
      if (depth > limit) return true;
    } else if (c === 0x5d || c === 0x7d) depth -= 1;
  }
  return false;
}

/** Real transport. Only ever asked the read methods in READ_METHODS. */
export const READ_METHODS = new Set([
  "eth_chainId",
  "eth_getTransactionReceipt",
  "eth_getBlockByNumber",
  "eth_blockNumber",
  // Read-only too: preview-payment.mjs reads the gas price for its fee line.
  // eth_estimateGas is deliberately NOT here: estimating a signed
  // transferWithAuthorization would hand the bearer authorization to an
  // operator, who could broadcast it first.
  "eth_gasPrice",
]);
export async function httpRpc(url, method, params) {
  if (!READ_METHODS.has(method)) {
    throw new Error(`refusing non-read method ${method}`);
  }
  // `redirect: "error"`: a redirect is a second URL nobody reviewed — the
  // allowlist and the https check were applied to the one you named.
  // The cap is enforced ON THE WIRE: `accept-encoding: identity` so nothing
  // inflates after the count (a 4 MiB gzip body decompressed to ~4 GiB in
  // RAM before `text.length` was ever compared), and the body is read as a
  // stream that aborts the moment the count passes the cap. A declared
  // content-length above the cap is refused before a byte is read.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("rpc timed out")), 20000);
  let text;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "accept-encoding": "identity" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: controller.signal,
      redirect: "error",
    });
    if (!res.ok) throw new Error(`http ${res.status}`);
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > MAX_RPC_BODY_BYTES) throw bodyTooLarge(declared);
    if (!res.body) throw new Error("rpc empty body");
    const chunks = [];
    let total = 0;
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RPC_BODY_BYTES) {
        controller.abort(bodyTooLarge(total));
        throw bodyTooLarge(total);
      }
      chunks.push(value);
    }
    text = Buffer.concat(chunks).toString("utf8");
  } finally {
    clearTimeout(timer);
  }
  // Depth is bounded BEFORE JSON.parse: a 4 MiB body of nested arrays parsed
  // into ~2 million levels (hundreds of MB of heap) before canonical() could
  // refuse it. A scan over the bytes, outside strings, costs nothing.
  if (nestingDepthExceeds(text, MAX_CANONICAL_DEPTH)) throw bodyTooDeep();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error("rpc body not JSON");
  }
  // The envelope is checked for SHAPE, and the provider's own error message is
  // never interpolated — it is the provider's text, and it can carry the URL.
  if (!isPlainObject(body)) throw new Error("rpc body not an object");
  if (isPlainObject(body.error)) {
    throw new Error(`rpc error ${Number.isInteger(body.error.code) ? body.error.code : "(non-integer code)"}`);
  }
  if (body.error !== undefined && body.error !== null) throw new Error("rpc error (unshaped)");
  if (!("result" in body)) throw new Error("rpc body carries neither result nor error");
  return body.result;
}

const lower = (v) => String(v ?? "").toLowerCase();
// A topic that carries an address is 12 zero bytes then 20 address bytes;
// non-zero padding is not an address (the preview's decoder already says so).
const topicToAddress = (t) => (/^0x0{24}[0-9a-f]{40}$/.test(lower(t)) ? "0x" + lower(t).slice(26) : null);
/** Operator-supplied quantities and hashes are shown only in their own shape, and short. */
const shownQuantity = (v) => (isQuantity(v) ? lower(v).slice(0, 40) : `(not a hex quantity: ${v === null ? "null" : Array.isArray(v) ? "an array" : typeof v})`);
const shownHash = (v) => (isStr(v) && /^0x[0-9a-f]{64}$/i.test(v) ? lower(v) : `(not a 32-byte hash: ${v === null ? "null" : Array.isArray(v) ? "an array" : typeof v})`);

/**
 * Parse a log's index. Returned as a Number; `null` when the field is absent
 * or unparseable. A canonical-USDC log with no readable index cannot be
 * ordered, and pairing by order is the whole point — so the caller refuses
 * rather than falling back to array position, which an operator controls.
 */
export function logIndexOf(log) {
  const raw = log?.logIndex;
  // A JSON-RPC quantity is a 0x-hex STRING. A bare number or a decimal string
  // is not what an operator sends, and an index past 2^32 is not an index.
  if (!isQuantity(raw)) return null;
  const n = BigInt(raw);
  if (n > 0xffffffffn) return null;
  return Number(n);
}

/**
 * The whole verdict, as a value. Injectable transport so the pairing rules can
 * be tested against fixtures with no network.
 *
 * @returns {Promise<{ok:true, …facts} | {ok:false, reason:string, detail:string}>}
 */
/**
 * A typed --grant-hash / --payer / --payee / --amount is argv, and argv used
 * to reach a refusal verbatim (60 KB of it, or a newline and a forged PROVEN
 * block). Shown only when it has the shape the flag is supposed to carry.
 */
const shownTyped = (flag, value) => {
  const v = String(value ?? "");
  const shape = flag === "--grant-hash" ? /^(0x)?[0-9a-f]{64}$/ : flag === "--amount" ? /^[0-9]{1,40}$/ : /^0x[0-9a-f]{40}$/;
  return shape.test(v) ? v : `(not a well-formed value, ${v.length} chars)`;
};

export async function verifySettlement(input) {
  // Every exit is a verdict. A thrown error anywhere below — a transport that
  // returns an object whose toString throws, a stack overflow from a hostile
  // document — used to escape as an uncaught exception with a stack trace,
  // which is the one shape "Exit 1: refused, by name" rules out. The message
  // is redacted before it is repeated: it may quote an operator URL.
  try {
    return await verifySettlementInner(input);
  } catch (e) {
    // The message is WITHHELD, not redacted: by the time a throw reaches this
    // boundary it may have come from anywhere — a transport, an operator's
    // document, a refusal being formatted — and a string this code did not
    // shape cannot be known secret-free. The class name is enough to say
    // "the verifier broke, not the settlement".
    let name = "Error";
    try {
      const raw = String(e?.constructor?.name ?? name);
      // The name is a stranger's string too: a forged constructor.name
      // carried a whole PROVEN block into this line.
      name = /^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(raw) ? raw : "Error";
    } catch {
      /* even the name can throw on a hostile object */
    }
    return {
      ok: false,
      reason: "verifier_exception",
      detail: `an unexpected ${name} inside the verifier — its message is withheld because it may quote an operator URL; this is a verifier fault, not a settlement verdict`,
    };
  }
}

async function verifySettlementInner({
  tx,
  grant,
  grantHash,
  payer,
  payee,
  amount,
  rpcUrls = DEFAULT_RPCS,
  rpc = httpRpc,
  minConfirmations = MIN_CONFIRMATIONS,
  allowUnpinnedRpc = false,
}) {
  const refuse = (reason, detail = "") => ({ ok: false, reason, detail });
  // A transport failure has a name of its own when it is the body cap firing.
  // Declared first: the chain-id loop runs before the nonce is derived, and a
  // helper declared below it was in its temporal dead zone there.
  const unanswered = (e) =>
    e && e.code === "RPC_BODY_TOO_LARGE" ? "rpc_body_too_large" : e && e.code === "RPC_BODY_TOO_DEEP" ? "receipt_unparseable" : "rpc_unanswered";

  const txHash = lower(tx).trim();
  // `0x` + 64 hex, exactly. A bare hash used to pass this test (the prefix was
  // stripped for the check but not for the value) and then refuse under the
  // wrong name three network calls later.
  if (!HASH32.test(txHash)) return refuse("bad_tx_hash");

  // ── The terms: from the grant, or as typed. ──────────────────────────────
  let gh, from, to, want;
  let terms;
  let band = null;
  // Grant mode is selected by the grant being GIVEN, not by what it parsed
  // to: a literal `null` in the file used to fall through to typed mode and
  // print "no --grant was given" on a run invoked with --grant.
  if (grant !== undefined) {
    const t = grantTermsOf(grant);
    if (!t.ok) return t;
    gh = t.grantHash;
    from = t.payer;
    to = t.payee;
    band = t.band;
    // Anything typed beside the grant must AGREE with it. A typed value that
    // disagrees is not overridden and not ignored: it is the exact shape of
    // "paid for one set of terms, bound to another", and it refuses.
    // An absent or empty typed value is "not given"; anything else must agree.
    const given = (v) => v !== undefined && v !== null && String(v).trim() !== "";
    const typed = [
      ["--grant-hash", given(grantHash) ? lower(grantHash).trim().replace(/^0x/, "") : undefined, gh],
      ["--payer", given(payer) ? lower(payer).trim() : undefined, from],
      ["--payee", given(payee) ? lower(payee).trim() : undefined, to],
    ];
    for (const [flag, given, fromGrant] of typed) {
      if (given !== undefined && given !== fromGrant) {
        return refuse(
          "grant_terms_mismatch",
          `${flag} ${shownTyped(flag, given)} disagrees with the grant (${fromGrant}) — the grant is the authority on its own terms; a value typed beside it that differs is a different hire`,
        );
      }
    }
    // The grant prices a BAND, so a typed --amount is checked against the band
    // here and against the chain below (exact_value): it must be both a price
    // the grant permits and the amount that moved.
    want = null;
    if (given(amount)) {
      const typedAmount = String(amount).trim();
      if (!/^[0-9]+$/.test(typedAmount)) return refuse("bad_amount");
      want = BigInt(typedAmount).toString();
      if (!inBand(want, band)) {
        return refuse(
          "grant_terms_mismatch",
          `--amount ${want.length > 40 ? "(a number with " + want.length + " digits)" : want} is outside the grant's price band ${band.min}..${band.max} — the grant is the authority on its own terms`,
        );
      }
    }
    terms = { source: "grant", expiresAt: t.expiresAt, band };
  } else {
    gh = lower(grantHash).replace(/^0x/, "");
    from = lower(payer);
    to = lower(payee);
    want = String(amount ?? "").trim();
    if (!HEX64.test(gh)) return refuse("bad_grant_hash");
    if (!ADDR.test(from)) return refuse("bad_payer_address");
    if (!ADDR.test(to)) return refuse("bad_payee_address");
    if (!/^[0-9]+$/.test(want)) return refuse("bad_amount");
    // "050000" is 50000. Compared as strings it refused exact_value while
    // being exact; compared as integers it is the amount typed.
    want = BigInt(want).toString();
    if (want === "0") return refuse("bad_amount", "0 is not a payment — a zero-value Transfer settles nothing");
    terms = { source: "typed" };
  }
  if (!Array.isArray(rpcUrls) || rpcUrls.length === 0) return refuse("no_rpc_endpoints");

  if (!Number.isInteger(minConfirmations) || minConfirmations < 1) {
    return refuse("verifier_misconfigured", "minConfirmations must be a positive integer");
  }

  // ── The quorum, decided BEFORE a single packet leaves. ────────────────────
  // HTTPS only, allowlisted hosts only (unless allowUnpinnedRpc), and at least
  // MIN_OPERATORS of them once duplicates collapse. Independence is counted by
  // HOST — `https://x/`, `HTTPS://X`, `https://x:443` and `https://x/other`
  // are all one operator, so `new Set(digests).size !== 1` below is a count of
  // OPERATORS, not of flags. Everything after this point is only as
  // trustworthy as this list.
  const checked = [];
  for (const raw of rpcUrls) {
    let u;
    try {
      u = new URL(String(raw).trim());
    } catch {
      // The raw value is withheld on purpose: a malformed --rpc argument
      // (`host/v2/KEY`, no scheme) is exactly the shape that carries a
      // credential, and a refusal line is a document that gets pasted around.
      return refuse("bad_rpc_url", "an --rpc value is not a URL (value withheld — a malformed RPC argument can still carry a credential)");
    }
    if (u.protocol !== "https:") {
      return refuse(
        "rpc_not_https",
        `${u.protocol}//${u.host} — a plaintext RPC can be rewritten in flight by anyone on the path`,
      );
    }
    if (!allowUnpinnedRpc && !ALLOWED_BASE_RPC_HOSTS.includes(u.host)) {
      return refuse(
        "rpc_host_not_allowlisted",
        `${u.host} is not one of the reviewed Base operators in scripts/lib/pins.mjs (${ALLOWED_BASE_RPC_HOSTS.join(", ")}) — pass --allow-unpinned-rpc only if you know exactly whose node that is`,
      );
    }
    checked.push({ url: raw, host: u.host.toLowerCase(), operatorKey: operatorKeyOf(u) });
  }
  const seenHosts = new Set();
  const operators = checked.filter((c) => {
    if (seenHosts.has(c.operatorKey)) return false;
    seenHosts.add(c.operatorKey);
    return true;
  });
  if (operators.length < MIN_OPERATORS) {
    return refuse(
      "insufficient_rpc_quorum",
      `${operators.length} distinct operator(s) [${operators.map((o) => o.host).join(", ") || "none"}] — a quorum needs at least ${MIN_OPERATORS}. A single endpoint, or the same endpoint named twice, can return whatever it likes`,
    );
  }
  rpcUrls = operators.map((o) => o.url);
  // Which of the operators the verdict rests on were NOT reviewed. Non-empty
  // only under --allow-unpinned-rpc; the printed verdict says so out loud,
  // because a PROVEN built on unreviewed operators is a different document
  // from a PROVEN built on the allowlist, and only the output travels.
  const unpinnedHosts = operators
    .map((o) => o.host)
    .filter((h) => !ALLOWED_BASE_RPC_HOSTS.includes(h));

  // ── Chain context, per operator, before anything else it says is believed.
  for (const url of rpcUrls) {
    let chainId;
    try {
      chainId = await rpc(url, "eth_chainId", []);
    } catch (e) {
      return refuse(
        unanswered(e),
        `${host(url)}: ${redactUrls(e.message, url)} on eth_chainId — an unanswered operator is a divergent operator`,
      );
    }
    // A string, or nothing: `String(["0x2105"])` is "0x2105" and an object
    // whose toString throws is an uncaught crash. Type first, value second.
    if (!isQuantity(chainId)) {
      return refuse(
        "wrong_chain",
        `${host(url)} answered eth_chainId with ${chainId === null ? "null" : Array.isArray(chainId) ? "an array" : typeof chainId === "string" ? "a malformed string" : `a ${typeof chainId}`}, not a hex chain id — a receipt read off an operator that cannot say which chain it is on proves nothing here`,
      );
    }
    if (lower(chainId) !== EXPECTED_CHAIN_ID_HEX) {
      return refuse(
        "wrong_chain",
        `${host(url)} reports chain ${redactUrls(chainId.slice(0, 66), url)}, expected ${EXPECTED_CHAIN_ID_HEX} (Base mainnet, 8453) — a receipt read off another chain proves nothing here`,
      );
    }
  }

  const nonce = bindingNonce(gh);

  // ── Quorum read: every named endpoint, byte-identical or nothing. ─────────
  const receipts = [];
  for (const url of rpcUrls) {
    let receipt;
    try {
      receipt = await rpc(url, "eth_getTransactionReceipt", [txHash]);
    } catch (e) {
      return refuse(
        unanswered(e),
        `${host(url)}: ${redactUrls(e.message, url)} — an unanswered operator is a divergent operator`,
      );
    }
    // ── RECEIPT IDENTITY, BEFORE ANYTHING ELSE IS READ FROM IT ─────────────
    // An operator that answers with a valid-but-unrelated receipt used to get
    // a PROVEN block printing a tx hash that appeared nowhere in the evidence
    // actually checked. Nothing below reads a field of this document until it
    // has said, itself, which transaction it describes.
    if (receipt !== null && receipt !== undefined) {
      if (!isPlainObject(receipt)) {
        return refuse(
          "receipt_not_for_this_tx",
          `${host(url)}: the receipt is ${Array.isArray(receipt) ? "an array" : `a ${typeof receipt}`}, not an object — a receipt that is not a document cannot identify itself`,
        );
      }
      const claimed = isStr(receipt.transactionHash) ? lower(receipt.transactionHash) : "";
      if (!isStr(receipt.transactionHash) || !/^0x[0-9a-f]{64}$/.test(claimed)) {
        return refuse(
          "receipt_not_for_this_tx",
          `${host(url)}: receipt carries no usable transactionHash — a receipt that cannot identify itself cannot prove anything about ${txHash}`,
        );
      }
      if (claimed !== txHash) {
        return refuse(
          "receipt_not_for_this_tx",
          `${host(url)}: asked for ${txHash}, got the receipt for ${claimed}`,
        );
      }
    }
    receipts.push({ url, receipt: receipt ?? null });
  }

  let digests;
  try {
    digests = receipts.map(({ receipt }) =>
      createHash("sha256").update(canonical(receipt)).digest("hex"),
    );
  } catch (e) {
    // Only this file's own depth message is repeated; anything else that
    // surfaces here is a stranger's string.
    const why = typeof e?.message === "string" && e.message.startsWith("document nested deeper than") ? e.message : "not canonicalizable";
    return refuse(
      "receipt_unparseable",
      `an operator's receipt could not be canonicalized (${why}) — a document too deep to hash is not a receipt`,
    );
  }
  if (new Set(digests).size !== 1) {
    return refuse(
      "rpc_divergence",
      receipts.map((r, i) => `${host(r.url)}=${digests[i].slice(0, 8)}`).join(" "),
    );
  }
  const receipt = receipts[0].receipt;
  if (receipt === null) return refuse("tx_not_found");
  if (!isStr(receipt.status) || lower(receipt.status) !== "0x1") {
    // Never the operator's own text: a 4 MB status, or one carrying newlines
    // and a forged PROVEN block, used to be printed verbatim in this line.
    return refuse("tx_reverted", `status ${isQuantity(receipt.status) ? lower(receipt.status) : "(not a hex quantity)"}`);
  }

  // ── Canonical-USDC logs only, ordered by their own logIndex. ─────────────
  // `logs` that is not an array used to coerce to [] and refuse with
  // nonce_not_spent_by_this_tx — true, but the wrong name for "the operator
  // sent something that is not a receipt".
  if (!Array.isArray(receipt.logs)) {
    return refuse(
      "receipt_logs_malformed",
      `the receipt's logs field is ${receipt.logs === null ? "null" : typeof receipt.logs}, not an array — a receipt whose events cannot be read proves nothing`,
    );
  }
  // The receipt must name its block BEFORE its logs are believed: every
  // canonical-USDC log below is required to name that same block.
  if (!isQuantity(receipt.blockNumber)) {
    return refuse(
      "receipt_not_mined",
      `the receipt for ${txHash} carries no usable blockNumber — it is not in a block, so it has no confirmations`,
    );
  }
  if (!isHash32(receipt.blockHash)) {
    return refuse(
      "block_hash_unreadable",
      `the receipt for ${txHash} carries no usable blockHash — a receipt that cannot name its block cannot be bound to one`,
    );
  }
  const receiptBlockHash = lower(receipt.blockHash);
  const receiptBlockNumber = BigInt(receipt.blockNumber);
  // Printed as a Number later; past 2^53 that print would round. No chain
  // this skill is reviewed for is within nine orders of magnitude of it.
  if (receiptBlockNumber > 0x1fffffffffffffn) {
    return refuse("receipt_not_mined", `the receipt names block ${lower(receipt.blockNumber).slice(0, 40)}, which is not a block height any operator could have`);
  }
  const allLogs = receipt.logs;
  const usdcLogs = [];
  for (const l of allLogs) {
    if (!isPlainObject(l)) {
      return refuse("log_malformed", "a log in this receipt is not an object — a receipt whose events cannot be read proves nothing");
    }
    if (!isStr(l.address) || lower(l.address) !== CANONICAL_USDC_BASE) continue;
    // A log marked removed was reorged out — it is the chain saying "this
    // event did not happen". Skipping it silently would let the rest of a
    // doctored receipt carry the proof, so it refuses instead.
    // `removed` is a JSON boolean on every operator; a string "true" is not
    // what the chain says and is not accepted as if it were.
    if (l.removed === true) {
      return refuse(
        "log_removed",
        "a canonical-USDC log in this receipt is marked removed (reorged out); a receipt carrying removed logs is not settled evidence",
      );
    }
    if (l.removed !== undefined && l.removed !== false) {
      return refuse("log_malformed", "a canonical-USDC log's removed flag is neither true nor false — a log that cannot be read cannot be ruled out");
    }
    // Every canonical-USDC log must name THIS transaction and THIS block —
    // required, not asserted-when-present. Base operators always send all
    // three fields (measured on the archive receipt), and a doctored receipt
    // that simply omits them would otherwise be exempt from the very check
    // that catches mixed evidence.
    if (!isHash32(l.transactionHash) || lower(l.transactionHash) !== txHash) {
      return refuse(
        "log_not_for_this_tx",
        `a canonical-USDC log names transaction ${isHash32(l.transactionHash) ? lower(l.transactionHash) : "(unreadable)"}, not ${txHash} — this receipt carries another transaction's evidence`,
      );
    }
    if (!isHash32(l.blockHash) || lower(l.blockHash) !== receiptBlockHash || !isQuantity(l.blockNumber) || BigInt(l.blockNumber) !== receiptBlockNumber) {
      return refuse(
        "log_not_in_this_block",
        `a canonical-USDC log names a block other than the receipt's (${receiptBlockHash} at ${Number(receiptBlockNumber)}) — this receipt carries evidence from another block`,
      );
    }
    // Topics: an array of 32-byte words. Both events this proof reads emit
    // exactly three (signature + two indexed fields); a log with any other
    // count, or a word that is not 32 bytes, cannot be one of them and cannot
    // be ruled out either, so it refuses rather than being skipped.
    if (!Array.isArray(l.topics)) {
      return refuse(
        "log_topics_malformed",
        `a canonical-USDC log has a non-array topics (${l.topics === null ? "null" : typeof l.topics}); a log that cannot be read cannot be ruled out, so this refuses rather than skipping it`,
      );
    }
    if (l.topics.length !== 3 || !l.topics.every(isHash32)) {
      return refuse(
        "log_topics_malformed",
        `a canonical-USDC log carries ${l.topics.length} topic(s)${l.topics.every(isHash32) ? "" : ", not all 32-byte words"}; AuthorizationUsed and Transfer each carry exactly three, and a log that cannot be read cannot be ruled out`,
      );
    }
    if (!isStr(l.data) || !BYTES.test(lower(l.data))) {
      return refuse("log_data_malformed", "a canonical-USDC log's data is not a hex byte string");
    }
    const idx = logIndexOf(l);
    if (idx === null) {
      return refuse(
        "log_index_unreadable",
        "a canonical-USDC log carries no readable logIndex; this proof pairs the authorization to its transfer BY INDEX and will not fall back to array position",
      );
    }
    usdcLogs.push({ log: l, index: idx });
  }
  usdcLogs.sort((a, b) => a.index - b.index);
  // Two canonical-USDC logs with one index: the pairing would then rest on
  // array position after all, which this file promises it never does.
  for (let i = 1; i < usdcLogs.length; i += 1) {
    if (usdcLogs[i].index === usdcLogs[i - 1].index) {
      return refuse("log_index_duplicate", `two canonical-USDC logs carry logIndex ${usdcLogs[i].index}; which is which is not determinable, so this refuses rather than trusting array order`);
    }
  }

  // ── The binding: EXACTLY ONE AuthorizationUsed carrying this hire's nonce.
  const withNonce = usdcLogs.filter(
    ({ log }) => lower(log.topics[0]) === TOPIC_AUTHORIZATION_USED && lower(log.topics[2]) === nonce,
  );
  if (withNonce.length === 0) {
    return refuse(
      "nonce_not_spent_by_this_tx",
      `no AuthorizationUsed with nonce ${nonce.slice(0, 10)}… on canonical USDC`,
    );
  }
  // USDC scopes nonces PER AUTHORIZER (_authorizationStates[authorizer][nonce]),
  // so a stranger spending the same bytes32 under their own key in the same
  // transaction is not this hire's authorization and must not make it
  // ambiguous. Ambiguity is counted among THIS payer's uses only.
  const auths = withNonce.filter(({ log }) => topicToAddress(log.topics[1]) === from);
  if (auths.length === 0) {
    const other = topicToAddress(withNonce[0].log.topics[1]);
    return refuse("authorizer_mismatch", other === null ? "AuthorizationUsed topic[1] is not decodable as an address" : `authorizer ${other}`);
  }
  if (auths.length > 1) {
    return refuse(
      "authorization_ambiguous",
      `${auths.length} AuthorizationUsed events carry nonce ${nonce.slice(0, 10)}… for this payer in one transaction; more than one is ambiguous and ambiguity refuses`,
    );
  }
  const auth = auths[0];
  const authorizer = from;

  // ── The PAIRED Transfer: the first canonical-USDC Transfer AFTER the
  //    authorization, by log index. FiatTokenV2 emits AuthorizationUsed
  //    immediately before the Transfer of the same call.
  // A log whose `topics` is not an array is REFUSED, never skipped.
  //
  // `log.topics?.[0]` on a string yields its first character, so a canonical-USDC
  // log with `topics` as a string silently fails every topic comparison and drops
  // out of the scan — which means a SECOND payer->payee Transfer shaped that way
  // slips past `transfer_ambiguous` and the run proves a single unambiguous
  // settlement that is not one. Measured on this file before the guard: it
  // returned ok with value 50000 instead of refusing.
  //
  // The quorum is a partial defence here and not a complete one: this file's
  // canonicalization DOES distinguish `topics: "0x…"` from `topics: ["0x…"]`
  // (different digests), so one honest operator breaks unanimity. That leaves
  // the case where every named endpoint serves the same doctored receipt. Shape
  // is cheap to check and skipping is the dangerous direction, so it is checked.
  // (Topic shape is enforced per log in the loop above, before any topic is
  // read — this scan is the belt to that braces.)
  const malformed = usdcLogs.find(({ log }) => !Array.isArray(log.topics) || log.topics.length !== 3);
  if (malformed) {
    return refuse("log_topics_malformed", `a canonical-USDC log at index ${malformed.index} has unreadable topics`);
  }
  const transfers = usdcLogs.filter(({ log }) => lower(log.topics?.[0]) === TOPIC_TRANSFER);
  if (transfers.length === 0) return refuse("no_usdc_transfer");
  const paired = transfers.find((t) => t.index > auth.index);
  if (!paired) {
    return refuse(
      "paired_transfer_missing",
      `AuthorizationUsed is at log ${auth.index} but no canonical-USDC Transfer follows it; the authorization and its transfer are one movement in one call`,
    );
  }

  // ── Every money assertion below reads the PAIRED log and no other. ────────
  const pFrom = topicToAddress(paired.log.topics?.[1]);
  const pTo = topicToAddress(paired.log.topics?.[2]);
  if (pFrom !== from) {
    return refuse(
      "transfer_payer_mismatch",
      `the Transfer paired to this authorization (log ${paired.index}) moves money from ${pFrom}, not the expected payer ${from}`,
    );
  }
  if (pTo !== to) {
    return refuse(
      "transfer_recipient_mismatch",
      `the paired Transfer pays ${pTo}, not the expected payee ${to}`,
    );
  }
  // A Transfer's data is exactly one 32-byte word. `BigInt("0x")` is 0n and
  // `BigInt("0x1")` is 1n, so a short or empty data field used to become a
  // value that then failed exact_value — refused, but for the wrong reason.
  if (!isStr(paired.log.data) || !HASH32.test(lower(paired.log.data))) {
    return refuse("transfer_value_unreadable", `log ${paired.index} data is not a single 32-byte word`);
  }
  const value = BigInt(paired.log.data).toString();
  if (band !== null && !inBand(value, band)) {
    return refuse(
      "amount_outside_grant_band",
      `the paired Transfer moved ${value}, outside the grant's price band ${band.min}..${band.max} — not a price this grant permits`,
    );
  }
  if (want !== null && value !== want) {
    return refuse("exact_value", `the paired Transfer moved ${value}, expected exactly ${want}`);
  }

  // ── Ambiguity guard: one payer -> payee movement, or refuse. A second one
  //    means a first match could have been taken for the settled one.
  const payerToPayee = transfers.filter(
    (t) => topicToAddress(t.log.topics?.[1]) === from && topicToAddress(t.log.topics?.[2]) === to,
  );
  if (payerToPayee.length > 1) {
    return refuse(
      "transfer_ambiguous",
      `${payerToPayee.length} canonical-USDC Transfers move ${from} -> ${to} in this transaction (logs ${payerToPayee
        .slice(0, 8)
        .map((t) => t.index)
        .join(", ")}${payerToPayee.length > 8 ? `, and ${payerToPayee.length - 8} more` : ""}); which one settled this hire is not determinable, so this refuses rather than picking one`,
    );
  }

  // ── Finality. Every named operator, not only the first. ──────────────────
  //
  // This read was `rpc(rpcUrls[0], ...)`. The receipt was under quorum and the
  // head was not, so ONE dishonest endpoint — merely by being first in argv —
  // turned a one-confirmation transaction into PROVEN printing
  // `confirmations: 250000`, with the honest peers never asked at all. The same
  // two operators and the same genuine receipt gave PROVEN or REFUSED depending
  // only on the order the flags were typed. Nothing about the receipt had to be
  // forged, and no test could see it: the fixture transport takes `_url` and
  // discards it, so every operator in every test returned the same head.
  //
  // The LOWEST head is used rather than a unanimity rule. A liar reporting a
  // head far ahead cannot raise the floor, and a lagging honest operator can
  // only lower it — both directions fail closed, which is the property a
  // finality check has to have.
  // `"" `, `"0x"` and any non-numeric value all coerce through BigInt() or
  // Number() into a block of 0 and a fabricated confirmation count, so this
  // tests for a READABLE block number rather than for two specific absences.
  const receiptBlock = receiptBlockNumber;

  // ── Block binding, per operator: the receipt names a blockHash, and every
  //    operator must report that same hash at that height. A receipt agreed on
  //    by RPCs but hanging off no block either of them has is not a
  //    settlement. A receipt with no READABLE blockHash refuses first —
  //    comparing undefined to undefined is how this check would silently
  //    assert nothing.
  for (const url of rpcUrls) {
    let block;
    try {
      block = await rpc(url, "eth_getBlockByNumber", [receipt.blockNumber, false]);
    } catch (e) {
      return refuse(
        unanswered(e),
        `${host(url)}: ${redactUrls(e.message, url)} on eth_getBlockByNumber — an operator that cannot show the block cannot corroborate the receipt`,
      );
    }
    if (block === null || block === undefined) {
      return refuse("block_not_found", `${host(url)} has no block ${receipt.blockNumber}`);
    }
    if (!isPlainObject(block) || !isHash32(block.hash)) {
      return refuse(
        "block_hash_mismatch",
        `${host(url)} answered eth_getBlockByNumber for ${shownQuantity(receipt.blockNumber)} with something that is not a block carrying a hash — the receipt cannot be bound to it`,
      );
    }
    if (!isQuantity(block.number) || BigInt(block.number) !== receiptBlockNumber) {
      return refuse(
        "block_hash_mismatch",
        `${host(url)} answered eth_getBlockByNumber for ${shownQuantity(receipt.blockNumber)} with block ${shownQuantity(block.number)} — not the block that was asked for`,
      );
    }
    if (lower(block.hash) !== receiptBlockHash) {
      return refuse(
        "block_hash_mismatch",
        `${host(url)} reports ${shownHash(block.hash)} at ${shownQuantity(receipt.blockNumber)}, the receipt claims ${receiptBlockHash} — that receipt is not on this operator's chain`,
      );
    }
  }
  // FAIL CLOSED, exactly as the receipt loop above does. The first version of
  // this loop collected failures into `headErrors` and carried on with whoever
  // answered — which restored the single-endpoint defect it was written to fix:
  // an honest peer that 429s on the SECOND of its two calls (the commonest
  // failure on a public Base RPC) leaves the liar's head as the floor, and the
  // run prints a fabricated `confirmations` beside a quorum line naming both
  // hosts. No forging, no argv race. `headErrors` was also read in exactly one
  // branch, so it promised a report the success path never made.
  //
  // This file's own contract, and settlement-proof.md, both say: "An unanswered
  // endpoint fails the whole run — unanimity or nothing." That is now true of
  // the head as well as the receipt.
  const heads = [];
  for (const url of rpcUrls) {
    let raw;
    try {
      raw = await rpc(url, "eth_blockNumber", []);
    } catch (e) {
      return refuse(
        unanswered(e),
        `${host(url)}: ${redactUrls(e.message, url)} — this operator returned a receipt but no block` +
          ` height; an operator that answers half the questions cannot corroborate finality`,
      );
    }
    // `BigInt(true)` is 1n and `BigInt([])` is 0n: a head of the wrong type
    // used to become a tiny confirmation count and refuse under the wrong name.
    if (!isQuantity(raw)) {
      return refuse(
        "rpc_head_unreadable",
        `${host(url)} answered eth_blockNumber with ${raw === null ? "null" : Array.isArray(raw) ? "an array" : `a ${typeof raw}`}, not a hex quantity — an operator that cannot state its head cannot corroborate finality`,
      );
    }
    if (BigInt(raw) > 0x1fffffffffffffn) {
      return refuse("rpc_head_unreadable", `${host(url)} reports a head of ${raw.slice(0, 40)}, which is not a block height any operator could have`);
    }
    heads.push({ url, head: BigInt(raw) });
  }
  const lowest = heads.reduce((a, b) => (b.head < a.head ? b : a));
  // The heads must also AGREE. The lowest head fails closed on its own, but an
  // operator wildly behind (or ahead of) the others is not following the same
  // chain, and a proof built astride two chains is not a proof.
  const highest = heads.reduce((a, b) => (b.head > a.head ? b : a));
  if (highest.head - lowest.head > BigInt(MAX_HEAD_DIVERGENCE)) {
    return refuse(
      "rpc_head_divergence",
      `${host(highest.url)} is ${Number(highest.head - lowest.head)} blocks ahead of ${host(lowest.url)}, beyond the ${MAX_HEAD_DIVERGENCE}-block tolerance — one of them is not following the chain the other is`,
    );
  }
  const confirmations = Number(lowest.head - receiptBlock);
  if (confirmations < minConfirmations) {
    return refuse(
      "insufficient_confirmations",
      `${confirmations} < ${minConfirmations}` +
        (heads.length > 1
          ? ` — lowest head of ${heads.length} operators, from ${host(lowest.url)}`
          : ` — from ${host(lowest.url)}, the only operator that answered`),
    );
  }

  return {
    ok: true,
    tx: txHash,
    grantHash: gh,
    nonce,
    authorizer,
    payer: from,
    payee: to,
    value,
    authLogIndex: auth.index,
    transferLogIndex: paired.index,
    blockNumber: Number(receiptBlock),
    confirmations,
    chain: EXPECTED_CHAIN_ID_HEX,
    // Where payer, payee and amount came from: "grant" (read off the envelope
    // whose hash the nonce binds; the amount checked against its band) or
    // "typed" (asserted as given).
    terms,
    rpcHosts: rpcUrls.map(host),
    unpinnedHosts,
    // A verdict resting on operators the user chose is a DIFFERENT verdict:
    // it prints a different first line and exits 2, so a consumer that greps
    // "PROVEN" or tests for exit 0 cannot mistake it for a transferable proof.
    unpinned: unpinnedHosts.length > 0,
    // What the confirmation count is actually corroborated by. The printed
    // verdict used to imply the whole quorum stood behind it; only the receipt
    // did.
    headOperators: heads.length,
    headFrom: host(lowest.url),
  };
}

// ── CLI ─────────────────────────────────────────────────────────────────────

const USAGE =
  "usage: node scripts/verify-settlement.mjs \\\n" +
  "  --tx 0x<64-hex> --grant ./keep.grant.json \\\n" +
  "  [--rpc https://mainnet.base.org --rpc https://base.drpc.org] \\\n" +
  "  [--allow-unpinned-rpc]\n" +
  "or, with the terms typed instead of read off the grant:\n" +
  "  --tx 0x<64-hex> --grant-hash <64-hex> \\\n" +
  "  --payer 0x<40-hex> --payee 0x<40-hex> --amount <atomic-usdc> ...\n" +
  `\nAt least ${MIN_OPERATORS} distinct HTTPS Base operators are required.` +
  `\nAllowlisted hosts: ${ALLOWED_BASE_RPC_HOSTS.join(", ")}`;

/**
 * Is this file the program? Node realpaths the main module, so comparing
 * `pathToFileURL(argv[1])` to `import.meta.url` was false through any symlink
 * in the invocation path — and a symlinked skill directory is the common
 * install shape. Through such a link the CLI did nothing and exited 0.
 */
export const invokedAsMain = (argv1, metaUrl) => {
  try {
    return typeof argv1 === "string" && realpathSync(argv1) === realpathSync(fileURLToPath(metaUrl));
  } catch {
    return false;
  }
};
const isMain = invokedAsMain(process.argv[1], import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error(USAGE);
    process.exit(1);
  }
  // --allow-unpinned-rpc takes no value; every other flag does. Unknown flags
  // refuse (a typo like --grant_hash silently became an ignored flag plus a
  // swallowed value), and a scalar flag given twice refuses rather than
  // last-one-wins deciding a money question. Only --rpc repeats.
  const VALUELESS = new Set(["allow-unpinned-rpc"]);
  const KNOWN = new Set(["tx", "grant", "grant-hash", "payer", "payee", "amount", "rpc", "allow-unpinned-rpc"]);
  const flags = { rpc: [] };
  for (let i = 0; i < args.length; i += 1) {
    const raw = args[i] ?? "";
    // Neither refusal echoes the value: a stray URL (a forgotten second
    // `--rpc`) or the `--rpc=URL` form carries the API-key path this file
    // withholds everywhere else.
    if (!raw.startsWith("--")) {
      const shown = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? `a URL for ${host(raw)}` : `a ${raw.length}-character value`;
      console.error(`REFUSED  unknown_argument — ${shown} is not a flag (value withheld)\n${USAGE}`);
      process.exit(1);
    }
    const k = raw.replace(/^--/, "");
    // A flag NAME is echoed only when it is shaped like one; anything else is
    // described by length — `--rpchttps://…/v2/KEY` is a name, technically.
    const shownName = (name) => (/^[a-z][a-z0-9_-]{0,30}$/.test(name) ? `--${name}` : `(flag name withheld, ${name.length} chars)`);
    if (k.includes("=")) {
      console.error(`REFUSED  flag_form_unsupported — ${shownName(k.split("=")[0])}=… is not read; write the flag and its value separated by a space (value withheld)\n${USAGE}`);
      process.exit(1);
    }
    if (!KNOWN.has(k)) {
      console.error(`REFUSED  unknown_flag — ${shownName(k)}\n${USAGE}`);
      process.exit(1);
    }
    if (VALUELESS.has(k)) {
      flags[k] = true;
      continue;
    }
    const v = args[i + 1];
    i += 1;
    // A valued flag with nothing usable after it is a usage error — `--grant`
    // as the last argument used to select TYPED mode and print "no --grant
    // was given" on a run invoked with --grant.
    if (!usableArgValue(v)) {
      console.error(`REFUSED  flag_value_missing — --${k} was given with no usable value after it (missing, empty, or another flag)\n${USAGE}`);
      process.exit(1);
    }
    if (k === "rpc") {
      flags.rpc.push(v);
      continue;
    }
    if (k in flags) {
      console.error(`REFUSED  duplicate_flag — --${k} was given twice; which value binds is not guessable`);
      process.exit(1);
    }
    flags[k] = v;
  }
  let grant;
  if (flags.grant !== undefined) {
    // The file is read here and nowhere else; the path itself is never echoed
    // past this line, and its contents are treated as an envelope to check,
    // not as text to trust.
    // A regular file of plausible size, or a refusal: a FIFO hung the read
    // forever and /dev/zero was read until memory ran out.
    let st;
    try {
      st = statSync(flags.grant);
    } catch (e) {
      console.error(`REFUSED  grant_unreadable — --grant could not be read (${e.code ?? "error"}); path withheld`);
      process.exit(1);
    }
    if (!st.isFile()) {
      console.error(`REFUSED  grant_unreadable — --grant is not a regular file`);
      process.exit(1);
    }
    if (st.size > MAX_GRANT_FILE_BYTES) {
      console.error(`REFUSED  grant_unreadable — --grant is ${st.size} bytes; a task-grant envelope is under ${MAX_GRANT_FILE_BYTES}`);
      process.exit(1);
    }
    let raw;
    try {
      raw = readFileSync(flags.grant, "utf8");
    } catch (e) {
      console.error(`REFUSED  grant_unreadable — --grant could not be read (${e.code ?? "error"}); path withheld`);
      process.exit(1);
    }
    try {
      grant = JSON.parse(raw);
    } catch {
      console.error(`REFUSED  grant_unreadable — --grant is not JSON`);
      process.exit(1);
    }
  }
  const verdict = await verifySettlement({
    tx: flags.tx ?? "",
    grant,
    // With --grant these are cross-checks (each must agree with the grant);
    // without it they are the terms.
    grantHash: flags["grant-hash"] ?? (grant ? undefined : ""),
    payer: flags.payer ?? (grant ? undefined : ""),
    payee: flags.payee ?? (grant ? undefined : ""),
    amount: flags.amount,
    rpcUrls: flags.rpc.length ? flags.rpc : DEFAULT_RPCS,
    allowUnpinnedRpc: flags["allow-unpinned-rpc"] === true,
  });
  if (!verdict.ok) {
    // One bounded line. Every detail is shape-bounded where it is built; this
    // is the backstop so no future interpolation can make a refusal a page.
    const detail = verdict.detail ? String(verdict.detail) : "";
    console.error(`REFUSED  ${verdict.reason}${detail ? ` — ${detail.length > 1024 ? detail.slice(0, 1024) + "…" : detail}` : ""}`);
    process.exit(1);
  }
  console.log(renderVerdict(verdict).join("\n"));
  process.exit(verdict.unpinned ? 2 : 0);
}

/** Exit code for a verdict: 0 PROVEN, 1 REFUSED, 2 PROVEN-UNPINNED. */
export const exitCodeFor = (verdict) => (!verdict.ok ? 1 : verdict.unpinned ? 2 : 0);

/**
 * The PROVEN block, as lines. Exported so the prose guard can compare the
 * captured block in SKILL.md against what this file actually prints — the
 * guard failed its own name twice by pinning substrings instead.
 * A quorum of fewer than two operators refuses long before a verdict exists,
 * so there is no single-operator branch here on purpose.
 */
export function renderVerdict(verdict) {
  const unpinned = Boolean(verdict.unpinnedHosts?.length);
  return [
    unpinned ? "PROVEN-UNPINNED  (exit 2 — operators you chose, not the reviewed allowlist)" : "PROVEN",
    `  tx:            ${verdict.tx}  (every operator's receipt names this hash)`,
    `  grant_hash:    ${verdict.grantHash}`,
    `  binding nonce: ${verdict.nonce} (recomputed, sha256 over the domain + grant hash)`,
    `  paired logs:   AuthorizationUsed #${verdict.authLogIndex} -> Transfer #${verdict.transferLogIndex} (the next canonical-USDC Transfer after it)`,
    `  transfer:      ${verdict.value} atomic USDC  ${verdict.payer} -> ${verdict.payee}`,
    `  block:         ${verdict.blockNumber}  confirmations: ${verdict.confirmations}` +
      ` (lowest head of ${verdict.headOperators} operators)`,
    `  chain:         ${verdict.chain} (Base mainnet, 8453) — confirmed by every operator, receipt bound to its block hash`,
    `  quorum:        ${verdict.rpcHosts.length}/${verdict.rpcHosts.length} agreed — ${verdict.rpcHosts.join(" + ")}, receipts byte-identical`,
    verdict.terms?.source === "grant"
      ? `  terms:         read off the --grant envelope (its hash recomputed the way the SDK computes it): payer and payee above are THAT grant's, and the amount sits inside its price band ${verdict.terms.band.min}..${verdict.terms.band.max}`
      : "  terms:         as typed on the command line — NOT read off a grant; pass --grant ./keep.grant.json to bind them",
    ...(verdict.unpinnedHosts?.length
      ? [
          `  caution:       ${verdict.unpinnedHosts.join(" + ")} — NOT on the reviewed allowlist (--allow-unpinned-rpc); this proof is only as strong as those operators`,
        ]
      : []),
    ...(verdict.terms?.source === "grant"
      ? [
          "  scope:         payment proven for THIS grant: its nonce was spent by its payer in this tx, moving an amount inside its price band to its payee.",
          "                 Delivery is a separate proof.",
        ]
      : [
          "  scope:         this tx spent the nonce derived from grant_hash and moved exactly that transfer.",
          "                 Whether payer, payee and amount are that grant's TERMS was not checked — no --grant was given.",
          "                 Delivery is a separate proof.",
        ]),
  ];
}
