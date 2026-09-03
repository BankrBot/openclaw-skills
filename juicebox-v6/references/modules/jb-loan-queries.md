---
name: jb-loan-queries
description: |
  Query REVLoans data via Bendystraw GraphQL. Use when: (1) displaying a user's loans
  across all revnets, (2) showing all loans for a specific revnet/project, (3) checking
  borrow permissions, (4) calculating loan headroom, (5) multi-chain loan aggregation.
  Covers the loan entity, permissionHolder checks, and sucker-group filtering.
version: 6.0.0
---

# Querying REVLoans via Bendystraw

Bendystraw indexes every REVLoans event into a `loan` entity, one row per loan ID ever minted. **Rows are never deleted** (`RevLoans6.ts` has no `db.delete`); historical activity lives in `borrowLoanEvent`, `repayLoanEvent`, `reallocateLoanEvent`, and `liquidateLoanEvent` tables.

## Loan-row lifecycle (filter for it)

| Event | Row effect |
|-------|-----------|
| `Borrow` | insert row, `owner = holder` |
| `RepayLoan` full | same row: `borrowAmount = 0`, `collateral = 0`, `sourceFeeAmount` overwritten |
| `RepayLoan` partial | new row for `paidOffLoanId`; the OLD row keeps its stale `borrowAmount`/`collateral` |
| `ReallocateCollateral` | new row for the new loan (`sourceFeeAmount = 0`); the OLD row is not touched |
| `Liquidate` | row rewritten with the event's (non-zero) `amount`/`collateral` |
| ERC-721 `Transfer` | `owner = to` (burn ⇒ `owner = 0x000…000`) |

An active loan is `owner != 0x0000000000000000000000000000000000000000 AND borrowAmount > 0` — add both to every `loans(where: …)` and never treat the raw `id` list as active loans. `owner` is set to the tx `caller` on `RepayLoan`/`ReallocateCollateral` (on-chain the new NFT goes to the loan owner), so after an operator-driven repay/reallocate `owner` is wrong until the next `Transfer`; confirm with `REVLoans.ownerOf(loanId)`.

## Endpoint

Production indexer (what juicebox.money / revnet.money read):

```
https://bendystraw.up.railway.app/graphql          (mainnets)
https://testnet.bendystraw.xyz/graphql             (testnets)
```

`bendystraw.xyz` is a lagging deploy of the same indexer — do not point mainnet builders at it. Both webclients read the host from `NEXT_PUBLIC_BENDYSTRAW_URL` / `NEXT_PUBLIC_TESTNET_BENDYSTRAW_URL` with the values above as defaults. Always pass `version: 6` in where-clauses.

## Loan entity fields (verified against the indexer schema)

