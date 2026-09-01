---
name: index-supply
description: Query Ethereum event logs and onchain data using Index Supply's stateless SQL API. Use when the user wants to query blockchain events, search transaction logs, look up token transfers, index Ethereum/Base/OP/Arbitrum data, write SQL against event signatures, stream live onchain events via SSE, or fetch block/transaction/log data across EVM chains.
---

# Index Supply

Hosted HTTP API for running SQL queries on Ethereum blocks, transactions, and event logs. No indexing step required — provide an event signature and query it instantly with SQL.

**Base URL**: `https://api.indexsupply.net`

## Authentication

Pass `api-key` as a query parameter. Get a key at [indexsupply.net/account](https://www.indexsupply.net/account).

Free tier is rate-limited to 5 queries/minute (no key required).

## Signatures

A signature is a human-readable ABI event definition that creates a virtual SQL table. The table name is the lowercased event name, columns match the parameter names.

```
Transfer(address indexed from, address indexed to, uint tokens)
```

Produces a virtual table:

```sql
transfer(from bytea, to bytea, tokens numeric)
```

Queryable as:

```sql
select "from", "to", tokens from transfer where chain = 8453 limit 10
```

Multiple signatures enable JOINs across virtual tables. Nested ABI types become `jsonb` columns.

An optional `event` or `function` prefix controls whether the query targets logs or transaction inputs:

```
event Foo(uint a)      -- targets logs (default)
function bar(uint b)   -- targets txs table
```

## Endpoints

### Single Query — `GET /v2/query`

```bash
curl -G 'https://api.indexsupply.net/v2/query?api-key=YOUR_KEY' \
  --data-urlencode 'query=select "from", "to", tokens from transfer where chain = 8453 limit 3' \
  --data-urlencode 'signatures=Transfer(address indexed from, address indexed to, uint tokens)'
```

Multiple signatures:

```bash
curl -G 'https://api.indexsupply.net/v2/query?api-key=YOUR_KEY' \
  --data-urlencode 'query=select a, b from foo, bar where foo.c = bar.c' \
  --data-urlencode 'signatures=Foo(uint a, uint c)' \
  --data-urlencode 'signatures=Bar(uint b, uint c)'
```

### Batch Query — `POST /v2/query`

Executes multiple queries in a single database transaction for consistent reads.

```bash
curl -X POST 'https://api.indexsupply.net/v2/query?api-key=YOUR_KEY' \
  -H "Content-Type: application/json" \
  -d '[
    {
      "signatures": ["Transfer(address indexed from, address indexed to, uint tokens)"],
      "query": "select tokens from transfer where chain = 8453 limit 1"
    },
    {
      "signatures": ["Approval(address indexed owner, address indexed spender, uint value)"],
      "query": "select value from approval where chain = 8453 limit 1"
    }
  ]'
```

### Live Query (SSE) — `GET /v2/query-live`

Streams results via Server-Sent Events as new blocks are indexed. Each event is `data: <json>\n\n`.

```bash
curl -G -N 'https://api.indexsupply.net/v2/query-live?api-key=YOUR_KEY' \
  --data-urlencode 'cursor=8453-0' \
  --data-urlencode 'query=select tokens from transfer where chain = 8453 limit 1' \
  --data-urlencode 'signatures=Transfer(address indexed from, address indexed to, uint tokens)'
```

## Cursor

Every response includes a `cursor` string (e.g. `"8453-29772171"`) encoding `chain-nextBlock`. Pass it back in subsequent requests to get only new data:

```bash
curl -G 'https://api.indexsupply.net/v2/query?api-key=YOUR_KEY' \
  --data-urlencode 'cursor=8453-29772171' \
  --data-urlencode 'query=select tokens from transfer where chain = 8453 limit 10' \
  --data-urlencode 'signatures=Transfer(address indexed from, address indexed to, uint tokens)'
```

Multi-chain cursors chain together: `chain1-block1-chain2-block2`.

## Response Format

Always a JSON array (single-element for GET, multi-element for batch POST):

```json
[{
  "cursor": "8453-29772171",
  "columns": [
    {"name": "from", "pgtype": "bytea"},
    {"name": "tokens", "pgtype": "numeric"}
  ],
  "rows": [
    ["0x0000000000000000000000000000000000000000", "1000000"]
  ]
}]
```

| ABI Type | JSON Type          |
|----------|--------------------|
| bool     | bool               |
| bytesN   | hexadecimal string |
| string   | string             |
| intN     | decimal string     |
| uintN    | decimal string     |

## Reorgs

If a live query sends a block height lower than a previously received one, discard all state and re-query from scratch.

## SQL Reference

Supported subset of Postgres SQL:

- `SELECT`, `FROM`, `WHERE`, `GROUP BY`, `HAVING`, `ORDER BY`, `LIMIT`, `OFFSET`
- Aggregates: `sum()`, `count()`, `avg()`, `min()`, `max()`
- Joins: `INNER`, `LEFT`, `RIGHT`, `FULL OUTER`
- Subqueries: `EXISTS`, `NOT EXISTS`, `IN`, `NOT IN`
- Operators: `+`, `-`, `*`, `/`, `%`, `=`, `<>`, `<`, `>`, `<=`, `>=`, `IS NULL`, `IS NOT NULL`, `AND`, `OR`, `NOT`

Quote reserved words used as column names (e.g. `"from"`, `"to"`).

## EVM Base Tables

These tables are queryable directly without signatures.

**blocks**: `chain`, `num`, `timestamp`, `hash`, `miner`, `gas_used`, `gas_limit`, `size`, `nonce`, `receipts_root`, `state_root`, `extra_data`

**txs**: `chain`, `block_num`, `block_timestamp`, `idx`, `type`, `hash`, `from`, `to`, `input`, `value`, `gas`, `gas_price`, `nonce`

**logs**: `chain`, `block_num`, `block_timestamp`, `log_idx`, `tx_hash`, `address`, `topics`, `data`

## Supported Chains

| Chain        | ID      |
|--------------|---------|
| Ethereum     | 1       |
| OP           | 10      |
| BNB          | 56      |
| Polygon      | 137     |
| World        | 480     |
| Base         | 8453    |
| Arbitrum One | 42161   |
| Linea        | 59144   |
| Base Sepolia | 84532   |
| Scroll       | 534352  |
| Zora         | 7777777 |

Full list at [indexsupply.net/docs](https://www.indexsupply.net/docs#getting-started). Email support@indexsupply.com for new chains.

### Cross-Chain Queries

```sql
select a from foo where chain in (1, 10, 8453)
```

Per-chain block ranges:

```sql
select a from foo
where (chain = 8453 and block_num > 42)
   or (chain = 10 and block_num > 100)
```

## Common Patterns

### Latest token holders (self-join for most recent transfer)

```bash
curl -G 'https://api.indexsupply.net/v2/query?api-key=YOUR_KEY' \
  --data-urlencode 'query=
    SELECT t1."to", t1.tokenId, t1.block_num
    FROM transfer t1
    LEFT JOIN transfer t2
      ON t1.address = t2.address
      AND t1.tokenId = t2.tokenId
      AND t1.block_num < t2.block_num
    WHERE t1.address = 0xE81b94b09B9dE001b75f2133A0Fb37346f7E8BA4
      AND t2.tokenId IS NULL' \
  --data-urlencode 'signatures=Transfer(address indexed from, address indexed to, uint tokenId)'
```

### Aggregate transfers by recipient

```bash
curl -G 'https://api.indexsupply.net/v2/query?api-key=YOUR_KEY' \
  --data-urlencode 'query=
    select "to", sum(value) as total
    from transfer
    where chain = 8453
      and address = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
    group by "to"
    order by total desc
    limit 10' \
  --data-urlencode 'signatures=Transfer(address indexed from, address indexed to, uint value)'
```
