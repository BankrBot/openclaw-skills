#!/usr/bin/env node
/**
 * Register an fname (Farcaster username) for your FID with the Farcaster fname registry.
 * This must be done BEFORE Neynar PATCH user with "username" will work ("fname is not registered for fid").
 *
 * Flow:
 * 1. Sign a username proof claim with your custody wallet.
 * 2. POST to https://fnames.farcaster.xyz/transfers to register the name to your FID.
 * 3. Optionally call Neynar PATCH user with username (and bio, pfp, etc.).
 *
 * Usage:
 *   CUSTODY_MNEMONIC="..." FID=2559835 FNAME=myclawbot node register-fname.js
 *   Then (optional): NEYNAR_API_KEY=... SIGNER_UUID=... FNAME=myclawbot node set-fname-and-profile.js
 */

const { makeUserNameProofClaim } = require('@farcaster/core');
const { ViemLocalEip712Signer } = require('@farcaster/hub-nodejs');
const { bytesToHex } = require('viem');
const { mnemonicToAccount } = require('viem/accounts');

const FNAME_REGISTRY_URL = 'https://fnames.farcaster.xyz/transfers';

function getEnv(name) {
  const v = process.env[name];
  if (!v || !v.trim()) return undefined;
  return v.trim();
}

async function main() {
  const mnemonic = getEnv('CUSTODY_MNEMONIC');
  const fidStr = getEnv('FID');
  const fname = getEnv('FNAME');
  if (!mnemonic || !fidStr || !fname) {
    console.error('Set CUSTODY_MNEMONIC, FID, and FNAME (the username you want, e.g. myclawbot).');
    process.exit(1);
  }
  const fid = parseInt(fidStr, 10);
  if (!Number.isInteger(fid) || fid <= 0) {
    console.error('FID must be a positive integer.');
    process.exit(1);
  }

  const account = mnemonicToAccount(mnemonic.trim());
  const owner = account.address;
  const timestamp = Math.floor(Date.now() / 1000);

  const claim = makeUserNameProofClaim({
    name: fname,
    owner: owner,
    timestamp,
  });
  const signer = new ViemLocalEip712Signer(account);
  const sigResult = await signer.signUserNameProofClaim(claim);
  if (!sigResult.isOk()) {
    throw new Error('signUserNameProofClaim failed: ' + (sigResult.error?.message || String(sigResult.error)));
  }
  const signature = bytesToHex(sigResult.value);

  const body = {
    name: fname,
    from: 0,
    to: fid,
    fid,
    owner,
    timestamp,
    signature,
  };

  const res = await fetch(FNAME_REGISTRY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`fname registry failed ${res.status}: ${text}`);
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  console.log('Fname registered with registry:', data);
  console.log('\nNext: set it on your profile via Neynar (so it shows on Warpcast):');
  console.log('  NEYNAR_API_KEY=... SIGNER_UUID=... FNAME=' + fname + ' node set-fname-and-profile.js');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
