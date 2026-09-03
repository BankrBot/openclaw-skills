#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const live = process.argv.includes('--live');
const skillRoot = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(await readFile(resolve(skillRoot, 'references/shared/deployment-manifest.json')));
const chainConfigRaw = await readFile(resolve(skillRoot, 'references/shared/chain-config.json'));
const sha256 = (value) => `sha256-${createHash('sha256').update(value).digest('base64')}`;
const keccak = (hex) => execFileSync(process.env.CAST_BIN || 'cast', ['keccak', hex], { encoding: 'utf8' }).trim().toLowerCase();

if (manifest.schemaVersion !== 1 || manifest.protocol !== 'juicebox-v6') throw new Error('invalid manifest identity');
if (sha256(chainConfigRaw) !== manifest.provenance.chainConfigIntegrity) throw new Error('chain-config integrity mismatch');
const relayr = manifest.externalServices?.relayr;
if (relayr?.origin !== 'https://api.relayr.ba5ed.com'
  || relayr?.paymentContract !== '0x1c05f7841379d4393574c0ffa17908ec40ffd97d'
  || relayr?.paymentFunction !== 'prepayment(bytes16,uint40)'
  || relayr?.paymentSelector !== '0x103903a7'
  || !/^0x[0-9a-f]{64}$/.test(relayr?.runtimeCodeHash || '')
  || relayr?.maxAuthorizationSeconds !== 1200
  || !Array.isArray(relayr?.paymentChainIds)) {
  throw new Error('invalid Relayr authority pins');
}

for (const [name, pin] of Object.entries(manifest.abis)) {
  const raw = await readFile(resolve(skillRoot, 'references/shared', pin.file));
  if (sha256(raw) !== pin.integrity) throw new Error(`${name}: ABI integrity mismatch`);
  if (new Set(pin.allowedWrites.map(({ selector }) => selector)).size !== pin.allowedWrites.length) {
    throw new Error(`${name}: duplicate write selector`);
  }
}

const liveChecks = [];

for (const [chainId, chain] of Object.entries(manifest.chains)) {
  for (const [name, pin] of Object.entries(chain.contracts)) {
    if (!/^0x[0-9a-f]{40}$/.test(pin.address)) throw new Error(`${chainId}/${name}: invalid address`);
    if (!/^0x[0-9a-f]{64}$/.test(pin.runtimeCodeHash)) throw new Error(`${chainId}/${name}: invalid code hash`);
    if (!pin.deploymentBlock || !/^0x[0-9a-f]{64}$/.test(pin.deploymentTransaction || '')) {
      throw new Error(`${chainId}/${name}: missing deployment provenance`);
    }
    if (pin.writeEnabled && (!pin.abi || !manifest.abis[pin.abi])) throw new Error(`${chainId}/${name}: write target lacks pinned ABI`);
    if (pin.proxy.kind === 'minimal-clone' && !pin.proxy.implementationAddress) {
      throw new Error(`${chainId}/${name}: clone implementation missing`);
    }
    if (!live || !pin.writeEnabled) continue;
    liveChecks.push(async () => {
      const rpc = chain.rpc;
      const code = await rpcCall(rpc, 'eth_getCode', [pin.address, 'latest']);
      if (!code || code === '0x') throw new Error(`${chainId}/${name}: no live code`);
      if (keccak(code) !== pin.runtimeCodeHash) throw new Error(`${chainId}/${name}: live code hash mismatch`);
    });
  }
}

if (live) {
  for (const chainId of relayr.paymentChainIds) {
    liveChecks.push(async () => {
      const code = await rpcCall(manifest.chains[String(chainId)].rpc, 'eth_getCode', [relayr.paymentContract, 'latest']);
      if (!code || code === '0x' || keccak(code) !== relayr.runtimeCodeHash) {
        throw new Error(`${chainId}/Relayr payment contract: live code hash mismatch`);
      }
    });
  }
  let cursor = 0;
  const workers = Array.from({ length: Math.min(4, liveChecks.length) }, async () => {
    while (cursor < liveChecks.length) await liveChecks[cursor++]();
  });
  await Promise.all(workers);
}

console.log(`reviewed manifest verified${live ? ' against live RPCs' : ''}`);

async function rpcCall(url, method, params) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'juicebox-v6-manifest-review/1' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    if (response.ok) {
      const body = await response.json();
      if (body.error) throw new Error(`${method}: ${body.error.message}`);
      return body.result;
    }
    if (![403, 429, 503].includes(response.status) || attempt === 5) {
      throw new Error(`${method}: HTTP ${response.status} from ${url}`);
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 500));
  }
}
