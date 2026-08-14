#!/usr/bin/env node
// Deterministic pre-payment gate for Tenjin x402 challenges. Read-only against
// your wallet: never touches keys, never signs, never pays. It enforces the
// sibling x402-registry.json -> signingPolicy (the single source of truth),
// decides whether user confirmation is required (autopay policy), guards
// against double-payment (local attempt ledger), and verifies settlements.
//
// Usage:
//   verify-402.mjs <url>                       GET the url and verify its 402
//   verify-402.mjs <url> --header <b64>        verify a PAYMENT-REQUIRED value
//                                              already held (POST endpoints
//                                              like /api/answer)
//   verify-402.mjs <url> --key <id>            extra ledger key when one url
//                                              sells many products (/api/answer:
//                                              pass the question or searchId)
//   verify-402.mjs <url> reconcile settled --tx <hash>   after paying: verify the
//                                              settlement tx on Base and close
//                                              the attempt
//   verify-402.mjs <url> reconcile settled --from <0xwallet>   same, but discover
//                                              the tx on-chain (for wallets like
//                                              the Bankr CLI that don't print it)
//   verify-402.mjs <url> reconcile declined|failed|entitled   close the attempt
//                                              without a payment (declined = the
//                                              user said no; budget released)
//
// Consent stays with the wallet: Bankr's `bankr x402 call` confirms every
// payment interactively unless the user passes -y/--ni themselves. This script
// adds what the wallet can't know: Tenjin payee verification, a double-payment
// guard, spend-so-far context, and settlement verification.
// Env overrides: TENJIN_LEDGER_FILE, BASE_RPC_URL.
// Exit: 0 = PASS (or nothing to pay / reconciled), 1 = FAIL, 2 = usage error.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const registry = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'x402-registry.json'),
    'utf8',
  ),
);
const policy = registry.signingPolicy;
const pinned = policy.pinned;
const payees = policy.payeePolicy;
const RPC = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const LEDGER_FILE = process.env.TENJIN_LEDGER_FILE || join(homedir(), '.config', 'tenjin', 'ledger.json');

const argv = process.argv.slice(2);
const url = argv[0];
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const die = (msg, code = 1) => {
  console.error(msg);
  process.exit(code);
};
const eq = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

if (!url) die('usage: verify-402.mjs <url> [--header <b64>] [--key <id>] | <url> reconcile settled --tx <hash> | <url> reconcile failed|entitled', 2);

let parsed;
try {
  parsed = new URL(url);
} catch {
  die(`FAIL: not a valid URL: ${url}`);
}
if (parsed.origin !== pinned.resourceOrigin)
  die(`FAIL: origin ${parsed.origin} != pinned ${pinned.resourceOrigin} - never pay a challenge from anywhere else.`);
const isAnswer = parsed.pathname === new URL(payees.answer.endpoint).pathname;
const isRead = parsed.pathname.startsWith('/api/read/');
if (!isAnswer && !isRead)
  die(`FAIL: ${parsed.pathname} is not a known Tenjin paid endpoint (expected /api/answer or /api/read/...).`);

const ledgerKey = flag('key') ? `${url}#${flag('key')}` : url;

function loadLedger() {
  try {
    return JSON.parse(readFileSync(LEDGER_FILE, 'utf8'));
  } catch {
    return { attempts: [] };
  }
}
function saveLedger(ledger) {
  mkdirSync(dirname(LEDGER_FILE), { recursive: true });
  writeFileSync(LEDGER_FILE, JSON.stringify(ledger, null, 2));
}

async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(15000),
  });
  return (await res.json()).result;
}

