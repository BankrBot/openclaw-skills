# Wire a Bankr agent into Splits execution

Two ways to give a Bankr agent execution power on a Splits account:

- **Signer** (default, below) — register a dedicated agent key as a multisig signer. Every action is a Splits proposal; supports human-in-the-loop via the threshold.
- **Module** (see [the module section](#alternative-enable-the-bankr-wallet-as-a-module)) — enable the **Bankr wallet itself** as a module on a bounded subaccount for direct execution, no separate key. Full, unilateral access — bounded subaccounts only.

## How it works

The agent uses two separate keys:

- The **Bankr trading wallet** — for market moves and small-value spends.
- A **dedicated Splits signer key** — a local EOA the Splits CLI generates, used only to sign Splits multisig transactions.

These are distinct keys. The Bankr wallet's key is never moved, exposed, or imported into Splits; the agent generates a separate Splits signer instead.

What the agent can do on an account is set by the **threshold**:

- **1-of-N** with the agent as a signer → the agent executes on its own. Use for sandbox and low-value automation accounts.
- **2-of-N** (agent + a human passkey) → the agent proposes and signs, a human co-signs to execute. Use for production treasury.

Changing this later is a threshold or signer update.

## Setup

Prerequisites: Node, and the agent able to run shell commands.

**1. Install the CLI** (or invoke with `npx -y @splits/splits-cli@latest`):

```bash
npm install -g @splits/splits-cli
```

**2. Get a Splits API key** — human step (requires a Splits team; free):
`https://teams.splits.org/settings/team/api-keys/`. Provide it to the agent as `SPLITS_API_KEY` (env or stdin — never in shell history).

**3. Authenticate:**

```bash
echo "$SPLITS_API_KEY" | splits auth login
splits auth whoami        # confirms org, key name, scopes
```

**4. Generate the agent's Splits signer key** — one command creates it locally and registers it:

```bash
splits auth create-key --register --name "Bankr Agent"
splits auth whoami        # localKey.signerId is now populated — that's the agent's signer id
```

**5. Add the agent as a signer on an account.** Choose one:

**5a — New subaccount with the agent and a human as signers:**

```bash
splits members list                    # your USER_ID
splits members signers <USER_ID>       # your passkey id
splits auth signers                    # the agent's signer id (from step 4)
splits accounts create --name "Bankr Agent Ops" \
  --eoaSignerIds <AGENT_SIGNER_ID> --passkeyIds <YOUR_PASSKEY_ID> --threshold 2
```

**5b — Add the agent to an account you already have:**

```bash
splits accounts update-signers <ACCOUNT> \
  --addEoaSignerIds <AGENT_SIGNER_ID> --memo "Add Bankr agent signer"
# approve the returned signUrl in the Splits app, then watch it land:
splits transactions get <TRANSACTION_ID>   # CREATED -> EXECUTED
```

The agent is now a signer on the account.

## Verify

```bash
splits accounts signers <ACCOUNT>          # the agent's EOA should be listed
# propose a tiny transfer and sign it
splits transactions create transfer --account <ACCOUNT> --chainId 8453 \
  --recipient <ADDRESS> --token <TOKEN_CONTRACT> --amount "1" --memo "signer test"
splits transactions sign <TRANSACTION_ID>  # signs; auto-submits if the signature meets threshold
```

On a 2-of-N account the test transfer will sit in `CREATED` until you co-sign with your passkey — that's expected.

## Moving funds between Bankr and Splits

This is a normal transfer; no integration is required. Keep working balances in the Bankr wallet and larger balances in Splits. When the agent needs funds, it transfers from Splits to its Bankr wallet:

```bash
splits transactions create transfer --account <TREASURY> --chainId 8453 \
  --recipient <BANKR_WALLET_ADDRESS> --token <TOKEN_CONTRACT> --amount "500" \
  --memo "Top up Bankr ops"
```

Find the Bankr wallet address with `bankr wallet` (CLI) or `GET /wallet/me` (API).

## Alternative: enable the Bankr wallet as a module

Instead of a separate signer key, you can enable the **Bankr wallet itself** as a *module* on a subaccount. An enabled module calls `executeFromModule` to run transactions **directly from the subaccount** — no proposal, sign, or threshold step per action — and the inner call executes with `msg.sender` = the subaccount, so it satisfies contracts that gate on the account (e.g. LP-fee or fee-locker claims). This reuses the Bankr wallet directly: enabling needs only its address, and execution uses Bankr's own `submit` (raw transaction). See Splits' [`ModuleManager.sol`](https://github.com/0xSplits/splits-contracts-monorepo/blob/main/packages/smart-vaults/src/utils/ModuleManager.sol).

**Trade-off:** a module has **full, unilateral access** to the subaccount — the multisig threshold does **not** gate its executions. Use a **dedicated, bounded operating subaccount — never the Treasury.** Enabling is approved once by the account's signers (human), and is revocable.

The only input required from the human is the **subaccount address** — the agent reads its own Bankr wallet address and builds the rest.

### Enable (agent builds it; human approves)

```bash
# the module = the Bankr wallet address (agent reads it itself)
#   bankr wallet   (CLI)   or   GET https://api.bankr.bot/wallet/me  -> address
BANKR_EOA=<bankr wallet address>

# encode the enableModule(address) self-call (any encoder; signature is real)
DATA=$(cast calldata "enableModule(address)" "$BANKR_EOA")    # foundry; or viem encodeFunctionData

# create the self-call proposal ON the subaccount (account == call target)
splits transactions create custom \
  --account <SUBACCOUNT> --chainId 8453 \
  --calls "[{\"to\":\"<SUBACCOUNT>\",\"data\":\"$DATA\",\"value\":\"0\"}]" \
  --memo "Enable Bankr executor module"
```

This returns a proposal — give the human its `signUrl` (the web approval link, same step as adding a signer), then poll:

```bash
splits transactions get <TRANSACTION_ID>   # CREATED -> EXECUTED
```

Once executed, the Bankr wallet is an enabled module on the subaccount.

### Execute (Bankr wallet, directly)

The Bankr wallet now runs transactions from the subaccount by calling `executeFromModule` on it. The `Call` is `{ target, value, data }` — the inner call you want the subaccount to make:

```bash
# encode executeFromModule((address,uint256,bytes)) with the inner call
CALL=$(cast calldata "executeFromModule((address,uint256,bytes))" "(<TARGET>,<VALUE_WEI>,<INNER_CALLDATA>)")

# Bankr submits it as a normal tx to the subaccount (Bankr pays gas — keep a little ETH on Base)
#   bankr wallet submit ...   or   POST https://api.bankr.bot/wallet/submit
#   { transaction: { to: <SUBACCOUNT>, chainId: 8453, value: "0", data: <CALL> } }
```

The inner call runs with `msg.sender` = the subaccount. A batch form exists too: `executeFromModule((address,uint256,bytes)[])`.

### Revoke

Disable the module the same way you enabled it — a `disableModule(address)` self-call:

```bash
DATA=$(cast calldata "disableModule(address)" "$BANKR_EOA")
splits transactions create custom --account <SUBACCOUNT> --chainId 8453 \
  --calls "[{\"to\":\"<SUBACCOUNT>\",\"data\":\"$DATA\",\"value\":\"0\"}]" --memo "Disable Bankr module"
```

### Signer vs module — which to use

- **Signer** — every action is a Splits proposal; supports human-in-the-loop via threshold. Default for treasury and anything needing per-action approval.
- **Module** — direct, unilateral execution from a bounded subaccount; best for autonomous/high-frequency ops and `msg.sender`-gated claims. Full access — keep funds bounded and never enable on the Treasury.

## Troubleshooting

- **`localKey.signerId` is null** → key exists locally but isn't registered: `splits auth register-signer <address>`.
- **`create-key` refuses** → a local key already exists. `splits auth delete-key` first (removes only the local key, not any on-chain signer status).
- **`409 SMART_ACCOUNT_STATE_CHANGE_IN_PROGRESS`** when adding the signer → a change is already pending: `splits transactions list --account <ACCOUNT>`, then sign or cancel it before retrying.
- **Agent can't execute alone** → threshold is ≥ 2; a human passkey must co-sign. By design — lower the threshold only on low-value accounts.

## Security

- The Splits signer key is a **hot key on disk** (`~/.splits/config.json`, mode `0600`). Use **threshold 2 with your passkey** for real treasury; reserve threshold 1 for sandbox/low-value accounts.
- Never expose or import your Bankr wallet's private key — the agent doesn't need it for Splits.
- Scope the Splits API key, and run `splits auth whoami` before acting to confirm the org and key source.

See `agent-access.md` for the full signer/permission model and `treasury-workflows.md` for what the agent does once it can sign.
