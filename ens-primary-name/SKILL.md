---
name: ens-primary-name
description: Set your primary ENS name on Base and other L2s. Use when user wants to set their ENS name, configure reverse resolution, set primary name, or make their address resolve to an ENS name. Supports Base, Arbitrum, Optimism, and Ethereum mainnet.
---

# ENS Primary Name

Set your primary ENS name on Base and other L2 chains via the ENS Reverse Registrar.

A primary name creates a bi-directional link:
- **Forward:** `name.eth` → `0x1234...` (set in ENS resolver)
- **Reverse:** `0x1234...` → `name.eth` (set via this skill)

## Quick Start

```bash
# Set primary name on Base
./scripts/set-primary.sh myname.eth

# Set on specific chain
./scripts/set-primary.sh myname.eth arbitrum

# Verify primary name is set
./scripts/verify-primary.sh 0x1234... base
```

## Supported Chains

| Chain | Reverse Registrar |
|-------|-------------------|
| Base | `0x0000000000D8e504002cC26E3Ec46D81971C1664` |
| Arbitrum | `0x0000000000D8e504002cC26E3Ec46D81971C1664` |
| Optimism | `0x0000000000D8e504002cC26E3Ec46D81971C1664` |
| Ethereum | `0x283F227c4Bd38ecE252C4Ae7ECE650B0e913f1f9` |

## Prerequisites

1. **Own or control an ENS name** - The name must be registered
2. **Forward resolution configured** - The name must resolve to your address
3. **Bankr skill installed** - Used to sign and submit transactions

## How It Works

1. Checks forward resolution exists (name → address)
2. Warns if chain-specific address is not set
3. Encodes `setName(string)` calldata
4. Submits transaction to the Reverse Registrar via Bankr
5. Verifies the primary name is correctly set

## Verification

The skill automatically verifies after setting. You can also verify manually:

```bash
./scripts/verify-primary.sh 0xYourAddress base
```

Output:
```
✅ Reverse record: 0x1234... → myname.eth
✅ Forward resolution: myname.eth → 0x1234...
🎉 PRIMARY NAME VERIFIED: myname.eth
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Transaction reverted" | Ensure the ENS name resolves to your address |
| "Name not showing" | Forward resolution may not be set for that chain's cointype |
| "Not authorized" | You must call from the address the name resolves to |
| "bankr.sh not found" | Install the bankr skill first |
| "Chain-specific address not set" | Set the address for the target chain via app.ens.domains |

## Setting Avatars

```bash
# Set avatar (requires L1 transaction + ETH for gas)
./scripts/set-avatar.sh myname.eth https://example.com/avatar.png

# Supported formats:
# - HTTPS: https://example.com/image.png
# - IPFS: ipfs://QmHash
# - NFT: eip155:1/erc721:0xbc4ca.../1234
```

**Note:** Avatars are text records stored on Ethereum mainnet.

## Links

- ENS Docs: https://docs.ens.domains/web/reverse
- ENS App: https://app.ens.domains
- Primary Names UI: https://primary.ens.domains
