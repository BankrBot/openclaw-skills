---
name: jb-bendystraw
description: |
  Bendystraw GraphQL API for querying indexed Juicebox V6 data. Use when: (1) need
  cross-chain aggregated project stats, (2) querying payment history or token holder
  lists, (3) fetching NFT tier data or mint history, (4) building unified activity
  feeds, (5) historical snapshots or time-series data, (6) loan data from REVLoans,
  (7) tracking cross-chain bridging or accounting sync status, (8) querying buyback
  AMM pool registrations and exact Uniswap V4 price history. Faster than on-chain
  queries for read-heavy operations.
---

# Bendystraw: Cross-Chain Juicebox Data API

Bendystraw is a GraphQL indexer (built on [Ponder](https://ponder.sh)) for Juicebox events across all supported chains. It aggregates data into two databases with identical schemas — one for mainnets, one for testnets.

## API Base URLs

```
Mainnets: https://bendystraw.up.railway.app/graphql          (keyless)
          https://bendystraw.up.railway.app/{API_KEY}/graphql (keyed)
Testnets: https://testnet.bendystraw.xyz/graphql
          https://testnet.bendystraw.xyz/{API_KEY}/graphql
Schema / playground (no key, rate-limited): GET https://bendystraw.up.railway.app/schema
```

`bendystraw.up.railway.app` is the production mainnet deployment every Juicebox webclient targets. `bendystraw.xyz` serves the same indexer but lags it; do not point new clients at it.

**Two routes, same schema:**

- Keyless `/graphql` and `/participants`: CORS is an origin allowlist (juicebox.money, revnet.app, and other first-party hosts). Server-side callers (Node, Next.js route handlers, scripts) are not subject to CORS and work keyless. Browsers on non-allowlisted origins are blocked.
- Keyed `/{API_KEY}/graphql` and `/{API_KEY}/participants`: key verified per request, no origin restriction. Required for browser calls from a third-party origin (for example a static IPFS bundle).

## Authentication

Keys are only needed for the keyed route. Contact [@peripheralist](https://x.com/peripheralist) on X to get one.

```javascript
const response = await fetch(`https://bendystraw.up.railway.app/${API_KEY}/graphql`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: '...', variables: { /* ... */ } })
});
```

**Never ship an API key in browser source.** Production clients use a same-origin server proxy that calls the keyless route and forwards only a registry of known operations (persisted-operation pattern), so neither a key nor a raw query document reaches the browser.

---

## Supported Chains

| Database | Chains |
|----------|--------|
| Mainnets (`bendystraw.up.railway.app`) | Ethereum (1), Optimism (10), Base (8453), Arbitrum (42161) |
| Testnets (`testnet.bendystraw.xyz`) | Sepolia (11155111), Optimism Sepolia (11155420), Base Sepolia (84532), Arbitrum Sepolia (421614) |

---

## The `version: 6` Rule

**Every table row carries a `version` column. Juicebox V6 data is `version: 6`. Every query MUST filter on the literal `version: 6`** — the same database contains rows from other protocol deployments tagged with other version values, and mixing them produces garbage. The tag is decided by which contract address emitted the event; V6-only singletons (buyback hook, V4 hook, suckers registry) always write 6.

- Plural queries: put `version: 6` in the `where` clause.
- Singular queries: `version` is part of most compound primary keys — pass `version: 6` as the argument.
- Ponder does not AND sibling fields into `OR` branches: when a `where` uses `OR: [...]`, repeat `version: 6` inside every branch.

```graphql
# Plural — filter
projects(where: { version: 6, chainId: 1 }, ...) { items { ... } }

# Singular — PK argument
project(projectId: 1, chainId: 1, version: 6) { ... }
```

A project is uniquely identified by **`projectId + chainId + version`**. `projectId` is a per-chain counter: the same number on two chains is two unrelated projects. An omnichain project is a set of per-chain projects with different ids linked by suckers; the link is `suckerGroupId`. Resolve the sibling on another chain through `suckerGroup.projects`, never by reusing the id.

---

## Query Semantics (Ponder GraphQL)

### Singular queries

Return one row by primary key. The PK columns are the arguments. **Integer PK args are typed `Float!` in the GraphQL schema** (a Ponder quirk) — declare variables as `Float!` or inline the literals.

| Query | Arguments (PK) |
|-------|----------------|
| `project` | `chainId: Float!, projectId: Float!, version: Float!` |
| `participant` | `version: Float!, chainId: Float!, projectId: Float!, address: String!` |
| `suckerGroup` | `id: String!` |
| `wallet` | `address: String!` |
| `loan` | `id: BigInt!, chainId: Float!, version: Float!` |
| `nft` | `chainId: Float!, hook: String!, tokenId: BigInt!, version: Float!` |
| `nftTier` | `version: Float!, chainId: Float!, hook: String!, tierId: Float!` |
| `nftHook` | `chainId: Float!, address: String!, version: Float!` |
| `projectPayer` | `version: Float!, chainId: Float!, projectId: Float!, address: String!` |
| `permissionHolder` | `version: Float!, chainId: Float!, account: String!, projectId: Float!, operator: String!` |
| `buybackPool` | `chainId: Float!, poolId: String!` |
| `buybackPoolPosition` | `chainId: Float!, tokenId: BigInt!` |
| `participantSnapshot` | `version: Float!, chainId: Float!, projectId: Float!, address: String!, block: Float!` |
| `suckerGroupMoment` | `suckerGroupId: String!, version: Float!, timestamp: Float!` |
| `suckerTransaction` | `index: Float!, token: String!, chainId: Float!, sucker: String!` |
| `cashOutTaxSnapshot` | `version: Float!, chainId: Float!, projectId: Float!, rulesetId: BigInt!` |
| event entities (`payEvent`, etc.) | `id: String!` (random UUID — not deterministic) |

### Plural queries

Return a page object. All plural queries take:

```graphql
entityName(
  where: entityFilter        # field filters, see below
  orderBy: "fieldName"       # String
  orderDirection: "desc"     # "asc" | "desc"
  limit: 100                 # Int
  before: "cursor"           # cursor pagination
  after: "cursor"
  offset: 0                  # Int — offset pagination also supported
) {
  items { ... }
  pageInfo { startCursor endCursor hasNextPage hasPreviousPage }
  totalCount              # computed only when selected
}
```

`before` and `offset` cannot be combined. Nested relation pages (`suckerGroup.projects`, `project.participants`, `wallet.nfts`, …) take the same arguments; without `limit` a large relation silently truncates, so always pass one (production uses `projects(limit: 100)`).

### Filter operators (`where`)

Per column, depending on its type:

| Column type | Operators |
|-------------|-----------|
| all | `field`, `field_not`, `field_in`, `field_not_in` |
| numeric (Int/BigInt) | `field_gt`, `field_gte`, `field_lt`, `field_lte` |
| String | `field_contains`, `field_not_contains`, `field_starts_with`, `field_ends_with`, `field_not_starts_with`, `field_not_ends_with`, plus `_nocase` variants of each. `_nocase` is NOT generated for hex columns (addresses, `txHash`, `poolId`) — `address_contains_nocase` fails validation |
| array (e.g. `tags`) | `field_has`, `field_not_has` |
| combinators | `AND: [filter]`, `OR: [filter]` |

```graphql
where: {
  version: 6
  chainId_in: [1, 10, 8453, 42161]
  balance_gt: "1000000000000000000"
  timestamp_gte: 1704067200
  name_contains_nocase: "dao"
}
```

### Deterministic IDs

- `project.id` = `"{version}-{projectId}-{chainId}"` (e.g. `"6-3-1"`). Stable; safe to store.
- `suckerGroup.id` = 32-char hex string (keccak hash of the sorted member project ids, no `0x` prefix). Stable; safe to store.
- All other `id` fields (event rows) are random UUIDs and **may change whenever Bendystraw reindexes**. Never store them.

---

## Entity Reference

Field types below are the GraphQL types served by the API (`BigInt` and `JSON` are custom scalars; `BigInt` values are returned as strings).

### Common event columns

Every `*Event` entity carries these unless noted:

```graphql
id: String!          # random UUID
chainId: Int!
version: Int!        # filter on 6
txHash: String!
timestamp: Int!
caller: String!      # the contract-level caller from the event args
from: String!        # transaction sender — NOT the beneficiary
logIndex: Int!
projectId: Int!
suckerGroupId: String!   # as of the event; see suckerGroup section
project: project     # relation
```

Exceptions: `burnEvent` / `manualBurnEvent` omit `caller` and `logIndex`; `projectTransferEvent` omits `caller`; `autoIssueEvent` / `storeAutoIssuanceAmountEvent` omit `suckerGroupId`; `decorateBannyEvent` omits `projectId` and `suckerGroupId` (it keeps `caller` and `logIndex`).

**Relation naming rule.** When a relation shares a name with a column, the relation replaces the column in the GraphQL object type (`nft.hook`, `nftTier.hook`, `suckerGroup.projects`, `activityEvent.payEvent`, …). Select it as an object (`hook { address }`); the `where` filter still uses the underlying column's scalar type (`where: { hook: "0x…" }`). There are no `*_rel` fields.

### project

```graphql
type project {
  id: String!                     # "{version}-{projectId}-{chainId}" — deterministic
  chainId: Int!
  projectId: Int!
  version: Int!
  createdAt: Int!
  suckerGroupId: String!
  isRevnet: Boolean
  handle: String
  metadataUri: String
  metadata: JSON
  deployer: String!
  owner: String!
  creator: String!

  # Activity counters
  paymentsCount: Int!
  redeemCount: Int!
  contributorsCount: Int!
  nftsMintedCount: Int!

  # Financial (denominated in the project's accounting token)
  volume: BigInt!                 # payments only (payEvent); addToBalance is NOT counted
  volumeUsd: BigInt!
  redeemVolume: BigInt!           # accrues from cashOutTokensEvent only
  redeemVolumeUsd: BigInt!
  balance: BigInt!                # = volume + Σ addToBalance − cash-outs − payouts − allowances
  balanceUsd: BigInt!             # live only (see note below)
  tokenSupply: BigInt!
  reservedTokenSupply: BigInt!

  # Trending (7-day rolling window)
  trendingScore: BigInt!
  trendingVolume: BigInt!
  trendingVolumeUsd: BigInt!
  trendingPaymentsCount: Int!
  createdWithinTrendingWindow: Boolean

  # Accounting context (the token the project's terminal accepts)
  token: String                   # accounting token address (0x…EEEe = native)
  tokenSymbol: String             # accounting token symbol ("ETH", "USDC") — NOT the project's ERC-20
  decimals: Int                   # accounting token decimals
  currency: BigInt                # accounting-context currency = uint32(uint160(token)); 61166 for native

  # Searchable metadata (unpacked from metadataUri)
  name: String
  description: String
  logoUri: String
  coverImageUri: String
  infoUri: String
  payDisclosure: String
  projectTagline: String
  tags: [String]
  tokens: [String]
  domain: String
  twitter: String
  discord: String
  telegram: String
  farcaster: String

  # Relations
  suckerGroup: suckerGroup
  participants: participantPage
  nfts: nftPage
  nftHooks: nftHookPage
  buybackPools: buybackPoolPage
  projectPayers: projectPayerPage
  permissionHolders: permissionHolderPage
  activityEvents: activityEventPage
  # …plus a page relation for every event entity (payEvents, cashOutTokensEvents, …)
}
```

**Live only.** `balanceUsd` (on `project`, `suckerGroup`, `suckerGroupMoment`) and `addToBalanceEvent.amountUsd` are served by production and selected by juicebox-money, but are absent from the `bendystraw-v6` checkout this document was verified against. Everything else here is in the schema source.

A "total raised" stat must add `addToBalanceEvents` to `volume`; `volume` alone under-reports projects funded through `addToBalance` (payouts from other projects with `preferAddToBalance`, sucker claims with `autoAddedToBalance`).

### suckerGroup (omnichain aggregation)

A sucker group links the same project across chains into one omnichain project with shared revenue and tokens. All stats are pre-aggregated across member chains.

```graphql
type suckerGroup {
  id: String!                     # deterministic hash — primary key
  version: Int!
  projects: projectPage           # RELATION — member projects (use { items { ... } })
  addresses: [String]!            # sucker contract addresses
  createdAt: Int!

  paymentsCount: Int!
  redeemCount: Int!
  volume: BigInt!
  volumeUsd: BigInt!
  redeemVolume: BigInt!
  redeemVolumeUsd: BigInt!
  nftsMintedCount: Int!
  balance: BigInt!
  balanceUsd: BigInt!             # live only
  tokenSupply: BigInt!
  reservedTokenSupply: BigInt!
  trendingScore: BigInt!
  trendingVolume: BigInt!
  trendingPaymentsCount: Int!
  contributorsCount: Int!

  suckerTransactions: suckerTransactionPage
}
```

**`suckerGroupId` is as-of-event.** Every project starts in its own single-member group. When suckers link projects, a NEW group id is created and only `project`, `projectCreateEvent`, `deployErc20Event` and `activityEvent` rows are re-pointed. `payEvents`, `cashOutTokensEvents`, `mintTokensEvents`, `swapEvents`, `participants`, `suckerGroupMoments`, `cashOutTaxSnapshots` and the rest keep the group id that was current when they were written. Consequences:

- `activityEvents(where: { suckerGroupId })` is complete across the merge; the typed event tables are not.
- For a complete historical list from a typed table, query by the group AND by each member's `(chainId, projectId)` (from `suckerGroup.projects`), merge, and de-duplicate by `id`.
- `suckerGroupMoments` for the current group id begin at the merge; pre-merge history sits under the old ids.

### participant (token holder, per project per chain)

```graphql
type participant {
  chainId: Int!
  projectId: Int!
  suckerGroupId: String!
  createdAt: Int!
  version: Int!
  isRevnet: Boolean
  address: String!
  volume: BigInt!                 # accrues to the pay `payer` (tx caller)
  volumeUsd: BigInt!
  lastPaidTimestamp: Int!
  paymentsCount: Int!             # also accrues to the payer
  balance: BigInt!                # creditBalance + erc20Balance; accrues to the mint `beneficiary`
  creditBalance: BigInt!          # unclaimed credits
  erc20Balance: BigInt!           # claimed ERC-20 tokens
  wallet: wallet
  project: project
  suckerGroup: suckerGroup
  nfts: nftPage
  loans: loanPage
}
```

Attribution trap: `volume`/`paymentsCount` credit the payer, `balance` credits the beneficiary. A checkout that pays from a smart wallet or router on behalf of a person produces two participant rows — one with volume and no balance, one with balance and no volume. "Top contributors" and "top holders" are different lists.

### wallet (cross-project aggregation per address)

```graphql
type wallet {
  address: String!
  volume: BigInt!
  volumeUsd: BigInt!
  lastPaidTimestamp: Int!
  participants: participantPage
  nfts: nftPage
}
```

### activityEvent (unified feed)

Polymorphic row per protocol event. `type` discriminates; exactly one embedded event object is non-null.

```graphql
type activityEvent {
  id: String!
  chainId: Int!
  from: String!                   # tx sender; no beneficiary column on this row
  timestamp: Int!
  txHash: String!
  projectId: Int!
  suckerGroupId: String!
  version: Int!
  type: activityEventType!
  # one of (matching `type`):
  payEvent: payEvent
  cashOutTokensEvent: cashOutTokensEvent
  mintNftEvent: mintNftEvent
  # … one field per enum value below
  project: project
  suckerGroup: suckerGroup
}

enum activityEventType {
  accountingSyncEvent  addNftTierEvent  addToBalanceEvent  autoIssueEvent
  borrowLoanEvent  bridgeClaimEvent  bridgeToOutboxEvent  bridgeToRemoteEvent
  burnEvent  buybackPoolEvent  cashOutTokensEvent  decorateBannyEvent
  deployErc20Event  inboxRootReceivedEvent  liquidateLoanEvent  manualBurnEvent
  manualMintTokensEvent  mintNftEvent  mintTokensEvent  operatorPermissionsSetEvent
  payEvent  projectCreateEvent  projectTransferEvent  reallocateLoanEvent
  repayLoanEvent  removeNftTierEvent  rulesetQueuedEvent  sendPayoutToSplitEvent
  sendPayoutsEvent  sendReservedTokensToSplitEvent  sendReservedTokensToSplitsEvent
  setUriEvent  swapEvent  useAllowanceEvent
}
```

### Payment / treasury events

```graphql
type payEvent {          # + common event columns
  distributionFromProjectId: Int  # set when the payment is a payout from another project
  beneficiary: String!
  amount: BigInt!                 # 0 when the payment was routed through the buyback pool (the trade is a swapEvent)
  amountUsd: BigInt!
  memo: String
  feeFromProject: Int             # set when the payment is a fee from this project ID
  newlyIssuedTokenCount: BigInt!
}

type cashOutTokensEvent {  # + common event columns
  cashOutCount: BigInt!           # project tokens burned
  beneficiary: String!
  holder: String!
  reclaimAmount: BigInt!          # terminal tokens reclaimed
  cashOutTaxRate: BigInt!
  reclaimAmountUsd: BigInt!
  metadata: String!
  rulesetCycleNumber: BigInt!
  rulesetId: BigInt!
}

type addToBalanceEvent {   # + common event columns
  amount: BigInt!
  amountUsd: BigInt!              # live only
  memo: String
  metadata: String!
  returnedFees: BigInt!
}

type sendPayoutsEvent {    # + common event columns
  amount: BigInt!
  amountUsd: BigInt!
  amountPaidOut: BigInt!
  amountPaidOutUsd: BigInt!
  netLeftoverPayoutAmount: BigInt!
  fee: BigInt!
  feeUsd: BigInt!
  rulesetId: Int!
  rulesetCycleNumber: Int!
}

type sendPayoutToSplitEvent {  # + common event columns
  amount: BigInt!
  netAmount: BigInt!
  amountUsd: BigInt!
  beneficiary: String!
  lockedUntil: BigInt!
  percent: Int!
  preferAddToBalance: Boolean!
  splitProjectId: Int!
  hook: String!
  group: BigInt!                  # split group ID
  rulesetId: Int!
}

type useAllowanceEvent {   # + common event columns
  amount: BigInt!
  amountPaidOut: BigInt!
  netAmountPaidOut: BigInt!       # after fees
  beneficiary: String!
  feeBeneficiary: String!
  memo: String
  rulesetCycleNumber: Int!
  rulesetId: Int!
}
```

### Token events

```graphql
type mintTokensEvent {     # + common event columns; manualMintTokensEvent is identical
  beneficiary: String!
  beneficiaryTokenCount: BigInt!
  reservedPercent: BigInt!
  tokenCount: BigInt!
  memo: String
}

type burnEvent {           # + common event columns MINUS caller/logIndex; manualBurnEvent identical
  amount: BigInt!
  creditAmount: BigInt!
  erc20Amount: BigInt!
}

type deployErc20Event {    # + common event columns
  symbol: String!
  name: String!
  token: String!            # the project's issued ERC-20 address
}
```

`manualBurnEvent` / `manualMintTokensEvent` are convenience tables containing only operator-initiated burns/mints (not those caused by cash-outs/payments). `burnEvent` / `mintTokensEvent` contain ALL burns/mints.

### Reserved token events

```graphql
type sendReservedTokensToSplitEvent {   # + common event columns
  rulesetId: Int!
  tokenCount: BigInt!
  groupId: BigInt!
  beneficiary: String!
  hook: String!
  lockedUntil: BigInt!
  percent: Int!
  preferAddToBalance: Boolean!
  splitProjectId: Int!
}

type sendReservedTokensToSplitsEvent {  # + common event columns
  rulesetCycleNumber: Int!
  rulesetId: Int!
  tokenCount: BigInt!
  leftoverAmount: BigInt!
  owner: String!
}
```

### Project lifecycle events

```graphql
type projectCreateEvent { }             # common event columns only
type projectTransferEvent {             # no caller
  previousOwner: String!
  owner: String!
}
type setUriEvent { uri: String!, metadata: JSON }
type rulesetQueuedEvent {               # + common event columns
  rulesetId: BigInt!
  duration: BigInt!
  weight: BigInt!
  weightCutPercent: BigInt!
  approvalHook: String!
  metadata: BigInt!                     # packed ruleset metadata
  mustStartAtOrAfter: BigInt!
  cashOutTax: Int!
  cycleNumber: Int!                     # what UIs print ("Ruleset #N")
  basedOnId: Int!                       # 0 = genesis ruleset
}
type cashOutTaxSnapshot {               # PK: version+chainId+projectId+rulesetId
  chainId: Int!  projectId: Int!  suckerGroupId: String!  version: Int!
  start: BigInt!  duration: BigInt!  cashOutTax: Int!  rulesetId: BigInt!
}
```

### Loans (REVLoans)

```graphql
type loan {                # current loan state; PK: id+chainId+version
  id: BigInt!              # loan ID (NFT token ID)
  projectId: Int!  chainId: Int!  createdAt: Int!  version: Int!
  borrowAmount: BigInt!
  collateral: BigInt!      # project tokens locked
  sourceFeeAmount: BigInt!
  prepaidDuration: Int!
  prepaidFeePercent: Int!
  beneficiary: String!
  owner: String!
  token: String!
  terminal: String!
  tokenUri: String
  project: project  participant: participant  wallet: wallet
}

type borrowLoanEvent {     # + common event columns
  borrowAmount: BigInt!  collateral: BigInt!  sourceFeeAmount: BigInt!
  prepaidDuration: Int!  prepaidFeePercent: Int!
  beneficiary: String!  token: String!  terminal: String!
}
type repayLoanEvent {      # + common event columns
  loanId: BigInt!  paidOffLoanId: BigInt!
  repayBorrowAmount: BigInt!  collateralCountToReturn: BigInt!
}
type reallocateLoanEvent { # + common event columns
  loanId: BigInt!  reallocatedLoanId: BigInt!  removedCollateralCount: BigInt!
}
type liquidateLoanEvent {  # + common event columns
  borrowAmount: BigInt!  collateral: BigInt!
}
```

### NFTs (721 hook)

```graphql
type nft {                 # PK: chainId+hook+tokenId+version
  chainId: Int!  projectId: Int!  createdAt: Int!  version: Int!
  mintTx: String!
  hook: nftHook             # RELATION (select `hook { address }`); filter with `where: { hook: "0x…" }`
  tokenId: BigInt!
  owner: String!
  category: Int!
  tokenUri: String
  metadata: JSON
  tierId: Int!
  customized: Boolean       # Banny decoration
  customizedAt: Int!
  tier: nftTier  project: project  participant: participant  wallet: wallet
}

type nftTier {             # PK: version+chainId+hook+tierId
  chainId: Int!  projectId: Int!  version: Int!
  hook: nftHook             # RELATION; filter with `where: { hook: "0x…" }`
  tierId: Int!
  price: BigInt!
  allowOwnerMint: Boolean
  encodedIpfsUri: String
  resolvedUri: String
  metadata: JSON
  initialSupply: Int!
  remainingSupply: Int!
  cannotBeRemoved: Boolean
  transfersPausable: Boolean
  votingUnits: BigInt
  createdAt: Int!
  category: Int!
  reserveFrequency: Int
  reserveBeneficiary: String
  svg: String               # Banny tiers only
  nfts: nftPage  project: project
}

type nftHook {             # PK: chainId+address+version
  chainId: Int!  projectId: Int!  createdAt: Int!  version: Int!
  address: String!
  name: String
  symbol: String
  nfts: nftPage  nftTiers: nftTierPage  project: project
}

type mintNftEvent {        # + common event columns
  hook: String!  beneficiary: String!  tierId: Int!  tokenId: BigInt!
  totalAmountPaid: BigInt!
}
type addNftTierEvent {     # + common event columns
  hook: String!  tierId: Int!  price: BigInt!  initialSupply: Int!
  remainingSupply: Int!  category: Int!  encodedIpfsUri: String!
  resolvedUri: String  metadata: JSON
}
type removeNftTierEvent {  # same shape as addNftTierEvent, most fields nullable
  hook: String!  tierId: Int!  price: BigInt  initialSupply: Int
  remainingSupply: Int  category: Int  encodedIpfsUri: String
  resolvedUri: String  metadata: JSON
}
type decorateBannyEvent {  # + common event columns MINUS projectId/suckerGroupId
  bannyBodyId: BigInt!
  outfitIds: [BigInt]
  backgroundId: BigInt
  tokenUri: String
  tokenUriMetadata: JSON
  bannyNft: nft
}
```

### Buyback pools and swaps

```graphql
type swapEvent {           # + common event columns — one row per settled PoolManager Swap on a registered pool
  direction: String!       # "buy" = trader received project tokens; "sell" = trader sent project tokens
                           # into the pool (any V4 sell through the hook, NOT a cash-out — cash-outs are
                           # cashOutTokensEvent); "mint" = buyback hook minted instead of swapping
  poolId: String
  terminalTokenAmount: BigInt!   # terminal-token side of the trade
  projectTokenAmount: BigInt!    # project-token side of the trade
  sqrtPriceX96: BigInt            # exact post-swap V4 spot; null for mint/legacy rows
  projectTokenIsCurrency0: Boolean # token ordering needed to orient sqrtPriceX96
  accountingTokenUsdRate: BigInt  # USD per 1 whole accounting token AT THIS BLOCK, 18-dec; null when no feed
}
```

`from` on a swap row is the tx submitter and `caller` is the router's `RouteSelected` caller; neither is a beneficiary. Swaps on pools never registered through `PoolAdded` are not indexed.

```graphql
type buybackPoolEvent {    # + common event columns — pool registration LOG (one row per PoolAdded)
  terminalToken: String!
  poolId: String!          # Uniswap V4 pool backing the project's buyback
  currency0: String
  currency1: String
  projectTokenIsCurrency0: Boolean
  initialSqrtPriceX96: BigInt      # Initialize/slot0 price at registration; nullable on legacy rows
}

type buybackPool {         # CURRENT registered pool state; PK: chainId+poolId (no suckerGroupId column)
  chainId: Int!  projectId: Int!  version: Int!  createdAt: Int!
  poolId: String!
  terminalToken: String!
  currency0: String!
  currency1: String!
  projectTokenIsCurrency0: Boolean!
  initialSqrtPriceX96: BigInt
  project: project
}

type buybackPoolPosition { # Uniswap V4 LP position in a registered buyback pool; PK: chainId+tokenId
  chainId: Int!  projectId: Int!  version: Int!  createdAt: Int!
  poolId: String!
  tokenId: BigInt!         # PositionManager NFT id (also the position salt)
  owner: String!
  tickLower: Int!
  tickUpper: Int!
  liquidity: BigInt!       # live liquidity
  feeGrowthInside0LastX128: BigInt!
  feeGrowthInside1LastX128: BigInt!
  feesClaimed0: BigInt!    # lifetime fees already collected (not recoverable from chain state)
  feesClaimed1: BigInt!
  updatedAt: Int!
  burned: Boolean!         # burned rows are kept; filter `burned: false` for live positions
  project: project
  pool: buybackPool
}
```

Use `buybackPools(where: { chainId, projectId, version: 6 })` to resolve a project's current pool, and `buybackPoolPositions(where: { chainId, poolId, burned: false })` for its LP table or a wallet's positions (`where: { owner }`) — this is how the remove-liquidity flow avoids walking PoolManager logs.

### Cross-chain (suckers)

```graphql
type suckerTransaction {   # token bridge legs; PK: index+token+chainId+sucker
  index: Int!
  token: String!
  projectId: Int!  chainId: Int!  version: Int!  suckerGroupId: String!  createdAt: Int!
  sucker: String!          # source sucker
  peer: String!            # destination sucker
  peerChainId: Int!        # destination chain
  beneficiary: String!
  projectTokenCount: BigInt!
  terminalTokenAmount: BigInt!
  root: String!
  status: suckerTransactionStatus   # pending | claimable | claimed
  suckerGroup: suckerGroup
}

type bridgeToOutboxEvent { # + common event columns — move queued into outbox tree
  sucker: String!  peer: String!  peerChainId: Int!  token: String!
  beneficiary: String!  projectTokenCount: BigInt!  terminalTokenAmount: BigInt!
  index: Int!  root: String!  hashed: String!
}
type bridgeToRemoteEvent { # + common event columns — outbox root shipped to remote chain
  sucker: String!  peer: String!  peerChainId: Int!  token: String!
  index: Int!  nonce: BigInt!  root: String!
}
type bridgeClaimEvent {    # + common event columns — beneficiary claimed on destination
  sucker: String!  peerChainId: Int!  token: String!  beneficiary: String!
  projectTokenCount: BigInt!  terminalTokenAmount: BigInt!  index: Int!
  autoAddedToBalance: Boolean  metadata: String
}
type accountingSyncEvent { # + common event columns — source chain pushed accounting snapshot to peer
  sucker: String!
  peerChainId: Int!             # destination
  sourceTimestamp: BigInt!      # packed (block.timestamp << 128) | sequence
  sourceTimestampSeconds: BigInt!  # unpacked seconds
}
type inboxRootReceivedEvent { # + common event columns — destination sucker accepted an inbox root
  sucker: String!
  peerChainId: Int!             # source chain
  token: String!  nonce: BigInt!  root: String!
}
```

For sync UIs: show "Syncing…" while a project's latest `accountingSyncEvent` (source side) is newer than the peer's latest accepted snapshot; a matching `inboxRootReceivedEvent` on the destination chain marks it landed.

### Misc entities

```graphql
type projectPayer {        # deployed payer contracts; PK: version+chainId+projectId+address
  chainId: Int!  projectId: Int!  suckerGroupId: String!  version: Int!  createdAt: Int!
  address: String!  owner: String!  deployer: String!
  defaultBeneficiary: String!  defaultMemo: String!  defaultMetadata: String!
  defaultAddToBalance: Boolean!
  paymentsCount: Int!  addToBalanceCount: Int!
  volume: BigInt!  volumeUsd: BigInt!
  balanceAdded: BigInt!  balanceAddedUsd: BigInt!
  totalFacilitated: BigInt!  totalFacilitatedUsd: BigInt!
  lastUsedAt: Int
}

type permissionHolder {    # PK: version+chainId+account+projectId+operator
  chainId: Int!  projectId: Int!  version: Int!
  account: String!  operator: String!
  permissions: [Int]!      # permission IDs granted
  isRevnetOperator: Boolean
}
type operatorPermissionsSetEvent {  # + common event columns
  account: String!  operator: String!  permissions: [Int]!
  packed: BigInt!  isRevnetOperator: Boolean
}

type autoIssueEvent {               # + common event columns MINUS suckerGroupId
  stageId: BigInt!  beneficiary: String!  count: BigInt!
}
type storeAutoIssuanceAmountEvent { # same fields as autoIssueEvent
  stageId: BigInt!  beneficiary: String!  count: BigInt!
}
```

### Historical snapshots

`projectMoment` exists in the schema but is never written (its insert is disabled in the indexer); `projectMoments` queries return empty pages. Chart from `suckerGroupMoments` — a single-chain project has its own single-member group, so this covers every project.

```graphql
type suckerGroupMoment {   # cross-chain time series; PK: suckerGroupId+version+timestamp (NO block field)
  suckerGroupId: String!  version: Int!  timestamp: Int!
  paymentsCount: Int!  redeemCount: Int!
  volume: BigInt!  volumeUsd: BigInt!  redeemVolume: BigInt!  redeemVolumeUsd: BigInt!
  nftsMintedCount: Int!  balance: BigInt!  tokenSupply: BigInt!  reservedTokenSupply: BigInt!
  balanceUsd: BigInt!      # live only
  trendingScore: BigInt!  trendingVolume: BigInt!  trendingPaymentsCount: Int!
  contributorsCount: Int!
  accountingTokenUsdRate: BigInt   # USD per 1 whole accounting token at this moment, 18-dec; null when no feed
}

type participantSnapshot { # per-holder time series; PK: version+chainId+projectId+address+block
  chainId: Int!  projectId: Int!  suckerGroupId: String!  version: Int!
  block: Int!  timestamp: Int!  address: String!
  volume: BigInt!  volumeUsd: BigInt!
  balance: BigInt!  creditBalance: BigInt!  erc20Balance: BigInt!
}
```

---

## Query Examples

All examples filter `version: 6`.

### Get single project

```graphql
query GetProject($projectId: Float!, $chainId: Float!) {
  project(projectId: $projectId, chainId: $chainId, version: 6) {
    id
    name
    handle
    owner
    balance
    volume
    volumeUsd
    tokenSupply
    paymentsCount
    contributorsCount
    suckerGroupId
    token
    tokenSymbol
    decimals
    currency
  }
}
```

### Get sucker group (omnichain totals)

```graphql
query GetSuckerGroup($id: String!) {
  suckerGroup(id: $id) {
    id
    volume
    volumeUsd
    balance
    tokenSupply
    paymentsCount
    contributorsCount
    projects(where: { version: 6 }, limit: 100) {
      items {
        projectId
        chainId
        name
        balance
        volume
        decimals
        currency
      }
    }
  }
}
```

### List projects

```graphql
query ListProjects($limit: Int!, $offset: Int!) {
  projects(
    where: { version: 6 }
    orderBy: "volumeUsd"
    orderDirection: "desc"
    limit: $limit
    offset: $offset
  ) {
    items { projectId chainId name handle volumeUsd balance paymentsCount }
    totalCount
  }
}
```

### Trending projects

```graphql
query Trending($limit: Int!) {
  projects(
    where: { version: 6 }
    orderBy: "trendingScore"
    orderDirection: "desc"
    limit: $limit
  ) {
    items { projectId chainId name trendingScore trendingVolume trendingPaymentsCount }
  }
}
```

### Recent payments

```graphql
query ListPayments($projectId: Int!, $chainId: Int!, $limit: Int!) {
  payEvents(
    where: { projectId: $projectId, chainId: $chainId, version: 6 }
    orderBy: "timestamp"
    orderDirection: "desc"
    limit: $limit
  ) {
    items {
      timestamp txHash from beneficiary amount amountUsd memo newlyIssuedTokenCount
    }
  }
}
```

### Top token holders

```graphql
query TopHolders($projectId: Int!, $chainId: Int!, $limit: Int!) {
  participants(
    where: { projectId: $projectId, chainId: $chainId, version: 6, balance_gt: "0" }
    orderBy: "balance"
    orderDirection: "desc"
    limit: $limit
  ) {
    items { address balance creditBalance erc20Balance volume paymentsCount }
    totalCount
  }
}
```

For omnichain holders, filter on `suckerGroupId` instead of `projectId + chainId` — the same wallet then appears once per chain; paginate the full set and sum `balance` by `address` client-side. Do not use the `/participants` REST endpoint for this (see below).

### Cash outs

```graphql
query ListCashOuts($projectId: Int!, $chainId: Int!, $limit: Int!) {
  cashOutTokensEvents(
    where: { projectId: $projectId, chainId: $chainId, version: 6 }
    orderBy: "timestamp"
    orderDirection: "desc"
    limit: $limit
  ) {
    items { timestamp txHash holder beneficiary cashOutCount reclaimAmount reclaimAmountUsd cashOutTaxRate }
  }
}
```

### Buyback AMM price history

Query pool registrations and swaps separately so a coordinated schema rollout can fall back on one stream without discarding the other:

```graphql
query BuybackPoolRegistrations(
  $suckerGroupId: String!
  $chainIds: [Int!]
  $limit: Int!
  $offset: Int!
) {
  buybackPoolEvents(
    where: { version: 6, suckerGroupId: $suckerGroupId, chainId_in: $chainIds }
    orderBy: "timestamp"
    orderDirection: "asc"
    limit: $limit
    offset: $offset
  ) {
    items {
      timestamp chainId txHash terminalToken poolId currency0 currency1
      projectTokenIsCurrency0 initialSqrtPriceX96
    }
    totalCount
  }
}
```

```graphql
query BuybackSwapHistory(
  $suckerGroupId: String!
  $chainIds: [Int!]
  $limit: Int!
  $offset: Int!
) {
  swapEvents(
    where: { version: 6, suckerGroupId: $suckerGroupId, chainId_in: $chainIds }
    orderBy: "timestamp"
    orderDirection: "asc"
    limit: $limit
    offset: $offset
  ) {
    items {
      timestamp chainId txHash direction poolId
      terminalTokenAmount projectTokenAmount
      sqrtPriceX96 projectTokenIsCurrency0
      accountingTokenUsdRate
    }
    totalCount
  }
}
```

For a USD price axis multiply each point by its own `accountingTokenUsdRate` (null → no USD point), never by today's rate.

`initialSqrtPriceX96` is the real V4 price at `PoolAdded`: the same-transaction `Initialize` price for a new pool, or pool-manager `slot0` at registration for an existing pool. Each swap row's `sqrtPriceX96` is the exact **post-trade** V4 spot. Both use Uniswap's raw encoding:

```
r = (sqrtPriceX96 / 2^96)^2  // raw currency1 per raw currency0
rawTerminalPerProject = projectTokenIsCurrency0 ? r : 1 / r
terminalPerProject = rawTerminalPerProject * 10^(18 - terminalDecimals)
```

V6 project tokens use 18 decimals; `terminalDecimals` comes from the project's accounting context (for example, 6 for USDC). Keep the raw GraphQL `BigInt` value exact and use a decimal/bignumber implementation when display precision matters.

A sucker group can span chains and retain superseded pools. Resolve the current pool with `buybackPools(where: { chainId, projectId, version: 6 })`, then accept only rows matching its exact `chainId` and `poolId`; use a matching pool registration as the first series point, followed by matching swaps in timestamp order. Ignore `direction: "mint"`, which does not touch V4. The new price/order fields are nullable on legacy rows: a swap's `terminalTokenAmount / projectTokenAmount` can be used as a **realized average-price** fallback, never labeled as an exact spot. During rollout, if the server rejects the new swap fields at GraphQL validation time, retry a legacy `swapEvents` selection without `sqrtPriceX96` and `projectTokenIsCurrency0`; do not let a failed pool-registration query erase usable swap history.

### Unified activity feed

Restrict the feed to the event types the UI renders by filtering the embedded-event id columns with `OR: [{ xEvent_not: null }, …]` (this is what every production client does; `type_in: [...]` on the enum also works):

```graphql
query ActivityFeed($suckerGroupId: String!, $limit: Int!, $offset: Int!) {
  activityEvents(
    where: {
      suckerGroupId: $suckerGroupId
      version: 6
      OR: [
        { payEvent_not: null }
        { cashOutTokensEvent_not: null }
        { mintNftEvent_not: null }
        { sendPayoutsEvent_not: null }
        { borrowLoanEvent_not: null }
        { swapEvent_not: null }
        { rulesetQueuedEvent_not: null }
        { projectTransferEvent_not: null }
      ]
    }
    orderBy: "timestamp"
    orderDirection: "desc"
    limit: $limit
    offset: $offset
  ) {
    items {
      id chainId timestamp txHash from type
      payEvent { amount amountUsd beneficiary memo }
      cashOutTokensEvent { cashOutCount reclaimAmount holder }
      mintNftEvent { tierId tokenId totalAmountPaid }
      sendPayoutsEvent { amount amountPaidOut fee }
      borrowLoanEvent { borrowAmount collateral }
      swapEvent {
        direction poolId terminalTokenAmount projectTokenAmount
        sqrtPriceX96 projectTokenIsCurrency0
      }
      rulesetQueuedEvent { rulesetId cycleNumber basedOnId duration weight cashOutTax }
      projectTransferEvent { previousOwner owner }
    }
    totalCount
  }
}
```

`activityEvents` is re-pointed on sucker-group merges, so `suckerGroupId` gives the complete omnichain feed. For a single chain use `where: { projectId, chainId, version: 6, OR: [...] }`.

`activityEvent` has no `beneficiary` column and `from` is the tx sender, so an account page must union two queries: `activityEvents(where: { from: $address, … })` plus the beneficiary-side typed tables (`payEvents(where: { beneficiary: $address })`, `cashOutTokensEvents(where: { beneficiary })`, `mintNftEvents(where: { beneficiary })`, …), then de-duplicate by `id`.

### Loans

```graphql
query ListLoans($projectId: Int!, $chainId: Int!, $limit: Int!) {
  loans(
    where: { projectId: $projectId, chainId: $chainId, version: 6 }
    orderBy: "createdAt"
    orderDirection: "desc"
    limit: $limit
  ) {
    items { id borrowAmount collateral prepaidDuration prepaidFeePercent owner beneficiary token terminal createdAt }
    totalCount
  }
}

query GetLoan($id: BigInt!, $chainId: Float!) {
  loan(id: $id, chainId: $chainId, version: 6) {
    id projectId borrowAmount collateral sourceFeeAmount
    prepaidDuration prepaidFeePercent beneficiary owner token terminal tokenUri createdAt
  }
}
```

### Wallet portfolio

```graphql
query GetWallet($address: String!) {
  wallet(address: $address) {
    address
    volume
    volumeUsd
    lastPaidTimestamp
    participants(where: { version: 6 }, limit: 100) {
      items { projectId chainId balance volume project { name handle } }
    }
    nfts(where: { version: 6 }, limit: 50) {
      items { projectId chainId tokenId tierId }
    }
  }
}
```

### NFT tiers and mints

```graphql
query ListNftTiers($projectId: Int!, $chainId: Int!) {
  nftTiers(
    where: { projectId: $projectId, chainId: $chainId, version: 6 }
    orderBy: "tierId"
    orderDirection: "asc"
    limit: 100
  ) {
    items {
      tierId price initialSupply remainingSupply category
      votingUnits resolvedUri metadata svg reserveFrequency reserveBeneficiary
    }
  }
}

query ListNftMints($projectId: Int!, $chainId: Int!, $limit: Int!) {
  mintNftEvents(
    where: { projectId: $projectId, chainId: $chainId, version: 6 }
    orderBy: "timestamp"
    orderDirection: "desc"
    limit: $limit
  ) {
    items { timestamp txHash beneficiary tierId tokenId totalAmountPaid }
  }
}
```

### Historical snapshots (charts)

Per-project moments are not populated; chart every project (single- or multi-chain) from its group's moments:

```graphql
query GroupHistory($suckerGroupId: String!, $limit: Int!) {
  suckerGroupMoments(
    where: { suckerGroupId: $suckerGroupId, version: 6 }
    orderBy: "timestamp"
    orderDirection: "desc"
    limit: $limit
  ) {
    items {
      timestamp volume volumeUsd balance tokenSupply contributorsCount
      accountingTokenUsdRate
    }
  }
}
```

### Buyback pool LP positions

```graphql
query LpPositions($chainId: Int!, $poolId: String!, $limit: Int!, $offset: Int!) {
  buybackPoolPositions(
    where: { chainId: $chainId, poolId: $poolId, burned: false }
    orderBy: "tokenId"
    orderDirection: "asc"
    limit: $limit
    offset: $offset
  ) {
    items {
      chainId tokenId owner tickLower tickUpper liquidity feesClaimed0 feesClaimed1
    }
    totalCount
  }
}
```

### Cross-chain bridge tracking

```graphql
query BridgeStatus($suckerGroupId: String!, $limit: Int!) {
  suckerTransactions(
    where: { suckerGroupId: $suckerGroupId, version: 6 }
    orderBy: "createdAt"
    orderDirection: "desc"
    limit: $limit
  ) {
    items {
      index chainId peerChainId sucker peer token beneficiary
      projectTokenCount terminalTokenAmount status createdAt
    }
  }
}
```

### Permission holders

```graphql
query Permissions($projectId: Int!, $chainId: Int!) {
  permissionHolders(
    where: { projectId: $projectId, chainId: $chainId, version: 6 }
    limit: 100
  ) {
    items { account operator permissions isRevnetOperator }
  }
}
```

### Cash-out tax history

```graphql
query CashOutTaxHistory($projectId: Int!, $chainId: Int!, $limit: Int!) {
  cashOutTaxSnapshots(
    where: { projectId: $projectId, chainId: $chainId, version: 6 }
    orderBy: "start"
    orderDirection: "desc"
    limit: $limit
  ) {
    items { start duration rulesetId cashOutTax }
  }
}
```

---

## Special Endpoint: `/participants` (latest snapshot per address)

What it does, exactly: collects the distinct `address` values of `participant` rows in the group with `createdAt <= timestamp`, then for each address returns the single most recent `participantSnapshot` with `timestamp <= timestamp` — with NO filter on `suckerGroupId`, `projectId` or `chainId`. It is one row per address, not a per-chain balance sum, and a wallet that also holds tokens in another project can come back with that other project's snapshot. Do not use it for omnichain holder de-duplication, airdrops or governance weights; paginate `participants(where: { suckerGroupId, version: 6 })` and sum by `address` client-side instead. (Block-height snapshots are not offered — block numbers are not comparable across chains.)

```
POST https://bendystraw.up.railway.app/{API_KEY}/participants   (or keyless /participants from an allowlisted origin)
Content-Type: application/json

{ "suckerGroupId": "…", "timestamp": 1704067200 }
```

Response: an array of snapshot objects:

```json
[
  {
    "chainId": 1,
    "projectId": 3,
    "suckerGroupId": "…",
    "timestamp": 1704067100,
    "block": 19000000,
    "address": "0x…",
    "volume": "…",
    "volumeUsd": "…",
    "balance": "…",
    "creditBalance": "…",
    "erc20Balance": "…"
  }
]
```

---

## JavaScript Client

```javascript
const HOST_MAINNET = 'https://bendystraw.up.railway.app';
const HOST_TESTNET = 'https://testnet.bendystraw.xyz';
const API_KEY = process.env.BENDYSTRAW_API_KEY; // optional server-side; required for browser calls from a foreign origin

async function bendystrawQuery(query, variables = {}, host = HOST_MAINNET) {
  const path = API_KEY ? `/${API_KEY}/graphql` : '/graphql';
  const res = await fetch(`${host}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Bendystraw HTTP ${res.status} ${res.statusText}`);
  const body = await res.json();
  if (body.errors?.length) throw new Error(body.errors.map(e => e.message).join('; '));
  return body.data;
}

// Project + omnichain totals
async function getProjectWithGroup(projectId, chainId) {
  const { project } = await bendystrawQuery(`
    query($projectId: Float!, $chainId: Float!) {
      project(projectId: $projectId, chainId: $chainId, version: 6) {
        name handle owner balance volume volumeUsd tokenSupply
        decimals currency suckerGroupId
        suckerGroup {
          volume volumeUsd balance tokenSupply contributorsCount
          projects(where: { version: 6 }, limit: 100) { items { chainId balance volume } }
        }
      }
    }
  `, { projectId, chainId });
  return project;
}
```

### Server-side proxy (Next.js)

```typescript
// app/api/bendystraw/route.ts — server-side, so the keyless route works (no CORS on server fetches)
export async function POST(req: Request) {
  const res = await fetch(
    'https://bendystraw.up.railway.app/graphql',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(await req.json()),
    }
  );
  return Response.json(await res.json());
}
```

---

## Formatting Amounts

### Accounting-token amounts (`amount`, `balance`, `volume`, `reclaimAmount`, …)

Denominated in the project's accounting token, with that token's decimals. Read `project.decimals` and `project.currency` first:

- `project.currency` is the **accounting-context currency**: `uint32(uint160(tokenAddress))`. The native token (`0x…EEEe`) yields `61166`.
- ETH-accounted projects: 18 decimals. USDC-accounted projects: 6 decimals.

```javascript
import { formatUnits } from 'viem';

