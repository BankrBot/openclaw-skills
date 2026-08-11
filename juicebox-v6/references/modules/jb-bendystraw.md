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
Mainnets: https://bendystraw.xyz/{API_KEY}/graphql
Testnets: https://testnet.bendystraw.xyz/{API_KEY}/graphql
Schema (no key): GET https://bendystraw.xyz/schema
Playground: https://bendystraw.xyz/schema
```

**Always use the keyed route.** The keyless `/graphql` endpoint sends a fixed `Access-Control-Allow-Origin` header, so browser requests CORS-fail from any other origin. The keyed route (`/{API_KEY}/graphql`) works everywhere.

## Authentication

**API key required.** Contact [@peripheralist](https://x.com/peripheralist) on X to get one.

```javascript
const response = await fetch(`https://bendystraw.xyz/${API_KEY}/graphql`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: '...', variables: { /* ... */ } })
});
```

**Never expose API keys in frontend source you control server-side.** Use a server-side proxy when possible.

---

## Supported Chains

| Database | Chains |
|----------|--------|
| Mainnets (`bendystraw.xyz`) | Ethereum (1), Optimism (10), Base (8453), Arbitrum (42161) |
| Testnets (`testnet.bendystraw.xyz`) | Sepolia (11155111), Optimism Sepolia (11155420), Base Sepolia (84532), Arbitrum Sepolia (421614) |

---

## The `version: 6` Rule

**Every table row carries a `version` column. Juicebox V6 data is `version: 6`. Every query MUST filter on the literal `version: 6`** — the same database contains rows from other protocol deployments tagged with other version values, and mixing them produces garbage.

- Plural queries: put `version: 6` in the `where` clause.
- Singular queries: `version` is part of most compound primary keys — pass `version: 6` as the argument.

```graphql
# Plural — filter
projects(where: { version: 6, chainId: 1 }, ...) { items { ... } }

# Singular — PK argument
project(projectId: 1, chainId: 1, version: 6) { ... }
```

A project is uniquely identified by **`projectId + chainId + version`**. The same `projectId` on multiple chains with `version: 6` IS the same omnichain project (linked via suckers); the same `projectId` with a different `version` is a different thing entirely.

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
| `projectMoment` | `version: Float!, chainId: Float!, projectId: Float!, block: Float!` |
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
  totalCount
}
```

### Filter operators (`where`)

Per column, depending on its type:

| Column type | Operators |
|-------------|-----------|
| all | `field`, `field_not`, `field_in`, `field_not_in` |
| numeric (Int/BigInt) | `field_gt`, `field_gte`, `field_lt`, `field_lte` |
| String | `field_contains`, `field_not_contains`, `field_starts_with`, `field_ends_with`, `field_not_starts_with`, `field_not_ends_with`, plus `_nocase` variants of each |
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
caller: String!
from: String!
logIndex: Int!
projectId: Int!
suckerGroupId: String!
project: project     # relation
```

Exceptions: `burnEvent` / `manualBurnEvent` omit `caller` and `logIndex`; `projectTransferEvent` omits `caller`; `decorateBannyEvent` and `autoIssueEvent` / `storeAutoIssuanceAmountEvent` omit `suckerGroupId` (`decorateBannyEvent` also omits `projectId`).

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
  volume: BigInt!
  volumeUsd: BigInt!
  redeemVolume: BigInt!
  redeemVolumeUsd: BigInt!
  balance: BigInt!
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
  projectMoments: projectMomentPage
  projectPayers: projectPayerPage
  permissionHolders: permissionHolderPage
  activityEvents: activityEventPage
  # …plus a page relation for every event entity (payEvents, cashOutTokensEvents, …)
}
```

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
  tokenSupply: BigInt!
  reservedTokenSupply: BigInt!
  trendingScore: BigInt!
  trendingVolume: BigInt!
  trendingPaymentsCount: Int!
  contributorsCount: Int!

  suckerTransactions: suckerTransactionPage
}
```

Most tables carry a `suckerGroupId` column — filter any event/participant query on it to get cross-chain results in one query.

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
  volume: BigInt!                 # total contributed
  volumeUsd: BigInt!
  lastPaidTimestamp: Int!
  paymentsCount: Int!
  balance: BigInt!                # creditBalance + erc20Balance
  creditBalance: BigInt!          # unclaimed credits
  erc20Balance: BigInt!           # claimed ERC-20 tokens
  wallet: wallet
  project: project
  suckerGroup: suckerGroup
  nfts: nftPage
  loans: loanPage
}
```

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
  from: String!
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
  amount: BigInt!
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
  hook: String!
  tokenId: BigInt!
  owner: String!
  category: Int!
  tokenUri: String
  metadata: JSON
  tierId: Int!
  customized: Boolean       # Banny decoration
  customizedAt: Int!
  tier: nftTier  project: project  hook_rel: nftHook  participant: participant  wallet: wallet
}

