# Wakehood request signing (Ed25519)

Every mutation on Wakehood is signed with the user's Ed25519 private key. The server verifies
the signature against the public key, checks the resource is owned by that key, and rejects
any request whose timestamp is more than **120 seconds** from the server clock.

Get any part of the canonical message wrong and the server returns `401`. This document is the
exact scheme; follow it byte for byte.

## The canonical message

Four lines joined by a single `\n` (newline), in this order:

```
<METHOD (uppercase)>
<path>
<timestamp (integer milliseconds, as a decimal string)>
<stableStringify(body)>
```

- **METHOD**: e.g. `POST`.
- **path**: the API path only, no host, no query string. For publishing: `/api/agents`.
- **timestamp**: `Date.now()` — milliseconds since epoch, as its plain decimal string.
- **stableStringify(body)**: JSON with **object keys sorted recursively**. Arrays keep their
  order. This is NOT `JSON.stringify` (which is insertion-ordered); the client and server must
  hash identical bytes.

`stableStringify` is:

```js
function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const keys = Object.keys(value).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`
}
```

## Keys and signature

- **private key**: the 32-byte Ed25519 seed, hex-encoded (64 chars).
- **public key**: the 32-byte Ed25519 public key, hex-encoded (64 chars). This is the identity.
- **signature**: Ed25519 signature of the UTF-8 bytes of the canonical message, hex-encoded
  (128 chars).

The request body sent to `POST /api/agents` is:

```json
{ "publicKey": "<hex>", "signature": "<hex>", "timestamp": <ms>, "agent": <the signed body> }
```

The `agent` field must be byte-identical to the body that was signed.

## Complete, runnable example (Node, @noble/ed25519 v3)

```js
// npm i @noble/ed25519 @noble/hashes
import * as ed from '@noble/ed25519'
import { sha512 } from '@noble/hashes/sha2.js'
ed.hashes.sha512 = sha512 // required for the sync API in @noble/ed25519 v3

const BASE = 'https://www.wakehood.com'
const enc = new TextEncoder()
const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
const fromHex = (h) => Uint8Array.from(h.match(/.{2}/g).map((x) => parseInt(x, 16)))

function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`
  const k = Object.keys(v).sort()
  return `{${k.map((x) => `${JSON.stringify(x)}:${stableStringify(v[x])}`).join(',')}}`
}

async function publish() {
  // 1. Identity (reuse the user's keys, or generate + back up)
  const { secretKey, publicKey } = ed.keygen()
  const privHex = hex(secretKey)
  const pubHex = hex(publicKey)
  console.log('BACK UP THIS PRIVATE KEY — it cannot be recovered:', privHex)

  // 2. Upload code to IPFS (or use an existing CID)
  const form = new FormData()
  form.append('name', 'My Agent')
  form.append('files', new File(['# strategy code\n'], 'strategy.py'))
  const { cid } = await (await fetch(`${BASE}/api/ipfs`, { method: 'POST', body: form })).json()

  // 3. The body to sign — sent unchanged as `agent`
  const agent = {
    name: 'My Momentum Bot',
    description: 'Enters on volume-backed breakouts, trails with an ATR stop.',
    assetType: 'CRYPTO',            // CRYPTO | STOCK | ETF | MIXED
    tags: ['momentum'],            // must be valid for the asset class
    ipfsCid: cid,
  }

  // 4. Sign the canonical message
  const timestamp = Date.now()
  const canonical = ['POST', '/api/agents', String(timestamp), stableStringify(agent)].join('\n')
  const signature = hex(ed.sign(enc.encode(canonical), fromHex(privHex)))

  // 5. Publish
  const res = await fetch(`${BASE}/api/agents`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ publicKey: pubHex, signature, timestamp, agent }),
  })
  const out = await res.json()
  if (res.status === 201) console.log('Published:', `${BASE}/agent/${out.agent.id}`)
  else console.error(res.status, out.error)
}

publish()
```

## Failure modes

| Status | Cause |
|---|---|
| `401` "Signature verification failed" | Canonical message mismatch (key order, wrong path, tampered body, wrong key) |
| `401` "Request expired" | `timestamp` more than 120s from the server clock — resign with a fresh `Date.now()` |
| `400` | Missing/invalid fields (name > 80, description > 2000, no valid tag, no CID) |
| `409` | The signer already has an agent with that exact name |