const NATIVE_CURRENCY = 61166; // uint32(uint160(0x…EEEe))

function formatAmount(raw, decimals, tokenSymbol) {
  return `${formatUnits(BigInt(raw), decimals)} ${tokenSymbol}`;
}
```

Never assume 18 decimals — `formatEther` on a USDC project's balance is wrong by 12 orders of magnitude.

### USD amounts (`volumeUsd`, `amountUsd`, `feeUsd`, …)

Fixed-point with **18 decimals**, returned as strings. Use `BigInt` — `parseFloat` loses precision beyond ~15 digits. For value-over-time use the stored USD columns (`volumeUsd`, `balanceUsd`, `accountingTokenUsdRate` on the row itself); do not multiply a raw accounting-token amount by today's rate — a project can switch accounting context mid-history, so the raw series mixes units. `*Usd` for ERC-20-accounted projects (USDC, …) depends on the indexer's external price feed and is `0` if it was not configured when that row was indexed.

```javascript
function formatUsd(raw) {
  const usd = Number(BigInt(raw) / BigInt(1e12)) / 1e6;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}k`;
  return `$${usd.toFixed(2)}`;
}
```

---

## Best Practices

1. **Filter `version: 6` on every query** — plural via `where`, singular via the PK arg.
2. **Server-side or allowlisted-origin calls go keyless**; a browser on a foreign origin needs the keyed route.
3. **Use `suckerGroup` for cross-chain totals** — pre-aggregated; avoids per-chain fan-out and race conditions.
4. **Filter on `suckerGroupId`** for `activityEvents` and current-state tables; for typed historical event tables also query each member `(chainId, projectId)` and merge, because their `suckerGroupId` is as-of-event.
5. **Cache responses** — indexing lags the chain by a block or two.
6. **Paginate** — `limit` + `offset`, or cursors (`after` + `pageInfo.endCursor`).
7. **Store only deterministic IDs** — `project.id` and `suckerGroup.id`; event `id`s change on reindex.
8. **Read `decimals`/`currency` before formatting** amounts.
9. **Handle nulls** — `name`, `handle`, `token`, `decimals`, `currency` are null until set (e.g. before the first accounting context or metadata resolution).
10. **For AMM history, match both chain and pool** — sucker groups can contain multiple chains and superseded buyback pools. Prefer `sqrtPriceX96` for exact post-trade spot; amount ratios are realized averages only.

