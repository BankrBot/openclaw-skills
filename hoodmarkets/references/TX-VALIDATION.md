# Transaction validation (before Bankr /wallet/submit)

**Mandatory** for every `prepare-buy` / `prepare-sell` response before calling Bankr.

## 1. Chain

- Every tx: `chainId === 4663`
- Abort if Bankr does not support 4663 — see `references/CHAIN-4663.md`

## 2. Transaction count

- **Buy:** exactly **1** tx (`buy`)
- **Sell:** **1** (`sell`) or **2** (`approve` then `sell`) — no extra txs
- Reject if API returns additional steps

## 3. Allowed `to` addresses

From `known-contracts.json` → `contracts`:

| Step | `to` must equal |
|------|-----------------|
| `buy` | `swapHelper` (`0x6373285f77ad0a3f5a441439b3d23d16b79aa585`) |
| `sell` | `swapHelper` |
| `approve` | User-requested `tokenAddress` (checksum match) |

Reject any other `to`.

## 4. Function selectors (exact)

| Step | Selector | Signature |
|------|----------|-----------|
| `buy` | `0x49168929` | `buy(address,uint128)` |
| `sell` | `0x006215e5` | `sell(address,uint256,uint128)` |
| `approve` | `0x095ea7b3` | `approve(address,uint256)` |

`data` must start with the selector for that step. Reject unknown selectors.

## 5. Calldata match

### Buy

- `value` > 0, matches user `amountEth` (wei)
- Token address in calldata (first arg) = user-requested `tokenAddress`
- `amountOutMinimum` (second arg) ≥ 1 — do not strip slippage args

### Sell

- `sell`: `value` = 0
- Token address in calldata = user-requested `tokenAddress`
- `amountIn` in calldata matches user sell amount

### Approve (if present)

- Spender (first arg) = `swapHelper` address
- Amount (second arg) ≥ sell `amountIn`
- **Reject unlimited approve** (`type(uint256).max` / `0xfff…fff`) unless user explicitly confirmed unlimited — API should emit exact amount only

## 6. Value bounds

- Buy `value`: > 0 and ≤ user-stated ETH amount + reasonable gas buffer (reject if API value ≫ user intent)
- Approve / sell: `value` = 0

## 7. User preview (required before submit)

Show and get implicit confirmation on:

- Token name/symbol + `tokenAddress`
- Action (buy / sell) and amount
- Each tx: `to`, `value`, human `description`
- `chainId: 4663`

Then submit txs in order via Bankr.

## Deploy / claim

- **Deploy:** no Bankr submit — server-side only (`references/AUTH-BOUNDARY.md`)
- **Claim:** no Bankr submit — `POST /api/agent/claim` or `claim-for-recipient`

## Abort if

- Wrong `chainId`
- Unknown `to` or selector
- Calldata token / spender / amount mismatch
- Extra transactions
- Unlimited approve without explicit user consent
- User did not confirm token ticker/address and amount
