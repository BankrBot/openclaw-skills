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
- A trusted operator machine (your laptop, vault host, etc.) — separate from the machine that will run the agent. You'll generate the wallet's authorization key on this machine and keep its private key off the agent.

### 1. Create a Privy App

1. Go to [dashboard.privy.io](https://dashboard.privy.io) and create a new app
2. Note your **App ID** and **App Secret** from the app settings page

### 2. Create a Server Wallet

```bash
curl -X POST https://api.privy.io/v1/wallets \
  -H "Authorization: Basic $(printf "%s:%s" "$PRIVY_APP_ID" "$PRIVY_APP_SECRET" | base64)" \
  -H "privy-app-id: $PRIVY_APP_ID" \
  -H "Content-Type: application/json" \
  -d '{ "chain_type": "ethereum" }'
```

> **Heads-up:** use `printf %s` (not `echo`) when building the basic-auth header. `echo` adds a trailing newline that corrupts the base64-encoded credentials and produces a 401 with a misleading "Invalid app ID or app secret" body.

Save the wallet `id` from the response as `PRIVY_WALLET_ID`.

### 3. Register an authorization key on the wallet

This step is part of the happy path, not optional hardening. Without it, the same `PRIVY_APP_ID` + `PRIVY_APP_SECRET` the agent uses for signing can also rewrite the wallet's policy unilaterally — including raising any spending cap you set in step 5.

**On your operator machine** (not the agent host), generate a P-256 keypair:

```bash
# Generates a base64-encoded PKCS8 P-256 private key + the matching public key.
node -e '
  const { generateKeyPairSync } = require("crypto");
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const pkcs8 = privateKey.export({ type: "pkcs8", format: "der" }).toString("base64");
  const spki  = publicKey.export({ type: "spki", format: "der" }).toString("base64");
  console.log("PRIVATE (keep on operator machine):", pkcs8);
  console.log("PUBLIC  (register with Privy):     ", spki);
'
```

Register the public key as the wallet's **owner** by following [Privy's authorization key setup guide](https://docs.privy.io/controls/authorization-keys/overview). Save the private key in your password manager / vault. **Do not put the owner private key in the agent's env.**

To let the agent sign while keeping the owner key off-machine, register a *second* P-256 keypair as an `additional_signer` on the wallet, with `override_policy_ids` pointing at the policy you'll create in step 5. The additional signer's private key is what goes in the agent's `PRIVY_AUTH_SIGNING_KEY`. It can sign transactions subject to the policy; it cannot mutate policy or signers.

### 4. Set Environment Variables

```bash
export OPENSEA_API_KEY="your-opensea-api-key"
export PRIVY_APP_ID="your-privy-app-id"
export PRIVY_APP_SECRET="your-privy-app-secret"
export PRIVY_WALLET_ID="your-privy-wallet-id"

# Required when the wallet has owner_id set (recommended). Base64-encoded
# PKCS8 P-256 private key for an additional_signer registered on the
# wallet. NEVER set this to the OWNER private key.
export PRIVY_AUTH_SIGNING_KEY="..."
```

### 5. Verify

```bash
opensea wallet info
```

Expected output: a JSON block with the wallet address, policy IDs, owner key ID, and `ownerEnforcesAuthKey: true`. If you see warnings on stderr, the corresponding hardening step is missing — fix it before funding the wallet.

<details>
<summary>Fallback: verify via curl</summary>

```bash
curl -s "https://api.privy.io/v1/wallets/$PRIVY_WALLET_ID" \
  -H "Authorization: Basic $(printf "%s:%s" "$PRIVY_APP_ID" "$PRIVY_APP_SECRET" | base64)" \
  -H "privy-app-id: $PRIVY_APP_ID" | jq .
```

> Use `printf %s` here, not `echo` — the trailing newline `echo` adds breaks the basic-auth header.

</details>

### 6. Configure a per-tx policy

See `references/wallet-policies.md` for templates and field reference. Apply the policy via the user-only recipe in `../../docs/policy-administration.md` — never construct or run the policy-update request from the agent.

For aggregate (daily/weekly cumulative) caps, see `references/wallet-funding.md` — Privy policies cannot enforce these natively, and the wallet float pattern is the answer.

---

## Turnkey Setup

### Prerequisites

- A Turnkey account ([turnkey.com](https://www.turnkey.com))
- An OpenSea API key (`OPENSEA_API_KEY`)

### 1. Create an Organization & a non-root, signer-only API user

1. Sign up at [app.turnkey.com](https://app.turnkey.com).
2. Create an organization. The bootstrap user is automatically a **root** user — keep this account credentials on your operator machine, separate from the agent. Do not use it as the agent's API key.
3. Create a **second** API user (Users → Add User → API user). This is the agent's user.
4. Generate a fresh P-256 keypair on your operator machine and upload the public key to the new user. The private key is what goes in `TURNKEY_API_PRIVATE_KEY` on the agent host.
5. Create a policy that scopes the agent user to **only** `ACTIVITY_TYPE_SIGN_TRANSACTION_V2` (and `ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2` if EIP-712 is needed) for the wallet addresses the agent should sign for. Default-deny on everything else; Turnkey defaults to deny so this is mostly an allowlist. Reference: [Turnkey policy examples](https://docs.turnkey.com/concepts/policies/examples).

> **Why this matters:** root users in Turnkey **bypass the policy engine entirely**. A leaked root API key has the same blast radius as a raw private key — sign anything, mutate any policy, mint new wallets, export keys. The hardening goal is that the agent's key is non-root and policy-scoped, so even a fully compromised agent cannot escalate.

### 2. Create a Wallet

Create a wallet in the Turnkey dashboard or via API. Note the Ethereum address. Verify the agent user has signing permission on this wallet's address per the policy from step 1.

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

### 4. Verify

```bash
opensea wallet info
```

Confirm `isRootUser: false`. If you see `isRootUser: true`, the agent is running as a root user and you've defeated the hardening — go back to step 1 and create a non-root user.

### 5. Fund

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

For aggregate caps, see `references/wallet-funding.md` — Turnkey policies are stateless per-activity evaluators and cannot enforce daily/weekly cumulative caps. Wallet float is the answer.

---

## Fireblocks Setup

### Prerequisites

- A Fireblocks account ([fireblocks.com](https://www.fireblocks.com))
- An OpenSea API key (`OPENSEA_API_KEY`)

### 1. Create a Signer-role API User

1. In the Fireblocks console, go to **Settings → API Users**.
2. Create a new API user. **Set the role to `Signer`** (or `NCW_SIGNER` for non-custodial wallets). **Do not pick `Admin`, `Editor`, `Non-Signing Admin`, or any role with governance access.**
3. The role is set at user-creation time; there is no downgrade path. To change a role, delete the user and create a new one.
4. Approval of the new API user requires admin quorum (per workspace settings). After the quorum approves, download the **API secret** (RSA private key PEM file) and note the **API key**.

> **Why this matters:** Fireblocks does not expose API-user role via API — there is no `/v1/users/me` introspection endpoint. `opensea wallet info` therefore cannot verify the role at runtime, only print a static reminder. **Verifying that the API key has the `Signer` role and only the `Signer` role is on you.** Re-confirm whenever the key is rotated.
>
> The platform's TAP-edits-require-quorum property only protects you if the agent's key is correctly scoped in the first place. An `Admin` key can edit TAP unilaterally; a `Signer` key cannot.

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

### 1. Provision an API Key with appropriate scope flags

Sign up at [bankr.bot](https://bankr.bot) and create a key at [bankr.bot/api](https://bankr.bot/api). Configure the key's scope flags as part of the happy path, not optional hardening:

- **For monitoring-only agents:** enable `readOnly`. The agent can call read endpoints (prices, balances, analytics) but `/wallet/sign` and `/wallet/submit` will return 403.
- **For signing agents:** set the following on the key —
  - `allowedRecipients`: an EVM (and Solana, if needed) address allowlist of destinations the agent should be permitted to send to. Empty means no allowlist; that's a footgun.
  - `allowedIps`: CIDR ranges for the agent's deploy environment. Restricts where the key can be used from.
  - Daily message limit: set this on the key page.
  - Disable `agentApiEnabled` if the agent does not need Bankr's prompt API; only enable `walletApiEnabled` if signing is actually needed.

> **Why this matters:** Bankr does not expose key-scope flags via API. `opensea wallet info` cannot verify these settings at runtime, only print a static reminder. **You are responsible for setting them correctly at the dashboard and re-confirming after any key rotation.**

### 2. Set Environment Variables

```bash
export OPENSEA_API_KEY="your-opensea-api-key"
export BANKR_API_KEY="your-bankr-api-key"
```

### 3. Verify

```bash
opensea wallet info
```

Confirms the key reaches Bankr and prints the wallet address. The output will include the static reminder to re-verify scope flags at bankr.bot/api — this is by design, not a bug.

### 4. Execute a Swap

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
| `Privy getAddress failed (401): Invalid app ID or app secret` with creds confirmed correct in env | Almost always `echo` vs `printf %s` when verifying via curl. `echo` adds a trailing newline that breaks the basic-auth header. | Use `opensea wallet info` instead, or build the header with `printf %s "$PRIVY_APP_ID:$PRIVY_APP_SECRET" \| base64`. |
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
