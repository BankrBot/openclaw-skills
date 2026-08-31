# TwentyPad claim reference

FeeEscrow (Base 8453): `0xD43586103c760Bd5e139a2De2655413dE441B150`  
These are hook fees in the quote asset, not Uniswap LP fees.

## ABI

```text
owed(address account, address asset) view returns (uint256)
claim(address asset)
claimTo(address to, address asset)
hook() view returns (address)

```

`asset` is a v4 Currency. Native ETH = `address(0)`, not WETH.
USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913.

Selectors:
- `claim(address)` = `0x1e83409a`
- `claimTo(address,address)` = `0x34a1ca89`

## Who can claim

`msg.sender` must be the credited account.
Creator fees → wallet that sent `createLaunch` (`tokenCreator[token]`).
Platform fees → hook platform account.
If Bankr signs with the wrong wallet, `owed` is 0. Do not send a tx.
TWENTY creator example: `0x1edBDc668fD5A749Ca8882fCB2bDa489B68154Ce`

## Workflow

1. Claimant = signing Bankr wallet.  
2. If they named a token, read factory `tokenCreator(token)`. Warn if it is not the signer.  
3. Read:

```text
owed(claimant, 0x0000000000000000000000000000000000000000)
owed(claimant, 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)

```
4. Both 0 → “nothing to claim”, stop.  
5. `value` is always `"0"`.

Claim to self:

```text
to:    0xD43586103c760Bd5e139a2De2655413dE441B150
data:  claim(asset)
chain: 8453

```
Claim to another address: `claimTo(to, asset)`.

ETH calldata:

```text
0x1e83409a0000000000000000000000000000000000000000000000000000000000000000

```

USDC calldata:

```text
0x1e83409a000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda02913

```

If both assets owed, two txs. Never call `credit` (hook-only).
Script helpers: `scripts/owed.sh <wallet>`, `scripts/claim.sh eth|usdc [to]`

## Split

1% hook fee on quote: **70% creator / 30% platform**. Anti-snipe surplus → platform.

## Errors

| Case | Action |
| --- | --- |
| `owed == 0` | No tx |
| Wrong wallet | Use the launch creator Bankr account |
| `tokenCreator == 0` | Not TwentyPad — refuse |
| `claimTo to address(0)` | Refuse |
| “claim LP fees” | Explain these are hook fees in ETH/USDC |

## After success

Re-read `owed` (should be 0 for that asset). Reply tx + Basescan + amount + leftover on the other asset.