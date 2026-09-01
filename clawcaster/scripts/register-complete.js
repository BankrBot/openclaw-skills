/**
 * Complete Clawcaster registration: step 1 (get FID) + sign with custody wallet + step 2 (register).
 *
 * Prerequisites:
 *   - Clawcaster API running (local: npm run dev, or use CLAWCASTER_URL for deployed).
 *   - CUSTODY_MNEMONIC: 24-word mnemonic for the custody wallet (this wallet will own the Farcaster account).
 *
 * Usage:
 *   cd scripts/register-step2 && npm install && CUSTODY_MNEMONIC="word1 word2 ..." node register-complete.js
 *   CLAWCASTER_URL=https://clawcaster.com/api CUSTODY_MNEMONIC="..." node register-complete.js
 */

const { ID_REGISTRY_ADDRESS, ViemLocalEip712Signer, idRegistryABI } = require('@farcaster/hub-nodejs');
const { bytesToHex, createPublicClient, http } = require('viem');
const { mnemonicToAccount } = require('viem/accounts');
const { optimism } = require('viem/chains');

const BASE_URL = process.env.CLAWCASTER_URL || 'https://clawcaster.com/api';

async function step1(custodyAddress) {
  const res = await fetch(`${BASE_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ custody_address: custodyAddress }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Step 1 failed ${res.status}: ${t}`);
  }
  return res.json();
}

async function step2(custodyAddress, fid, signature, deadline) {
  const res = await fetch(`${BASE_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      custody_address: custodyAddress,
      fid,
      signature,
      deadline,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Step 2 failed ${res.status}: ${t}`);
  }
  return res.json();
}

async function main() {
  const mnemonic = process.env.CUSTODY_MNEMONIC;
  if (!mnemonic || !mnemonic.trim()) {
    console.error('Set CUSTODY_MNEMONIC (24 words). This wallet will own the Farcaster account.');
    process.exit(1);
  }
  const trimmed = mnemonic.trim();
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount !== 24) {
    console.error(`CUSTODY_MNEMONIC must be 24 words (got ${wordCount}).`);
    process.exit(1);
  }

  const account = mnemonicToAccount(trimmed);
  const custodyAddress = account.address;
  console.log('Custody address:', custodyAddress);
  console.log('Clawcaster URL:', BASE_URL);

  // Step 1: get FID + deadline from Clawcaster
  console.log('\nStep 1: Fetching FID from Clawcaster...');
  const step1Result = await step1(custodyAddress);
  const fid = step1Result.fid;
  const deadline = step1Result.deadline;
  if (fid == null || deadline == null) {
    console.error('Step 1 did not return fid/deadline:', step1Result);
    process.exit(1);
  }
  console.log('fid:', fid, 'deadline:', deadline);

  // Get nonce from Id Registry on Optimism
  const publicClient = createPublicClient({
    chain: optimism,
    transport: http(),
  });
  const nonce = await publicClient.readContract({
    address: ID_REGISTRY_ADDRESS,
    abi: idRegistryABI,
    functionName: 'nonces',
    args: [custodyAddress],
  });

  // Sign transfer (fid, to, nonce, deadline)
  const signer = new ViemLocalEip712Signer(account);
  const sigResult = await signer.signTransfer({
    fid: BigInt(fid),
    to: custodyAddress,
    nonce,
    deadline: BigInt(deadline),
  });
  if (!sigResult.isOk()) {
    throw new Error('signTransfer failed: ' + (sigResult.error?.message || String(sigResult.error)));
  }
  const signatureHex = bytesToHex(sigResult.value);

  // Step 2: complete registration via Clawcaster
  console.log('\nStep 2: Registering account with Clawcaster...');
  const step2Result = await step2(custodyAddress, fid, signatureHex, deadline);
  console.log('\nRegistration result:');
  console.log(JSON.stringify(step2Result, null, 2));
  console.log('\nDone. Store the signer (private_key or signer_uuid) securely.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
