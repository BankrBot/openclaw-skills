#!/usr/bin/env node
// Deterministic SIWX (CAIP-122 / EIP-4361) handling for Tenjin: builds and
// validates the message, assembles the header, and sends the request - the
// personal_sign itself stays in your wallet. Bearer-credential hygiene is
// enforced by construction: the signature enters via stdin only (never argv,
// env, or files), is sent only to https://tenjin.blog, and is never printed
// or persisted; the pending-context file stores public fields only.
//
// Usage:
//   siwx.mjs message <url> --address <0x>        server-issued flow (free
//     re-reads): fetch the 402, validate its sign-in-with-x info against the
//     pins, write the exact message to a file, print the sign command
//   siwx.mjs message <url> --address <0x> --mint client-minted flow (publish
//     and account routes per https://tenjin.blog/skills.md: fresh nonce,
//     24h expiry)
//   siwx.mjs send <url> [-X <method>] [-d <json>] < signature-on-stdin
//     assemble the header from the saved context and call the url
//
// Message formatting and header encoding come from the official
// @x402/extensions package - the same code Tenjin's server verifies against.
// One-time setup: npm install --prefix scripts (from the skill root).
// Env overrides: TENJIN_SIWX_DIR. Exit: 0 ok, 1 validation/request fail, 2 usage.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';

let createSIWxMessage, encodeSIWxHeader, getAddress;
try {
  ({ createSIWxMessage, encodeSIWxHeader } = await import('@x402/extensions/sign-in-with-x'));
  ({ getAddress } = await import('viem'));
} catch {
  console.error('FAIL: @x402/extensions not installed - run `npm install --prefix scripts` once from the skill root.');
  process.exit(2);
}

const ORIGIN = 'https://tenjin.blog';
const CHAIN = 'eip155:8453';
const STATE_DIR = process.env.TENJIN_SIWX_DIR || join(homedir(), '.config', 'tenjin', 'siwx');

const [cmd, url] = process.argv.slice(2);
const argv = process.argv.slice(4);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const has = (name) => argv.includes(`--${name}`);
const die = (msg, code = 1) => {
  console.error(msg);
  process.exit(code);
};

if (!['message', 'send'].includes(cmd) || !url) die('usage: siwx.mjs message <url> --address <0x> [--mint] | siwx.mjs send <url> [-X <method>] [-d <json>]', 2);
let parsed;
try {
  parsed = new URL(url);
} catch {
  die(`FAIL: not a valid URL: ${url}`);
}
if (parsed.origin !== ORIGIN) die(`FAIL: origin ${parsed.origin} != ${ORIGIN} - SIWX signatures never leave this origin.`);

const ctxFile = join(STATE_DIR, `${Buffer.from(url).toString('base64url')}.json`);

