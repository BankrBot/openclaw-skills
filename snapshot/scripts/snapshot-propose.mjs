#!/usr/bin/env node
/**
 * snapshot-propose.mjs — Create a proposal on Snapshot via Bankr signing.
 *
 * Usage:
 *   node snapshot-propose.mjs --space "your-space.eth" \
 *     --title "Proposal Title" \
 *     --body "Proposal body (markdown)" \
 *     --choices '["For","Against","Abstain"]' \
 *     --type "basic" \
 *     --start 1700000000 \
 *     --end 1700600000 \
 *     [--snapshot 12345678] \
 *     [--from "0xYOUR_ADDRESS"] \
 *     [--network "1"] \
 *     [--body-file /path/to/body.md]
 *
 * Signs via `bankr wallet sign` (no private key needed).
 * Submits the signed envelope to the Snapshot sequencer.
 *
 * NOTE: Bankr's default API key may have trusted-recipient restrictions that
 * block EIP-712 typed-data signing for non-transaction messages. If signing
 * fails with a 403 error, configure an unrestricted Bankr API key in
 * ~/.bankr/config.json before running this script.
 *
 * TIP: For long proposal bodies, use --body-file to read from a file instead
 * of passing markdown on the command line (avoids shell escaping issues).
 *
 * Voting types: single-choice, basic, approval, weighted, quadratic, ranked-choice
 */
import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const SEQUENCER = process.env.SNAPSHOT_SEQUENCER || 'https://seq.snapshot.org';
const DOMAIN = { name: 'snapshot', version: '0.1.4' };

const { values: args } = parseArgs({
  options: {
    space:      { type: 'string' },
    title:      { type: 'string' },
    body:       { type: 'string', default: '' },
    'body-file': { type: 'string', default: '' },
    choices:    { type: 'string' },
    type:       { type: 'string', default: 'basic' },
    start:      { type: 'string', default: '' },
    end:        { type: 'string', default: '' },
    snapshot:   { type: 'string', default: '' },
    discussion: { type: 'string', default: '' },
    from:       { type: 'string', default: '' },
    app:        { type: 'string', default: 'openclaw-snapshot' },
    network:    { type: 'string', default: '1' },
  },
  strict: true,
});

if (!args.space || !args.title || !args.choices) {
  console.error('Missing required args: --space, --title, --choices');
  process.exit(1);
}

// Read body from file if --body-file provided (preferred for long markdown)
let bodyText = args.body;
if (args['body-file']) {
  bodyText = readFileSync(args['body-file'], 'utf8');
}

// Resolve signer address from Bankr if not provided
let address = args.from;
if (!address) {
  const whoami = execSync('bankr whoami 2>&1', { encoding: 'utf8' });
  const match = whoami.match(/\b0x[0-9a-fA-F]{40}\b/);
  if (!match) { console.error('Could not get address from bankr whoami'); process.exit(1); }
  address = match[0];
}
address = toChecksumAddress(address);

const choices = JSON.parse(args.choices);
const now = Math.floor(Date.now() / 1000);

// If no snapshot block provided, fetch via public RPC
let snapshotBlock = args.snapshot ? parseInt(args.snapshot, 10) : 0;
if (!snapshotBlock) {
  try {
    const rpcUrl = args.network === '8453'
      ? 'https://mainnet.base.org'
      : 'https://cloudflare-eth.com';
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
    });
    const data = await res.json();
    snapshotBlock = parseInt(data.result, 16);
    console.log(`Auto-fetched snapshot block: ${snapshotBlock}`);
  } catch {
    console.error('Could not auto-fetch block number. Provide --snapshot manually.');
    process.exit(1);
  }
}

const start = args.start ? parseInt(args.start, 10) : now;
const end = args.end ? parseInt(args.end, 10) : now + 7 * 24 * 3600;

if (start >= end) {
  console.error('Error: --start must be before --end (start=' + start + ', end=' + end + ')');
  process.exit(1);
}

// Build EIP-712 message
const timestamp = Math.floor(Date.now() / 1000);
const message = {
  from: address,
  space: args.space,
  timestamp,
  type: args.type,
  title: args.title,
  body: bodyText,
  discussion: args.discussion,
  choices,
  labels: [],
  start,
  end,
  snapshot: snapshotBlock,
  plugins: JSON.stringify({}),
  privacy: '',
  app: args.app,
};

