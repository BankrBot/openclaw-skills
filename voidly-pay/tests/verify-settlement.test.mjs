// Tests for scripts/verify-settlement.mjs — fixture-driven, NO network.
//
// Every test injects a fake `rpc` transport returning recorded-shape JSON-RPC
// results (the field set eth_getTransactionReceipt / eth_blockNumber return on
// Base). Run with:
//
//   node --test tests/
//
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  verifySettlement,
  bindingNonce,
  redactUrls,
  host,
  canonical,
  renderVerdict,
  exitCodeFor,
  MAX_CANONICAL_DEPTH,
  TOPIC_AUTHORIZATION_USED,
  TOPIC_TRANSFER,
  sdkCanonicalize,
  grantHashOf,
  grantTermsOf,
  GRANT_KEYS,
  EXPECTED_PRICE_ASSET,
  operatorKeyOf,
  invokedAsMain,
  httpRpc,
  nestingDepthExceeds,
  MAX_RPC_BODY_BYTES,
} from "../scripts/verify-settlement.mjs";
import { createServer } from "node:http";
import { gzipSync } from "node:zlib";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { envelopeHash } from "@voidly/session";
import { randomBytes } from "node:crypto";
import { CANONICAL_USDC_BASE } from "../scripts/lib/pins.mjs";

const TX = "0x" + "ab".repeat(32);
const OTHER_TX = "0x" + "cd".repeat(32);
const PAYER = "0x" + "11".repeat(20);
const PAYEE_A = "0xb0b3fca940e04f99367f08e665e1c2cb4ebd4912"; // the pinned payee
const PAYEE_B = "0x" + "33".repeat(20);
const GRANT_A = "aa".repeat(32);
const GRANT_B = "bb".repeat(32);
const BLOCK = 0x100n;
const BLOCK_HASH = "0x" + "77".repeat(32);
// Every canonical-USDC log must name its transaction and its block — the
// verifier requires all three, as Base operators always send them.
const IN_BLOCK = { transactionHash: TX, blockHash: BLOCK_HASH, blockNumber: "0x" + BLOCK.toString(16) };

const pad = (a) => "0x" + a.slice(2).padStart(64, "0");
const val = (v) => "0x" + BigInt(v).toString(16).padStart(64, "0");

const authLog = (nonce, index, { token = CANONICAL_USDC_BASE, from = PAYER } = {}) => ({
  ...IN_BLOCK,
  address: token,
  topics: [TOPIC_AUTHORIZATION_USED, pad(from), nonce],
  data: "0x",
  logIndex: "0x" + index.toString(16),
});

const transferLog = (from, to, value, index, { token = CANONICAL_USDC_BASE } = {}) => ({
  ...IN_BLOCK,
  address: token,
  topics: [TOPIC_TRANSFER, pad(from), pad(to)],
  data: val(value),
  logIndex: "0x" + index.toString(16),
});

const receiptOf = (logs, { transactionHash = TX, status = "0x1", blockHash = BLOCK_HASH } = {}) => ({
  transactionHash,
  blockNumber: "0x" + BLOCK.toString(16),
  blockHash,
  status,
  logs,
});

// `_url` used to be discarded here, so every operator in every test returned
// the same head — which is exactly why 71 tests were green while one dishonest
// endpoint could decide finality by itself. `heads` lets a test disagree.
const rpcServing = (
  receipt,
  { head = BLOCK + 100n, heads = null, asked = null, chainIds = null, blocks = null } = {},
) =>
  async (url, method) => {
    if (asked) (asked[url] ??= []).push(method);
    if (method === "eth_chainId") {
      const c = chainIds && url in chainIds ? chainIds[url] : "0x2105";
      if (c instanceof Error) throw c;
      return c;
    }
    if (method === "eth_getBlockByNumber") {
      const b = blocks && url in blocks ? blocks[url] : { number: receipt?.blockNumber ?? null, hash: receipt?.blockHash ?? null };
      if (b instanceof Error) throw b;
      return b;
    }
    if (method === "eth_getTransactionReceipt") return receipt;
    if (method === "eth_blockNumber") {
      const h = heads && url in heads ? heads[url] : head;
      // An Error value lets a test model the operator that answers the receipt
      // and then fails the SECOND call — the shape that reopened the defect.
      if (h instanceof Error) throw h;
      return "0x" + h.toString(16);
    }
    throw new Error(`unexpected method ${method}`);
  };

const RPCS = ["https://mainnet.base.org", "https://base.drpc.org"];
const run = (receipt, args, opts) =>
  verifySettlement({ tx: TX, rpcUrls: RPCS, rpc: rpcServing(receipt, opts), ...args });

// ── The honest single-settlement receipt ────────────────────────────────────

const HONEST = receiptOf([
  authLog(bindingNonce(GRANT_A), 0),
  transferLog(PAYER, PAYEE_A, 50000, 1),
]);

test("an honest settlement proves, and reports the pair it used", async () => {
  const v = await run(HONEST, {
    grantHash: GRANT_A,
    payer: PAYER,
    payee: PAYEE_A,
    amount: "50000",
  });
  assert.equal(v.ok, true);
  assert.equal(v.authLogIndex, 0);
  assert.equal(v.transferLogIndex, 1);
  assert.equal(v.value, "50000");
});

// ═══════════════════════════════════════════════════════════════════════════
// FINDING A — the batched transaction. Hire A's transfer used to satisfy the
// amount while hire B's nonce satisfied the binding.
// ═══════════════════════════════════════════════════════════════════════════
//
// Real USDC emits AuthorizationUsed immediately before the Transfer of the
// SAME call, so a two-hire batch interleaves: auth_A, transfer_A, auth_B,
// transfer_B. Hire A really moved 5,000,000. Hire B really moved 1.

const BATCHED = receiptOf([
  authLog(bindingNonce(GRANT_A), 0),
  transferLog(PAYER, PAYEE_A, 5000000, 1),
  authLog(bindingNonce(GRANT_B), 2),
  transferLog(PAYER, PAYEE_B, 1, 3),
]);

test("A: the OLD algorithm proved 5,000,000 for the hire that moved 1", () => {
  // Verbatim reconstruction of the shipped logic this fix replaces:
  //   const auth  = usdcLogs.find(l => l.topics[0]===AUTH && l.topics[2]===nonce)
  //   const paired = transfers.find(l => l.topics[1]===pad(payer))
  // It pairs nothing: the nonce comes from one hire, the value from another.
  const usdcLogs = BATCHED.logs.filter((l) => l.address === CANONICAL_USDC_BASE);
  const nonce = bindingNonce(GRANT_B);
  const auth = usdcLogs.find((l) => l.topics[0] === TOPIC_AUTHORIZATION_USED && l.topics[2] === nonce);
  const transfers = usdcLogs.filter((l) => l.topics[0] === TOPIC_TRANSFER);
  const paired = transfers.find((l) => l.topics[1] === pad(PAYER));

  assert.equal(auth.logIndex, "0x2", "the nonce resolves to hire B's authorization");
  assert.equal(paired.logIndex, "0x1", "…but find() returns hire A's transfer");
  assert.equal(BigInt(paired.data).toString(), "5000000");
  // Hire B moved 1 atomic unit. The old code would have called it 5,000,000.
});

test("A: the paired Transfer is the next canonical-USDC Transfer by log index", async () => {
  const v = await run(BATCHED, {
    grantHash: GRANT_B,
    payer: PAYER,
    payee: PAYEE_B,
    amount: "1",
  });
  assert.equal(v.ok, true);
  assert.equal(v.authLogIndex, 2, "hire B's authorization");
  assert.equal(v.transferLogIndex, 3, "hire B's transfer, not hire A's at index 1");
  assert.equal(v.value, "1");
});

test("A: claiming hire A's amount for hire B now refuses", async () => {
  const v = await run(BATCHED, {
    grantHash: GRANT_B,
    payer: PAYER,
    payee: PAYEE_B,
    amount: "5000000",
  });
  assert.equal(v.ok, false);
  assert.equal(v.reason, "exact_value");
  assert.match(v.detail, /moved 1, expected exactly 5000000/);
});

test("A: claiming hire A's payee for hire B now refuses", async () => {
  const v = await run(BATCHED, {
    grantHash: GRANT_B,
    payer: PAYER,
    payee: PAYEE_A,
    amount: "5000000",
  });
  assert.equal(v.ok, false);
  assert.equal(v.reason, "transfer_recipient_mismatch");
});

test("A: two payer -> payee Transfers refuse rather than a first match winning", async () => {
  const twice = receiptOf([
    authLog(bindingNonce(GRANT_A), 0),
    transferLog(PAYER, PAYEE_A, 5000000, 1),
    authLog(bindingNonce(GRANT_B), 2),
    transferLog(PAYER, PAYEE_A, 5000000, 3),
  ]);
  const v = await verifySettlement({
    tx: TX,
    grantHash: GRANT_A,
    payer: PAYER,
    payee: PAYEE_A,
    amount: "5000000",
    rpcUrls: RPCS,
    rpc: rpcServing(twice),
  });
  assert.equal(v.ok, false);
  assert.equal(v.reason, "transfer_ambiguous");
});

test("A: two AuthorizationUsed carrying the same nonce refuse as ambiguous", async () => {
  const dup = receiptOf([
    authLog(bindingNonce(GRANT_A), 0),
    authLog(bindingNonce(GRANT_A), 1),
    transferLog(PAYER, PAYEE_A, 50000, 2),
  ]);
  const v = await verifySettlement({
    tx: TX,
    grantHash: GRANT_A,
    payer: PAYER,
    payee: PAYEE_A,
    amount: "50000",
    rpcUrls: RPCS,
    rpc: rpcServing(dup),
  });
  assert.equal(v.ok, false);
  assert.equal(v.reason, "authorization_ambiguous");
});

test("A: a Transfer BEFORE the authorization is not the paired one", async () => {
  const before = receiptOf([
    transferLog(PAYER, PAYEE_A, 50000, 0),
    authLog(bindingNonce(GRANT_A), 1),
  ]);
  const v = await verifySettlement({
    tx: TX,
    grantHash: GRANT_A,
    payer: PAYER,
    payee: PAYEE_A,
    amount: "50000",
    rpcUrls: RPCS,
    rpc: rpcServing(before),
  });
  assert.equal(v.ok, false);
  assert.equal(v.reason, "paired_transfer_missing");
});

test("A: a canonical-USDC log with no readable logIndex refuses, never falls back to array order", async () => {
  const noIndex = receiptOf([
    authLog(bindingNonce(GRANT_A), 0),
    { ...transferLog(PAYER, PAYEE_A, 50000, 1), logIndex: undefined },
  ]);
  const v = await verifySettlement({
    tx: TX,
    grantHash: GRANT_A,
    payer: PAYER,
    payee: PAYEE_A,
    amount: "50000",
    rpcUrls: RPCS,
    rpc: rpcServing(noIndex),
  });
  assert.equal(v.ok, false);
  assert.equal(v.reason, "log_index_unreadable");
});

