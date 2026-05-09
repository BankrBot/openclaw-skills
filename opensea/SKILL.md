---
name: opensea
description: Query NFT and token data, trade NFTs on Seaport, swap ERC20 tokens via DEX aggregator, configure wallet signing providers, and build/register/gate AI agent tools on Base. Covers the full OpenSea developer surface across CLI, MCP server, shell scripts, and SDK. Pick the right sub-skill using the routing table below, then read that sub-skill's SKILL.md for operational detail.
license: MIT
compatibility: Requires network access and Node.js >= 18. Set $OPENSEA_API_KEY (free instant key at https://docs.opensea.io/reference/api-keys#instant-api-key-for-agents) for all read/write operations. Write operations (marketplace, swaps) additionally require a wallet provider — Bankr, Privy, Turnkey, Fireblocks, or a local PRIVATE_KEY — configured per opensea-wallet/SKILL.md. `curl` and `jq` recommended for shell-script flows.
metadata:
  author: ProjectOpenSea
  version: "1.0"
---

# OpenSea (router)

Entry point for OpenSea agent skills. Pick the sub-skill based on task, then read its `SKILL.md`:

| Task | Sub-skill |
|---|---|
| Query NFT/token data, search, drops, events | [`opensea-api/SKILL.md`](opensea-api/SKILL.md) |
| Buy/sell NFTs on Seaport, sweeps, cross-chain | [`opensea-marketplace/SKILL.md`](opensea-marketplace/SKILL.md) |
| Swap ERC20 tokens via DEX aggregator | [`opensea-swaps/SKILL.md`](opensea-swaps/SKILL.md) |
| Configure wallet signing (Privy/Turnkey/Fireblocks/Bankr) | [`opensea-wallet/SKILL.md`](opensea-wallet/SKILL.md) |
| Build/register/gate AI agent tools (ERC-8257) | [`opensea-tool-sdk/SKILL.md`](opensea-tool-sdk/SKILL.md) |

Always read the sub-skill `SKILL.md` before executing. This router intentionally has no operational detail.

## Quick decision guide

- **Read-only queries** (collections, NFTs, tokens, search, stats, events, drops): `opensea-api`
- **Write operations** (buy, sell, make offers, fulfill listings): `opensea-marketplace`
- **Token swaps** (ERC20 to ERC20, cross-chain): `opensea-swaps`
- **Wallet setup** (before any write operation): `opensea-wallet`
- **Tool building** (register, gate, monetize AI tools): `opensea-tool-sdk`

## Source

Maintained at [github.com/ProjectOpenSea/opensea-skill](https://github.com/ProjectOpenSea/opensea-skill). File issues and contributions there.
