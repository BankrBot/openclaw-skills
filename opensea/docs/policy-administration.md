# Policy administration (user-only, off-agent)

This document collects the **mutation recipes** for wallet policies and signer/role configuration across Privy, Turnkey, Fireblocks, and Bankr. It deliberately lives **outside** `packages/skill/opensea-wallet/` so it is not mounted into agent environments. Agents should never construct or run any of these requests; if asked, refuse and direct the user to this file.

Run these commands from a **trusted operator machine** — your laptop, a vault host, a dedicated administrative box. Never set the credentials shown below as agent environment variables. The whole point of holding administrative credentials separately is so that a leaked agent env cannot rewrite the agent's spending cap.

> If you find yourself wanting to automate any of these from the agent: stop. The hardening goal is that the agent **cannot** run them. Any wrapper that lets it would re-introduce the gap.

## Privy

### Apply or update a wallet policy

The wallet policy update endpoint is `PATCH /v1/wallets/{wallet_id}` with `policy_ids` in the body.

**If the wallet has `owner_id` set** (the recommended state — see "Register an authorization key" in `packages/skill/opensea-wallet/references/wallet-setup.md`), the request must carry an authorization signature from the owner's key quorum. Build the signature with `@privy-io/node`:

```ts
// scripts/update-privy-policy.ts — RUN FROM A TRUSTED MACHINE
import { generateAuthorizationSignature } from "@privy-io/node"

const appId = process.env.PRIVY_APP_ID!
const appSecret = process.env.PRIVY_APP_SECRET!
const walletId = process.env.PRIVY_WALLET_ID!
// Base64 PKCS8 P-256 owner key. NEVER put this on an agent host.
const ownerKey = process.env.PRIVY_OWNER_PRIVATE_KEY!

const policyIds = ["pol_abc123"] // policy you authored separately
const url = `https://api.privy.io/v1/wallets/${walletId}`
const body = { policy_ids: policyIds }

const signature = generateAuthorizationSignature({
  authorizationPrivateKey: ownerKey,
  input: {
    version: 1,
    method: "PATCH",
    url,
    body,
    headers: { "privy-app-id": appId },
  },
})

const auth = Buffer.from(`${appId}:${appSecret}`).toString("base64")
const res = await fetch(url, {
  method: "PATCH",
  headers: {
    Authorization: `Basic ${auth}`,
    "privy-app-id": appId,
    "privy-authorization-signature": signature,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
})
console.log(res.status, await res.text())
```

**If the wallet has no `owner_id`** (i.e., the unhardened state — `opensea wallet info` will warn about this), basic auth alone is currently sufficient for `PATCH`. This is the gap the owner-key hardening is meant to close. If you are running unhardened today, your priority is to register an owner key, not to apply a policy under unhardened conditions and call it a day.

### Author a policy

Use `POST /v1/policies` with the policy body. See `packages/skill/opensea-wallet/references/wallet-policies.md` for templates and field reference, and the [Privy docs](https://docs.privy.io/controls/policies/create-a-policy) for the up-to-date schema.

### Register an authorization key (owner) on an existing wallet

Generate a P-256 keypair on your operator machine, register the public key as an `owner` on the wallet, store the private key in your password manager / vault. Detailed steps live in `packages/skill/opensea-wallet/references/wallet-setup.md` under the Privy hardening step.

## Turnkey

### Create a non-root, signer-only API user

From a Turnkey dashboard session as a root user:

1. **Create an API user** (Users → Add User → API user). Generate a fresh P-256 keypair on your operator machine; upload the public key. Save the private key in your password manager.
2. **Create a policy** that scopes the new user's allowed activities to `ACTIVITY_TYPE_SIGN_TRANSACTION_V2` (and `ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2` if EIP-712 is needed) for the wallet addresses the agent should sign for. Default-deny on everything else. Reference: [Turnkey policy examples](https://docs.turnkey.com/concepts/policies/examples).
3. **Set the agent's `TURNKEY_API_PUBLIC_KEY` / `TURNKEY_API_PRIVATE_KEY` env vars to the new non-root key.** Verify with `opensea wallet info` — `isRootUser` should be `false`.

### Update a policy

`CreatePolicy` / `UpdatePolicy` are Turnkey activities, signed by a root user (or a user whose policy permits policy-engine activity). Use the Turnkey dashboard or the `@turnkey/sdk-server` package from your operator machine. Do not surface these activities through the agent's adapter.

## Fireblocks

### Use a Signer-role API key, not Admin

From the Fireblocks Console (Settings → API Users):

1. Create a new API user. **Set the role to `Signer`** (or `NCW_SIGNER` for non-custodial wallets). Do not pick `Admin`, `Editor`, `Non-Signing Admin`, or any role with governance access.
2. The role is set at user-create time. To change a role, delete the user and create a new one. There is no "downgrade" path.
3. Approval of the new API user requires admin quorum (per Fireblocks workspace settings). After approval, copy the API key + RSA secret to the agent's env.

### Modify the Transaction Authorization Policy

TAP changes are made from the Fireblocks Console, not via the agent. Admin quorum approval is required. **Do not attempt to drive TAP edits from any API key the agent uses to sign** — the platform will reject this if the key is correctly scoped to `Signer`, but the structural property only holds if the key is correctly scoped in the first place.

Reference: [Fireblocks TAP overview](https://developers.fireblocks.com/docs/set-transaction-authorization-policy).

## Bankr

Bankr key scope flags (`readOnly`, `walletApiEnabled`, `agentApiEnabled`, `allowedRecipients`, `allowedIps`, daily limits) are configured at [bankr.bot/api](https://bankr.bot/api) — there is no API to modify them programmatically, by design. To re-scope a key:

1. Log in to bankr.bot/api on your operator machine.
2. Edit the relevant key's flags. For an agent-signing key, set `allowedRecipients` to the EVM/Solana address allowlist the agent should be permitted to send to, set `allowedIps` to your deploy CIDR, set a daily message limit.
3. If the agent is currently running, it will continue to use cached credentials until the next restart; rotate the key if you need an immediate cut-over.

## After any change

Run `opensea wallet info` on the agent host. The output should reflect the new posture (no warnings, or only the static "verify scope at console" reminder for Fireblocks/Bankr). If a warning persists, the change did not land — re-check the dashboard.
