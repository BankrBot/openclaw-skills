---
name: splits
description: "Use Splits with Bankr for onchain treasury operations: secure assets, process revenue, manage operating subaccounts, pay expenses, govern contracts, and maintain clean accounting books."
tags: [treasury, operations, multisig, accounting, payments, agents, defi]
version: 1
visibility: public
metadata:
  clawdbot:
    emoji: "🏦"
    homepage: "https://splits.org/treasury"
    requires:
      bins: [node, npx]
      packages: ["@splits/splits-cli"]
---

# Splits

Splits is a self-custodied onchain treasury platform: multisig accounts with configurable approval thresholds, crosschain operating subaccounts, USD/EUR bank off/on-ramps, automated swap-and-sweep accounts for revenue processing, and clean accounting. Humans design the rules and restrictions in which agents can act.

Division of labor with Bankr: Bankr handles market/trading reasoning and fast small-value moves from its own wallet; Splits holds the treasury, enforces the approval policy, and executes governed payments and revenue operations. Keep day-to-day spending in Bankr and larger balances (revenue, reserves, payroll) in Splits; the agent moves funds between the two as needed.

Using Splits and Bankr together: a Bankr agent operates Splits through the CLI, and gets execution power on an account one of two ways. As a multisig **signer** — a dedicated Splits EOA the agent generates (separate from the Bankr wallet); every action is a proposal, and the account threshold sets whether the agent acts alone or needs human co-approval. Or as a **module** — the Bankr wallet itself, enabled on a bounded subaccount to execute directly with no per-action proposal (full, unilateral access; bounded subaccounts only, never the Treasury). Both setups are in [references/bankr-agent-signer.md](references/bankr-agent-signer.md).

## When to use Splits

- **Process revenue and pay expenses** — claim/collect protocol or token fees into a secure multisig treasury, then pay vendors, payroll, grants, and reimbursements, and off/on-ramp between USD and EUR via connected bank accounts. See [references/treasury-workflows.md](references/treasury-workflows.md).
- **Create subaccounts and grant scoped human + agent access** — separate operating accounts by revenue stream, expense category, experiment, or department, and add teammates and agents with granular permissions and signer thresholds. See [references/agent-access.md](references/agent-access.md).
- **Automate swap and sweep** — process revenue with accounts that auto-convert to stablecoin, buy back your token, withhold tax, or consolidate the treasury. See [references/swap-and-sweep.md](references/swap-and-sweep.md).
- **Keep clean books** — add memos and custom properties to every transaction, then filter, reconcile, and export for accounting and tax prep. See [references/accounting-analysis.md](references/accounting-analysis.md).

## When NOT to use Splits

Simple one-off Bankr trades, market research, or actions that only need the Bankr wallet/agent APIs. Reach for Splits when the action touches the treasury, needs an approval policy, or needs durable accounting.

## Setup

A Bankr agent gets execution power on an account one of two ways — full walkthrough for both in [references/bankr-agent-signer.md](references/bankr-agent-signer.md):