// ---- reconcile mode: close an open attempt, verifying the tx when settled.
if (argv[1] === 'reconcile') {
  const outcome = argv[2] === 'declined' ? 'failed' : argv[2];
  if (!['settled', 'failed', 'entitled'].includes(outcome))
    die('usage: verify-402.mjs <url> reconcile settled [--tx <hash> | --from <0xwallet>] | declined | failed | entitled', 2);
  const ledger = loadLedger();
  const attempt = ledger.attempts.findLast((a) => a.key === ledgerKey && a.state === 'pending');
  if (!attempt) die(`FAIL: no pending attempt for ${ledgerKey} in ${LEDGER_FILE}.`);
  if (outcome === 'settled') {
    let tx = flag('tx');
    // Some wallets (Bankr CLI included) never surface the settlement tx.
    // Discover it from the USDC Transfer that matches the attempt exactly.
    if (!tx && /^0x[0-9a-fA-F]{40}$/.test(String(flag('from')))) {
      const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
      const latest = Number(await rpc('eth_blockNumber', []));
      const pad = (addr) => `0x${'0'.repeat(24)}${addr.slice(2).toLowerCase()}`;
      const logs = await rpc('eth_getLogs', [{
        address: pinned.asset,
        fromBlock: `0x${Math.max(0, latest - 3000).toString(16)}`,
        toBlock: 'latest',
        topics: [TRANSFER, pad(flag('from')), pad(attempt.payTo)],
      }]);
      const hit = (logs || []).find((l) => BigInt(l.data) === BigInt(attempt.amount));
      if (!hit) die(`FAIL: no recent USDC transfer of ${attempt.amount} atomic from ${flag('from')} to ${attempt.payTo} found on Base - treat as unsettled, do NOT re-pay; retry later or pass --tx.`);
      tx = hit.transactionHash;
      console.log(`Discovered settlement tx ${tx}.`);
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(String(tx))) die('FAIL: reconcile settled requires --tx <hash> or --from <your wallet>.', 2);
    const receipt = await rpc('eth_getTransactionReceipt', [tx]);
    if (!receipt) die(`FAIL: tx ${tx} not found on Base - treat as unsettled, do NOT re-pay; retry reconcile later.`);
    if (receipt.status !== '0x1') die(`FAIL: tx ${tx} reverted - do NOT re-pay; investigate with the user.`);
    // ERC-20 Transfer(from,to,value) from the pinned USDC contract, to == the
    // attempt's payTo, value == the attempt's exact amount.
    const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    const hit = (receipt.logs || []).find(
      (l) =>
        eq(l.address, pinned.asset) &&
        l.topics?.[0] === TRANSFER &&
        eq(`0x${l.topics[2].slice(26)}`, attempt.payTo) &&
        BigInt(l.data) === BigInt(attempt.amount),
    );
    if (!hit)
      die(`FAIL: tx ${tx} has no USDC transfer of ${attempt.amount} atomic to ${attempt.payTo} - do not report success; escalate to the user.`);
    attempt.tx = tx;
  }
  attempt.state = outcome;
  saveLedger(ledger);
  console.log(
    outcome === 'settled'
      ? `SETTLEMENT VERIFIED: ${attempt.amount} atomic USDC to ${attempt.payTo} in ${attempt.tx}. Attempt closed.`
      : `Attempt for ${ledgerKey} closed as ${outcome}${outcome === 'failed' ? ' (its budget is released)' : ''}.`,
  );
  process.exit(0);
}

// ---- verify mode.
const failures = [];
const fail = (msg) => failures.push(msg);

let headerB64 = flag('header');
if (!headerB64) {
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 200) {
    console.log('NO PAYMENT REQUIRED: 200 OK (free piece, MISS, or this wallet is already entitled).');
    process.exit(0);
  }
  if (res.status !== 402) die(`FAIL: expected 402, got ${res.status}.`);
  headerB64 = res.headers.get('payment-required');
  if (!headerB64) die('FAIL: 402 without a PAYMENT-REQUIRED header.');
}

let challenge;
try {
  challenge = JSON.parse(Buffer.from(headerB64, 'base64').toString('utf8'));
} catch {
  die('FAIL: PAYMENT-REQUIRED header is not base64-encoded JSON.');
}
const a = challenge.accepts?.[0];
if (!a) die('FAIL: challenge has no accepts[0].');

// Downgrade guard: Tenjin serves exactly one direct-eip3009 accepts entry.
// Extra entries or extra fields (permit2 spender, facilitator address, ...)
// could steer a multi-scheme wallet into a spender-mediated flow whose payee
// these checks never see - reject the whole challenge instead.
if (challenge.accepts.length !== 1)
  fail(`challenge carries ${challenge.accepts.length} accepts entries - Tenjin serves exactly one; a wallet could pick an unvetted entry`);
const unknownExtra = Object.keys(a.extra || {}).filter((k) => !['name', 'version'].includes(k));
if (unknownExtra.length)
  fail(`accepts[0].extra carries unexpected fields (${unknownExtra.join(', ')}) - only the EIP-712 domain {name, version} belongs there; spender/facilitator fields signal a non-eip3009 flow`);