---

## Common mistakes

- **Omitting `version: 6`.** The database also contains rows with other `version` values. Every plural query needs `version: 6` in `where`; every singular query needs it as an argument.
- **Wrong singular-arg types.** Singular queries type integer PK args as `Float!`, plural `where` filters use `Int`. Declaring `$projectId: Int!` for `project(...)` fails; declaring `Float!` for a `where` filter fails.
- **`projects_rel` / `hook_rel` do not exist.** A relation that shares a column's name replaces it: `suckerGroup.projects { items { … } }`, `nft.hook { address }`.
- **Same `projectId` on another chain is a different project.** Cross-chain siblings have different ids; find them through `suckerGroup.projects`.
- **`projectMoments` is always empty.** Chart from `suckerGroupMoments`.
- **`volume` excludes `addToBalance`.** Total inflow = `volume` + Σ `addToBalanceEvents.amount`.
- **Filtering a typed event table by `suckerGroupId` only** misses rows written before the group merged.
- **`cashOutEvents` does not exist.** The entity is `cashOutTokensEvent` / query `cashOutTokensEvents`.
- **`project.id` format is `"{version}-{projectId}-{chainId}"`** — version first, chain last.
- **`tokenSymbol` is the accounting token** ("ETH", "USDC"), NOT the project's issued ERC-20 symbol. For the issued token, read `deployErc20Events` (fields `token`, `name`, `symbol`) or query `JBTokens.tokenOf(projectId)` on-chain (`0x1f80d8f057ee36b4c2656d107e4e4558b71ba7d9`, same address on every chain).
- **`project.currency` is not a small enum.** It is `uint32(uint160(accountingToken))` — `61166` for the native token, `uint32(uint160(USDC_ADDRESS))` for USDC. Do not compare it against 1/2-style price-feed currency IDs.
- **`participant` has no `redeemCount`, `firstPaidAt`, or `lastPaidAt`** — the timestamp field is `lastPaidTimestamp`.
- **`payEvent` has no `rulesetId`, `blockNumber`, or `beneficiaryTokenCount`** — token issuance is `newlyIssuedTokenCount`; fee/payout provenance is `feeFromProject` / `distributionFromProjectId`. `amount` is `0` for buyback-routed payments, so never derive a USD rate from `amountUsd / amount`; read `accountingTokenUsdRate` from `swapEvent`/`suckerGroupMoment`.
- **Treating swap amounts as the exact AMM spot.** `terminalTokenAmount / projectTokenAmount` is the realized average across the trade. Use `sqrtPriceX96` for the exact post-trade V4 spot when present.
- **Ignoring `projectTokenIsCurrency0`.** Uniswap's sqrt price is always currency1/currency0. Invert it when the project token is currency1, then apply the project-token (18) and terminal-token decimal adjustment.
- **`suckerTransaction.status` values are `pending | claimable | claimed`** — there is no `completed`/`failed`.
- **`suckerGroupMoment` has no `block` field** — it is keyed by `timestamp` (block numbers are not comparable across chains).
- **`nft.category` is the field name** — there is no `tierCategory`.
- **Storing event `id`s.** They are random UUIDs regenerated on reindex. Key client-side caches on `(chainId, txHash, logIndex)` instead.