type nftTier {             # PK: version+chainId+hook+tierId
  chainId: Int!  projectId: Int!  version: Int!
  hook: String!
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
  nfts: nftPage  project: project  hook_rel: nftHook
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

### Buyback hook events

```graphql
type swapEvent {           # + common event columns — buyback hook AMM trades
  direction: String!       # "buy" (swap), "sell" (cash-out swap), or "mint" (leftover minted instead)
  poolId: String
  terminalTokenAmount: BigInt!   # terminal-token side of the trade
  projectTokenAmount: BigInt!    # project-token side of the trade
  sqrtPriceX96: BigInt            # exact post-swap V4 spot; null for mint/legacy rows
  projectTokenIsCurrency0: Boolean # token ordering needed to orient sqrtPriceX96
}

type buybackPoolEvent {    # + common event columns — pool registrations
  terminalToken: String!
  poolId: String!          # Uniswap V4 pool backing the project's buyback
  currency0: String
  currency1: String
  projectTokenIsCurrency0: Boolean
  initialSqrtPriceX96: BigInt      # Initialize/slot0 price at registration; nullable on legacy rows
}
```

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

```graphql
type projectMoment {       # per-project time series; PK: version+chainId+projectId+block
  projectId: Int!  chainId: Int!  version: Int!
  block: Int!  timestamp: Int!
  volume: BigInt!  volumeUsd: BigInt!  balance: BigInt!  trendingScore: BigInt!
}

type suckerGroupMoment {   # cross-chain time series; PK: suckerGroupId+version+timestamp (NO block field)
  suckerGroupId: String!  version: Int!  timestamp: Int!
  paymentsCount: Int!  redeemCount: Int!
  volume: BigInt!  volumeUsd: BigInt!  redeemVolume: BigInt!  redeemVolumeUsd: BigInt!
  nftsMintedCount: Int!  balance: BigInt!  tokenSupply: BigInt!  reservedTokenSupply: BigInt!
  trendingScore: BigInt!  trendingVolume: BigInt!  trendingPaymentsCount: Int!
  contributorsCount: Int!
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
    projects {
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

For omnichain holders, filter on `suckerGroupId` instead of `projectId + chainId` — but note the same wallet then appears once per chain; aggregate by `address` client-side or use the `/participants` REST endpoint.

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
    }
    totalCount
  }
}
```

`initialSqrtPriceX96` is the real V4 price at `PoolAdded`: the same-transaction `Initialize` price for a new pool, or pool-manager `slot0` at registration for an existing pool. Each swap row's `sqrtPriceX96` is the exact **post-trade** V4 spot. Both use Uniswap's raw encoding:

```
r = (sqrtPriceX96 / 2^96)^2  // raw currency1 per raw currency0
rawTerminalPerProject = projectTokenIsCurrency0 ? r : 1 / r
terminalPerProject = rawTerminalPerProject * 10^(18 - terminalDecimals)
```

V6 project tokens use 18 decimals; `terminalDecimals` comes from the project's accounting context (for example, 6 for USDC). Keep the raw GraphQL `BigInt` value exact and use a decimal/bignumber implementation when display precision matters.

A sucker group can span chains and retain superseded pools. Resolve the current onchain pool, then accept only rows matching its exact `chainId` and `poolId`; use a matching pool registration as the first series point, followed by matching swaps in timestamp order. Ignore `direction: "mint"`, which does not touch V4. The new price/order fields are nullable on legacy rows: a swap's `terminalTokenAmount / projectTokenAmount` can be used as a **realized average-price** fallback, never labeled as an exact spot. During rollout, if the server rejects the new swap fields at GraphQL validation time, retry a legacy `swapEvents` selection without `sqrtPriceX96` and `projectTokenIsCurrency0`; do not let a failed pool-registration query erase usable swap history.

### Unified activity feed

```graphql
query ActivityFeed($projectId: Int!, $chainId: Int!, $limit: Int!) {
  activityEvents(
    where: { projectId: $projectId, chainId: $chainId, version: 6 }
    orderBy: "timestamp"
    orderDirection: "desc"
    limit: $limit
  ) {
    items {
      id timestamp txHash from type
      payEvent { amount amountUsd beneficiary memo }
      cashOutTokensEvent { cashOutCount reclaimAmount holder }
      mintNftEvent { tierId tokenId totalAmountPaid }
      sendPayoutsEvent { amount amountPaidOut fee }
      borrowLoanEvent { borrowAmount collateral }
      swapEvent {
        direction poolId terminalTokenAmount projectTokenAmount
        sqrtPriceX96 projectTokenIsCurrency0
      }
      rulesetQueuedEvent { rulesetId duration weight cashOutTax }
      projectTransferEvent { previousOwner owner }
    }
  }
}
```

For an omnichain feed, use `where: { suckerGroupId: $suckerGroupId, version: 6 }` and include `chainId` in items.

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

```graphql
query ProjectHistory($projectId: Int!, $chainId: Int!, $limit: Int!) {
  projectMoments(
    where: { projectId: $projectId, chainId: $chainId, version: 6 }
    orderBy: "timestamp"
    orderDirection: "desc"
    limit: $limit
  ) {
    items { block timestamp volume volumeUsd balance trendingScore }
  }
}

query GroupHistory($suckerGroupId: String!, $limit: Int!) {
  suckerGroupMoments(
    where: { suckerGroupId: $suckerGroupId, version: 6 }
    orderBy: "timestamp"
    orderDirection: "desc"
    limit: $limit
  ) {
    items { timestamp volume volumeUsd balance tokenSupply contributorsCount }
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

## Special Endpoint: `/participants` (holder snapshot at timestamp)

Retrieves every `participantSnapshot` for a sucker group at a given unix timestamp, de-duped by wallet address. Use for governance snapshots and airdrops. (Block-height snapshots are not offered — block numbers are not comparable across chains.)

```
POST https://bendystraw.xyz/{API_KEY}/participants
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
const HOST_MAINNET = 'https://bendystraw.xyz';
const HOST_TESTNET = 'https://testnet.bendystraw.xyz';
const API_KEY = process.env.BENDYSTRAW_API_KEY;

async function bendystrawQuery(query, variables = {}, host = HOST_MAINNET) {
  const res = await fetch(`${host}/${API_KEY}/graphql`, {
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
          projects { items { chainId balance volume } }
        }
      }
    }
  `, { projectId, chainId });
  return project;
}
```

### Server-side proxy (Next.js)

```typescript
// app/api/bendystraw/route.ts
export async function POST(req: Request) {
  const res = await fetch(
    `https://bendystraw.xyz/${process.env.BENDYSTRAW_API_KEY}/graphql`,
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

Fixed-point with **18 decimals**, returned as strings. Use `BigInt` — `parseFloat` loses precision beyond ~15 digits:

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
2. **Use the keyed route** — the keyless `/graphql` route is origin-locked (CORS).
3. **Use `suckerGroup` for cross-chain totals** — pre-aggregated; avoids per-chain fan-out and race conditions.
4. **Filter on `suckerGroupId`** for omnichain event/holder queries.
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
- **`projects_rel` does not exist.** `suckerGroup.projects` is the relation and returns a page: `projects { items { … } }`.
- **`cashOutEvents` does not exist.** The entity is `cashOutTokensEvent` / query `cashOutTokensEvents`.
- **`project.id` format is `"{version}-{projectId}-{chainId}"`** — version first, chain last.
- **`tokenSymbol` is the accounting token** ("ETH", "USDC"), NOT the project's issued ERC-20 symbol. For the issued token, read `deployErc20Events` (fields `token`, `name`, `symbol`) or query `JBTokens.tokenOf(projectId)` on-chain (`0x1f80d8f057ee36b4c2656d107e4e4558b71ba7d9`, same address on every chain).
- **`project.currency` is not a small enum.** It is `uint32(uint160(accountingToken))` — `61166` for the native token, `uint32(uint160(USDC_ADDRESS))` for USDC. Do not compare it against 1/2-style price-feed currency IDs.
- **`participant` has no `redeemCount`, `firstPaidAt`, or `lastPaidAt`** — the timestamp field is `lastPaidTimestamp`.
- **`payEvent` has no `rulesetId`, `blockNumber`, or `beneficiaryTokenCount`** — token issuance is `newlyIssuedTokenCount`; fee/payout provenance is `feeFromProject` / `distributionFromProjectId`.
- **Treating swap amounts as the exact AMM spot.** `terminalTokenAmount / projectTokenAmount` is the realized average across the trade. Use `sqrtPriceX96` for the exact post-trade V4 spot when present.
- **Ignoring `projectTokenIsCurrency0`.** Uniswap's sqrt price is always currency1/currency0. Invert it when the project token is currency1, then apply the project-token (18) and terminal-token decimal adjustment.
- **`suckerTransaction.status` values are `pending | claimable | claimed`** — there is no `completed`/`failed`.
- **`suckerGroupMoment` has no `block` field** — it is keyed by `timestamp` (block numbers are not comparable across chains).
- **`nft.category` is the field name** — there is no `tierCategory`.
- **Storing event `id`s.** They are random UUIDs regenerated on reindex. Key client-side caches on `(chainId, txHash, logIndex)` instead.