test("A: a look-alike token's events are invisible to the proof", async () => {
  const fake = "0x" + "de".repeat(20);
  const spoof = receiptOf([
    authLog(bindingNonce(GRANT_A), 0, { token: fake }),
    transferLog(PAYER, PAYEE_A, 50000, 1, { token: fake }),
  ]);
  const v = await verifySettlement({
    tx: TX,
    grantHash: GRANT_A,
    payer: PAYER,
    payee: PAYEE_A,
    amount: "50000",
    rpcUrls: RPCS,
    rpc: rpcServing(spoof),
  });
  assert.equal(v.ok, false);
  assert.equal(v.reason, "nonce_not_spent_by_this_tx");
});

// ═══════════════════════════════════════════════════════════════════════════
// FINDING B — no script ever read receipt.transactionHash.
// ═══════════════════════════════════════════════════════════════════════════

test("B: a valid-but-unrelated receipt refuses instead of proving", async () => {
  // Every other check on this receipt passes. Only its own transactionHash
  // says it is not about --tx.
  const unrelated = receiptOf(
    [authLog(bindingNonce(GRANT_A), 0), transferLog(PAYER, PAYEE_A, 50000, 1)],
    { transactionHash: OTHER_TX },
  );
  const v = await verifySettlement({
    tx: TX,
    grantHash: GRANT_A,
    payer: PAYER,
    payee: PAYEE_A,
    amount: "50000",
    rpcUrls: RPCS,
    rpc: rpcServing(unrelated),
  });
  assert.equal(v.ok, false);
  assert.equal(v.reason, "receipt_not_for_this_tx");
  assert.match(v.detail, /asked for .*, got the receipt for/);
});

test("B: a receipt with no transactionHash cannot identify itself, so it refuses", async () => {
  const anon = receiptOf([authLog(bindingNonce(GRANT_A), 0), transferLog(PAYER, PAYEE_A, 50000, 1)]);
  delete anon.transactionHash;
  const v = await verifySettlement({
    tx: TX,
    grantHash: GRANT_A,
    payer: PAYER,
    payee: PAYEE_A,
    amount: "50000",
    rpcUrls: RPCS,
    rpc: rpcServing(anon),
  });
  assert.equal(v.ok, false);
  assert.equal(v.reason, "receipt_not_for_this_tx");
  assert.match(v.detail, /cannot identify itself/);
});

test("B: the identity check runs before any log is read", async () => {
  // A receipt for another transaction whose logs are pure junk. If identity
  // were checked after the logs, this would refuse with a log-shaped reason.
  const junk = receiptOf([{ address: CANONICAL_USDC_BASE, topics: [], data: "0x" }], {
    transactionHash: OTHER_TX,
  });
  const v = await verifySettlement({
    tx: TX,
    grantHash: GRANT_A,
    payer: PAYER,
    payee: PAYEE_A,
    amount: "50000",
    rpcUrls: RPCS,
    rpc: rpcServing(junk),
  });
  assert.equal(v.reason, "receipt_not_for_this_tx");
});

test("B: identity is checked on EVERY operator's receipt, not just the first", async () => {
  const good = receiptOf([authLog(bindingNonce(GRANT_A), 0), transferLog(PAYER, PAYEE_A, 50000, 1)]);
  const bad = receiptOf([authLog(bindingNonce(GRANT_A), 0), transferLog(PAYER, PAYEE_A, 50000, 1)], {
    transactionHash: OTHER_TX,
  });
  const v = await verifySettlement({
    tx: TX,
    grantHash: GRANT_A,
    payer: PAYER,
    payee: PAYEE_A,
    amount: "50000",
    rpcUrls: RPCS,
    rpc: async (url, method) => {
      if (method === "eth_chainId") return "0x2105";
      if (method === "eth_blockNumber") return "0x" + (BLOCK + 100n).toString(16);
      return url === RPCS[0] ? good : bad;
    },
  });
  assert.equal(v.ok, false);
  assert.equal(v.reason, "receipt_not_for_this_tx");
  assert.match(v.detail, /base\.drpc\.org/);
});

test("B: case differences in the receipt's own hash are not a mismatch", async () => {
  const upper = receiptOf(
    [authLog(bindingNonce(GRANT_A), 0), transferLog(PAYER, PAYEE_A, 50000, 1)],
    { transactionHash: "0x" + "AB".repeat(32) },
  );
  const v = await verifySettlement({
    tx: TX,
    grantHash: GRANT_A,
    payer: PAYER,
    payee: PAYEE_A,
    amount: "50000",
    rpcUrls: RPCS,
    rpc: rpcServing(upper),
  });
  assert.equal(v.ok, true);
});

// ── The checks that were already right stay right ───────────────────────────

test("quorum divergence refuses rather than voting", async () => {
  const a = receiptOf([authLog(bindingNonce(GRANT_A), 0), transferLog(PAYER, PAYEE_A, 50000, 1)]);
  const b = receiptOf([authLog(bindingNonce(GRANT_A), 0), transferLog(PAYER, PAYEE_A, 49999, 1)]);
  const v = await verifySettlement({
    tx: TX,
    grantHash: GRANT_A,
    payer: PAYER,
    payee: PAYEE_A,
    amount: "50000",
    rpcUrls: RPCS,
    rpc: async (url, method) => {
      if (method === "eth_chainId") return "0x2105";
      if (method === "eth_blockNumber") return "0x" + (BLOCK + 100n).toString(16);
      return url === RPCS[0] ? a : b;
    },
  });
  assert.equal(v.ok, false);
  assert.equal(v.reason, "rpc_divergence");
});

test("an unanswered operator is a divergent operator", async () => {
  const v = await verifySettlement({
    tx: TX,
    grantHash: GRANT_A,
    payer: PAYER,
    payee: PAYEE_A,
    amount: "50000",
    rpcUrls: RPCS,
    rpc: async (url, method) => {
      if (url === RPCS[1]) throw new Error("timeout");
      if (method === "eth_chainId") return "0x2105";
      if (method === "eth_getBlockByNumber") return { hash: HONEST.blockHash };
      return HONEST;
    },
  });
  assert.equal(v.reason, "rpc_unanswered");
});

test("a reverted transaction proves nothing", async () => {
  const reverted = receiptOf(
    [authLog(bindingNonce(GRANT_A), 0), transferLog(PAYER, PAYEE_A, 50000, 1)],
    { status: "0x0" },
  );
  const v = await verifySettlement({
    tx: TX,
    grantHash: GRANT_A,
    payer: PAYER,
    payee: PAYEE_A,
    amount: "50000",
    rpcUrls: RPCS,
    rpc: rpcServing(reverted),
  });
  assert.equal(v.reason, "tx_reverted");
});

test("shallow confirmations refuse", async () => {
  const v = await verifySettlement({
    tx: TX,
    grantHash: GRANT_A,
    payer: PAYER,
    payee: PAYEE_A,
    amount: "50000",
    rpcUrls: RPCS,
    rpc: rpcServing(HONEST, { head: BLOCK + 3n }),
  });
  assert.equal(v.reason, "insufficient_confirmations");
});

test("a different grant hash does not resolve to this transaction's nonce", async () => {
  const v = await run(HONEST, {
    grantHash: GRANT_B,
    payer: PAYER,
    payee: PAYEE_A,
    amount: "50000",
  });
  assert.equal(v.reason, "nonce_not_spent_by_this_tx");
});

test("the binding nonce is a pure function of the grant hash", () => {
  assert.equal(
    bindingNonce("5e63f8c4f11b989bac73b4306bb1a7975b91571a586989127b35f812c31daea6"),
    "0x02467d7f0144886c4d5d66c0395a43158b073a380cd49b727566eafc5c7f8e4d",
  );
  assert.equal(bindingNonce("0x" + GRANT_A), bindingNonce(GRANT_A), "0x prefix is stripped");
});

// ═══════════════════════════════════════════════════════════════════════════
// An --rpc value may carry an API key. A verdict is handed to a counterparty.
// ═══════════════════════════════════════════════════════════════════════════
//
// host() existed for exactly this reason and the refusal beside it interpolated
// the transport's own message, which quotes the whole URL. Two shapes leaked
// the key verbatim on the shipped CLI, with no injection:
//
//   --rpc https://user:KEY@host/    "Request cannot be constructed from a URL
//                                    that includes credentials: <url>"
//   --rpc host/v2/KEY               "Failed to parse URL from <url>"
//
// Ordinary network and HTTP failures never carried it, so the property looked
// held. Nothing pinned it.

test("redactUrls: the transport's own quoted URL never survives", () => {
  const SECRET = "SUPERSECRETAPIKEY123";
  const cases = [
    [`https://user:${SECRET}@rpc.example.com/`,
     `Request cannot be constructed from a URL that includes credentials: https://user:${SECRET}@rpc.example.com/`],
    [`base-mainnet.g.alchemy.com/v2/${SECRET}`,
     `Failed to parse URL from base-mainnet.g.alchemy.com/v2/${SECRET}`],
    [`https://rpc.example.com/v2/${SECRET}`,
     `connect ECONNREFUSED for https://rpc.example.com/v2/${SECRET}`],
  ];
  for (const [url, message] of cases) {
    const out = redactUrls(message, url);
    assert.ok(!out.includes(SECRET), `the key survived redaction of ${url}: ${out}`);
  }
});

test("redactUrls: a URL-shaped remnant is reduced even when it is not the value we sent", () => {
  // A redirect target or a normalized form can differ from the string we
  // handed the transport, so the literal replacement cannot be the only arm.
  const out = redactUrls(
    "redirected to https://other.example.com/v2/LEAKED_KEY_9f2a",
    "https://rpc.example.com/",
  );
  assert.ok(!out.includes("LEAKED_KEY_9f2a"), out);
  assert.match(out, /other\.example\.com/);
});

test("redactUrls: a degenerate --rpc value does not mangle the failure reason", () => {
  // `--rpc a` made the literal-replacement arm a find-and-replace over ordinary
  // words. The reason a verification failed is the point of the line.
  assert.equal(
    redactUrls("connect ECONNREFUSED at a place a request failed", "a"),
    "connect ECONNREFUSED at a place a request failed",
  );
  assert.equal(redactUrls("Failed to parse URL from e", "e"), "Failed to parse URL from e");
  // and a scheme-only value must not splice an empty host into the sentence
  assert.doesNotMatch(redactUrls("Failed to parse URL from http://", "http://"), /from\s*$/);
});

