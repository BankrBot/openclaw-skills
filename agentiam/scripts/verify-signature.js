// verify-signature.js — reference signature verification for AgentIAM responses.
//
// Every AgentIAM response carries a `proof.signature` field. This script shows
// how a consuming agent verifies the signature against the canonical signer wallet.
//
// Usage:
//   node scripts/verify-signature.js < agentiam-response.json
//
// Dependencies (zero runtime install — both are npm-hash-verified):
//   npm install ethers
//
// Exit code:
//   0 = signature valid, signer matches canonical wallet
//   1 = signature invalid or signer mismatch — REJECT the response

'use strict';

const { ethers } = require('ethers');

// Canonical signer wallet. Any response signed by a different address must be rejected.
const CANONICAL_SIGNER = '0x069c6012E053DFBf50390B19FaE275aD96D22ed7';

function readStdin() {
  return new Promise((resolve, reject) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { buf += chunk; });
    process.stdin.on('end', () => resolve(buf));
    process.stdin.on('error', reject);
  });
}

function canonicalize(result) {
  // Deterministic JSON stringification — keys sorted, no whitespace. The
  // signer hashes this exact byte sequence before signing.
  const sortKeys = (v) => {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v && typeof v === 'object') {
      return Object.keys(v).sort().reduce((acc, k) => {
        acc[k] = sortKeys(v[k]);
        return acc;
      }, {});
    }
    return v;
  };
  return JSON.stringify(sortKeys(result));
}

(async () => {
  const raw = await readStdin();
  let resp;
  try {
    resp = JSON.parse(raw);
  } catch (e) {
    console.error('invalid JSON on stdin:', e.message);
    process.exit(1);
  }

  const { result, proof } = resp;
  if (!result || !proof || !proof.signature || !proof.signer) {
    console.error('missing result/proof/signature/signer');
    process.exit(1);
  }

  // 1. Reconstruct the signed message exactly as the signer produced it.
  const message = canonicalize(result);
  const digest = ethers.hashMessage(message); // EIP-191 personal_sign prefix

  // 2. Recover the signer address.
  const recovered = ethers.recoverAddress(digest, proof.signature);

  // 3. Compare to the claimed signer, then to the canonical signer.
  const claimed = ethers.getAddress(proof.signer);
  const canonical = ethers.getAddress(CANONICAL_SIGNER);
  const recoveredAddr = ethers.getAddress(recovered);

  if (recoveredAddr !== claimed) {
    console.error(`signature invalid: recovered ${recoveredAddr} != claimed ${claimed}`);
    process.exit(1);
  }
  if (recoveredAddr !== canonical) {
    console.error(`signer mismatch: recovered ${recoveredAddr} is not the canonical wallet ${canonical}`);
    console.error('REJECT this response.');
    process.exit(1);
  }

  console.log(`OK — response signed by canonical wallet ${canonical}`);
  process.exit(0);
})();
