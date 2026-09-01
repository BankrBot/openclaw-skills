#!/usr/bin/env node
/**
 * snapshot-vote.mjs — Cast a vote on a Snapshot proposal via Bankr signing.
 *
 * Usage:
 *   node snapshot-vote.mjs --space "ens.eth" \
 *     --proposal "0xabc..." \
 *     --choice 1 \
 *     --type "single-choice" \
 *     [--reason "My rationale"] \
 *     [--from "0xYOUR_ADDRESS"]
 *
 * Choice format by voting type:
 *   single-choice / basic : integer (1-indexed)
 *   approval              : JSON array of ints, e.g. [1,3]
 *   ranked-choice         : JSON array of ints in rank order, e.g. [2,1,3]
 *   weighted / quadratic  : JSON object, e.g. {"1":60,"2":40}
 *
 * Signs via `bankr wallet sign` (no private key needed).
 * Submits the signed envelope to the Snapshot sequencer.
 *
 * NOTE: Bankr's default API key may have trusted-recipient restrictions that
 * block EIP-712 typed-data signing for non-transaction messages. If signing
 * fails with a 403 error, configure an unrestricted Bankr API key in
 * ~/.bankr/config.json before running this script.
 */
import { execSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const SEQUENCER = process.env.SNAPSHOT_SEQUENCER || 'https://seq.snapshot.org';
const DOMAIN = { name: 'snapshot', version: '0.1.4' };

const { values: args } = parseArgs({
  options: {
    space:    { type: 'string' },
    proposal: { type: 'string' },
    choice:   { type: 'string' },
    type:     { type: 'string', default: 'single-choice' },
    reason:   { type: 'string', default: '' },
    from:     { type: 'string', default: '' },
    app:      { type: 'string', default: 'openclaw-snapshot' },
  },
  strict: true,
});

if (!args.space || !args.proposal || !args.choice) {
  console.error('Missing required args: --space, --proposal, --choice');
  process.exit(1);
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

// Parse choice based on type
let choice;
const t = args.type;
if (t === 'single-choice' || t === 'basic') {
  choice = parseInt(args.choice, 10);
} else {
  choice = JSON.parse(args.choice);
}

// Build EIP-712 message
const timestamp = Math.floor(Date.now() / 1000);
const message = {
  from: address,
  space: args.space,
  timestamp,
  proposal: args.proposal,
  choice,
  reason: args.reason,
  app: args.app,
  metadata: '{}',
};

// Determine the correct EIP-712 types based on voting type
let voteTypes;
if (t === 'single-choice' || t === 'basic') {
  voteTypes = {
    Vote: [
      { name: 'from', type: 'string' },
      { name: 'space', type: 'string' },
      { name: 'timestamp', type: 'uint64' },
      { name: 'proposal', type: 'string' },
      { name: 'choice', type: 'uint32' },
      { name: 'reason', type: 'string' },
      { name: 'app', type: 'string' },
      { name: 'metadata', type: 'string' },
    ]
  };
} else if (['approval', 'ranked-choice'].includes(t)) {
  voteTypes = {
    Vote: [
      { name: 'from', type: 'string' },
      { name: 'space', type: 'string' },
      { name: 'timestamp', type: 'uint64' },
      { name: 'proposal', type: 'string' },
      { name: 'choice', type: 'uint32[]' },
      { name: 'reason', type: 'string' },
      { name: 'app', type: 'string' },
      { name: 'metadata', type: 'string' },
    ]
  };
} else {
  // weighted, quadratic — choice is stringified JSON
  message.choice = JSON.stringify(choice);
  voteTypes = {
    Vote: [
      { name: 'from', type: 'string' },
      { name: 'space', type: 'string' },
      { name: 'timestamp', type: 'uint64' },
      { name: 'proposal', type: 'string' },
      { name: 'choice', type: 'string' },
      { name: 'reason', type: 'string' },
      { name: 'app', type: 'string' },
      { name: 'metadata', type: 'string' },
    ]
  };
}

// Build the full EIP-712 typed data for bankr signing
const typedData = {
  domain: DOMAIN,
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
    ],
    ...voteTypes,
  },
  primaryType: 'Vote',
  message,
};

console.log(`Voting on proposal ${args.proposal} in space ${args.space}`);
console.log(`Voter: ${address} | Type: ${args.type} | Choice: ${JSON.stringify(choice)}`);

// Sign with Bankr
const sig = signWithBankr(typedData);
console.log('Signed successfully');

// Submit to Snapshot sequencer
const envelope = {
  address,
  sig,
  data: { domain: DOMAIN, types: voteTypes, message },
};

const res = await fetch(SEQUENCER, {
  method: 'POST',
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  body: JSON.stringify(envelope),
  signal: AbortSignal.timeout(30000),
});
const body = await res.json();
if (!res.ok) {
  console.error('Sequencer rejected vote:', JSON.stringify(body, null, 2));
  process.exit(1);
}
console.log('Vote submitted successfully!');
console.log(JSON.stringify(body, null, 2));

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
