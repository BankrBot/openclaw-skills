# Supported chains, addresses, and common tokens

Ophis is **same-chain best execution** (MEV-protected CoW batch settlement). For cross-chain bridging, use a bridging skill (`symbiosis`, `trails`).

## Chains

| Chain | ID | Orderbook base URL | Settlement (setPreSignature) | VaultRelayer (approve) | Model | Bankr-native? |
|---|---|---|---|---|---|---|
| Base | 8453 | `https://api.cow.fi/base` | `0x9008D19f58AAbD9eD0D60971565AA8510560ab41` | `0xC92E8bdf79f0507f65a392b0ab4667716BFE0110` | CoW-hosted | ✅ |
| Unichain | 130 | `https://unichain-mainnet.ophis.fi` | `0x108A678716e5E1776036eF044CAB7064226F714E` | `0xaB29E2a859704C914E55566Ae9b3A7EDE25959cb` | **Ophis-sovereign** | ✅ |
| Arbitrum | 42161 | `https://api.cow.fi/arbitrum_one` | `0x9008D19f58AAbD9eD0D60971565AA8510560ab41` | `0xC92E8bdf79f0507f65a392b0ab4667716BFE0110` | CoW-hosted | ✅ |
| Polygon | 137 | `https://api.cow.fi/polygon` | `0x9008D19f58AAbD9eD0D60971565AA8510560ab41` | `0xC92E8bdf79f0507f65a392b0ab4667716BFE0110` | CoW-hosted | ✅ |
| BNB | 56 | `https://api.cow.fi/bnb` | `0x9008D19f58AAbD9eD0D60971565AA8510560ab41` | `0xC92E8bdf79f0507f65a392b0ab4667716BFE0110` | CoW-hosted | ✅ |
| Ethereum | 1 | `https://api.cow.fi/mainnet` | `0x9008D19f58AAbD9eD0D60971565AA8510560ab41` | `0xC92E8bdf79f0507f65a392b0ab4667716BFE0110` | CoW-hosted | ✅ |
| Optimism | 10 | `https://optimism-mainnet.ophis.fi` | `0x310784c7FCE12d578dA6f53460777bAc9718B859` | `0x83847EaB41ad9ea43809ce71569eB2e9daF51830` | **Ophis-sovereign** | ⚠️ verify |
| Gnosis | 100 | `https://api.cow.fi/xdai` | `0x9008D19f58AAbD9eD0D60971565AA8510560ab41` | `0xC92E8bdf79f0507f65a392b0ab4667716BFE0110` | CoW-hosted | ❌ |
| Avalanche | 43114 | `https://api.cow.fi/avalanche` | `0x9008D19f58AAbD9eD0D60971565AA8510560ab41` | `0xC92E8bdf79f0507f65a392b0ab4667716BFE0110` | CoW-hosted | ❌ |
| Linea | 59144 | `https://api.cow.fi/linea` | `0x9008D19f58AAbD9eD0D60971565AA8510560ab41` | `0xC92E8bdf79f0507f65a392b0ab4667716BFE0110` | CoW-hosted | ❌ |
| Plasma | 9745 | `https://api.cow.fi/plasma` | `0x9008D19f58AAbD9eD0D60971565AA8510560ab41` | `0xC92E8bdf79f0507f65a392b0ab4667716BFE0110` | CoW-hosted | ❌ |
| Ink | 57073 | `https://api.cow.fi/ink` | `0x9008D19f58AAbD9eD0D60971565AA8510560ab41` | `0xC92E8bdf79f0507f65a392b0ab4667716BFE0110` | CoW-hosted | ❌ |
| Sepolia (testnet) | 11155111 | `https://api.cow.fi/sepolia` | `0x9008D19f58AAbD9eD0D60971565AA8510560ab41` | `0xC92E8bdf79f0507f65a392b0ab4667716BFE0110` | CoW-hosted | ❌ |

- **Sovereign** (OP, Unichain): Ophis runs its own solver stack; 100% of price improvement is returned to the trader; contracts are non-canonical (use the addresses above, not CoW's canonical ones).
- **Bankr-native** = Bankr's Submit API can transact there today. The best targets are **Base and Unichain** (Bankr-native AND a live Ophis stack). Chains marked ❌ are Ophis-supported but Bankr may not submit there — the swap flow still constructs, but the Bankr Submit calls (approve / setPreSignature) will fail on an unsupported chain.

## Common token addresses

| Token | Chain | Address | Decimals |
|---|---|---|---|
| USDC | Base (8453) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | 6 |
| WETH | Base (8453) | `0x4200000000000000000000000000000000000006` | 18 |
| USDC | Ethereum (1) | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | 6 |
| WETH | Ethereum (1) | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | 18 |
| USDC | Arbitrum (42161) | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | 6 |
| USDC | Polygon (137) | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` | 6 |

> Always verify a token address on-chain before swapping. For chains/tokens not listed, resolve the ERC-20 address (e.g. via a block explorer or another Bankr skill) and pass it with its decimals.
