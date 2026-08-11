---
name: jb-docs
description: |
  Query Juicebox documentation and reference material. Use when: (1) looking up
  interface definitions, struct schemas, or event signatures, (2) finding
  implementation guides for hooks, terminals, or project configuration,
  (3) searching docs for protocol concepts or patterns, (4) need deployed contract
  addresses (prefer references/shared/chain-config.json for those).
version: 6.0.0
---

# Juicebox V6 Documentation Lookup

Query Juicebox documentation via the docs.juicebox.money MCP server or REST API. **Always request v6 docs** — the API serves version-tagged documents, and only `v6` content applies here. Never accept a result tagged with any other version.

## Sources of Truth, in Order

1. **Contract addresses**: `references/shared/chain-config.json` (generated from deployment artifacts). Do not take addresses from web docs.
2. **Interfaces / structs / events**: the source repos (below) and `references/shared/abis/*.json`.
3. **Concept guides and tutorials**: docs.juicebox.money, filtered to v6.

If a v6 docs query returns no results, the page has not been published yet — fall back to the source repos instead of accepting docs tagged with another version.

## MCP Server (Recommended)

Add to your Claude Code or MCP client configuration:

```json
{
  "mcpServers": {
    "juice-docs": {
      "type": "http",
      "url": "https://docs.juicebox.money/api/mcp-sse"
    }
  }
}
```

### MCP Tools Available

| Tool | Purpose |
|------|---------|
| `search_docs` | Search documentation by keyword |
| `get_doc` | Get full document content by path |
| `list_docs_by_category` | List docs in a category |
| `get_doc_structure` | Get documentation structure |

Pass the v6 version tag with every call that supports one, and only request `dev/v6/...` paths.

```bash
curl -X POST https://docs.juicebox.money/api/mcp-sse \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_docs","arguments":{"query":"pay hook","version":"v6"}}}'
```

## REST API Endpoints

### Search documentation

```bash
POST https://docs.juicebox.money/api/mcp/search
Content-Type: application/json

{
  "query": "pay hook",
  "category": "all",    # all, developer, user, dao, ecosystem
  "version": "v6",      # ALWAYS v6
  "limit": 10
}
```

### Get specific document

```bash
POST https://docs.juicebox.money/api/mcp/get-doc
Content-Type: application/json

{
  "path": "dev/v6/learn/overview.md"
}
```

### List documents by category

```bash
GET https://docs.juicebox.money/api/mcp/list-docs?category=developer&version=v6
```

### Get documentation structure

```bash
GET https://docs.juicebox.money/api/mcp/structure
```

Use the structure response to confirm v6 coverage before relying on search results.

## Using WebFetch

Fetch v6 documentation pages directly:

```
WebFetch https://docs.juicebox.money/dev/v6/build/pay-hook/
"Extract how to implement a pay hook"
```

```
WebFetch https://docs.juicebox.money/dev/v6/learn/overview/
"Summarize the protocol overview"
```

Documentation path layout:

```
/dev/                    # Developer documentation root
/dev/v6/learn/           # Conceptual documentation
/dev/v6/build/           # Implementation guides
/dev/v6/api/             # API reference
/dev/v6/api/core/        # Core contract docs
```

## Source Repositories (ground truth for code)

| Repo | Contents |
|------|----------|
| [Bananapus/nana-core-v6](https://github.com/Bananapus/nana-core-v6) | Core protocol: controller, terminals, rulesets, tokens, splits |
| [Bananapus/nana-721-hook-v6](https://github.com/Bananapus/nana-721-hook-v6) | 721 tiers hook (NFT rewards) |
| [Bananapus/nana-buyback-hook-v6](https://github.com/Bananapus/nana-buyback-hook-v6) | Buyback hook (AMM routing on pay) |
| [Bananapus/nana-suckers-v6](https://github.com/Bananapus/nana-suckers-v6) | Cross-chain suckers |
| [rev-net/revnet-core-v6](https://github.com/rev-net/revnet-core-v6) | Revnets: REVDeployer, REVLoans |
| [mejango/croptop-core-v6](https://github.com/mejango/croptop-core-v6) | Croptop publisher |
| [peripheralist/bendystraw](https://github.com/peripheralist/bendystraw) | GraphQL indexer |

## Common Documentation Queries

### "What's the JBController address on mainnet?"

Read `references/shared/chain-config.json`. Core contracts share one address across all chains — JBController is `0x3fcec3572e84b624477bcff4e2cf1f7deab648f1` everywhere.

### "How do I implement a pay hook?"

```
WebFetch https://docs.juicebox.money/dev/v6/build/pay-hook/
"Extract implementation steps for pay hooks"
```

If unpublished, read `IJBPayHook.sol` and `IJBRulesetDataHook.sol` in nana-core-v6's `src/interfaces/`.

### "What events does JBMultiTerminal emit?"

Prefer `references/shared/abis/JBMultiTerminal.json` (verified deployment ABI) or `nana-core-v6/src/JBMultiTerminal.sol`; docs alternative:

```
WebFetch https://docs.juicebox.money/dev/v6/api/core/jbmultiterminal/
"List all events emitted by JBMultiTerminal"
```

## Official Resources

- **Docs**: https://docs.juicebox.money
- **GitHub**: https://github.com/Bananapus
- **Indexer**: https://bendystraw.xyz (see `/jb-bendystraw`)

## Generation Guidelines

1. **Request v6 only** — pass `version: "v6"` and `dev/v6/...` paths on every call; discard results tagged with any other version.
2. **Addresses from `references/shared/chain-config.json`**, never from fetched pages.
3. **Interfaces/structs from source repos or `references/shared/abis/`** when docs are missing or ambiguous.
4. **Provide direct links** to the v6 pages you used.

## Common mistakes

- **Accepting docs from another version tag.** Search results can include pages for other protocol versions; check the `dev/v6/` path prefix on every result before using it.
- **Copying addresses from docs pages.** Docs can lag deployments; `references/shared/chain-config.json` is generated from the deployment artifacts and is authoritative.
- **Treating an empty v6 result as "feature doesn't exist."** It usually means the page is unpublished — verify against the source repos before concluding anything.
