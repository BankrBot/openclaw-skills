# Aerodrome — Base Token Addresses & Contracts

## Base Token Addresses

| Token | Address | Decimals |
|-------|---------|----------|
| Native ETH (pseudo-token for swaps) | `ETH` | 18 |
| WETH | `0x4200000000000000000000000000000000000006` | 18 |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | 6 |
| AERO | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` | 18 |
| cbBTC | `0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf` | 8 |
| cbETH | `0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22` | 18 |
| USDbC (bridged USDC) | `0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA` | 6 |
| DAI | `0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb` | 18 |
| USDT | `0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2` | 6 |

Use token addresses (not symbols) when building transactions to avoid routing errors.
`ETH` (the string) works as a pseudo-address for native ETH swap inputs only — do not use it for pool filters.
For WETH pool filters use the WETH address, not `ETH`.

## Known WETH/USDC Pools on Base

| Pool Address | Type |
|-------------|------|
| `0xcDAC0d6c6C59727a65F871236188350531885C43` | Volatile basic |
| `0x3548029694fbB241D45FB24Ba0cd9c9d4E745f16` | Stable basic |

## Aerodrome Contract Addresses

| Contract | Address |
|----------|---------|
| Sugar (read helper) | `0x69dD9db6d8f8E7d83887A704f447b1a584b599A1` |
| Router | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` |
| Universal Router | `0x01D40099fCD87C018969B0e8D4aB1633Fb34763C` |
| Slipstream (CL) | `0x0AD09A66af0154a84e86F761313d02d0abB6edd5` |
| Nonfungible Position Manager | `0x827922686190790b37229fd06084350E74485b72` |

## Pool Types

- `volatile` — constant-product AMM (x·y = k), best for uncorrelated assets
- `stable` — optimized AMM (similar to Curve), best for like-value assets (e.g. USDC/USDbC)
- `cl` — concentrated liquidity (Slipstream), requires tick-spacing and price/tick range

## Sugar SDK Reference

Sugar SDK CLI: `git+https://github.com/velodrome-finance/sugar-sdk.git@v0.4.0`

Run via uvx:
```bash
uvx --from "git+https://github.com/velodrome-finance/sugar-sdk.git@v0.4.0" sugar --help
```

Set `SUGAR_RPC_URI_8453` to a reliable Base JSON-RPC endpoint before running pool-heavy commands.
