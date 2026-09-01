#!/usr/bin/env node
// verify-settlement.mjs — prove (or refuse, by name) that a Base-mainnet
// transaction settled ONE specific hire. Pure Node: no npm dependencies (the
// reviewed constants come from lib/pins.mjs), no keys, no writes. The only
// network calls are read-only JSON-RPC to the public Base endpoints you name.
//
//   node scripts/verify-settlement.mjs \
//     --tx 0x<64-hex> --grant-hash <64-hex> \
//     --payer 0x<40-hex> --payee 0x<40-hex> --amount <atomic-usdc> \
//     [--rpc https://mainnet.base.org --rpc https://base.drpc.org]
//
// What "PROVEN" means here, and nothing more:
//   1. The nonce binding. The EIP-3009 nonce is a pure function of the hire:
//      sha256("voidly-session-settlement-binding/v1|" + grantHash) — the same
//      SETTLEMENT_BINDING_DOMAIN @voidly/session exports. USDC's
//      AuthorizationUsed event must carry exactly that nonce, authorized by
//      the payer. A settlement for a DIFFERENT hire cannot fake this.
//   2. The receipt: status success, emitted by the canonical Base USDC
//      contract, with a Transfer of exactly --amount from payer to payee.
//      Exact equality, deliberately — ">=" is how amount checks rot.
//   3. Finality: at least 12 confirmations.
//   4. Quorum: every RPC you name must return a byte-identical receipt.
//      An unanswered endpoint fails the run — unanimity or nothing.
//
// What it does NOT prove: that the work was done, delivered, or any good.
// Payment buys an attempt; delivery is proven by the sealed result and its
// receipt (see verify-artifacts.mjs), never by the chain alone.
//
// Exit 0 PROVEN / 1 REFUSED, with the failed check named.

import { createHash } from "node:crypto";
import { CANONICAL_USDC_BASE } from "./lib/pins.mjs";

const SETTLEMENT_BINDING_DOMAIN = "voidly-session-settlement-binding/v1|";
// keccak256("AuthorizationUsed(address,bytes32)") — EIP-3009, from the USDC ABI.
const TOPIC_AUTHORIZATION_USED =
  "0x98de503528ee59b575ef0c0a2576a82497bfc029a5685b209e9ec333479b10a5";
// keccak256("Transfer(address,address,uint256)")
const TOPIC_TRANSFER =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const MIN_CONFIRMATIONS = 12;
const DEFAULT_RPCS = ["https://mainnet.base.org", "https://base.drpc.org"];

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error(
    "usage: node scripts/verify-settlement.mjs \\\n" +
      "  --tx 0x<64-hex> --grant-hash <64-hex> \\\n" +
      "  --payer 0x<40-hex> --payee 0x<40-hex> --amount <atomic-usdc> \\\n" +
      "  [--rpc https://mainnet.base.org --rpc https://base.drpc.org]",
  );
  process.exit(1);
}
const flags = { rpc: [] };
for (let i = 0; i < args.length; i += 2) {
  const k = args[i]?.replace(/^--/, "");
  const v = args[i + 1];
  if (k === "rpc") flags.rpc.push(v);
  else flags[k] = v;
}
const rpcs = flags.rpc.length ? flags.rpc : DEFAULT_RPCS;

const refuse = (name, detail) => {
  console.error(`REFUSED  ${name}${detail ? ` — ${detail}` : ""}`);
  process.exit(1);
};
const hex64 = /^[0-9a-f]{64}$/;
const tx = (flags.tx ?? "").toLowerCase();
const grantHash = (flags["grant-hash"] ?? "").toLowerCase();
const payer = (flags.payer ?? "").toLowerCase();
const payee = (flags.payee ?? "").toLowerCase();
const amount = flags.amount;
if (!hex64.test(tx.replace(/^0x/, ""))) refuse("bad_tx_hash");
if (!hex64.test(grantHash)) refuse("bad_grant_hash");
if (!/^0x[0-9a-f]{40}$/.test(payer)) refuse("bad_payer_address");
if (!/^0x[0-9a-f]{40}$/.test(payee)) refuse("bad_payee_address");
if (!/^[0-9]+$/.test(amount ?? "")) refuse("bad_amount");
// Host names only in output — an RPC URL can carry an API key in its path.
const host = (u) => { try { return new URL(u).host; } catch { return "unparseable"; } };

