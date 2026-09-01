# Agent Text Record Schema

Standardized ENS text records for Bankr agent metadata, using the `agent:*` namespace established in the [oikonomos framework](https://github.com/estmcmxci/oikonomos).

## Core Records

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `agent:type` | string | Yes | Agent classification. One of: `trading-bot`, `portfolio-manager`, `token-launcher`, `treasury`, `defi`, `nft`, `prediction-market` |
| `agent:capabilities` | string | Yes | Comma-separated list of capabilities the agent supports |
| `agent:chains` | string | Yes | Comma-separated list of chains the agent operates on |
| `agent:version` | semver | No | Agent software version (e.g. `2.1.0`) |
| `agent:creator` | string | No | ENS name or address of the agent's creator |

## Network & API Records

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `agent:a2a` | URL | No | Agent-to-Agent (A2A) protocol endpoint |
| `agent:chainId` | number | No | Primary chain ID (e.g. `8453` for Base) |
| `agent:mode` | string | No | Operating mode: `autonomous` or `supervised` |
| `agent:policy` | string | No | Access policy: `read-only`, `full-access`, or `scoped` |

## Token & Delegation Records

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `agent:token` | address | No | Address of the agent's deployed token contract |
| `agent:token:symbol` | string | No | Token ticker symbol |
| `agent:token:address` | address | No | Explicit token contract address (alias for `agent:token`) |
| `agent:delegation` | string | No | ENS name of the parent agent this agent delegates to |

## Verification Records (ENSIP-25)

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `agent-registration[<registry>][<agentId>]` | string | No | ENSIP-25 attestation linking ENS name to ERC-8004 registry entry. Value is `"1"` (non-empty = endorsement) |

The `<registry>` parameter is an [ERC-7930](https://eips.ethereum.org/EIPS/eip-7930) interoperable address encoding chain + contract address.

## Capabilities Vocabulary

Standard capability values for the `agent:capabilities` field:

| Capability | Description |
|------------|-------------|
| `swap` | Token swaps (same-chain) |
| `bridge` | Cross-chain token bridges |
| `limit-order` | Limit order placement |
| `dca` | Dollar-cost averaging |
| `twap` | Time-weighted average price execution |
| `polymarket` | Prediction market operations |
| `nft` | NFT buying/selling |
| `deploy-token` | ERC-20 token deployment |
| `transfer` | Token/ETH transfers |
| `leverage` | Leveraged/perpetual trading |
| `portfolio` | Portfolio tracking and management |

## Chain Identifiers

Standard chain values for the `agent:chains` field:

| Value | Chain ID | Chain |
|-------|----------|-------|
| `base` | 8453 | Base |
| `ethereum` | 1 | Ethereum Mainnet |
| `polygon` | 137 | Polygon |
| `arbitrum` | 42161 | Arbitrum One |
| `optimism` | 10 | Optimism |
| `unichain` | 130 | Unichain |
| `solana` | — | Solana |

## Example: Full Agent Record Set

For `alpha-go.bankr.eth`:

```
agent:type          = "trading-bot"
agent:capabilities  = "swap,bridge,limit-order,dca"
agent:chains        = "base,ethereum,polygon"
agent:a2a           = "https://api.bankr.bot/agent/alpha-go"
agent:version       = "2.1.0"
agent:creator       = "estmcmxci.eth"
agent:chainId       = "8453"
agent:mode          = "autonomous"
agent:policy        = "full-access"
agent:token         = "0x842cfeb..."
agent:token:symbol  = "ALPH"
agent:delegation    = "treasury.bankr.eth"

# ENSIP-25 verification
agent-registration[0x0001000002210514BA001234...][42] = "1"
```

## Setting Records via NameStone

```typescript
import NameStone from "@namestone/namestone-sdk";
const ns = new NameStone(process.env.NAMESTONE_API_KEY);

await ns.setName({
  name: "alpha-go",
  domain: "bankr.eth",
  address: "0x703ae03fB120eC91e9Ed6d08Ce8044E498CC789B",
  text_records: {
    "agent:type": "trading-bot",
    "agent:capabilities": "swap,bridge,limit-order,dca",
    "agent:chains": "base,ethereum,polygon",
    "agent:a2a": "https://api.bankr.bot/agent/alpha-go",
    "agent:version": "2.1.0",
    "agent:creator": "estmcmxci.eth"
  }
});
```