const proposalTypes = {
  Proposal: [
    { name: 'from', type: 'string' },
    { name: 'space', type: 'string' },
    { name: 'timestamp', type: 'uint64' },
    { name: 'type', type: 'string' },
    { name: 'title', type: 'string' },
    { name: 'body', type: 'string' },
    { name: 'discussion', type: 'string' },
    { name: 'choices', type: 'string[]' },
    { name: 'labels', type: 'string[]' },
    { name: 'start', type: 'uint64' },
    { name: 'end', type: 'uint64' },
    { name: 'snapshot', type: 'uint64' },
    { name: 'plugins', type: 'string' },
    { name: 'privacy', type: 'string' },
    { name: 'app', type: 'string' },
  ]
};

// Build the full EIP-712 typed data for bankr signing
const typedData = {
  domain: DOMAIN,
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
    ],
    ...proposalTypes,
  },
  primaryType: 'Proposal',
  message,
};

console.log(`Creating proposal in ${args.space}`);
console.log(`Author: ${address}`);
console.log(`Title: ${args.title}`);
console.log(`Choices: ${JSON.stringify(choices)}`);
console.log(`Type: ${args.type} | Start: ${new Date(start * 1000).toISOString()} | End: ${new Date(end * 1000).toISOString()}`);

// Sign with Bankr
const sig = signWithBankr(typedData);
console.log('Signed successfully');

// Submit to Snapshot sequencer
const envelope = {
  address,
  sig,
  data: { domain: DOMAIN, types: proposalTypes, message },
};

const res = await fetch(SEQUENCER, {
  method: 'POST',
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  body: JSON.stringify(envelope),
  signal: AbortSignal.timeout(30000),
});
const resBody = await res.json();
if (!res.ok) {
  console.error('Sequencer rejected proposal:', JSON.stringify(resBody, null, 2));
  process.exit(1);
}
console.log('Proposal created successfully!');
console.log(JSON.stringify(resBody, null, 2));

// ── Helpers ──

/**
 * Sign EIP-712 typed data via bankr wallet sign.
 * Writes typed data to a unique temp file and invokes bankr via a bash wrapper
 * to avoid shell escaping issues with complex JSON payloads.
 * Cleans up temp files in a finally block and on process signals.
 */
function signWithBankr(typedData) {
  const id = randomUUID();
  const tmpData = `/tmp/snapshot-typed-data-${id}.json`;
  const tmpScript = `/tmp/bankr-sign-${id}.sh`;

  function cleanup() {
    rmSync(tmpData, { force: true });
    rmSync(tmpScript, { force: true });
  }

  // Register signal handlers so cleanup runs even if interrupted
  const signals = ['SIGINT', 'SIGTERM'];
  const sigHandlers = {};
  for (const sig of signals) {
    sigHandlers[sig] = () => { cleanup(); process.exit(1); };
    process.once(sig, sigHandlers[sig]);
  }
  process.once('exit', cleanup);

  try {
    writeFileSync(tmpData, JSON.stringify(typedData));
    writeFileSync(tmpScript, [
      '#!/bin/bash',
      `TD=$(cat ${tmpData})`,
      'bankr wallet sign --type eth_signTypedData_v4 --typed-data "$TD"',
    ].join('\n') + '\n');
    execSync(`chmod +x ${tmpScript}`);
    const output = execSync(tmpScript, { encoding: 'utf8', timeout: 30000 });
    const match = output.match(/0x[0-9a-fA-F]{130}/);
    if (!match) {
      console.error('Could not extract signature from bankr output:', output);
      process.exit(1);
    }
    return match[0];
  } finally {
    cleanup();
    // Remove signal handlers to avoid leaks
    for (const sig of signals) {
      process.removeListener(sig, sigHandlers[sig]);
    }
    process.removeListener('exit', cleanup);
  }
}

/** EIP-55 checksum address. Uses @ethersproject/address if available. */
function toChecksumAddress(addr) {
  try {
    const { getAddress } = require('@ethersproject/address');
    return getAddress(addr);
  } catch {
    console.warn('Warning: @ethersproject/address not found, using lowercase address.');
    console.warn('Install it: npm i @ethersproject/address');
    return addr.toLowerCase();
  }
}
