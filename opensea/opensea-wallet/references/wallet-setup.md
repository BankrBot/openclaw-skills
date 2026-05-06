# Wallet Setup

Transaction signing in the OpenSea CLI and SDK uses wallet providers through the `WalletAdapter` interface. Four providers are supported out of the box.

| Provider | Best For | Docs |
|----------|----------|------|
| **Privy** (default) | TEE-enforced policies, embedded wallets | [privy.io](https://privy.io) |
| **Turnkey** | HSM-backed keys, multi-party approval | [turnkey.com](https://www.turnkey.com) |
| **Fireblocks** | Enterprise MPC custody, institutional use | [fireblocks.com](https://www.fireblocks.com) |
| **Bankr** | Agent wallets via HTTP signing API | [bankr.bot](https://bankr.bot) |
| **Private Key** (not recommended) | Local dev/testing only | (none) |

Managed providers (Privy, Turnkey, Fireblocks) are **strongly recommended** over raw private keys. They provide spending limits, destination allowlists, and policy enforcement that raw keys cannot.

The CLI auto-detects the provider based on which environment variables are set. You can also specify one explicitly with `--wallet-provider privy|turnkey|fireblocks|private-key`.

---

## Privy Setup

### Prerequisites

- A Privy account ([privy.io](https://privy.io))
- An OpenSea API key (`OPENSEA_API_KEY`)

### 1. Create a Privy App

1. Go to [dashboard.privy.io](https://dashboard.privy.io) and create a new app
2. Note your **App ID** and **App Secret** from the app settings page

### 2. Create a Server Wallet

```bash
curl -X POST https://api.privy.io/v1/wallets \
  -H "Authorization: Basic $(echo -n "$PRIVY_APP_ID:$PRIVY_APP_SECRET" | base64)" \
  -H "privy-app-id: $PRIVY_APP_ID" \
  -H "Content-Type: application/json" \
  -d '{ "chain_type": "ethereum" }'
```

Save the wallet `id` from the response as `PRIVY_WALLET_ID`.

### 3. Set Environment Variables

```bash
export OPENSEA_API_KEY="your-opensea-api-key"
export PRIVY_APP_ID="your-privy-app-id"
export PRIVY_APP_SECRET="your-privy-app-secret"
export PRIVY_WALLET_ID="your-privy-wallet-id"
```

### 4. Fund & Verify

Send ETH to the wallet address, then test with a quote:

```bash
opensea swaps quote \
  --from-chain base \
  --from-address 0x0000000000000000000000000000000000000000 \
  --to-chain base \
  --to-address 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --quantity 0.001 \
  --address "$(curl -s https://api.privy.io/v1/wallets/$PRIVY_WALLET_ID \
    -H "Authorization: Basic $(echo -n "$PRIVY_APP_ID:$PRIVY_APP_SECRET" | base64)" \
    -H "privy-app-id: $PRIVY_APP_ID" | jq -r .address)"
```

### 5. Configure Policies (Recommended)

Before executing real transactions, configure wallet policies to enforce guardrails. See `references/wallet-policies.md` for details.

---

## Turnkey Setup

### Prerequisites

- A Turnkey account ([turnkey.com](https://www.turnkey.com))
- An OpenSea API key (`OPENSEA_API_KEY`)

### 1. Create an Organization & API Key

1. Sign up at [app.turnkey.com](https://app.turnkey.com)
2. Create an organization
3. Generate an API key pair, then note the **public key** and **private key**

### 2. Create a Wallet

Create a wallet in the Turnkey dashboard or via API. Note the Ethereum address.

### 3. Set Environment Variables

```bash
export OPENSEA_API_KEY="your-opensea-api-key"
export TURNKEY_API_PUBLIC_KEY="your-turnkey-public-key"
export TURNKEY_API_PRIVATE_KEY="your-turnkey-private-key"  # hex-encoded P-256 private key
export TURNKEY_ORGANIZATION_ID="your-turnkey-org-id"
export TURNKEY_WALLET_ADDRESS="0xYourTurnkeyWalletAddress"
export TURNKEY_RPC_URL="https://mainnet.infura.io/v3/YOUR_KEY"  # required
# Optional:
# export TURNKEY_PRIVATE_KEY_ID="your-turnkey-private-key-id"  # if signing with a specific key
# export TURNKEY_API_BASE_URL="https://api.turnkey.com"  # override API base URL
```

> **Note:** `TURNKEY_RPC_URL` is **required**. Turnkey is a pure signing service: it does not estimate gas or broadcast transactions. The adapter uses `TURNKEY_RPC_URL` to populate gas fields (nonce, gasLimit, maxFeePerGas, maxPriorityFeePerGas) via `eth_getTransactionCount`, `eth_estimateGas`, and `eth_feeHistory`, then broadcasts the signed transaction via `eth_sendRawTransaction`. The RPC endpoint must match the target chain.

### 4. Fund & Verify

Send ETH to `TURNKEY_WALLET_ADDRESS`, then execute a swap:

```bash
opensea swaps execute \
  --wallet-provider turnkey \
  --from-chain base \
  --from-address 0x0000000000000000000000000000000000000000 \
  --to-chain base \
  --to-address 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --quantity 0.001
```

---

## Fireblocks Setup

### Prerequisites

- A Fireblocks account ([fireblocks.com](https://www.fireblocks.com))
- An OpenSea API key (`OPENSEA_API_KEY`)

### 1. Create an API User

1. In the Fireblocks console, go to **Settings → API Users**
2. Create a new API user and download the **API secret** (RSA private key PEM file)
3. Note the **API key**

### 2. Create a Vault Account

Create a vault account with an ETH (or relevant EVM) wallet. Note the **vault account ID**.

### 3. Set Environment Variables

```bash
export OPENSEA_API_KEY="your-opensea-api-key"
export FIREBLOCKS_API_KEY="your-fireblocks-api-key"
export FIREBLOCKS_API_SECRET="$(cat /path/to/fireblocks-secret.pem)"
export FIREBLOCKS_VAULT_ID="your-vault-account-id"
# Optional: override asset ID (default: auto-detected from chain)
# export FIREBLOCKS_ASSET_ID="ETH"
# Optional: override max polling attempts for async transactions (default: 60 = 120s)
# export FIREBLOCKS_MAX_POLL_ATTEMPTS="120"  # 240s for multi-party approval workflows
```

> **Note:** Fireblocks transactions are asynchronous (MPC signing). The adapter polls for completion with a default timeout of 120 seconds (60 attempts × 2s). For transactions requiring multi-party approval, increase `FIREBLOCKS_MAX_POLL_ATTEMPTS`.

### 4. Fund & Verify

Fund the vault account via the Fireblocks console or an external transfer, then execute a swap:

```bash
opensea swaps execute \
  --wallet-provider fireblocks \
  --from-chain base \
  --from-address 0x0000000000000000000000000000000000000000 \
  --to-chain base \
  --to-address 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --quantity 0.001
```

---

## Bankr Setup

Bankr is an HTTP signing service for agent wallets. The adapter calls Bankr's API for transaction signing rather than holding a key locally.

### Prerequisites

- A Bankr account ([bankr.bot](https://bankr.bot))
- An OpenSea API key (`OPENSEA_API_KEY`)

### 1. Get a Bankr API Key

Sign up at [bankr.bot](https://bankr.bot) and provision an API key.

### 2. Set Environment Variables

```bash
export OPENSEA_API_KEY="your-opensea-api-key"
export BANKR_API_KEY="your-bankr-api-key"
```

### 3. Execute a Swap

```bash
opensea swaps execute \
  --wallet-provider bankr \
  --from-chain base \
  --from-address 0x0000000000000000000000000000000000000000 \
  --to-chain base \
  --to-address 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --quantity 0.001
```

### SDK Usage

```typescript
import { createBankrAccount } from '@opensea/wallet-adapters';

const account = await createBankrAccount(process.env.BANKR_API_KEY);
// Use with authenticatedFetch, paidAuthenticatedFetch, or the OpenSeaCLI swaps API
```

---

## Private Key Setup (Not Recommended)

> **WARNING:** Using a raw private key provides no spending limits, no destination allowlists, and no human-in-the-loop approval. Use a managed provider (Privy, Turnkey, Fireblocks) for anything beyond local development.

### Set Environment Variables

```bash
export OPENSEA_API_KEY="your-opensea-api-key"
export PRIVATE_KEY="0xYourHexPrivateKey"
export RPC_URL="http://127.0.0.1:8545"  # local dev node only (Hardhat/Anvil/Ganache)
export WALLET_ADDRESS="0xYourWalletAddress"
```

### Execute a Swap

```bash
opensea swaps execute \
  --wallet-provider private-key \
  --from-chain base \
  --from-address 0x0000000000000000000000000000000000000000 \
  --to-chain base \
  --to-address 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --quantity 0.001
```

**Note:** The private-key adapter uses `eth_sendTransaction` on the RPC node, which requires the node to manage the imported key (e.g. Hardhat, Anvil, Ganache). The `PRIVATE_KEY` env var is validated to confirm intent but is not used for signing; the RPC node signs server-side. This adapter does **not** work with production RPC providers like Infura or Alchemy. Use a managed wallet instead.

---

## Using the Wallet

### CLI

```bash
# Auto-detect provider from env vars (defaults to Privy)
opensea swaps execute \
  --from-chain base \
  --from-address 0x0000000000000000000000000000000000000000 \
  --to-chain base \
  --to-address 0xb695559b26bb2c9703ef1935c37aeae9526bab07 \
  --quantity 0.02

# Explicitly specify provider
opensea swaps execute --wallet-provider turnkey ...
opensea swaps execute --wallet-provider fireblocks ...
opensea swaps execute --wallet-provider bankr ...
opensea swaps execute --wallet-provider private-key ...  # not recommended
```

### SDK (TypeScript)

```typescript
import {
  OpenSeaCLI,
  PrivyAdapter,
  TurnkeyAdapter,
  FireblocksAdapter,
  BankrAdapter,
  PrivateKeyAdapter,
  createWalletFromEnv,
} from '@opensea/cli';

const sdk = new OpenSeaCLI({ apiKey: process.env.OPENSEA_API_KEY });

// Auto-detect from env vars
const wallet = createWalletFromEnv();

// Or use a specific provider
// const wallet = PrivyAdapter.fromEnv();
// const wallet = TurnkeyAdapter.fromEnv();
// const wallet = FireblocksAdapter.fromEnv();
// const wallet = BankrAdapter.fromEnv();
// const wallet = PrivateKeyAdapter.fromEnv();  // not recommended

const results = await sdk.swaps.execute({
  fromChain: 'base',
  fromAddress: '0x0000000000000000000000000000000000000000',
  toChain: 'base',
  toAddress: '0xb695559b26bb2c9703ef1935c37aeae9526bab07',
  quantity: '0.02',
}, wallet);
```

### Shell Script

```bash
./scripts/opensea-swap.sh 0xb695559b26bb2c9703ef1935c37aeae9526bab07 0.02 base
```

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `PRIVY_APP_ID environment variable is required` | Missing Privy env var | Set Privy credentials or use `--wallet-provider` to pick another provider |
| `Privy getAddress failed (401)` | Bad Privy credentials | Check `PRIVY_APP_ID` and `PRIVY_APP_SECRET` |
| `Privy sendTransaction failed (403)` | Policy violation | Review wallet policies (see `wallet-policies.md`) |
| `TURNKEY_API_PUBLIC_KEY environment variable is required` | Missing Turnkey env var | Set Turnkey credentials |
| `Turnkey sendTransaction failed` | Turnkey API error | Check API keys and organization ID |
| `FIREBLOCKS_API_KEY environment variable is required` | Missing Fireblocks env var | Set Fireblocks credentials |
| `No Fireblocks asset ID mapping for chain` | Unsupported chain | Set `FIREBLOCKS_ASSET_ID` explicitly |
| `Fireblocks transaction ended with status: REJECTED` | Policy rejection | Review Fireblocks TAP rules |
| `BANKR_API_KEY environment variable is required` | Missing Bankr env var | Set `BANKR_API_KEY` |
| `Bankr signing failed (401)` | Bad Bankr API key | Verify the key at [bankr.bot](https://bankr.bot) |
| `PRIVATE_KEY environment variable is required` | Missing private key env var | Set `PRIVATE_KEY`, `RPC_URL`, and `WALLET_ADDRESS` |
| `RPC_URL environment variable is required` | Missing RPC URL | Set `RPC_URL` for the target chain |
| `insufficient funds` | Wallet not funded | Send ETH to the wallet address |
