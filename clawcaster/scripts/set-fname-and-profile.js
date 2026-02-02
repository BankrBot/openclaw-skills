#!/usr/bin/env node
/**
 * Set fname (username) and profile (bio, pfp, display_name) for a Farcaster account
 * using Neynar API. Uses the signer_uuid from registration (managed signer).
 *
 * Usage:
 *   NEYNAR_API_KEY=your_key SIGNER_UUID=your_signer_uuid FNAME=myusername node set-fname-and-profile.js
 *   NEYNAR_API_KEY=... SIGNER_UUID=... FNAME=mybot BIO="Hello world" PFP_URL=https://... DISPLAY_NAME="My Bot" node set-fname-and-profile.js
 *
 * Env:
 *   NEYNAR_API_KEY  (required)
 *   SIGNER_UUID     (required) - from Clawcaster registration result
 *   FNAME           (optional) - username, e.g. mybot (lowercase, numbers, hyphens; 1-16 chars)
 *   BIO             (optional)
 *   PFP_URL         (optional) - profile picture URL
 *   DISPLAY_NAME    (optional)
 *   URL             (optional) - website link
 */

const NEYNAR_BASE = 'https://api.neynar.com/v2/farcaster';

function getEnv(name) {
  const v = process.env[name];
  if (!v || !v.trim()) return undefined;
  return v.trim();
}

async function checkFnameAvailable(apiKey, fname) {
  const url = `${NEYNAR_BASE}/fname/availability/?fname=${encodeURIComponent(fname)}`;
  const res = await fetch(url, {
    headers: { 'x-api-key': apiKey },
  });
  if (!res.ok) throw new Error(`fname check failed ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.available === true;
}

async function updateUser(apiKey, signerUuid, body) {
  const res = await fetch(`${NEYNAR_BASE}/user/`, {
    method: 'PATCH',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`update profile failed ${res.status}: ${await res.text()}`);
  return res.json();
}

async function main() {
  const apiKey = getEnv('NEYNAR_API_KEY');
  const signerUuid = getEnv('SIGNER_UUID');
  if (!apiKey || !signerUuid) {
    console.error('Set NEYNAR_API_KEY and SIGNER_UUID (from your registration result).');
    process.exit(1);
  }

  const fname = getEnv('FNAME');
  const bio = getEnv('BIO');
  const pfpUrl = getEnv('PFP_URL');
  const displayName = getEnv('DISPLAY_NAME');
  const url = getEnv('URL');

  if (!fname && bio === undefined && !pfpUrl && displayName === undefined && url === undefined) {
    console.error('Set at least one of: FNAME, BIO, PFP_URL, DISPLAY_NAME, URL');
    process.exit(1);
  }

  const body = { signer_uuid: signerUuid };
  if (fname) {
    const available = await checkFnameAvailable(apiKey, fname);
    if (!available) {
      console.error(`Fname "${fname}" is not available. Pick another.`);
      process.exit(1);
    }
    body.username = fname;
    console.log('Fname', fname, 'is available.');
  }
  if (bio !== undefined) body.bio = bio;
  if (pfpUrl) body.pfp_url = pfpUrl;
  if (displayName) body.display_name = displayName;
  if (url) body.url = url;

  const result = await updateUser(apiKey, signerUuid, body);
  console.log('Profile updated:', result);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