| Field | Type | Meaning |
|-------|------|---------|
| `id` | BigInt | on-chain loan ID: `revnetId * 1e18 + loanNumber` |
| `projectId` | Int | revnet project ID |
| `chainId` | Int | chain the loan lives on (loans never move cross-chain) |
| `version` | Int | protocol version (6) |
| `createdAt` | Int | unix timestamp (liquidation clock: `createdAt + 10 years`) |
| `borrowAmount` | BigInt | debt in source-token units — includes fees taken at creation |
| `collateral` | BigInt | revnet tokens burned as collateral |
| `sourceFeeAmount` | BigInt | source fee from the LAST event that wrote the row (borrow, or the repay's fee; `0` on a reallocated loan) |
| `prepaidDuration` | Int | seconds of zero-extra-cost repayment from `createdAt` |
| `prepaidFeePercent` | Int | 25–500 (out of 1000) |
| `owner` | String | loan NFT owner as last indexed (see lifecycle table; `0x0…0` = burned) |
| `beneficiary` | String | recipient of the borrowed funds at creation |
| `token` | String | source token (native = `0x000000000000000000000000000000000000eeee`) |
| `terminal` | String | terminal the loan drew from |
| `tokenUri` | String? | NFT metadata URI |

Primary key is `(id, chainId, version)` — the same loan ID can exist on multiple chains for different loans.

## Queries

Variable scalar types below are illustrative — the deployed Ponder schema uses `Float!` for single-row lookup args (`project(chainId, projectId, version)`), and where-input scalars can differ. Introspect (`__type(name: "loanFilter")`) before hardcoding `Int!`.

### All loans for a user

```graphql
query LoansByAccount($owner: String!, $version: Int!) {
  loans(where: { owner: $owner, version: $version, borrowAmount_gt: "0" }) {
    items {
      id
      chainId
      projectId
      borrowAmount
      collateral
      prepaidDuration
      prepaidFeePercent
      createdAt
      token
      terminal
    }
  }
}
```

Variables: `{ "owner": "0x…" (lowercase), "version": 6 }`.

### Loans for a specific revnet

Add `projectId` (and `chainId` for a single chain) to the where-clause:

```graphql
query LoansForRevnet($owner: String!, $projectId: Int!, $version: Int!) {
  loans(where: { owner: $owner, projectId: $projectId, version: $version, borrowAmount_gt: "0" }) {
    items { id chainId borrowAmount collateral createdAt token }
  }
}
```

A revnet spans chains as a sucker group. Get its per-chain project IDs first, then filter:

```graphql
query GetSuckerGroup($id: String!) {
  suckerGroup(id: $id) { projects }
}
```

`suckerGroup.projects` is a string array with entries shaped `"{chainId}-{projectId}-…"`:

```javascript
const byChain = {}
group.projects.forEach(s => {
  const m = /^(\d+)-(\d+)-/.exec(String(s))
  if (m) byChain[Number(m[1])] = Number(m[2])
})
// then: loans(where: { projectId: byChain[chainId], chainId, version: 6, borrowAmount_gt: "0", owner_not: "0x0000000000000000000000000000000000000000" })
```

Get a project's `suckerGroupId` from `project(projectId, chainId, version) { suckerGroupId }`.

### Check borrow permission

Borrowing on a holder's behalf requires `OPEN_LOAN` — **permission ID 37** (`REALLOCATE_LOAN` = 38, `REPAY_LOAN` = 39, and the holder must have granted `BURN_TOKENS` = 11 to the REVLoans address).

```graphql
query HasPermission($account: String!, $operator: String!, $projectId: Int!, $chainId: Int!, $version: Int!) {
  permissionHolders(
    where: {
      account: $account, operator: $operator,
      projectId: $projectId, chainId: $chainId, version: $version
    }
  ) {
    items { permissions }
  }
}
```

`permissions` is an integer array; check it includes `37`. `account` is the token holder, `operator` is the address acting for them (REVLoans checks the caller when it isn't the holder). Self-borrowing needs no permissionHolder row — only the `BURN_TOKENS` grant to REVLoans (`account = holder`, `operator = REVLoans address`, permissions include `11`).

## Loan headroom (reallocatable amount)

Headroom uses the on-chain preview, not the indexer:

```typescript
// REVLoans.borrowableAmountFrom returns TWO values.
const [borrowableNow, borrowableCapacity] = await revLoans.read.borrowableAmountFrom([
  BigInt(loan.projectId),
  BigInt(loan.collateral),
  BigInt(decimals),   // source token decimals (18 native, 6 USDC)
  BigInt(currency),   // accounting-context currency of the source token
])

// Value of existing collateral vs debt → headroom:
const headroom = borrowableCapacity > BigInt(loan.borrowAmount)
  ? borrowableCapacity - BigInt(loan.borrowAmount)
  : 0n
// Actual extraction via reallocateCollateralFromLoan is additionally capped by borrowableNow
// (the terminal's live balance).
```

Get `decimals`/`currency` from the terminal's accounting context for `loan.token` (`JBMultiTerminal.accountingContextForTokenOf`), not from hardcoded assumptions.

## Display helpers

- Fee-time remaining: `loan.createdAt + loan.prepaidDuration - now` (zero-extra-cost window). After it, repayment cost ramps linearly until liquidation at `loan.createdAt + 315360000` (10 years).
- `prepaidDuration` is fixed at creation — it does not tick down in the entity; compute remaining time client-side.
- Poll interval of ~3s keeps UIs responsive to loan mutations (every repay/reallocate changes the loan ID).

## Common mistakes

- Querying with `version: 5` or omitting version — V6 rows carry `version: 6`.
- Checking permission ID 1 for borrowing. `OPEN_LOAN` is **37**.
- Caching loan IDs across mutations: partial repayment and reallocation burn the old NFT and mint new IDs; re-query after any loan transaction.
- Treating `borrowableAmountFrom` as single-valued, or using `borrowableNow` to value existing collateral (use `borrowableCapacity`).
- Using the keyless Bendystraw endpoint in a browser app — it CORS-fails outside the allow-listed origin.
- Treating every `loan` row as active. Rows persist after full repay (`borrowAmount = 0`), partial repay/reallocate (stale old row), and burn (`owner = 0x0`); filter `borrowAmount > 0` and `owner != 0x0`.
- Reading mainnet data from `bendystraw.xyz` — it lags the production host `bendystraw.up.railway.app`.
