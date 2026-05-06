---
name: opensea-wallet
description: Set up and configure wallet signing providers for OpenSea transactions. Supports Privy, Turnkey, Fireblocks, Bankr, and local private keys. Required for executing trades (opensea-marketplace) and token swaps (opensea-swaps).
homepage: https://github.com/ProjectOpenSea/opensea-skill
repository: https://github.com/ProjectOpenSea/opensea-skill
license: MIT
env:
  PRIVY_APP_ID:
    description: Privy application ID for wallet signing (default provider)
    required: false
    obtain: https://dashboard.privy.io
  PRIVY_APP_SECRET:
    description: Privy application secret
    required: false
    obtain: https://dashboard.privy.io
  PRIVY_WALLET_ID:
    description: Privy wallet ID to sign transactions with
    required: false
  TURNKEY_API_PUBLIC_KEY:
    description: Turnkey API public key
    required: false
    obtain: https://app.turnkey.com
  TURNKEY_API_PRIVATE_KEY:
    description: Turnkey API private key
    required: false
  TURNKEY_ORGANIZATION_ID:
    description: Turnkey organization ID
    required: false
  TURNKEY_WALLET_ADDRESS:
    description: Turnkey wallet address
    required: false
  FIREBLOCKS_API_KEY:
    description: Fireblocks API key
    required: false
    obtain: https://console.fireblocks.io
  FIREBLOCKS_API_SECRET:
    description: Fireblocks API secret
    required: false
  FIREBLOCKS_VAULT_ID:
    description: Fireblocks vault account ID
    required: false
  BANKR_API_KEY:
    description: Bankr API key for HTTP-based agent wallet signing
    required: false
    obtain: https://bankr.bot
dependencies:
  - node >= 18.0.0
---

# OpenSea Wallet

Set up and configure wallet signing providers for OpenSea transactions. The CLI and SDK auto-detect which provider to use based on environment variables, or you can specify one explicitly with `--wallet-provider`.

## When to use this skill (`scope_in`)

Use `opensea-wallet` when you need to:

- Set up a wallet provider for the first time (Privy, Turnkey, Fireblocks, Bankr, or local keys)
- Configure signing policies (value caps, allowlists, multi-party approval)
- Switch between wallet providers
- Understand the security model for each provider

## When NOT to use this skill (`scope_out`, handoff)

| Need | Use instead |
|---|---|
| Query NFT/token data | `opensea-api` |
| Buy/sell NFTs | `opensea-marketplace` |
| Swap ERC20 tokens | `opensea-swaps` |
| Build/register/gate AI agent tools | `opensea-tool-sdk` |

## Quick start

```bash
# 1. Pick a managed provider and set its env vars (Privy default shown)
export OPENSEA_API_KEY=your_key
export PRIVY_APP_ID=your_app_id
export PRIVY_APP_SECRET=your_app_secret
export PRIVY_WALLET_ID=your_wallet_id

# 2. Use the wallet via any signing-capable command
opensea swaps execute \
  --from-chain base --from-address 0x0000000000000000000000000000000000000000 \
  --to-chain base --to-address 0xb695559b26bb2c9703ef1935c37aeae9526bab07 \
  --quantity 0.001
```

For other providers, see the table below and `references/wallet-setup.md`.

## Supported providers

| Provider | Env Vars | Best For |
|----------|----------|----------|
| **Privy** (default) | `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `PRIVY_WALLET_ID` | TEE-enforced policies, embedded wallets |
| **Turnkey** | `TURNKEY_API_PUBLIC_KEY`, `TURNKEY_API_PRIVATE_KEY`, `TURNKEY_ORGANIZATION_ID`, `TURNKEY_WALLET_ADDRESS` | HSM-backed keys, multi-party approval |
| **Fireblocks** | `FIREBLOCKS_API_KEY`, `FIREBLOCKS_API_SECRET`, `FIREBLOCKS_VAULT_ID` | Enterprise MPC custody, institutional use |
| **Bankr** | `BANKR_API_KEY` | Agent wallets via Bankr's HTTP signing API |
| **Private Key** (local dev only) | `PRIVATE_KEY`, `RPC_URL`, `WALLET_ADDRESS` | Local dev/testing only (no spending limits or guardrails) |

The CLI and SDK handle signing automatically once env vars are set. Auto-detect order: Privy, Fireblocks, Turnkey, Bankr, Private Key. To specify a provider explicitly:

```bash
opensea swaps execute --wallet-provider turnkey ...
opensea swaps execute --wallet-provider fireblocks ...
opensea swaps execute --wallet-provider bankr ...
opensea swaps execute --wallet-provider private-key ...
```

## Security

- **Managed providers (Privy, Turnkey, Fireblocks, Bankr) are strongly recommended** over raw private keys.
- **Raw `PRIVATE_KEY` is for local development only.** Never paste a raw private key into a shared agent environment, hosted CI, or any context where the key could be logged or exfiltrated.
- Production and shared-agent setups must use a managed provider with conservative signing policies (value caps, allowlists, multi-party approval).

## References

- `references/wallet-setup.md`: detailed setup instructions for each provider
- `references/wallet-policies.md`: policy configuration for signing limits and allowlists
- [OpenSea CLI](https://github.com/ProjectOpenSea/opensea-cli)
