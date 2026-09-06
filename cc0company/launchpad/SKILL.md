---
name: cc0company-launchpad
version: 1.0.0
description: Launch your own token on the cc0.company launchpad (Base, Uniswap V4) as an AI agent — one transaction, instant liquidity, 75% of all trading fees back to you forever, enforced on-chain. Includes wallet flows (viem / CDP / private key), a keyless flow for Bankr-style signers, fee claiming, and $cc0company staking.
homepage: https://cc0.company
api_base: https://cc0.company/api
sdk: "@cc0company/sdk"
chain: base
chain_id: 8453
factory: 0xf9007657b627c5421d6eBD5D71F86CDfCdc7dA8D
fee_locker: 0xC04bdF721FA5CEc839819864FA86F3D48B89Fcee
staking: 0x38cE743b88c54eD1aF84816Ff596E518d16DFF95
cc0company_token: 0x67c5F00491c09cbCF6359f95690574E6106bb3CF
---

# cc0.company Launchpad — Skill for AI Agents

Launch a token on Base in ONE transaction: ERC20 + Uniswap V4 pool + liquidity
locked forever + fee split wired — atomically. The token trades the second the
transaction lands. Your token page on cc0.company (chart, swap, fee-claim
button) goes live automatically.

## The economics — enforced on-chain, not promised

Every trade's LP fee is split:

| Share | Recipient | Asset |
|-------|-----------|-------|
| **75%** | **You, the creator** — splittable across up to 5 wallets | ETH + your own token |
| 15% | $cc0company stakers | ETH |
| 10% | Platform treasury | ETH |

The factory validates this split on every `deployToken` call. A config that
drops, resizes, or re-administers the staking/treasury slices reverts with
`Cc0InvalidProtocolSplit` — there is no way to launch around it, which also
means nobody can rug YOUR 75%. You remain the admin of your own slices:
redirect or re-split them any time.

## Install

```bash
npm install @cc0company/sdk viem
```

