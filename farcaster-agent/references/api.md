# Farcaster Agent API Reference

## Programmatic Usage

```javascript
const {
  // Full autonomous setup
  autoSetup,
  checkAllBalances,

  // Core functions
  registerFid,
  addSigner,
  postCast,
  swapEthToUsdc,

  // Profile setup
  setProfileData,
  registerFname,
  setupFullProfile,

  // Utilities
  checkFidSync,
  checkSignerSync,
  getCast
} = require('farcaster-agent/src');
```

## Functions

### autoSetup(privateKey, castText)

Complete autonomous setup from any funded wallet.

```javascript
const result = await autoSetup('0x...privateKey', 'My first cast!');
// Returns: { fid, signerPrivateKey, castHash }
```

### registerFid(privateKey)

Register a new Farcaster ID on Optimism.

```javascript
const { fid } = await registerFid('0x...privateKey');
```

### addSigner(privateKey)

Add an Ed25519 signer key for the FID.

```javascript
const { signerPrivateKey } = await addSigner('0x...privateKey');
```

### postCast(options)

Post a cast to the network.

```javascript
const { hash, verified } = await postCast({
  privateKey: '0x...',      // For x402 payment
  signerPrivateKey: '...',  // Ed25519 key (hex, no 0x)
  fid: 123,
  text: 'Hello Farcaster!'
});
```

### setupFullProfile(options)

Set up complete profile with fname, display name, bio, and PFP.

```javascript
await setupFullProfile({
  privateKey: '0x...',
  signerPrivateKey: '...',
  fid: 123,
  fname: 'myusername',
  displayName: 'My Name',
  bio: 'My bio text',
  pfpUrl: 'https://example.com/pfp.png'
});
```

## Contract Addresses

### Optimism

| Contract | Address |
|----------|---------|
| IdGateway | `0x00000000Fc25870C6eD6b6c7E41Fb078b7656f69` |
| IdRegistry | `0x00000000Fc6c5F01Fc30151999387Bb99A9f489b` |
| KeyGateway | `0x00000000fC56947c7E7183f8Ca4B62398CaAdf0B` |
| SignedKeyRequestValidator | `0x00000000FC700472606ED4fA22623Acf62c60553` |

### Base

| Contract | Address |
|----------|---------|
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

### Neynar

| Endpoint | URL |
|----------|-----|
| Hub API | `hub-api.neynar.com` |
| Payment Address | `0xA6a8736f18f383f1cc2d938576933E5eA7Df01A1` |

## x402 Micropayments

Neynar hub requires x402 payments (0.001 USDC per call on Base).

The payment uses EIP-3009 `transferWithAuthorization` - a gasless signature-based USDC transfer included in the `X-PAYMENT` header.

## Key Types

- **Custody Key:** Ethereum wallet that owns the FID (secp256k1)
- **Signer Key:** Ed25519 key for signing casts (separate from custody)
