# Snapshot Hub GraphQL API Reference

Endpoint: `https://hub.snapshot.org/graphql`
Testnet: `https://testnet.hub.snapshot.org/graphql`
Rate limit: 100 req/min (no key) · 2M req/month (with API key via `x-api-key` header)

## Spaces

### Get a single space
```graphql
query {
  space(id: "ens.eth") {
    id name about network symbol
    members admins
    strategies { name network params }
    voting { delay period quorum type privacy }
    filters { minScore onlyMembers }
    validation { name params }
  }
}
```

### Get multiple spaces
```graphql
query {
  spaces(first: 20, skip: 0, orderBy: "created", orderDirection: desc,
         where: { id_in: ["ens.eth", "aave.eth"] }) {
    id name network symbol
    strategies { name params }
  }
}
```
Arguments: `first`, `skip`, `where.id`, `where.id_in`, `orderBy`, `orderDirection`

## Proposals

### Get a single proposal
```graphql
query {
  proposal(id: "0x...") {
    id title body choices start end snapshot state
    author created type privacy
    scores scores_total scores_updated
    scores_by_strategy
    quorum
    strategies { name network params }
    space { id name }
    plugins network
  }
}
```

### Get proposals (filtered)
```graphql
query {
  proposals(first: 20, skip: 0,
    where: { space_in: ["ens.eth"], state: "active" },
    orderBy: "created", orderDirection: desc) {
    id title body choices start end snapshot state
    author scores scores_total type
    space { id name }
  }
}
```
Arguments: `first`, `skip`, `where.id`, `where.id_in`, `where.space`, `where.space_in`, `where.author`, `where.author_in`, `where.network`, `where.network_in`, `where.state` (active/closed/pending), `orderBy`, `orderDirection`

## Votes

> **Choices are 1-indexed.** Choice 1 = first option.

### Get a single vote
```graphql
query {
  vote(id: "Qm...") {
    id voter vp vp_by_strategy vp_state created
    choice reason
    proposal { id }
    space { id }
  }
}
```

### Get votes for a proposal
```graphql
query {
  votes(first: 1000, skip: 0,
    where: { proposal: "0x..." },
    orderBy: "vp", orderDirection: desc) {
    id voter vp created choice reason
    space { id }
  }
}
```
Arguments: `first`, `skip`, `where.id`, `where.id_in`, `where.space`, `where.space_in`, `where.voter`, `where.voter_in`, `where.proposal`, `where.proposal_in`, `orderBy`, `orderDirection`

### Check if an address already voted
```graphql
query {
  votes(where: { proposal: "0x...", voter: "0xYOUR_ADDRESS" }) {
    id choice vp created
  }
}
```

## Voting Power

```graphql
query {
  vp(voter: "0x...", space: "ens.eth", proposal: "0x...") {
    vp vp_by_strategy vp_state
  }
}
```

## Follows

```graphql
query {
  follows(first: 25, where: { follower: "0x..." }) {
    follower space { id } created
  }
}
```
Arguments: `first`, `skip`, `where.follower`, `where.follower_in`, `where.space`, `where.space_in`

## Aliases & Subscriptions

```graphql
query {
  aliases(where: { address: "0x..." }) { address alias created }
  subscriptions(where: { address: "0x...", space: "ens.eth" }) { address space { id } }
}
```

## Common Patterns

### Active proposals in spaces you follow
```graphql
query {
  proposals(first: 50, where: {
    space_in: ["ens.eth", "aave.eth", "uniswapgovernance.eth"],
    state: "active"
  }, orderBy: "end", orderDirection: asc) {
    id title end choices scores scores_total type
    space { id name }
  }
}
```

### Vote results breakdown
```graphql
query {
  proposal(id: "0x...") {
    title choices scores scores_total type state
    votes
  }
}
```

### Your voting history in a space
```graphql
query {
  votes(first: 100, where: { voter: "0xYOU", space: "ens.eth" },
        orderBy: "created", orderDirection: desc) {
    id choice vp created reason
    proposal { id title state }
  }
}
```