if (a.scheme !== policy.requireScheme) fail(`scheme ${a.scheme} != ${policy.requireScheme}`);
if (a.network !== pinned.network) fail(`network ${a.network} != ${pinned.network} (Base mainnet)`);
if (!eq(a.asset, pinned.asset)) fail(`asset ${a.asset} != pinned Base USDC ${pinned.asset} - never sign for any other token`);
if (a.extra?.name !== pinned.assetName || a.extra?.version !== pinned.assetVersion)
  fail(`asset extra ${JSON.stringify(a.extra)} != pinned {name:${pinned.assetName}, version:${pinned.assetVersion}}`);
if (!/^\d+$/.test(String(a.amount)) || BigInt(a.amount) > BigInt(policy.limits.maxAmountAtomic))
  fail(`amount ${a.amount} exceeds cap ${policy.limits.maxAmountAtomic} atomic`);
if (Number(a.maxTimeoutSeconds) > policy.limits.maxValiditySeconds)
  fail(`maxTimeoutSeconds ${a.maxTimeoutSeconds} > ${policy.limits.maxValiditySeconds}`);
if (!/^0x[0-9a-fA-F]{40}$/.test(String(a.payTo))) fail(`payTo ${a.payTo} is not an address`);

let payeeClass = '';
if (failures.length === 0 && isAnswer) {
  if (eq(a.payTo, pinned.treasury)) payeeClass = 'pinned Tenjin treasury';
  else fail(`payTo ${a.payTo} != pinned treasury ${pinned.treasury}`);
}
if (failures.length === 0 && isRead) {
  const code = await rpc('eth_getCode', [a.payTo, 'latest']);
  if (!code || code === '0x') fail(`payTo ${a.payTo} has no contract code on Base (EOA or undeployed) - reject`);
  else if (!eq(code, payees.read.runtimeBytecode))
    fail(`payTo ${a.payTo} code is not the 0xSplits PushSplit proxy every Tenjin split shares - reject`);
  else payeeClass = 'creator split (verified 0xSplits proxy bytecode)';
}

if (failures.length > 0) {
  console.error('FAIL - do not sign:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

// Double-payment guard: an open or completed attempt on this key means signing
// again is never the next step.
const ledger = loadLedger();
const prior = ledger.attempts.findLast((x) => x.key === ledgerKey && x.state !== 'failed');
if (prior) {
  die(
    prior.state === 'pending'
      ? `FAIL: a pending payment attempt for ${ledgerKey} already exists (${prior.ts}). Reconcile it first (verify-402.mjs <url> reconcile settled --tx <hash> | failed | entitled) - never sign a second authorization for the same purchase.`
      : `FAIL: this purchase was already ${prior.state} (${prior.ts}${prior.tx ? `, tx ${prior.tx}` : ''}). Re-collect free with SIGN-IN-WITH-X - never pay twice. (Different product at the same url? Pass --key <id>.)`,
  );
}

const today = new Date().toISOString().slice(0, 10);
const spentToday = ledger.attempts
  .filter((x) => x.state !== 'failed' && x.ts.slice(0, 10) === today)
  .reduce((s, x) => s + BigInt(x.amount), 0n);

ledger.attempts.push({
  key: ledgerKey,
  url,
  amount: String(a.amount),
  payTo: a.payTo,
  state: 'pending',
  ts: new Date().toISOString(),
});
saveLedger(ledger);

const usd = (Number(a.amount) / 1e6).toFixed(Number(a.amount) % 10000 === 0 ? 2 : 6);
console.log('PASS - payment preview:');
console.log(`  endpoint : ${url}`);
console.log(`  network  : Base mainnet (${a.network})`);
console.log(`  asset    : USDC ${a.asset}`);
console.log(`  amount   : ${a.amount} atomic ($${usd})`);
console.log(`  payTo    : ${a.payTo} (${payeeClass})`);
console.log(`  validity : authorization expires <=${a.maxTimeoutSeconds}s after signing`);
console.log(`  today    : ${spentToday} atomic USDC already attempted on Tenjin before this call`);
console.log(`Pay with your wallet's own confirmation flow, capped at this exact price (Bankr: bankr x402 call '${url}' --max-payment ${usd} - never pass -y/--ni unless the user explicitly asked for autopay).`);
console.log(`Then close the loop: verify-402.mjs '${url}' reconcile settled --tx <hash> (or failed | entitled).`);
