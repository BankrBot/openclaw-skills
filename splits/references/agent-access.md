# Agent access & signer governance

How a Bankr agent gets bounded access to a Splits account. Humans authenticate with passkeys; agents sign with their own local EOA key, and can only act once a human has added that key as a signer. Accounts are multisigs: depending on the threshold a human sets, an agent can act unilaterally or require human co-approval on every transaction.

## 1. API key

API keys are created by a human in the web app and require a Splits team:
`https://teams.splits.org/settings/team/api-keys/` (browser-only). Keys look like `sk_read_...` (or a legacy hex key). Owner-scoped keys are required for state-changing account operations (`accounts create`, `accounts update-signers`, archive/unarchive).

Provide the key to the agent via the `SPLITS_API_KEY` environment variable, or have the agent log in over stdin:

```bash
echo "$SPLITS_API_KEY" | splits auth login    # saved to ~/.splits/config.json (mode 0600)
splits auth whoami                             # org, key name, scopes, credential source, local EOA
```

`auth login` prefers stdin; avoid `--apiKey` so the secret never lands in shell history. The env var always wins over the saved key.

## 2. Agent EOA signing key

The agent needs its own Ethereum EOA to approve multisig transactions locally. Create and register it in one call:

```bash
splits auth create-key --register --name "Bankr Agent"
```

This generates a local key (saved 0600 to `~/.splits/config.json`) and registers the address with the backend so it can be attached as a signer. On a registration failure the local key is rolled back. `create-key` refuses if a key already exists — delete it first with `splits auth delete-key` (which removes only the local key, not any on-chain signer status).

The generated EOA is a **hot key on disk** but **inert until a human adds it as a signer** — its reach is exactly the accounts it's attached to, bounded by each threshold. Lifecycle on a shared/ephemeral host:

- **Rotate:** `auth delete-key` → `auth create-key --register` → `accounts update-signers <ACCOUNT> --addEoaSignerIds <NEW> --removeEoaIds <OLD>`.
- **Revoke:** remove it as a signer (`accounts update-signers --removeEoaIds`); deleting the local file alone leaves on-chain signer status intact.
- **Clean up:** `auth delete-key` (local key) + `auth logout` (saved auth) when finished. Keep thresholds ≥ 2 so a leaked hot key still can't move funds alone.

Alternatives:

- `splits auth create-key` then `splits auth register-signer <address>` — two-step equivalent.
- `echo "$PRIVATE_KEY" | splits auth import-key` — import an existing key over stdin.

Discover ids:

```bash
splits auth signers     # EOA signer ids registered under the acting user (+ address, name, last verified)
splits auth whoami      # localKey.signerId once the local key is registered (null = not yet registered)
```

`register-signer` is idempotent — re-running with the same address returns the same id and keeps the first name.

## 3a. Create a bounded agent subaccount

Best when starting fresh: stand up a subaccount with both the human passkey and the agent EOA as signers.

```bash
splits members list                  # find the human's USER_ID
splits members signers <USER_ID>     # passkey IDs for that human
splits auth signers                  # agent EOA signer id
splits accounts create \
  --name "Bankr Agent Ops" \
  --eoaSignerIds <AGENT_SIGNER_ID> \
  --passkeyIds <HUMAN_PASSKEY_ID> \
  --threshold 2
```

Threshold guidance:

- `--threshold 2` (or higher) — human-in-the-loop. The agent can propose and add its signature, but a human passkey is required to reach threshold. **Default everywhere the agent is a signer.**
- `--threshold 1` — agent can execute alone (its lone signature auto-submits). Create or use one **only when the user has explicitly stated they want it**, and only for constrained sandbox/low-value accounts. This is separate from Splits *automation* accounts, which are unilateral by design (see `swap-and-sweep.md`).

`--eoaSignerIds` is preferred; `--eoaAddresses` is a convenience alternative for already-registered addresses.

## 3b. Add the agent to an existing account

```bash
splits accounts signers <ACCOUNT>     # see current passkeys, EOAs, and threshold
splits accounts update-signers <ACCOUNT> \
  --addEoaSignerIds <AGENT_SIGNER_ID> \
  --memo "Add Bankr agent signer"
```

This creates a proposal immediately, but it must be **approved and signed by a human on the web** via the returned `signUrl`. Before showing the link, confirm its host is `teams.splits.org` or `app.splits.org` — if it points anywhere else, don't display it, warn instead. Hand that URL to the human and poll:

```bash
splits transactions get <TRANSACTION_ID>    # watch CREATED -> EXECUTED
```

Notes:

- A `409 SMART_ACCOUNT_STATE_CHANGE_IN_PROGRESS` means a signer change is already pending. Find it with `splits transactions list --account <ACCOUNT>`; it must be signed or cancelled before retrying.
- The same EOA signer id can be attached to any number of accounts.
- You can also change the threshold or remove signers here (`--threshold`, `--removeEoaIds`, `--addPasskeyIds`, `--removePasskeyIds`). Recovery / resetting signers stays web-only.
- Signer updates apply across every active network on the org automatically.

## Direct execution via modules (advanced, opt-in)

> **Advanced / opt-in only.** A module grants **unilateral** execution with **no per-action approval**. Set it up only when the user explicitly asks for it.

Being a signer is one of two ways an agent can act. The other is the **module system**: an account can `enableModule(<eoa>)` to grant an EOA the ability to call `executeFromModule` and run calls **directly from the account** — `msg.sender` on the inner call is the account, with no proposal, signature, or threshold step per action. `enableModule`/`disableModule` are gated by the account's own authorization, so enabling is a self-call approved by the account's signers (a human, once); execution afterward is not.

| | Signer | Module |
|---|---|---|
| Execution | propose → sign → threshold (userOp) | direct `executeFromModule` |
| Per-action human gate | yes, if threshold ≥ 2 | **none** — full access |
| Enable / revoke | `update-signers` / remove signer | `enableModule` / `disableModule` self-call |

A module has **full, unilateral access** to the account. Splits has **no per-action threshold or spend limit** for a module — that knob does not exist; unilateral execution is the whole point. The only bound is **structural**: the blast radius equals the subaccount's funded balance. So before enabling, require all of — (1) explicit human confirmation, (2) a **dedicated, bounded subaccount, never the Treasury**, funded with only what you're willing to expose and topped up per task, and (3) the `disableModule` revoke call staged up front. It fits autonomous/high-frequency operations and `msg.sender`-gated calls (LP-fee or fee-locker claims). For the runnable Bankr flow — enable the Bankr wallet as a module, then execute via Bankr's raw-transaction `submit` — see `bankr-agent-signer.md`. Contract reference: [`ModuleManager.sol`](https://github.com/0xSplits/splits-contracts-monorepo/blob/main/packages/smart-vaults/src/utils/ModuleManager.sol).

## Passkeys vs EOAs

|                     | Human                                                      | Agent                          |
| ------------------- | ---------------------------------------------------------- | ------------------------------ |
| Credential          | Passkey (biometric)                                        | Local EOA key                  |
| Discover with       | `members signers <USER_ID>` / `accounts signers <ACCOUNT>` | `auth signers` / `auth whoami` |
| Can sign headlessly | No (needs biometric 2nd factor)                            | Yes (local key)                |

Never ask a human for a seed phrase, private key, or passkey. The agent's authority comes only from its registered EOA plus the threshold a human set.

## Verify before acting

```bash
splits auth whoami        # right org? expected key source (env vs keystore)? local key registered?
splits accounts get <ACCOUNT>
splits accounts signers <ACCOUNT>
```