test("redactUrls: an ordinary message is left alone", () => {
  // Over-redaction would hide the reason a verification failed, which is its
  // own kind of dishonest output.
  const msg = "http 429";
  assert.equal(redactUrls(msg, "https://rpc.example.com/"), msg);
  assert.equal(host("https://user:pw@rpc.example.com:8443/x"), "rpc.example.com:8443");
});

// ═══════════════════════════════════════════════════════════════════════════
// Finality was decided by ONE endpoint while the receipt was under quorum.
// ═══════════════════════════════════════════════════════════════════════════

const HIRE = { grantHash: GRANT_A, payer: PAYER, payee: PAYEE_A, amount: "50000" };

test("a dishonest first operator cannot inflate the confirmation count", async () => {
  // Both operators serve the byte-identical honest receipt. Only the first lies
  // about the head. Before the fix this returned ok with confirmations 250000
  // for a transaction one block old, and the honest peer was never asked.
  const asked = {};
  const v = await run(HONEST, HIRE, {
    heads: { [RPCS[0]]: BLOCK + 250_000n, [RPCS[1]]: BLOCK + 1n },
    asked,
  });
  assert.equal(v.ok, false, `expected a refusal, got ${JSON.stringify(v)}`);
  assert.equal(v.reason, "rpc_head_divergence");
  for (const url of RPCS) {
    assert.ok((asked[url] ?? []).includes("eth_blockNumber"), `${url} was never asked for the head`);
  }
});

test("the verdict does not depend on the order the --rpc flags were typed", async () => {
  const heads = { [RPCS[0]]: BLOCK + 250_000n, [RPCS[1]]: BLOCK + 1n };
  const forward = await verifySettlement({
    tx: TX, rpcUrls: RPCS, rpc: rpcServing(HONEST, { heads }), ...HIRE,
  });
  const reversed = await verifySettlement({
    tx: TX, rpcUrls: [...RPCS].reverse(), rpc: rpcServing(HONEST, { heads }), ...HIRE,
  });
  assert.equal(forward.ok, reversed.ok, "same evidence, same operators, different flag order");
  assert.equal(forward.reason, reversed.reason);
});

test("an honest lagging operator lowers the count rather than being ignored", async () => {
  const v = await run(HONEST, HIRE, {
    heads: { [RPCS[0]]: BLOCK + 40n, [RPCS[1]]: BLOCK + 20n },
  });
  assert.equal(v.ok, true, JSON.stringify(v));
  assert.equal(v.confirmations, 20, "the LOWEST head decides — the only direction that fails closed");
  assert.equal(v.headOperators, 2);
});

test("one endpoint is never a quorum — it refuses, not a labelled verdict", async () => {
  const v = await verifySettlement({
    tx: TX,
    rpcUrls: ["https://mainnet.base.org", "https://mainnet.base.org"],
    rpc: rpcServing(HONEST),
    ...HIRE,
  });
  assert.equal(v.ok, false, JSON.stringify(v));
  assert.equal(v.reason, "insufficient_rpc_quorum");
  assert.match(v.detail, /1 distinct operator/);
});

test("a receipt with no blockNumber refuses by name instead of throwing", async () => {
  const v = await run({ ...HONEST, blockNumber: null }, HIRE);
  assert.equal(v.ok, false);
  assert.equal(v.reason, "receipt_not_mined");
});

test("an operator that answers the receipt but not the head fails the run", async () => {
  // The first version of the head loop collected this into `headErrors` and
  // carried on with whoever answered — handing the floor to the survivor. A
  // public RPC 429ing on the second of its two calls is the commonest failure
  // there is, so this needed no attacker at all.
  const v = await run(HONEST, HIRE, {
    heads: { [RPCS[0]]: new Error("http 429"), [RPCS[1]]: BLOCK + 250_000n },
  });
  assert.equal(v.ok, false, `expected a refusal, got ${JSON.stringify(v)}`);
  assert.equal(v.reason, "rpc_unanswered");
});

test("one endpoint spelled several ways is one operator, and one operator refuses", async () => {
  for (const pair of [
    ["https://mainnet.base.org", "https://mainnet.base.org/"],
    ["https://mainnet.base.org", "HTTPS://MAINNET.BASE.ORG"],
    ["https://mainnet.base.org", "https://mainnet.base.org:443"],
    ["https://mainnet.base.org", "https://mainnet.base.org/another-path"],
  ]) {
    const v = await verifySettlement({ tx: TX, rpcUrls: pair, rpc: rpcServing(HONEST), ...HIRE });
    assert.equal(v.ok, false, `${pair.join(" vs ")} produced ${JSON.stringify(v)}`);
    assert.equal(v.reason, "insufficient_rpc_quorum", `${pair.join(" vs ")} was counted as two operators`);
  }
});

test("an unreadable blockNumber refuses instead of proving at block 0", async () => {
  for (const bad of ["", "0x", "not-a-number", null, undefined]) {
    const v = await run({ ...HONEST, blockNumber: bad }, HIRE);
    assert.equal(v.ok, false, `blockNumber ${JSON.stringify(bad)} produced ${JSON.stringify(v)}`);
    assert.equal(v.reason, "receipt_not_mined");
  }
});

test("a canonical-USDC log with non-array topics refuses instead of being skipped", async () => {
  // `topics?.[0]` on a string is its first character, so such a log failed every
  // topic comparison and dropped out of the scan. A second payer->payee Transfer
  // shaped that way therefore slipped past transfer_ambiguous: measured before
  // the guard, this returned ok with value "50000".
  for (const shape of [TOPIC_TRANSFER, { 0: TOPIC_TRANSFER }, 7, null]) {
    const receipt = receiptOf([
      authLog(bindingNonce(GRANT_A), 0),
      transferLog(PAYER, PAYEE_A, 50000, 1),
      { ...IN_BLOCK, address: CANONICAL_USDC_BASE, topics: shape, data: val(50000), logIndex: "0x2" },
    ]);
    const v = await run(receipt, HIRE);
    assert.equal(v.ok, false, `topics ${JSON.stringify(shape)} produced ${JSON.stringify(v)}`);
    assert.equal(v.reason, "log_topics_malformed");
  }
});


// ═══════════════════════════════════════════════════════════════════════════
// The reconciled pre-flight and per-operator context checks. These came from
// the review branch (a lone RPC was being called a quorum) and are asserted
// here so the reconciliation cannot silently drop them again: quorum floor,
// transport policy, allowlist, chain context, block binding, head agreement.
// ═══════════════════════════════════════════════════════════════════════════

test("a plaintext http:// operator refuses before any call is made", async () => {
  const asked = {};
  const v = await verifySettlement({
    tx: TX,
    rpcUrls: ["http://mainnet.base.org", "https://base.drpc.org"],
    rpc: rpcServing(HONEST, { asked }),
    ...HIRE,
  });
  assert.equal(v.ok, false);
  assert.equal(v.reason, "rpc_not_https");
  assert.deepEqual(asked, {}, "a refused list must never be dialled");
});

test("an unallowlisted host refuses by name, and names the escape hatch", async () => {
  const asked = {};
  const v = await verifySettlement({
    tx: TX,
    rpcUrls: ["https://evil.example.com", "https://base.drpc.org"],
    rpc: rpcServing(HONEST, { asked }),
    ...HIRE,
  });
  assert.equal(v.ok, false);
  assert.equal(v.reason, "rpc_host_not_allowlisted");
  assert.match(v.detail, /--allow-unpinned-rpc/);
  assert.deepEqual(asked, {}, "a refused list must never be dialled");
});

test("allowUnpinnedRpc lifts the allowlist but NOT https and NOT the quorum floor", async () => {
  const ok = await verifySettlement({
    tx: TX,
    rpcUrls: ["https://a.example", "https://b.example"],
    rpc: rpcServing(HONEST),
    allowUnpinnedRpc: true,
    ...HIRE,
  });
  assert.equal(ok.ok, true, JSON.stringify(ok));

  const http = await verifySettlement({
    tx: TX,
    rpcUrls: ["http://a.example", "https://b.example"],
    rpc: rpcServing(HONEST),
    allowUnpinnedRpc: true,
    ...HIRE,
  });
  assert.equal(http.reason, "rpc_not_https");

  const lone = await verifySettlement({
    tx: TX,
    rpcUrls: ["https://a.example", "https://a.example"],
    rpc: rpcServing(HONEST),
    allowUnpinnedRpc: true,
    ...HIRE,
  });
  assert.equal(lone.reason, "insufficient_rpc_quorum");
});

test("a malformed --rpc value refuses without echoing the value", async () => {
  // `host/v2/SECRETKEY` with no scheme is exactly the malformed shape that
  // carries a credential; the refusal must not become the leak.
  const v = await verifySettlement({
    tx: TX,
    rpcUrls: ["mainnet.base.org/v2/SECRETKEY123", "https://base.drpc.org"],
    rpc: rpcServing(HONEST),
    ...HIRE,
  });
  assert.equal(v.ok, false);
  assert.equal(v.reason, "bad_rpc_url");
  assert.ok(!JSON.stringify(v).includes("SECRETKEY123"), `the refusal echoed the credential: ${v.detail}`);
});

test("an operator on the wrong chain refuses before its receipt is believed", async () => {
  const asked = {};
  const v = await run(HONEST, HIRE, { chainIds: { [RPCS[1]]: "0x1" }, asked });
  assert.equal(v.ok, false);
  assert.equal(v.reason, "wrong_chain");
  assert.match(v.detail, /base\.drpc\.org/);
  for (const calls of Object.values(asked)) {
    assert.ok(!calls.includes("eth_getTransactionReceipt"), "a receipt was fetched before the chain was confirmed");
  }
});

test("an operator that cannot answer eth_chainId fails the run", async () => {
  const v = await run(HONEST, HIRE, { chainIds: { [RPCS[0]]: new Error("http 429") } });
  assert.equal(v.ok, false);
  assert.equal(v.reason, "rpc_unanswered");
  assert.match(v.detail, /eth_chainId/);
});

test("a receipt with no usable blockHash refuses instead of binding nothing to nothing", async () => {
  for (const bad of [undefined, null, "", "0x", "not-hex"]) {
    // spread, not receiptOf(): a destructuring default would silently turn
    // `undefined` back into a valid hash and test nothing
    const v = await run({ ...HONEST, blockHash: bad }, HIRE);
    assert.equal(v.ok, false, `blockHash ${JSON.stringify(bad)} produced ${JSON.stringify(v)}`);
    assert.equal(v.reason, "block_hash_unreadable");
  }
});

test("an operator whose block hash disagrees with the receipt refuses", async () => {
  const v = await run(HONEST, HIRE, {
    blocks: { [RPCS[1]]: { hash: "0x" + "99".repeat(32) } },
  });
  assert.equal(v.ok, false);
  assert.equal(v.reason, "block_hash_mismatch");
  assert.match(v.detail, /base\.drpc\.org/);
});

