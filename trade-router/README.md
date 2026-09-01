# Trade Router — ClawHub skill

**Non-custodial Solana trading API for AI agents.** One interface for swaps, MEV-protected execution, wallet holdings, limit orders, trailing stops, DCA, TWAP, and combo orders. The private key stays with the agent that calls the API.

[![Security: non-custodial](https://img.shields.io/badge/Security-Non%20Custodial-green.svg)](./SECURITY.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

## Is this safe?

**Yes, and here's exactly why.** The private key never crosses the network to api.traderouter.ai. `POST /swap` returns an *unsigned* transaction; the agent signs it locally; only the *signed* transaction goes to `POST /protect` (Jito MEV-protected bundle). Server responses are Ed25519-verified against a hard-coded trust anchor. See [SECURITY.md](./SECURITY.md) for the full threat model, data-flow diagram, and permissions manifest.

**Signing flow:**

1. Agent calls the skill's `swap` action → HTTPS request to api.traderouter.ai sends the wallet *address* (public key), token mint, amount
2. API returns an **unsigned** transaction
3. Agent **signs the tx locally** with its private key
4. The *signed* transaction is submitted to `/protect` (Jito MEV-protected bundle)
5. Server confirms and returns balance changes. The private key never leaves the agent's machine.

## Two ways to consume this skill

### A. Direct API integration (what SKILL.md documents)

Read `SKILL.md` for the full API spec — REST endpoints, WebSocket order protocol, request/response shapes, error handling, and reference agent example code. Pair it with any HTTP client and Solana signing library.

The example code in SKILL.md uses these conventions (feel free to pick your own — they're the agent's choice, not imposed by the API):

| Example env var | Example default | Purpose in the reference agent |
|---|---|---|
| `PRIVATE_KEY` | *(required)* | Solana base58 private key held by the agent process |
| `DRY_RUN` | `true` | Safe-by-default gate — swap actions only submit when you set `DRY_RUN=false` |
| `MAX_DAILY_LOSS_LAMPORTS` | `2_000_000_000` (2 SOL) | Activates the reference agent's `KILL_SWITCH` when exceeded |

These are the reference agent's own conventions. The API itself doesn't require any of them.

### B. Ready-made MCP server (`@traderouter/trade-router-mcp`)

For Claude Desktop, Cursor, Cline, and any [MCP](https://modelcontextprotocol.io)-compatible client, a published MCP server wraps the same API:

```bash
npx -y @traderouter/trade-router-mcp
```

Or wire it into your MCP client config:

```json
{
  "mcpServers": {
    "traderouter": {
      "command": "npx",
      "args": ["-y", "@traderouter/trade-router-mcp"],
      "env": {
        "TRADEROUTER_PRIVATE_KEY": "your_base58_private_key"
      }
    }
  }
}
```

The MCP server's env conventions are different from the example code in SKILL.md — they're prefixed with `TRADEROUTER_` for namespace hygiene in multi-MCP environments:

| MCP env var | Required | Purpose |
|---|---|---|
| `TRADEROUTER_PRIVATE_KEY` | ✅ | Solana base58 private key (local use only) |
| `SOLANA_RPC_URL` | ❌ | Custom RPC (defaults to mainnet-beta) |
| `TRADEROUTER_SERVER_PUBKEY` | ❌ | Override the server Ed25519 trust anchor |
| `TRADEROUTER_SERVER_PUBKEY_NEXT` | ❌ | Accept an additional key during server rotation |
| `TRADEROUTER_REQUIRE_SERVER_SIGNATURE` | ❌ | Default `true`; fail-closed on `order_filled` verification |
| `TRADEROUTER_REQUIRE_ORDER_CREATED_SIGNATURE` | ❌ | Default `true`; fail-closed on `order_created` verification |

The MCP server does **not** currently implement `DRY_RUN` or daily-loss caps — those live only in the reference agent example in SKILL.md. If you need them end-to-end, either use the reference agent pattern directly, or wrap the MCP tool calls with your own gate.

Full details, all 21 tools, and the LangChain adapter snippet are in the npm package README: <https://www.npmjs.com/package/@traderouter/trade-router-mcp>

## Features

### REST endpoints

| Endpoint | Purpose |
|---|---|
| `POST /swap` | Build unsigned swap (multi-DEX: Raydium, PumpSwap, Orca, Meteora) |
| `POST /protect` | Submit signed tx via Jito bundle — MEV-protected, returns confirmed balance changes |
| `POST /holdings` | Accurate wallet scan — catches tokens standard RPC misses |
| `GET /mcap` | Market cap + price for any token |
| `GET /flex` | Trade card PNG generation |
| `GET /security` | Server trust-anchor public key |

### WebSocket (`wss://api.traderouter.ai/ws`)

Persistent connection for server-side order monitoring:

- **Limit orders** — trigger by market cap or price
- **Trailing stops** — percentage or absolute
- **DCA / TWAP** — time-weighted execution
- **Combo orders** — limit+trailing, limit+TWAP, trailing+TWAP, limit+trailing+TWAP

Server polls market-cap ~every 5s. When an order triggers, you receive an unsigned tx → sign locally → submit.

## Trust anchor

The baked-in server public key is `EXX3nRzfDUvbjZSmxFzHDdiSYeGVP1EGr77iziFZ4Jd4`. Every `order_filled`, `order_created`, and `twap_execution` message is Ed25519-verified against this key before being treated as authoritative. The server can rotate via `TRADEROUTER_SERVER_PUBKEY_NEXT`.

## Fees

Flat **1% fee on swap volume**, embedded in routing at `/protect`. No subscription, no API key, no monthly minimums. Read-only endpoints (`/holdings`, `/mcap`) are free.

## Links

- **Website:** <https://traderouter.ai>
- **llms.txt:** <https://traderouter.ai/llms.txt>
- **npm (MCP server):** <https://www.npmjs.com/package/@traderouter/trade-router-mcp>
- **PyPI (MCP server):** <https://pypi.org/project/traderouter-mcp/>
- **MCP Registry:** <https://registry.modelcontextprotocol.io/v0/servers?search=trade-router>
- **ClawHub listing:** <https://clawhub.ai/re-bruce-wayne/trade-router>
- **GitHub source:** <https://github.com/re-bruce-wayne/openclaw-skills/tree/main/trade-router>
- **X/Twitter:** <https://x.com/trade_router>
- **Moltbook:** <https://moltbook.com/u/traderouter>

## Security disclosure

Found a vulnerability? Email **security@traderouter.ai** or use GitHub Security Advisories on this repo. 48-hour acknowledgement. See [SECURITY.md](./SECURITY.md) for the full policy.

## License

MIT. See [LICENSE](./LICENSE).

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).