// 1. The binding nonce, recomputed from the hire — never taken from anywhere.
const nonce =
  "0x" + createHash("sha256").update(SETTLEMENT_BINDING_DOMAIN + grantHash).digest("hex");

async function rpc(url, method, params) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`http ${res.status}`);
  const body = await res.json();
  if (body.error) throw new Error(`rpc error ${body.error.code}`);
  return body.result;
}

// 2. Quorum read: every named endpoint, byte-identical or nothing.
const receipts = [];
for (const url of rpcs) {
  try {
    receipts.push({ url, receipt: await rpc(url, "eth_getTransactionReceipt", [tx]) });
  } catch (e) {
    refuse("rpc_unanswered", `${host(url)}: ${e.message} — an unanswered operator is a divergent operator`);
  }
}
// Fully recursive, key-sorted canonicalization. An array replacer here would
// silently strip every log's address/topics/data from the digest — one
// dishonest RPC could then forge agreement on a settlement that never
// happened. Every nested field, logs included, goes into the hash.
const canonical = (v) => {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  return `{${Object.keys(v)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`)
    .join(",")}}`;
};
const digests = receipts.map(({ receipt }) =>
  createHash("sha256").update(canonical(receipt)).digest("hex"),
);
if (new Set(digests).size !== 1) {
  refuse("rpc_divergence", receipts.map((r) => `${host(r.url)}=${digests[receipts.indexOf(r)].slice(0, 8)}`).join(" "));
}
const receipt = receipts[0].receipt;
if (receipt === null) refuse("tx_not_found");
if (receipt.status !== "0x1") refuse("tx_reverted", `status ${receipt.status}`);

// 3. AuthorizationUsed: THIS payer spent THIS hire's nonce in THIS tx.
const usdcLogs = receipt.logs.filter(
  (l) => l.address.toLowerCase() === CANONICAL_USDC_BASE,
);
const pad = (addr) => "0x" + addr.slice(2).padStart(64, "0");
const auth = usdcLogs.find(
  (l) => l.topics[0] === TOPIC_AUTHORIZATION_USED && l.topics[2] === nonce,
);
if (!auth) refuse("nonce_not_spent_by_this_tx", `no AuthorizationUsed with nonce ${nonce.slice(0, 10)}… on canonical USDC`);
if (auth.topics[1] !== pad(payer)) refuse("authorizer_mismatch", `authorizer ${auth.topics[1]}`);

// 4. The Transfer: exactly this amount, payer -> payee, on canonical USDC.
const transfers = usdcLogs.filter((l) => l.topics[0] === TOPIC_TRANSFER);
if (transfers.length === 0) refuse("no_usdc_transfer");
const paired = transfers.find((l) => l.topics[1] === pad(payer));
if (!paired) refuse("transfer_payer_mismatch");
if (paired.topics[2] !== pad(payee)) {
  refuse("transfer_recipient_mismatch", `the paired Transfer pays 0x${paired.topics[2].slice(26)}, not the expected payee ${payee}`);
}
const value = BigInt(paired.data).toString();
if (value !== amount) refuse("exact_value", `transfer moved ${value}, expected exactly ${amount}`);

// 5. Finality.
const head = BigInt(await rpc(rpcs[0], "eth_blockNumber", []));
const confirmations = Number(head - BigInt(receipt.blockNumber));
if (confirmations < MIN_CONFIRMATIONS) {
  refuse("insufficient_confirmations", `${confirmations} < ${MIN_CONFIRMATIONS}`);
}

console.log("PROVEN");
console.log(`  tx:            ${tx}`);
console.log(`  grant_hash:    ${grantHash}`);
console.log(`  binding nonce: ${nonce} (recomputed, sha256 over the domain + grant hash)`);
console.log(`  transfer:      ${value} atomic USDC  ${payer} -> ${payee}`);
console.log(`  block:         ${Number(BigInt(receipt.blockNumber))}  confirmations: ${confirmations}`);
console.log(`  quorum:        ${rpcs.map(host).join(" + ")} — receipts byte-identical`);
console.log("  scope:         payment proven for this exact hire. Delivery is a separate proof.");