test("an operator with no block at the receipt's height refuses", async () => {
  const v = await run(HONEST, HIRE, { blocks: { [RPCS[0]]: null } });
  assert.equal(v.ok, false);
  assert.equal(v.reason, "block_not_found");
});

test("an operator that cannot answer eth_getBlockByNumber fails the run", async () => {
  const v = await run(HONEST, HIRE, { blocks: { [RPCS[1]]: new Error("http 429") } });
  assert.equal(v.ok, false);
  assert.equal(v.reason, "rpc_unanswered");
  assert.match(v.detail, /eth_getBlockByNumber/);
});

test("heads further apart than the tolerance refuse as divergence, either direction", async () => {
  for (const heads of [
    { [RPCS[0]]: BLOCK + 100n, [RPCS[1]]: BLOCK + 131n },
    { [RPCS[0]]: BLOCK + 131n, [RPCS[1]]: BLOCK + 100n },
  ]) {
    const v = await run(HONEST, HIRE, { heads });
    assert.equal(v.ok, false, JSON.stringify(v));
    assert.equal(v.reason, "rpc_head_divergence");
  }
});

test("heads exactly at the tolerance still prove", async () => {
  const v = await run(HONEST, HIRE, {
    heads: { [RPCS[0]]: BLOCK + 100n, [RPCS[1]]: BLOCK + 130n },
  });
  assert.equal(v.ok, true, JSON.stringify(v));
  assert.equal(v.confirmations, 100, "the lowest head still decides the count");
});

test("the verdict names the chain and both operators for the printer", async () => {
  const v = await run(HONEST, HIRE);
  assert.equal(v.ok, true, JSON.stringify(v));
  assert.equal(v.chain, "0x2105");
  assert.deepEqual(v.rpcHosts, ["mainnet.base.org", "base.drpc.org"]);
  assert.equal(v.headOperators, 2);
});

test("a canonical-USDC log marked removed refuses — reorged evidence is not evidence", async () => {
  // A boolean true is a reorged log; the STRING "true" is not a value the
  // chain emits and is refused as malformed. Both refuse.
  for (const [removed, reason] of [[true, "log_removed"], ["true", "log_malformed"]]) {
    const receipt = receiptOf([
      authLog(bindingNonce(GRANT_A), 0),
      { ...transferLog(PAYER, PAYEE_A, 50000, 1), removed },
    ]);
    const v = await run(receipt, HIRE);
    assert.equal(v.ok, false, `removed=${JSON.stringify(removed)} produced ${JSON.stringify(v)}`);
    assert.equal(v.reason, reason);
  }
});

test("a log naming another transaction refuses; one naming this transaction is fine", async () => {
  const foreign = receiptOf([
    authLog(bindingNonce(GRANT_A), 0),
    { ...transferLog(PAYER, PAYEE_A, 50000, 1), transactionHash: OTHER_TX },
  ]);
  const v = await run(foreign, HIRE);
  assert.equal(v.ok, false);
  assert.equal(v.reason, "log_not_for_this_tx");

  const own = receiptOf([
    { ...authLog(bindingNonce(GRANT_A), 0), transactionHash: TX },
    { ...transferLog(PAYER, PAYEE_A, 50000, 1), transactionHash: TX.toUpperCase().replace("0X", "0x") },
  ]);
  const ok = await run(own, HIRE);
  assert.equal(ok.ok, true, JSON.stringify(ok));
});

test("a negative blockNumber refuses instead of minting confirmations", async () => {
  const v = await run({ ...HONEST, blockNumber: "-5" }, HIRE);
  assert.equal(v.ok, false, JSON.stringify(v));
  assert.equal(v.reason, "receipt_not_mined");
});

test("a verdict built on unpinned operators names them, and the printer says so", async () => {
  const { renderVerdict } = await import("../scripts/verify-settlement.mjs");
  const v = await verifySettlement({
    tx: TX,
    rpcUrls: ["https://a.example", "https://b.example"],
    rpc: rpcServing(HONEST),
    allowUnpinnedRpc: true,
    ...HIRE,
  });
  assert.equal(v.ok, true, JSON.stringify(v));
  assert.deepEqual(v.unpinnedHosts, ["a.example", "b.example"]);
  const lines = renderVerdict(v);
  const caution = lines.find((l) => l.includes("caution:"));
  assert.ok(caution, "an unpinned-operator verdict must carry a caution line");
  assert.match(caution, /NOT on the reviewed allowlist/);

  const pinned = await run(HONEST, HIRE);
  assert.deepEqual(pinned.unpinnedHosts, []);
  assert.ok(
    !renderVerdict(pinned).some((l) => l.includes("caution:")),
    "an all-allowlisted verdict must not carry the caution line",
  );
});