if (cmd === 'message') {
  if (!/^0x[0-9a-fA-F]{40}$/.test(String(flag('address')))) die('FAIL: --address <0x...> (your wallet) is required.', 2);
  let address;
  try {
    address = getAddress(flag('address'));
  } catch {
    die('FAIL: --address has a bad EIP-55 checksum - pass it all-lowercase or correctly checksummed.', 2);
  }

  let info;
  if (has('mint')) {
    // Client-minted flow (skills.md recipe): the values are ours, nothing
    // remote to distrust.
    info = {
      domain: 'tenjin.blog',
      uri: ORIGIN,
      version: '1',
      chainId: CHAIN,
      type: 'eip191',
      nonce: randomUUID().replace(/-/g, ''),
      issuedAt: new Date().toISOString(),
      expirationTime: new Date(Date.now() + 86_400_000).toISOString(),
      statement: 'Sign in to Tenjin.',
    };
  } else {
    // Server-issued flow: the 402's advertised info is REMOTE DATA - validate
    // every field against the pins before letting a wallet sign it.
    const res = await fetch(url, { headers: { accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (res.status !== 402) die(`FAIL: expected 402 with a sign-in-with-x extension, got ${res.status}.`);
    const header = res.headers.get('payment-required');
    let ext;
    try {
      ext = JSON.parse(Buffer.from(header, 'base64').toString('utf8')).extensions?.['sign-in-with-x'];
    } catch {
      die('FAIL: unreadable PAYMENT-REQUIRED header.');
    }
    if (!ext?.info) die('FAIL: this 402 advertises no sign-in-with-x extension.');
    // chainId lives in supportedChains, not info; pin it to the one chain we
    // accept (validated below) before building the message.
    info = { ...ext.info, chainId: CHAIN, type: 'eip191' };
    const bad = [];
    if (info.domain !== 'tenjin.blog') bad.push(`domain ${info.domain} != tenjin.blog`);
    if (info.uri !== url) bad.push(`uri ${info.uri} != the url you requested`);
    if (!(ext.supportedChains || []).some((c) => c.chainId === CHAIN && c.type === 'eip191')) bad.push(`no ${CHAIN}/eip191 in supportedChains`);
    if (!/^[0-9a-zA-Z]{8,}$/.test(String(info.nonce))) bad.push(`nonce missing or malformed`);
    if (Math.abs(Date.now() - Date.parse(info.issuedAt)) > 600_000) bad.push(`issuedAt ${info.issuedAt} is not fresh (>10min skew)`);
    for (const r of info.resources || []) if (!String(r).startsWith(`${ORIGIN}/`)) bad.push(`resource ${r} outside ${ORIGIN}`);
    if (/[\r\n]/.test(String(info.statement || ''))) bad.push('statement contains line breaks (structure injection)');
    if (bad.length) die(`FAIL - do not sign:\n${bad.map((b) => `  - ${b}`).join('\n')}`);
  }

  const message = createSIWxMessage(info, address);
  mkdirSync(STATE_DIR, { recursive: true });
  const msgFile = join(STATE_DIR, 'message.txt');
  writeFileSync(msgFile, message);
  writeFileSync(ctxFile, JSON.stringify({ info, address }, null, 2));
  console.log('Validated. Show the user this exact message before signing:\n');
  console.log(message.split('\n').map((l) => `  | ${l}`).join('\n'));
  console.log(`\nAfter the user confirms, sign and send in ONE pipeline (signing costs nothing and moves no funds; the pipe keeps the signature out of logs and argv):`);
  console.log(`  bankr wallet sign --type personal_sign --message "$(cat '${msgFile}')" | awk '/Signature:/{print $2}' | node scripts/siwx.mjs send '${url}'${parsed.pathname === '/api/answer' ? " -X POST -d '<same question body>'" : ''}`);
} else {
  let ctx;
  try {
    ctx = JSON.parse(readFileSync(ctxFile, 'utf8'));
  } catch {
    die(`FAIL: no pending SIWX context for ${url} - run siwx.mjs message first.`);
  }
  const signature = readFileSync(0, 'utf8').trim();
  if (!/^0x[0-9a-fA-F]{130,}$/.test(signature)) die('FAIL: stdin did not contain a hex signature.');
  const headerValue = encodeSIWxHeader({ ...ctx.info, address: ctx.address, signatureScheme: 'eip191', signature });
  const methodAt = argv.indexOf('-X');
  const dataAt = argv.indexOf('-d');
  const body = dataAt >= 0 ? argv[dataAt + 1] : undefined;
  const res = await fetch(url, {
    method: methodAt >= 0 ? argv[methodAt + 1] : 'GET',
    headers: {
      accept: 'application/json',
      'sign-in-with-x': headerValue,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body,
    redirect: 'error',
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  rmSync(ctxFile, { force: true }); // single-use: the server burns the nonce either way
  console.log(`HTTP ${res.status}`);
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2));
  } catch {
    console.log(text);
  }
  if (res.status === 401) console.error('401: nonce burned or proof stale - mint a FRESH message and re-sign; never resend the same header.');
  process.exit(res.ok ? 0 : 1);
}