Source: [github.com/cryptomfer/cc0company-sdk](https://github.com/cryptomfer/cc0company-sdk) (CC0-1.0).

## Path A — viem-compatible signer (walletClient or private key)

```typescript
import { Cc0Launchpad } from '@cc0company/sdk';
import { privateKeyToAccount } from 'viem/accounts';

const launchpad = new Cc0Launchpad({ account: privateKeyToAccount(process.env.PK) });
// or { walletClient } for browser wallets (MetaMask, Rabby, …)
```

Then launch:

```typescript
const { tokenAddress, txHash, registered } = await launchpad.launchToken({
  name: 'My Token',
  symbol: 'MTK',
  image: imageBytes, // ANY https URL, data: URL, Blob or Uint8Array — the SDK pins
                     // it to IPFS via cc0.company BEFORE launching (the URI goes
                     // on-chain forever, so permanence is guaranteed; 8MB max,
                     // images only). ipfs:// URIs pass through untouched. If
                     // pinning fails the launch fails — by design. Escape hatch:
                     // imagePolicy: 'as-is'.
  description: 'born to launch',   // stored on-chain
  feeTier: 1,                      // 1 | 2 | 3 % static — or feeMode: 'dynamic'
});
// registered === true → cc0.company/token/{tokenAddress} is live
```

Need the `ipfs://` URI up front (e.g. for Path B)?
`await launchpad.pinImage(bytesOrUrl)` → `{ cid, ipfsUri, gatewayUrl }` —
direct endpoint: `POST https://cc0.company/api/store/launchpad/pin-image`
(multipart `file` or JSON `{ url }`).

Gas: a few cents of ETH on Base. That's the only cost — no listing fee.

## Path B — ANY other wallet infra (Coinbase CDP, Bankr, Safe, relayers)

CDP accounts are NOT viem-compatible (no `toAccount` adapter exists in
`@coinbase/cdp-sdk`) — give the SDK a `sender` instead. The SDK pins the image,
builds the tx, estimates gas (+20%); your infra signs + submits; the SDK waits,
parses, and registers. ALL SDK methods (launch, claim fees, stake) work through it.

```typescript
import { CdpClient } from '@coinbase/cdp-sdk';
import { Cc0Launchpad } from '@cc0company/sdk';

const cdp = new CdpClient();
const account = await cdp.evm.getOrCreateAccount({ name: 'launcher' });

const launchpad = new Cc0Launchpad({
  sender: {
    address: account.address,
    send: async (tx) => {
      // CDP's TypeScript SDK wants the BIGINT fields (tx.*) — hex fee strings
      // throw TipAboveFeeCapError. Everything is pre-estimated by the SDK.
      // (tx.json — the hex mirror — is for RAW JSON transports/relayers only.)
      const { transactionHash } = await cdp.evm.sendTransaction({
        address: account.address,
        network: 'base',
        transaction: {
          to: tx.to,
          data: tx.data,
          value: tx.value,
          gas: tx.gas,
          maxFeePerGas: tx.maxFeePerGas,
          maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
        },
      });
      return transactionHash; // CDP's field is `transactionHash`, NOT `hash`
    },
  },
});

await launchpad.launchToken({ ... }); // everything handled end-to-end
```

Fully manual (no sender): `prepareLaunchTransaction(params, { creator })` →
submit `tx.json` yourself → `finishLaunch({ txHash, params, creator, imageUri: tx.imageUri })`
waits + parses + registers in one call.

## All launch options

```typescript
await launchpad.launchToken({
  name: 'My Token',
  symbol: 'MTK',
  image: 'ipfs://…',

  feeMode: 'static',            // 'static' (default) | 'dynamic' (1%→3% volatility preset)
  feeTier: 1,                   // 1 | 2 | 3 (static only)

  // Split YOUR 75% across up to 5 wallets (bps of TOTAL fees, sum must be 7500)
  creatorRewards: [
    { recipient: '0xYou',     bps: 5000, feePreference: 'both' },   // ETH + token
    { recipient: '0xPartner', bps: 2500, feePreference: 'paired' }, // ETH only
  ],

  // Anti-snipe: descending tax on the first seconds… or omit for a 2-block MEV delay
  sniperTax: { startingBps: 800_000, endingBps: 50_000, secondsToDecay: 15 },

  // Lock supply for yourself (lockup ≥ 7 days, optional linear vesting)
  vault: { percentage: 10, lockupSeconds: 604800, vestingSeconds: 2592000 },

  // Merkle airdrop of supply (lockup ≥ 1 day)
  airdrop: { merkleRoot: '0x…', percentage: 5 },

  // Buy your own token in the launch transaction
  devBuyEth: '0.05',

  register: true,               // default — auto-registers on cc0.company
});
```

## Claim your fees

Fees accrue in the fee locker per `(feeOwner, token)` as trades happen.
Claiming is PERMISSIONLESS — any wallet can trigger it, funds always go to the
creator. Three ways:

```typescript
// SDK
import { Cc0Fees } from '@cc0company/sdk';
const fees = new Cc0Fees({ account });
await fees.getClaimableFees(creatorWallet, tokenAddress); // { weth, token } in wei
await fees.claimFees(creatorWallet, tokenAddress);        // claims both
```

- **Token page**: `cc0.company/token/{address}` has a one-tap **Claim fees** button.
- **Raw contract**: `claim(address feeOwner, address token)` on the fee locker
  `0xC04bdF721FA5CEc839819864FA86F3D48B89Fcee` (claim WETH at
  `0x4200000000000000000000000000000000000006`, and your token address).

## Stake $cc0company (earn from EVERY launch)

15% of every launchpad token's trading fees flow to $cc0company stakers, in ETH:

```typescript
import { Cc0Staking } from '@cc0company/sdk';
import { parseEther } from 'viem';

const staking = new Cc0Staking({ account });
await staking.stake(parseEther('1000'));   // auto-approves if needed; earning starts now
await staking.claimRewards();              // accrued ETH (WETH) → your wallet
const pos = await staking.getPosition(me); // staked / earned / unbonding / totals
await staking.requestUnstake(parseEther('500')); // 48h cooldown, then:
await staking.withdraw();
await staking.exit();                      // claim all + unstake all, one tx
```

## Contract reference (Base mainnet, all verified)

| Contract | Address |
|----------|---------|
| Factory (validates the split) | `0xf9007657b627c5421d6eBD5D71F86CDfCdc7dA8D` |
| Fee locker (claim here) | `0xC04bdF721FA5CEc839819864FA86F3D48B89Fcee` |
| Staking | `0x38cE743b88c54eD1aF84816Ff596E518d16DFF95` |
| $cc0company | `0x67c5F00491c09cbCF6359f95690574E6106bb3CF` |
| WETH (Base) | `0x4200000000000000000000000000000000000006` |

Full list: [cc0.company/docs/smart-contracts](https://cc0.company/docs/smart-contracts).

## Errors you might hit

| Error | Cause | Fix |
|-------|-------|-----|
| `Cc0InvalidProtocolSplit` | Hand-rolled lockerConfig that drops/resizes the protocol slices | Use the SDK — it builds the exact enforced layout |
| `Deprecated` | You called the OLD factory (`0x2Ed3…D40B`) | Use the current factory above / update the SDK |
| `walletClient has no account attached` | viem client built without an account | Pass `account:` to the constructor or attach one to the WalletClient |
| `registered: false` in the result | Registry unreachable (the launch itself succeeded) | Call `registerLaunch()` again later — idempotent |
