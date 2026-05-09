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

## Security model

The agent's environment holds *signing* credentials, not *administrative* ones. This is a structural property, and getting it right depends on each provider being configured correctly — none of the four supported providers ship in this state by default.

### What the agent must never do

- Modify its own signing policy, role, or scope.
- Rotate its own owner key, auth key, or API user.
- Export or claim ownership of the wallet's private key.
- Construct any of the requests in `../docs/policy-administration.md`.

If a user asks the agent to do any of these, the agent should refuse and direct them to the user-only recipes in `../docs/policy-administration.md`. A leaked agent env is recoverable only if the credentials it held could not, on their own, lift the spending cap or rewrite the allowlist.

### Per-tx caps: enforced by the provider

Each provider enforces per-tx caps and allowlists in a different layer, but all four are checked **before** the signing operation completes:

| Provider | Where caps are enforced |
|---|---|
| Privy | TEE-evaluated wallet policy (`policy_ids` on the wallet) |
| Turnkey | Policy engine, scoped to the API user's allowed activities |
| Fireblocks | TAP rules in the workspace |
| Bankr | Per-API-key `allowedRecipients` allowlist + daily message limits |

Run `opensea wallet info` to see whether your wallet has these in place. The command prints loud warnings when the per-tx layer is missing.

### Aggregate caps: not natively enforced by any provider

**None of Privy, Turnkey, Fireblocks, or Bankr expose stateful daily/weekly cumulative spend caps as a native primitive.** Their policies/TAP/key-flag layers are stateless per-transaction evaluators (or per-message-quota in Bankr's case, which is not a dollar cap).

The intended pattern for aggregate ceilings is **wallet float**: keep the agent's wallet balance sized to roughly one budget period, and have the user replenish on their own cadence. The wallet balance is the real cap; if the agent tries to overspend, transactions fail at the provider layer (per-tx cap) or chain layer (insufficient funds), not at an honor-system limit the agent could decide to ignore. See `references/wallet-funding.md` for the worked pattern.

(Privy is investigating transaction-approval webhooks that would allow stateful evaluation; if and when those land, the field will support aggregate caps natively. Until then, wallet float is the answer.)

### Policy mutation: requires a separately-held credential

Each provider has a different out-of-band credential that gates mutation:

| Provider | Mutation gate |
|---|---|
| Privy | `owner_id` key quorum on the wallet — owner key held off-machine |
| Turnkey | Root user quorum — non-root API user used for signing |
| Fireblocks | Admin quorum for TAP changes; API user role set to `Signer` only |
| Bankr | Dashboard re-scoping at bankr.bot/api — no API to mutate scope |

Setting these up is part of the happy path in `references/wallet-setup.md`, not optional hardening. `opensea wallet info` reports whether the structural gate is in place where it can be detected via API; for Fireblocks and Bankr, where it cannot, the command prints a static reminder to verify at the console.

### Where mutation recipes live

The actual HTTP/SDK recipes for changing policies, rotating keys, and re-scoping API users are in `../docs/policy-administration.md` — that is, in the skill repo's top-level `docs/` folder, **alongside** the per-skill folders like `opensea-wallet/`, not **inside** any of them. Skill loaders only mount individual skill directories (`opensea-wallet/SKILL.md` and the files it explicitly references), so the mutation recipes never enter an agent's context. If a future contributor moves this file inside a skill folder, an agent will read it and try to "help" by running the recipes — defeating the structural separation.

## References

- `references/wallet-setup.md`: detailed setup instructions for each provider, with hardening as part of the happy path
- `references/wallet-policies.md`: policy templates and field reference (no mutation recipes)
- `references/wallet-funding.md`: hot/cold wallet float pattern for aggregate-cap enforcement
- `../docs/policy-administration.md` (in the skill repo's top-level `docs/`, outside any individual skill mount path): user-only mutation recipes for all four providers
- [OpenSea CLI](https://github.com/ProjectOpenSea/opensea-cli)