test("CLI: unknown, duplicated and stray arguments refuse before any network call", async () => {
  const { execFileSync } = await import("node:child_process");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");
  const script = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "verify-settlement.mjs");
  const runCli = (args) => {
    try {
      execFileSync(process.execPath, [script, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      return { code: 0, stderr: "" };
    } catch (e) {
      return { code: e.status, stderr: String(e.stderr) };
    }
  };
  const base = ["--tx", "0x" + "ab".repeat(32), "--grant-hash", "aa".repeat(32), "--payer", "0x" + "11".repeat(20), "--payee", "0x" + "22".repeat(20), "--amount", "1"];

  const unknown = runCli([...base, "--grant_hash", "beef"]);
  assert.equal(unknown.code, 1);
  assert.match(unknown.stderr, /REFUSED {2}unknown_flag — --grant_hash/);

  const dup = runCli([...base, "--amount", "2"]);
  assert.equal(dup.code, 1);
  assert.match(dup.stderr, /REFUSED {2}duplicate_flag — --amount/);

  const stray = runCli([...base, "stray-value"]);
  assert.equal(stray.code, 1);
  assert.match(stray.stderr, /REFUSED {2}unknown_argument/);
});

// ═══════════════════════════════════════════════════════════════════════════
// Type strictness, depth, and the exception boundary. Recovered from the
// attack scripts the cut-off audit left behind: a 200k-deep JSON body threw an
// UNCAUGHT RangeError, `["0x2105"]` passed as a chain id, and an object whose
// toString throws escaped as an uncaught "boom".
// ═══════════════════════════════════════════════════════════════════════════

const HIRE_A = { grantHash: GRANT_A, payer: PAYER, payee: PAYEE_A, amount: "50000" };

test("a hostile operator's deeply nested receipt refuses by name instead of blowing the stack", async () => {
  let deep = 0;
  for (let i = 0; i < 200000; i += 1) deep = [deep];
  const receipt = { ...HONEST, extra: deep };
  const v = await run(receipt, HIRE_A);
  assert.equal(v.ok, false);
  assert.equal(v.reason, "receipt_unparseable");
  assert.throws(() => canonical(deep), /nested deeper than/);
  let shallow = 0;
  for (let i = 0; i < MAX_CANONICAL_DEPTH; i += 1) shallow = [shallow];
  assert.doesNotThrow(() => canonical(shallow));
});

test("a chain id that is not a hex string refuses wrong_chain, whatever it coerces to", async () => {
  for (const bad of [["0x2105"], { toString: () => "0x2105" }, 8453, null, "", "0x", "2105", "0X2105\n"]) {
    const v = await run(HONEST, HIRE_A, { chainIds: { [RPCS[1]]: bad } });
    assert.equal(v.ok, false, `chainId ${JSON.stringify(bad)} produced ${JSON.stringify(v)}`);
    assert.equal(v.reason, "wrong_chain");
  }
  // upper-case hex is still a string of the right shape
  const upper = await run(HONEST, HIRE_A, { chainIds: { [RPCS[1]]: "0X2105" } });
  assert.equal(upper.ok, true, JSON.stringify(upper));
});

test("an operator whose answer throws on inspection is a named refusal, not a crash", async () => {
  const bomb = { get toString() { throw new Error("boom"); }, valueOf() { throw new Error("boom"); } };
  const v = await verifySettlement({
    tx: TX, rpcUrls: RPCS, ...HIRE_A,
    rpc: async (url, method) => {
      if (method === "eth_chainId") return url === RPCS[0] ? "0x2105" : Object.create(bomb);
      return rpcServing(HONEST)(url, method);
    },
  });
  assert.equal(v.ok, false);
  assert.ok(["wrong_chain", "verifier_exception"].includes(v.reason), v.reason);
});

test("the exception boundary names the failure and redacts operator URLs", async () => {
  const SECRET = "SUPERSECRET_KEY_777";
  const urls = [`https://mainnet.base.org/v2/${SECRET}`, "https://base.drpc.org"];
  const v = await verifySettlement({
    tx: TX, rpcUrls: urls, ...HIRE_A,
    rpc: async () => { throw Object.assign(new Error(`exploded at https://mainnet.base.org/v2/${SECRET}`), { name: "Custom" }); },
  });
  assert.equal(v.ok, false);
  // rpc_unanswered is the named path; the boundary is for what the named paths miss
  assert.ok(!JSON.stringify(v).includes(SECRET), JSON.stringify(v));
  // A message that only surfaces while the refusal is being FORMATTED reaches
  // the boundary, and the boundary cannot know what is secret in it — so it
  // withholds the message entirely and names only the error class.
  const w = await verifySettlement({
    tx: TX, rpcUrls: urls, ...HIRE_A,
    rpc: async () => { throw { message: { toString() { throw new Error(`deep ${SECRET}`); } } }; },
  });
  assert.equal(w.ok, false);
  assert.equal(w.reason, "verifier_exception");
  assert.ok(!JSON.stringify(w).includes(SECRET), JSON.stringify(w));
  assert.match(w.detail, /withheld/);
});

test("a head that is not a hex quantity refuses rpc_head_unreadable, not a fabricated count", async () => {
  for (const bad of [true, [], {}, null, 256, "256", "0x", "0X100 "]) {
    const v = await verifySettlement({
      tx: TX, rpcUrls: RPCS, ...HIRE_A,
      rpc: async (url, method, params) => {
        if (method === "eth_blockNumber" && url === RPCS[1]) return bad;
        return rpcServing(HONEST)(url, method, params);
      },
    });
    assert.equal(v.ok, false, `head ${JSON.stringify(bad)} produced ${JSON.stringify(v)}`);
    assert.equal(v.reason, "rpc_head_unreadable");
  }
});

test("a receipt whose logs are not an array refuses by that name", async () => {
  for (const bad of [null, "logs", {}, 7]) {
    const v = await run({ ...HONEST, logs: bad }, HIRE_A);
    assert.equal(v.reason, "receipt_logs_malformed", JSON.stringify(bad));
  }
  const v = await run({ ...HONEST, logs: [authLog(bindingNonce(GRANT_A), 0), "not a log"] }, HIRE_A);
  assert.equal(v.reason, "log_malformed");
});

test("a receipt that is a string, array or number cannot identify itself", async () => {
  for (const bad of ["receipt", [], 7, true]) {
    const v = await run(bad, HIRE_A);
    assert.equal(v.reason, "receipt_not_for_this_tx", JSON.stringify(bad));
  }
});

test("a status that is not the string 0x1 is a revert", async () => {
  for (const bad of [1, true, ["0x1"], null]) {
    const v = await run({ ...HONEST, status: bad }, HIRE_A);
    assert.equal(v.reason, "tx_reverted", JSON.stringify(bad));
  }
});

test("every canonical-USDC log must name THIS transaction and THIS block", async () => {
  const withLog = (over) => receiptOf([authLog(bindingNonce(GRANT_A), 0), { ...transferLog(PAYER, PAYEE_A, 50000, 1), ...over }]);
  assert.equal((await run(withLog({ transactionHash: OTHER_TX }), HIRE_A)).reason, "log_not_for_this_tx");
  assert.equal((await run(withLog({ transactionHash: undefined }), HIRE_A)).reason, "log_not_for_this_tx");
  assert.equal((await run(withLog({ blockHash: "0x" + "88".repeat(32) }), HIRE_A)).reason, "log_not_in_this_block");
  assert.equal((await run(withLog({ blockHash: undefined }), HIRE_A)).reason, "log_not_in_this_block");
  assert.equal((await run(withLog({ blockNumber: "0x101" }), HIRE_A)).reason, "log_not_in_this_block");
  assert.equal((await run(withLog({ blockNumber: undefined }), HIRE_A)).reason, "log_not_in_this_block");
  // a log of some OTHER contract is not held to this — it is not read at all
  const other = receiptOf([
    authLog(bindingNonce(GRANT_A), 0),
    transferLog(PAYER, PAYEE_A, 50000, 1),
    { address: "0x" + "99".repeat(20), topics: "junk", data: 5, logIndex: 1 },
  ]);
  assert.equal((await run(other, HIRE_A)).ok, true);
});

test("topics must be exactly three 32-byte words on every canonical-USDC log", async () => {
  const withTopics = (topics) => receiptOf([authLog(bindingNonce(GRANT_A), 0), { ...transferLog(PAYER, PAYEE_A, 50000, 1), topics }]);
  for (const bad of [
    [TOPIC_TRANSFER, pad(PAYER)],
    [TOPIC_TRANSFER, pad(PAYER), pad(PAYEE_A), pad(PAYEE_A)],
    [TOPIC_TRANSFER, pad(PAYER), "0x1234"],
    [TOPIC_TRANSFER, pad(PAYER), 42],
    [],
  ]) {
    const v = await run(withTopics(bad), HIRE_A);
    assert.equal(v.ok, false, JSON.stringify(bad));
    assert.equal(v.reason, "log_topics_malformed", JSON.stringify(bad));
  }
});

test("a Transfer's data must be one 32-byte word", async () => {
  const withData = (data) => receiptOf([authLog(bindingNonce(GRANT_A), 0), { ...transferLog(PAYER, PAYEE_A, 50000, 1), data }]);
  assert.equal((await run(withData("0x"), HIRE_A)).reason, "transfer_value_unreadable");
  assert.equal((await run(withData("0xc350"), HIRE_A)).reason, "transfer_value_unreadable");
  assert.equal((await run(withData(val(50000) + "00"), HIRE_A)).reason, "transfer_value_unreadable");
  assert.equal((await run(withData("0xzz"), HIRE_A)).reason, "log_data_malformed");
  assert.equal((await run(withData(50000), HIRE_A)).reason, "log_data_malformed");
});

test("a logIndex must be a hex quantity string within 32 bits", async () => {
  const withIndex = (logIndex) => receiptOf([authLog(bindingNonce(GRANT_A), 0), { ...transferLog(PAYER, PAYEE_A, 50000, 1), logIndex }]);
  for (const bad of [1, "1", "0x" + "f".repeat(64), "0x01", null]) {
    const v = await run(withIndex(bad), HIRE_A);
    assert.equal(v.reason, "log_index_unreadable", JSON.stringify(bad));
  }
});

test("a block answer that is not a block, or is a different height, cannot bind the receipt", async () => {
  for (const bad of ["0x" + "77".repeat(32), 7, [], { number: "0x100" }]) {
    const v = await run(HONEST, HIRE_A, { blocks: { [RPCS[0]]: bad } });
    assert.equal(v.reason, "block_hash_mismatch", JSON.stringify(bad));
  }
  const wrongHeight = await run(HONEST, HIRE_A, { blocks: { [RPCS[0]]: { number: "0x101", hash: BLOCK_HASH } } });
  assert.equal(wrongHeight.reason, "block_hash_mismatch");
});

test("an unpinned verdict is a different verdict: different first line, exit 2", async () => {
  const pinned = await run(HONEST, HIRE_A);
  assert.equal(pinned.ok, true);
  assert.equal(pinned.unpinned, false);
  assert.equal(exitCodeFor(pinned), 0);
  assert.equal(renderVerdict(pinned)[0], "PROVEN");

  const mixed = await verifySettlement({
    tx: TX, rpcUrls: ["https://mainnet.base.org", "https://evil.example.com"], rpc: rpcServing(HONEST), allowUnpinnedRpc: true, ...HIRE_A,
  });
  assert.equal(mixed.ok, true, JSON.stringify(mixed));
  assert.equal(mixed.unpinned, true);
  assert.equal(exitCodeFor(mixed), 2);
  const lines = renderVerdict(mixed);
  assert.match(lines[0], /^PROVEN-UNPINNED/);
  assert.notEqual(lines[0], "PROVEN", "a grep for the exact word PROVEN must not match an unpinned verdict's first line");
  assert.ok(lines.some((l) => /caution:.*evil\.example\.com/.test(l)));
  assert.equal(exitCodeFor({ ok: false, reason: "x" }), 1);
});

test("the scope lines do not claim the terms were checked", async () => {
  const lines = renderVerdict(await run(HONEST, HIRE_A));
  const scope = lines.filter((l) => /scope:|^\s{17}/.test(l)).join(" ");
  assert.doesNotMatch(scope, /exact hire/);
  assert.match(scope, /was not checked/);
  assert.match(scope, /--grant/);
});

// ═══════════════════════════════════════════════════════════════════════════
// --grant mode: the terms come off the envelope whose hash the nonce binds.
// ═══════════════════════════════════════════════════════════════════════════

const b64 = (n) => randomBytes(n).toString("base64");
const hex = (n) => randomBytes(n).toString("hex");
const GRANT = (over = {}) => ({
  schema: "voidly-task-grant/v1",
  hirer_did: "did:voidly:" + "mPJNnvvYiKrFuY96NeESb",
  provider_did: "did:voidly:" + "6rGTFa5apSnKNF14bGXZfu",
  provider_signing_pubkey_base64: b64(32),
  provider_enc_pubkey_base64: b64(32),
  offer_hash: hex(32),
  capsule_hash: hex(32),
  brief_commitment: hex(32),
  price_chain: "eip155:8453",
  price_asset: EXPECTED_PRICE_ASSET,
  price_payer_account: "eip155:8453:" + PAYER,
  price_payee_account: "eip155:8453:" + PAYEE_A,
  price_min_amount: "50000",
  price_max_amount: "5000000",
  nonce: b64(24),
  issued_at: "2026-09-01T12:00:00.000Z",
  expires_at: "2026-09-01T12:10:00.000Z",
  ...over,
});

test("grant hash: the dependency-free hash equals @voidly/session's envelopeHash, over random envelopes", async () => {
  for (let i = 0; i < 40; i += 1) {
    const g = GRANT({ price_min_amount: String(1 + (i * 7919) % 100000) });
    assert.equal(grantHashOf(g), await envelopeHash(g));
    // key order must not matter, and null/undefined keys must be dropped, exactly as the SDK does
    const shuffled = Object.fromEntries(Object.entries(g).reverse());
    assert.equal(grantHashOf(shuffled), await envelopeHash(shuffled));
    assert.equal(grantHashOf({ ...g, extra: null }), await envelopeHash({ ...g, extra: null }));
  }
  // nested values, numbers, booleans and unicode: the SDK's own canonical form
  const odd = { a: [1, "two", { c: true, d: null }, [false]], "é": "ü\u2028", z: 0 };
  assert.equal(grantHashOf(odd), await envelopeHash(odd));
  assert.throws(() => sdkCanonicalize({ a: 1.5 }), /only finite integers/);
});

test("grant mode: payer, payee and amount are read off the grant, and the verdict says so", async () => {
  const g = GRANT();
  const nonce = bindingNonce(grantHashOf(g));
  const receipt = receiptOf([authLog(nonce, 0), transferLog(PAYER, PAYEE_A, 50000, 1)]);
  const v = await verifySettlement({ tx: TX, grant: g, rpcUrls: RPCS, rpc: rpcServing(receipt) });
  assert.equal(v.ok, true, JSON.stringify(v));
  assert.equal(v.grantHash, grantHashOf(g));
  assert.equal(v.payer, PAYER);
  assert.equal(v.payee, PAYEE_A);
  assert.equal(v.value, "50000");
  assert.equal(v.terms.source, "grant");
  const lines = renderVerdict(v);
  assert.ok(lines.some((l) => /terms:\s+read off the --grant envelope/.test(l)), lines.join("\n"));
  assert.ok(lines.some((l) => /scope:\s+payment proven for THIS grant/.test(l)), lines.join("\n"));
  assert.ok(!lines.some((l) => /not checked/.test(l)));
});

test("grant mode: the same tx refuses for a grant whose terms it did not settle", async () => {
  const g = GRANT();
  const nonce = bindingNonce(grantHashOf(g));
  // right nonce, wrong payee on chain
  const wrongPayee = receiptOf([authLog(nonce, 0), transferLog(PAYER, PAYEE_B, 50000, 1)]);
  assert.equal((await verifySettlement({ tx: TX, grant: g, rpcUrls: RPCS, rpc: rpcServing(wrongPayee) })).reason, "transfer_recipient_mismatch");
  // right nonce, an amount BELOW the grant's band (50000..5000000)
  const wrongAmount = receiptOf([authLog(nonce, 0), transferLog(PAYER, PAYEE_A, 49999, 1)]);
  assert.equal((await verifySettlement({ tx: TX, grant: g, rpcUrls: RPCS, rpc: rpcServing(wrongAmount) })).reason, "amount_outside_grant_band");
  // and above it
  const tooMuch = receiptOf([authLog(nonce, 0), transferLog(PAYER, PAYEE_A, 5000001, 1)]);
  assert.equal((await verifySettlement({ tx: TX, grant: g, rpcUrls: RPCS, rpc: rpcServing(tooMuch) })).reason, "amount_outside_grant_band");
  // inside the band above the floor is what the SDK's binding accepts, so it proves
  const aboveFloor = receiptOf([authLog(nonce, 0), transferLog(PAYER, PAYEE_A, 50001, 1)]);
  const v = await verifySettlement({ tx: TX, grant: g, rpcUrls: RPCS, rpc: rpcServing(aboveFloor) });
  assert.equal(v.ok, true, JSON.stringify(v));
  assert.equal(v.value, "50001");
  assert.deepEqual(v.terms.band, { min: "50000", max: "5000000" });
  // a different grant's nonce
  const other = GRANT({ offer_hash: hex(32) });
  const honest = receiptOf([authLog(nonce, 0), transferLog(PAYER, PAYEE_A, 50000, 1)]);
  assert.equal((await verifySettlement({ tx: TX, grant: other, rpcUrls: RPCS, rpc: rpcServing(honest) })).reason, "nonce_not_spent_by_this_tx");
});

test("grant mode: a typed value beside the grant must agree with it, or the run refuses", async () => {
  const g = GRANT();
  const nonce = bindingNonce(grantHashOf(g));
  const receipt = receiptOf([authLog(nonce, 0), transferLog(PAYER, PAYEE_A, 50000, 1)]);
  const base = { tx: TX, grant: g, rpcUrls: RPCS, rpc: rpcServing(receipt) };
  assert.equal((await verifySettlement({ ...base, grantHash: grantHashOf(g), payer: PAYER, payee: PAYEE_A, amount: "50000" })).ok, true);
  assert.equal((await verifySettlement({ ...base, grantHash: "0x" + grantHashOf(g).toUpperCase() })).ok, true, "0x and case are spelling, not disagreement");
  // a typed amount inside the band that the chain did not move is exact_value;
  // one outside the band is a term the grant never permitted
  assert.equal((await verifySettlement({ ...base, amount: "50001" })).reason, "exact_value");
  assert.equal((await verifySettlement({ ...base, amount: "6000000" })).reason, "grant_terms_mismatch");
  assert.equal((await verifySettlement({ ...base, amount: "0" })).reason, "grant_terms_mismatch");
  assert.equal((await verifySettlement({ ...base, payee: PAYEE_B })).reason, "grant_terms_mismatch");
  assert.equal((await verifySettlement({ ...base, payer: PAYEE_B })).reason, "grant_terms_mismatch");
  assert.equal((await verifySettlement({ ...base, grantHash: hex(32) })).reason, "grant_terms_mismatch");
  const m = await verifySettlement({ ...base, amount: "6000000" });
  assert.match(m.detail, /--amount 6000000 is outside the grant's price band 50000\.\.5000000/);
});

test("grant mode: documents that are not a Base-USDC task grant refuse by name, before any network call", async () => {
  const asked = {};
  const tryGrant = async (g) => verifySettlement({ tx: TX, grant: g, rpcUrls: RPCS, rpc: rpcServing(HONEST, { asked }) });
  assert.equal((await tryGrant({ wire: { grant: GRANT() } })).reason, "grant_not_a_grant_envelope", "keep.json itself");
  assert.equal((await tryGrant([])).reason, "grant_not_a_grant_envelope");
  assert.equal((await tryGrant("x")).reason, "grant_not_a_grant_envelope");
  assert.equal((await tryGrant(GRANT({ schema: "voidly-task-grant/v2" }))).reason, "grant_not_a_grant_envelope");
  assert.equal((await tryGrant({ ...GRANT(), extra: "field" })).reason, "grant_not_a_grant_envelope", "an extra field");
  const missing = GRANT(); delete missing.nonce;
  assert.equal((await tryGrant(missing)).reason, "grant_not_a_grant_envelope", "a missing field");
  assert.equal((await tryGrant(GRANT({ price_min_amount: 50000 }))).reason, "grant_not_a_grant_envelope", "a numeric amount");
  assert.equal((await tryGrant(GRANT({ price_min_amount: "0" }))).reason, "grant_not_a_grant_envelope", "a zero amount");
  assert.equal((await tryGrant(GRANT({ price_chain: "eip155:1", price_asset: "eip155:1/erc20:" + CANONICAL_USDC_BASE, price_payer_account: "eip155:1:" + PAYER, price_payee_account: "eip155:1:" + PAYEE_A }))).reason, "grant_chain_not_base");
  assert.equal((await tryGrant(GRANT({ price_asset: "eip155:8453/erc20:0x" + "ab".repeat(20) }))).reason, "grant_asset_not_canonical_usdc");
  assert.equal((await tryGrant(GRANT({ price_payer_account: "eip155:1:" + PAYER }))).reason, "grant_not_a_grant_envelope", "payer on another chain");
  assert.equal((await tryGrant(GRANT({ price_payee_account: "eip155:8453:notanaddress" }))).reason, "grant_not_a_grant_envelope");
  assert.equal((await tryGrant(GRANT({ price_min_amount: "6000000" }))).reason, "grant_not_a_grant_envelope", "an inverted band");
  // PAYER is all digits, so upper-casing it changes nothing — use an address with hex letters.
  assert.equal((await tryGrant(GRANT({ price_payer_account: "eip155:8453:0x" + "AB".repeat(20) }))).reason, "grant_not_a_grant_envelope", "an upper-case account the SDK calls unpayable");
  assert.equal((await tryGrant(GRANT({ price_asset: EXPECTED_PRICE_ASSET.toUpperCase().replace("EIP155", "eip155").replace("ERC20", "erc20") }))).reason, "grant_asset_not_canonical_usdc", "an upper-case asset string");
  const throwing = GRANT();
  Object.defineProperty(throwing, "nonce", { get() { throw new Error("boom"); }, enumerable: true });
  assert.equal((await tryGrant(throwing)).reason, "grant_not_a_grant_envelope", "a getter that throws");
  const proto = JSON.parse(JSON.stringify(GRANT()).replace('"schema"', '"__proto__":{"polluted":1},"schema"'));
  assert.equal((await tryGrant(proto)).reason, "grant_not_a_grant_envelope", "an own __proto__ key");
  assert.deepEqual(asked, {}, "no grant refusal may reach the network");
  assert.equal(GRANT_KEYS.length, 17);
});

test("grant mode: the terms are the SDK's — from/to/value are what the authorization builders sign", async () => {
  // buildTransferPaymentAuthorization signs { from: grant.price_payer_account,
  // to: grant.price_payee_account, value: grant.price_min_amount }. The proof
  // must read the same three, or it proves a different payment than the one
  // the SDK makes.
  const g = GRANT({ price_min_amount: "123456", price_max_amount: "5000000" });
  const t = grantTermsOf(g);
  assert.equal(t.ok, true);
  // The SDK's builders sign value = price_min_amount; its provider-side
  // binding accepts [min, max] (authorization_below_floor / _over_ceiling).
  // The proof therefore checks the BAND, not the floor.
  assert.deepEqual(t.band, { min: "123456", max: "5000000" });
  assert.equal(t.payer, PAYER);
  assert.equal(t.payee, PAYEE_A);
  assert.equal(t.expiresAt, g.expires_at);
});

test("typed mode still works, and its verdict says the terms were typed", async () => {
  const v = await run(HONEST, HIRE_A);
  assert.equal(v.ok, true);
  assert.equal(v.terms.source, "typed");
  const lines = renderVerdict(v);
  assert.ok(lines.some((l) => /terms:\s+as typed on the command line/.test(l)));
  assert.ok(lines.some((l) => /was not checked — no --grant was given/.test(l)));
});

// ═══════════════════════════════════════════════════════════════════════════
// Second hostile round — the engine audit of an earlier revision. No exit-0 contract
// defect was found; these are the leaks, the DoS, the forgeable stderr, and
// the wrong-name refusals it did find.
// ═══════════════════════════════════════════════════════════════════════════

const HERE2 = dirname(fileURLToPath(import.meta.url));
const SKILL2 = join(HERE2, "..");
const CLI = join(SKILL2, "scripts/verify-settlement.mjs");
const runCli = (args, opts = {}) => spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", ...opts });

test("E1: a stray URL or --rpc=URL on the command line is refused without echoing the value", () => {
  const SECRET = "SECRET-API-KEY-1234";
  const a = runCli(["--tx", TX, `--rpc=https://mainnet.base.org/v2/${SECRET}`]);
  assert.equal(a.status, 1);
  assert.match(a.stderr, /REFUSED\s+flag_form_unsupported/);
  assert.ok(!a.stderr.includes(SECRET), a.stderr);
  const b = runCli(["--tx", TX, "--rpc", "https://mainnet.base.org", `https://base.drpc.org/v2/${SECRET}`]);
  assert.equal(b.status, 1);
  assert.match(b.stderr, /REFUSED\s+unknown_argument — a URL for base\.drpc\.org/);
  assert.ok(!b.stderr.includes(SECRET), b.stderr);
  const c = runCli(["--tx", TX, `--${SECRET}`, "x"]);
  assert.match(c.stderr, /REFUSED\s+unknown_flag/);
});

test("E2: the body cap is enforced on the wire — a gzip bomb and an endless chunked body both abort at the cap, by name", async () => {
  // 64 MiB of spaces, ~64 KB on the wire. Decompressed in full it is sixteen
  // times the cap; the reader must stop at the cap, not at the end.
  const INFLATED = MAX_RPC_BODY_BYTES * 16;
  const bomb = gzipSync(Buffer.alloc(INFLATED, 0x20));
  const server = createServer((req, res) => {
    if (req.url === "/gzip") {
      res.writeHead(200, { "content-type": "application/json", "content-encoding": "gzip" });
      res.end(bomb);
      return;
    }
    if (req.url === "/chunked") {
      res.writeHead(200, { "content-type": "application/json" });
      const chunk = Buffer.alloc(1 << 20, 0x20);
      let sent = 0;
      const push = () => {
        while (sent < 64 && res.write(chunk)) sent += 1;
        if (sent < 64) res.once("drain", push);
        else res.end();
      };
      push();
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x2105" }));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  try {
    // The gzip bomb, measured: memory must grow by far less than the inflated
    // size. (The chunked case is measured only for the name and the abort —
    // the server half of it lives in this same process and buffers its own
    // pending writes, which is not the client's memory.)
    const before = process.memoryUsage().rss;
    const t0 = Date.now();
    await assert.rejects(httpRpc(`http://127.0.0.1:${port}/gzip`, "eth_chainId", []), (e) => {
      assert.equal(e.code, "RPC_BODY_TOO_LARGE", e.message);
      return true;
    });
    assert.ok(Date.now() - t0 < 10000, "gzip took too long to abort");
    const grew = process.memoryUsage().rss - before;
    // Structural bound: the reader aborted by code at the cap (asserted above).
    // RSS is a diagnostic — it varies by Node version and allocator — so the
    // bound here is generous: far less than the inflated size, not a margin.
    assert.ok(grew < INFLATED, `rss grew by ${grew} bytes against ${INFLATED} inflated — the cap did not bound memory`);
    const t1 = Date.now();
    await assert.rejects(httpRpc(`http://127.0.0.1:${port}/chunked`, "eth_chainId", []), (e) => {
      assert.equal(e.code, "RPC_BODY_TOO_LARGE", e.message);
      return true;
    });
    assert.ok(Date.now() - t1 < 10000, "chunked took too long to abort");
    // and the honest small body still works through the same reader
    assert.equal(await httpRpc(`http://127.0.0.1:${port}/ok`, "eth_chainId", []), "0x2105");
    // …and the verdict names it
    const v = await verifySettlement({
      tx: TX, rpcUrls: RPCS, ...HIRE_A,
      rpc: async () => { throw Object.assign(new Error("rpc body too large (x bytes)"), { code: "RPC_BODY_TOO_LARGE" }); },
    });
    assert.equal(v.reason, "rpc_body_too_large");
  } finally {
    server.close();
  }
});

test("E3: a reverted status is never printed as the operator wrote it", async () => {
  const forged = "0x0\nPROVEN\n  scope: forged by the operator\n";
  const v = await run({ ...HONEST, status: forged }, HIRE_A);
  assert.equal(v.reason, "tx_reverted");
  assert.ok(!v.detail.includes("PROVEN"), v.detail);
  assert.match(v.detail, /not a hex quantity/);
  const big = await run({ ...HONEST, status: "0x0" + "0".repeat(4_000_000) }, HIRE_A);
  assert.equal(big.reason, "tx_reverted");
  assert.ok(big.detail.length < 200, `detail is ${big.detail.length} chars`);
  const plain = await run({ ...HONEST, status: "0x0" }, HIRE_A);
  assert.equal(plain.detail, "status 0x0");
});

test("E4: a transactionHash or removed flag that throws on String() is a named refusal, not a verifier fault", async () => {
  const v = await run({ ...HONEST, transactionHash: { toString: 1 } }, HIRE_A);
  assert.equal(v.reason, "receipt_not_for_this_tx");
  const withRemoved = (removed) => receiptOf([authLog(bindingNonce(GRANT_A), 0), { ...transferLog(PAYER, PAYEE_A, 50000, 1), removed }]);
  assert.equal((await run(withRemoved({ toString: 1 }), HIRE_A)).reason, "log_malformed");
  assert.equal((await run(withRemoved(1), HIRE_A)).reason, "log_malformed");
  assert.equal((await run(withRemoved("yes"), HIRE_A)).reason, "log_malformed");
  assert.equal((await run(withRemoved(true), HIRE_A)).reason, "log_removed");
  // `removed` is a JSON boolean on every operator: a STRING "true"/"false" is
  // a malformed log, not a value to read through.
  assert.equal((await run(withRemoved("true"), HIRE_A)).reason, "log_malformed");
  assert.equal((await run(withRemoved("false"), HIRE_A)).reason, "log_malformed");
  assert.equal((await run(withRemoved(false), HIRE_A)).ok, true);
  assert.equal((await run(withRemoved(undefined), HIRE_A)).ok, true);
});

test("E5: two canonical-USDC logs sharing a logIndex refuse — array order decides nothing", async () => {
  const nonce = bindingNonce(GRANT_A);
  const good = transferLog(PAYER, PAYEE_A, 50000, 1);
  const bad = transferLog(PAYER, PAYEE_B, 50000, 1);
  for (const order of [[good, bad], [bad, good]]) {
    const v = await run(receiptOf([authLog(nonce, 0), ...order]), HIRE_A);
    assert.equal(v.reason, "log_index_duplicate", JSON.stringify(v));
  }
});

test("E6: --amount with leading zeros is the same amount", async () => {
  const v = await run(HONEST, { ...HIRE_A, amount: "050000" });
  assert.equal(v.ok, true, JSON.stringify(v));
  assert.equal(v.value, "50000");
  const g = GRANT();
  const receipt = receiptOf([authLog(bindingNonce(grantHashOf(g)), 0), transferLog(PAYER, PAYEE_A, 50000, 1)]);
  const w = await verifySettlement({ tx: TX, grant: g, amount: "000050000", rpcUrls: RPCS, rpc: rpcServing(receipt) });
  assert.equal(w.ok, true, JSON.stringify(w));
});

test("E7: a --tx without 0x refuses bad_tx_hash before any network call", async () => {
  const asked = {};
  const v = await verifySettlement({ tx: TX.slice(2), rpcUrls: RPCS, rpc: rpcServing(HONEST, { asked }), ...HIRE_A });
  assert.equal(v.reason, "bad_tx_hash");
  assert.deepEqual(asked, {});
  const upper = await verifySettlement({ tx: TX.toUpperCase().replace("0X", "0x"), rpcUrls: RPCS, rpc: rpcServing(HONEST), ...HIRE_A });
  assert.equal(upper.ok, true, "case is spelling");
});

test("E8: one box on two ports, or localhost beside 127.0.0.1, is one operator", async () => {
  for (const pair of [
    ["https://127.0.0.1:8443", "https://127.0.0.1:8444"],
    ["https://127.0.0.1:8443", "https://localhost:8443"],
    ["https://localhost", "https://[::1]"],
    ["https://mainnet.base.org", "https://mainnet.base.org:8443"],
  ]) {
    const v = await verifySettlement({ tx: TX, rpcUrls: pair, rpc: rpcServing(HONEST), allowUnpinnedRpc: true, ...HIRE_A });
    assert.equal(v.reason, "insufficient_rpc_quorum", `${pair.join(" vs ")} counted as two: ${JSON.stringify(v)}`);
  }
  assert.equal(operatorKeyOf(new URL("https://LOCALHOST:1")), "loopback");
  assert.equal(operatorKeyOf(new URL("https://127.9.9.9")), "loopback");
  assert.equal(operatorKeyOf(new URL("https://a.localhost")), "loopback");
  assert.equal(operatorKeyOf(new URL("https://Mainnet.Base.org:8443/x")), "mainnet.base.org");
});

test("E9: a stranger spending the same nonce bytes under their own key does not make this hire ambiguous", async () => {
  const nonce = bindingNonce(GRANT_A);
  const stranger = "0x" + "44".repeat(20);
  const receipt = receiptOf([
    authLog(nonce, 0),
    transferLog(PAYER, PAYEE_A, 50000, 1),
    authLog(nonce, 2, { from: stranger }),
    transferLog(stranger, PAYEE_B, 7, 3),
  ]);
  const v = await run(receipt, HIRE_A);
  assert.equal(v.ok, true, JSON.stringify(v));
  assert.equal(v.transferLogIndex, 1);
  // …but two uses by THIS payer are still ambiguous, and a nonce spent only by
  // someone else is still an authorizer mismatch
  const twice = receiptOf([authLog(nonce, 0), transferLog(PAYER, PAYEE_A, 50000, 1), authLog(nonce, 2), transferLog(PAYER, PAYEE_A, 50000, 3)]);
  assert.equal((await run(twice, HIRE_A)).reason, "authorization_ambiguous");
  const other = receiptOf([authLog(nonce, 0, { from: stranger }), transferLog(stranger, PAYEE_A, 50000, 1)]);
  assert.equal((await run(other, HIRE_A)).reason, "authorizer_mismatch");
});

test("E10: block heights past 2^53 refuse instead of being printed rounded", async () => {
  const huge = "0x" + (0x20000000000000n + 1n).toString(16);
  const v = await run({ ...HONEST, blockNumber: huge }, HIRE_A);
  assert.equal(v.reason, "receipt_not_mined");
  const w = await run(HONEST, HIRE_A, { heads: { [RPCS[1]]: 0x20000000000000n + 1n } });
  assert.equal(w.reason, "rpc_head_unreadable");
});

test("E11: a block answer must carry a readable number equal to the receipt's height", async () => {
  for (const bad of [{ hash: BLOCK_HASH }, { hash: BLOCK_HASH, number: 256 }, { hash: BLOCK_HASH, number: "256" }, { hash: BLOCK_HASH, number: null }]) {
    const v = await run(HONEST, HIRE_A, { blocks: { [RPCS[0]]: bad } });
    assert.equal(v.reason, "block_hash_mismatch", JSON.stringify(bad));
  }
});

test("API: a nonsensical minConfirmations is a named misconfiguration, not a proof", async () => {
  const v = await run(HONEST, { ...HIRE_A, minConfirmations: -5 });
  assert.equal(v.reason, "verifier_misconfigured");
});

test("F1: the CLI runs when invoked through a symlinked directory", () => {
  const dir = mkdtempSync(join(tmpdir(), "vs-symlink-"));
  symlinkSync(SKILL2, join(dir, "skill"));
  const r = spawnSync(process.execPath, [join(dir, "skill", "scripts", "verify-settlement.mjs")], { encoding: "utf8" });
  assert.equal(r.status, 1, "usage must be printed and exit 1 — a silent exit 0 means main never ran");
  assert.match(r.stderr, /^usage:/);
  assert.equal(invokedAsMain(join(dir, "skill", "scripts", "verify-settlement.mjs"), new URL("../scripts/verify-settlement.mjs", import.meta.url).href), true);
  assert.equal(invokedAsMain("/no/such/file.mjs", import.meta.url), false);
  assert.equal(invokedAsMain(undefined, import.meta.url), false);
});

// ═══════════════════════════════════════════════════════════════════════════
// Engine, round two — ten findings against an earlier revision.
// ═══════════════════════════════════════════════════════════════════════════

test("R2-F1: --grant is never silently downgraded to typed mode", async () => {
  // engine: a null grant is a refusal, not "no grant"
  const v = await verifySettlement({ tx: TX, grant: null, grantHash: GRANT_A, payer: PAYER, payee: PAYEE_A, amount: "50000", rpcUrls: RPCS, rpc: rpcServing(HONEST) });
  assert.equal(v.reason, "grant_not_a_grant_envelope");
  // CLI: a file holding `null`, and --grant as the last argument
  const dir = mkdtempSync(join(tmpdir(), "vs-grant-"));
  writeFileSync(join(dir, "null.grant.json"), "null");
  const nul = runCli(["--tx", TX, "--grant", join(dir, "null.grant.json"), "--grant-hash", GRANT_A, "--payer", PAYER, "--payee", PAYEE_A, "--amount", "50000"]);
  assert.equal(nul.status, 1);
  assert.match(nul.stderr, /REFUSED\s+grant_not_a_grant_envelope/, nul.stderr);
  const last = runCli(["--tx", TX, "--grant-hash", GRANT_A, "--payer", PAYER, "--payee", PAYEE_A, "--amount", "50000", "--grant"]);
  assert.equal(last.status, 1);
  assert.match(last.stderr, /REFUSED\s+flag_value_missing — --grant/, last.stderr);
  const emptyRpc = runCli(["--tx", TX, "--rpc"]);
  assert.match(emptyRpc.stderr, /flag_value_missing — --rpc/);
});

test("R2-F2: unspecified, IPv4-mapped and trailing-dot spellings of one box are one operator", async () => {
  for (const pair of [
    ["https://127.0.0.1:8453", "https://0.0.0.0:8453"],
    ["https://127.0.0.1:8453", "https://[::ffff:127.0.0.1]:8453"],
    ["https://127.0.0.1:8453", "https://[::ffff:7f00:1]:8453"],
    ["https://localhost:8453", "https://localhost.:8453"],
    ["https://[::1]:8453", "https://[0:0:0:0:0:0:0:1]:8453"],
    ["https://mainnet.base.org", "https://mainnet.base.org."],
  ]) {
    const v = await verifySettlement({ tx: TX, rpcUrls: pair, rpc: rpcServing(HONEST), allowUnpinnedRpc: true, ...HIRE_A });
    assert.equal(v.reason, "insufficient_rpc_quorum", `${pair.join(" vs ")} counted as two: ${JSON.stringify(v)}`);
  }
  assert.equal(operatorKeyOf(new URL("https://0.0.0.0")), "loopback");
  assert.equal(operatorKeyOf(new URL("https://[::]")), "loopback");
  assert.equal(operatorKeyOf(new URL("https://Mainnet.Base.org.")), "mainnet.base.org");
});

test("R2-F3: a credential-shaped flag NAME is withheld; a typo'd name is shown", () => {
  const SECRET = "SECRET-API-KEY-1234";
  const a = runCli(["--tx", TX, `--rpchttps://base.drpc.org/v2/${SECRET}`, "x"]);
  assert.match(a.stderr, /unknown_flag — \(flag name withheld, \d+ chars\)/);
  assert.ok(!a.stderr.includes(SECRET), a.stderr);
  const b = runCli(["--tx", TX, `--https://base.drpc.org/v2/${SECRET}=1`]);
  assert.match(b.stderr, /flag_form_unsupported — \(flag name withheld/);
  assert.ok(!b.stderr.includes(SECRET), b.stderr);
  const c = runCli(["--tx", TX, "--grant_hash", "beef"]);
  assert.match(c.stderr, /unknown_flag — --grant_hash/);
});

test("R2-F4: --grant must be a regular file of plausible size", () => {
  const dir = mkdtempSync(join(tmpdir(), "vs-gfile-"));
  const asDir = runCli(["--tx", TX, "--grant", dir]);
  assert.match(asDir.stderr, /grant_unreadable — --grant is not a regular file/);
  writeFileSync(join(dir, "big.json"), "{" + "\"a\":\"" + "x".repeat(70 * 1024) + "\"}");
  const big = runCli(["--tx", TX, "--grant", join(dir, "big.json")]);
  assert.match(big.stderr, /grant_unreadable — --grant is \d+ bytes; a task-grant envelope is under 65536/);
  const missing = runCli(["--tx", TX, "--grant", join(dir, "nope.json")]);
  assert.match(missing.stderr, /grant_unreadable — --grant could not be read \(ENOENT\); path withheld/);
});

test("R2-F5: a typed amount of zero is not a payment", async () => {
  for (const zero of ["0", "00", "000"]) {
    const receipt = receiptOf([authLog(bindingNonce(GRANT_A), 0), transferLog(PAYER, PAYEE_A, 0, 1)]);
    const v = await run(receipt, { ...HIRE_A, amount: zero });
    assert.equal(v.reason, "bad_amount", zero);
  }
});

test("R2-F6/F7: an empty body and a non-integer error code are named transport failures, not TypeErrors", async () => {
  const server = createServer((req, res) => {
    if (req.url === "/204") { res.writeHead(204); res.end(); return; }
    if (req.url === "/objcode") { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: { toString: 1 } } })); return; }
    res.writeHead(200); res.end("{}");
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  try {
    await assert.rejects(httpRpc(`http://127.0.0.1:${port}/204`, "eth_chainId", []), /rpc empty body/);
    await assert.rejects(httpRpc(`http://127.0.0.1:${port}/objcode`, "eth_chainId", []), /rpc error \(non-integer code\)/);
  } finally {
    server.close();
  }
});

test("R2-F8: a body of nested arrays is refused by a byte scan before JSON.parse builds it", async () => {
  const deep = "[".repeat(200000) + "]".repeat(200000);
  assert.equal(nestingDepthExceeds(deep, MAX_CANONICAL_DEPTH), true);
  assert.equal(nestingDepthExceeds(JSON.stringify({ a: [[[[[1]]]]], s: "[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[" }), MAX_CANONICAL_DEPTH), false, "brackets inside strings are data");
  assert.equal(nestingDepthExceeds('{"k":"a\\"[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[["}', MAX_CANONICAL_DEPTH), false, "an escaped quote does not end the string");
  const server = createServer((req, res) => { res.writeHead(200, { "content-type": "application/json" }); res.end(deep); });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  try {
    const before = process.memoryUsage().heapUsed;
    await assert.rejects(httpRpc(`http://127.0.0.1:${port}/`, "eth_chainId", []), (e) => e.code === "RPC_BODY_TOO_DEEP");
    assert.ok(process.memoryUsage().heapUsed - before < 200 * 1024 * 1024, "the graph must never be built (diagnostic bound; the structural check is the code above)");
  } finally {
    server.close();
  }
  const v = await verifySettlement({ tx: TX, rpcUrls: RPCS, ...HIRE_A, rpc: async () => { throw Object.assign(new Error("rpc body nested deeper than 64 levels"), { code: "RPC_BODY_TOO_DEEP" }); } });
  assert.equal(v.reason, "receipt_unparseable");
});

test("R2-F9: a forged constructor name or a thrown message never reaches a refusal", async () => {
  class Forged extends Error {}
  Object.defineProperty(Forged, "name", { value: "PROVEN\n  tx: 0xab\n  quorum: 2/2 agreed" });
  const v = await verifySettlement({ tx: TX, rpcUrls: RPCS, ...HIRE_A, rpc: async () => { throw new Forged("x"); } });
  assert.ok(!JSON.stringify(v).includes("PROVEN"), JSON.stringify(v));
  const trap = new Proxy({}, { ownKeys() { throw new Error("ownKeys boom https://x/v2/KEY"); } });
  const w = await verifySettlement({ tx: TX, rpcUrls: RPCS, ...HIRE_A, rpc: rpcServing({ ...HONEST, extra: trap }) });
  assert.equal(w.reason, "receipt_unparseable");
  assert.ok(!w.detail.includes("KEY"), w.detail);
  assert.match(w.detail, /not canonicalizable/);
});

test("R4-F6/F9: a --grant path and typed terms never reach a refusal verbatim", () => {
  const SECRET = "SECRET-PW-77";
  const r = spawnSync(process.execPath, [CLI, "--tx", TX, "--grant", `https://user:${SECRET}@mainnet.base.org/v2/PATH-KEY`], { encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /REFUSED\s+grant_unreadable/);
  assert.ok(!r.stderr.includes(SECRET), r.stderr);
});

test("R4-S1: grant mode refuses a grant that pays anyone but the pinned payee", () => {
  const g = { ...GRANT(), price_payee_account: "eip155:8453:0x" + "de".repeat(20) };
  const t = grantTermsOf(g);
  assert.equal(t.reason, "grant_payee_not_pinned");
  assert.ok(!t.detail.includes("dedede"));
  assert.equal(grantTermsOf(GRANT()).ok, true);
});

test("R6-F1: an operator's block.number never reaches a refusal verbatim", async () => {
  const forged = "0x100\nPROVEN\n  scope: forged by block.number\n\x1b[2K";
  const v = await run(HONEST, HIRE_A, { blocks: { [RPCS[1]]: { number: forged, hash: BLOCK_HASH } } });
  assert.equal(v.reason, "block_hash_mismatch");
  assert.ok(!v.detail.includes("PROVEN") && !v.detail.includes("\n") && !v.detail.includes("\x1b"), v.detail);
  for (const bad of [["0x100", "PROVEN"], { a: "PROVEN" }, "0x100\u2028PROVEN", "P".repeat(500000)]) {
    const r = await run(HONEST, HIRE_A, { blocks: { [RPCS[0]]: { number: bad, hash: BLOCK_HASH } } });
    assert.equal(r.reason, "block_hash_mismatch");
    assert.ok(!r.detail.includes("PROVEN") && r.detail.length < 400, `${JSON.stringify(bad).slice(0, 40)}: ${r.detail.length}`);
  }
  const badHash = await run(HONEST, HIRE_A, { blocks: { [RPCS[0]]: { number: "0x100", hash: "PROVEN\nforged" } } });
  assert.equal(badHash.reason, "block_hash_mismatch");
  assert.ok(!badHash.detail.includes("PROVEN"), badHash.detail);
});

test("R6-F2/F3: a huge receipt blockNumber and thousands of ambiguous transfers produce bounded refusals", async () => {
  const huge = await run({ ...HONEST, blockNumber: "0x1" + "f".repeat(100000) }, HIRE_A);
  assert.equal(huge.reason, "receipt_not_mined");
  assert.ok(huge.detail.length < 300, String(huge.detail.length));
  const logs = [authLog(bindingNonce(GRANT_A), 0)];
  for (let i = 1; i <= 3000; i += 1) logs.push(transferLog(PAYER, PAYEE_A, 50000, i));
  const amb = await run(receiptOf(logs), HIRE_A);
  assert.equal(amb.reason, "transfer_ambiguous");
  assert.match(amb.detail, /and 2992 more/);
  assert.ok(amb.detail.length < 400, String(amb.detail.length));
});

test("R6: a topic with non-zero padding is not an address", async () => {
  const receipt = receiptOf([
    { ...authLog(bindingNonce(GRANT_A), 0), topics: [TOPIC_AUTHORIZATION_USED, "0x" + "ff".repeat(12) + PAYER.slice(2), bindingNonce(GRANT_A)] },
    transferLog(PAYER, PAYEE_A, 50000, 1),
  ]);
  const v = await run(receipt, HIRE_A);
  assert.equal(v.ok, false);
  assert.equal(v.reason, "authorizer_mismatch");
});

test("R6: the CLI's refusal line is capped at 1 KB even for a detail nothing else bounded", () => {
  const r = spawnSync(process.execPath, [CLI, "--tx", TX, "--grant-hash", GRANT_A, "--payer", PAYER, "--payee", PAYEE_A, "--amount", "50000", "--rpc", "https://" + "a".repeat(60000) + ".example", "--rpc", "https://base.drpc.org"], { encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.ok(r.stderr.length < 1200, String(r.stderr.length));
  assert.match(r.stderr, /^REFUSED\s+rpc_host_not_allowlisted/);
});