- **Signer** (steps below): the agent generates a dedicated Splits EOA (`splits auth create-key --register`), then a human adds that EOA as a signer — on a new subaccount (step 4a) or an existing account (step 4b). The key is separate from the Bankr wallet; every action is a proposal, and the threshold sets the approval path.
- **Module** (see [the alternative at the end of Setup](#alternative-module-based-execution-direct)): enable the Bankr wallet itself as a module on a bounded subaccount for direct execution — no separate key. Full, unilateral access; bounded subaccounts only, never the Treasury.

The Splits **CLI is the primary programmatic path** (`@splits/splits-cli`, also ships a built-in MCP server exposing the same surface). For an agent that calls it repeatedly, **install once globally** — the package is tiny but pulls in `viem` (~24 MB), so a one-time install avoids re-downloading that on every `npx` call:

```bash
npm install -g @splits/splits-cli       # recommended for agents — one-time, then instant
# quick one-off without installing (downloads deps on first run):
npx -y @splits/splits-cli@latest --help
```

After a global install, get the full command reference with `splits --llms-full`.

**1. Human creates a Splits API key** (browser-only; requires a Splits team; free):
`https://teams.splits.org/settings/team/api-keys/`. The agent should ask the user for the key or read an injected `SPLITS_API_KEY`. Never paste it into shell history.

**2. Authenticate and verify the org/key source:**

```bash
echo "$SPLITS_API_KEY" | splits auth login   # prefer stdin, not --apiKey
splits auth whoami                            # confirm org, key name, scopes, local EOA
```

**3. Give the agent a signing key** (its own dedicated Splits EOA — distinct from its Bankr wallet and from any human passkey):

```bash
splits auth create-key --register --name "Bankr Agent"   # create local EOA + register in one call
splits auth whoami                                        # localKey.signerId is now set
```

**4a. Create a bounded agent subaccount** with human + agent signers from the start:

```bash
splits members list                       # find the human USER_ID
splits members signers <USER_ID>          # discover the human's passkey IDs
splits auth signers                        # discover the agent's EOA signer id
splits accounts create --name "Bankr Agent Ops" \
  --eoaSignerIds <AGENT_SIGNER_ID> --passkeyIds <HUMAN_PASSKEY_ID> --threshold 2
```

Default to `--threshold 2` (human-in-the-loop). Use `--threshold 1` only for constrained sandbox accounts.

**4b. Or add the agent to an existing account.** This creates a proposal the human must approve on the web:

```bash
splits accounts update-signers <ACCOUNT> --addEoaSignerIds <SIGNER_ID> --memo "Add Bankr agent signer"
# hand the returned signUrl to the human, then poll:
splits transactions get <TRANSACTION_ID>   # CREATED -> EXECUTED
```

Note: `members signers` lists **passkeys** (human); `auth signers` lists the agent's registered **EOA** signer ids. Passkeys require a biometric second factor agents cannot provide, so agents always sign with their local EOA.

### Alternative: module-based execution (direct)

Beyond being a signer, an agent can be enabled as a **module** on a subaccount: the account `enableModule(<eoa>)`s the agent, after which it calls `executeFromModule` to run transactions **directly from the subaccount** — no proposal/threshold per action, with `msg.sender` = the subaccount (so it satisfies `msg.sender`-gated calls like fee-locker claims). For Bankr this reuses the **Bankr wallet itself** — enable its address as a module, then execute via Bankr's raw-transaction `submit`, no separate Splits key. A module has **full, unilateral access**, so use a dedicated, bounded subaccount — **never the Treasury** — and enabling is human-approved and revocable (`disableModule`). The only human input needed is the subaccount address. Full flow in [references/bankr-agent-signer.md](references/bankr-agent-signer.md).

## Core workflows

Brief overview below; deeper, step-by-step procedures live in `references/`.

### Treasury inventory and monitoring

```bash
splits accounts list
splits accounts get <address>
splits accounts balances <address> --chainIds 1,8453
splits automations list
splits transactions list --account <address> --period thisMonth
```

### Payments and expenses

Use `transactions create transfer` for vendor, payroll, reimbursement, grant, and operational payments. Always attach a memo and/or properties for accounting context:

```bash
splits transactions create transfer --account <ACCOUNT> --chainId 8453 \
  --recipient <ADDRESS> --token <TOKEN> --amount "1000" \
  --memo "Vendor payment INV-123" --property invoice=INV-123 --property category=vendor
```

The approval path depends on the account threshold. The agent can `splits transactions sign <id>` only once it is an approved signer and policy allows; a signature meeting threshold auto-submits unless `--noSubmit`. See `references/treasury-workflows.md`.

### Revenue, swaps, sweeps, and buybacks

Splits subaccounts + automations handle revenue streams, token conversion, buybacks, tax withholding, and consolidation. **Automation rules are configured in the Splits web app; via CLI the agent discovers and monitors them with `automations list`.** For one-off swaps/buybacks not covered by a high-level command, use `transactions create custom` with raw EVM calls — but only after explaining the target contract, calldata, value, and risk. See `references/swap-and-sweep.md`.

### Fee-locker claiming

Identify the fee-locker contract and claim method first, describe/simulate the call, then create a Splits custom transaction from the treasury/subaccount and forward proceeds to the multisig. **Do not invent ABI or calldata** — if the ABI/claim method is unknown, ask for it or fetch it from the canonical explorer/source. See `references/treasury-workflows.md`.

### Subaccounts and approvals

Create subaccounts per purpose (revenue, buyback, payroll, vendors, grants, trading sandbox, tax reserve) with `accounts create`, and manage signer sets/thresholds with `accounts signers` and `accounts update-signers`. Passkeys/biometrics stay with humans; agents use their own EOA keys. See `references/agent-access.md`.

### Accounting and cleanup

```bash
splits transactions list --account <address> --period lastMonth --direction outbound
splits transactions memo <id> --memo "Q1 payroll"
splits transactions properties set <id> --property category=payroll --property period=2026Q1
```

Filter with `--period`, `--direction`, `--memo`, `--minAmount`, `--maxAmount`, `--transactionHash`, `--userOpHash`. Do period/category math with scripts, not by hand. See `references/accounting-analysis.md`.

## Safety

- Never ask for or store a human seed phrase, private key, or passkey.
- Prefer `SPLITS_API_KEY` via env or stdin login; keep secrets out of shell history.
- Run `splits auth whoami` before acting and verify the org and key source.
- Agent signing requires the local EOA created/imported by the CLI **and** that EOA being a registered signer on the account. Whether execution also needs a human depends on the threshold: on a 2-of-N (or higher) account the agent's lone signature can't execute — a human passkey is required; on a 1-of-N account where the agent is a signer, its signature meets threshold and **auto-submits with no human in the loop**. Use thresholds ≥ 2 for production treasury so agent actions stay human-approved.
- Before any state-changing action, show account, chain, token, recipient, amount, memo/properties, signer threshold, and the expected approval path.
- Default to human-in-the-loop thresholds for production treasury accounts.
- Do not use `transactions create custom` unless the contract target and calldata are known and explained. No invented ABIs, token addresses, or integrations.

## References

- [references/treasury-workflows.md](references/treasury-workflows.md) — **process revenue and pay expenses**: inventory, fee-locker claiming, vendor/payroll payments, fiat off/on-ramp, custom transactions, signing.
- [references/agent-access.md](references/agent-access.md) — **subaccounts and scoped access**: API key, CLI auth, agent EOA registration, signer sets, permissions, and thresholds.
- [references/swap-and-sweep.md](references/swap-and-sweep.md) — **automate swap and sweep**: stablecoin conversion, buybacks, tax withholding, and consolidation.
- [references/accounting-analysis.md](references/accounting-analysis.md) — **keep clean books**: transaction filtering, memo/property cleanup, reconciliation, and exports.

## Resources

- Splits Treasury: https://splits.org/treasury
- LLM context: https://splits.org/llms.txt
- CLI reference: `npx -y @splits/splits-cli@latest --llms-full`
- API keys (browser): https://teams.splits.org/settings/team/api-keys/
