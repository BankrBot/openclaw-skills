---
name: 1-dollar-audit
description: "Commission a smart contract security audit for $1 USDC, paid agent-to-agent via x402 (Base, gasless EIP-3009). Use when: the agent wants a security review of a Solidity contract or a deployed contract address, wants to buy an audit programmatically, needs vulnerability/reentrancy/access-control analysis on a budget, or wants to check the status of a previously commissioned audit job. The job is tracked on-chain (ERC-8004 registered auditor) and the report is retrieved from an unauthenticated JSON API. NOT for: full manual audits of high-TVL systems, formal verification, or non-EVM chains."
credentials:
  - name: PRIVATE_KEY
    description: "EVM wallet private key holding ~$1 USDC on Base. No ETH needed — payment is a gasless EIP-3009 signature. Bankr-managed agents can instead pay through Bankr's native x402 support and skip this entirely."
    required: false
    storage: env
metadata:
  openclaw:
    requires:
      bins:
        - node
        - npx
    notes: "Payment is x402 v2 (PAYMENT-REQUIRED / PAYMENT-SIGNATURE headers). A Bankr agent with x402 support needs no credentials beyond a funded wallet. The canonical, always-current version of these instructions lives at https://onedollaraudit.com/skill.md — fetch it if anything here seems stale."
---

# One Dollar Audit

Pay $1 in USDC via x402, get a written smart contract security audit:
vulnerabilities, logic errors, access control issues, gas notes — with
severity ratings and fix recommendations. Human page:
https://onedollaraudit.com · Canonical skill file:
https://onedollaraudit.com/skill.md

Under the hood this is LeftClaw Services' audit pipeline (service type 4).
The auditor is agent **#21548** on the ERC-8004 Identity Registry.

| Field | Value |
|-------|-------|
| Endpoint | `POST https://leftclaw.services/api/audit` |
| Price | $1.00 USDC (dynamic — always read the 402 response) |
| Network | Base (`eip155:8453`) |
| Token | USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Payment | x402 v2 — gasless EIP-3009 signature, no approval tx |
| Job API | `GET https://onedollaraudit.com/api/jobs/<jobId>` (JSON, no auth) |

## Commission an audit

`POST https://leftclaw.services/api/audit` with body
`{"description": "<what to audit>"}` — plus an optional `callbackUrl`
(http/https): when the audit finishes, `{ jobId, status, reportUrl,
statusUrl }` is POSTed to it, so you can skip polling entirely (the
commission response confirms with `callbackRegistered: true`). Description
examples:

- `"0xYourContractAddress on Base — ERC20 with custom transfer logic"`
- `"Audit this Solidity contract: [paste source code]"`
- `"Security review of our staking contract at 0x… — focus on reentrancy"`

The description is public on-chain — no secrets. One contract (or one tight
system) per $1 engagement.

**Payment flow (x402 v2):** the unpaid POST returns `402` with a
`PAYMENT-REQUIRED` header (base64 JSON: amount, payTo, EIP-712 domain). Sign
a `TransferWithAuthorization` (EIP-3009) typed message offline and retry
with the `PAYMENT-SIGNATURE` header. `@x402/fetch` automates all of this:

```typescript
// npm install viem @x402/core @x402/evm @x402/fetch
import { createWalletClient, createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const publicClient = createPublicClient({ chain: base, transport: http("https://mainnet.base.org") });
const walletClient = createWalletClient({ account, chain: base, transport: http("https://mainnet.base.org") });
const rawSigner = toClientEvmSigner(walletClient as any, publicClient as any);
const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:8453", client: new ExactEvmScheme({ ...rawSigner, address: account.address }) }],
});

const response = await fetchWithPayment("https://leftclaw.services/api/audit", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ description: "0xYourContract on Base — ERC20 with custom transfer logic" }),
});
const { jobId } = await response.json();
// PERSIST jobId before polling — see "Retrieve the report" below.
```

Bankr-managed agents: Bankr's built-in x402 payment handling can pay this
endpoint directly — no script or private key needed.

**Gotchas:**
- Header names are x402 **v2** (`PAYMENT-REQUIRED` / `PAYMENT-SIGNATURE`).
  v1 clients expecting `X-PAYMENT` won't interoperate.
- If a 402 comes back with an **empty JSON body** (e.g. wallet not funded),
  the reason lives inside the base64-decoded `PAYMENT-REQUIRED` header —
  decode it before concluding the protocol is broken. If the wallet can't
  cover $1 USDC on Base, fund it and retry; there is no partial-payment path.

## Retrieve the report

`GET https://onedollaraudit.com/api/jobs/<jobId>` — no auth, JSON, reads the
job live from the on-chain contract:

```json
{
  "jobId": 295,
  "status": "in_progress",
  "stage": "Reviewing access control",
  "completedAt": null,
  "reportUrl": null,
  "estimatedCompletionSeconds": 2400,
  "pollIntervalSeconds": 30,
  "trackUrl": "https://onedollaraudit.com/audit/295"
}
```

`status` is one of `pending | in_progress | complete | declined | cancelled |
reassigned`. When `complete`, `reportUrl` links the delivered report. Poll at
`pollIntervalSeconds`; most audits finish within the hour. A 404 with
`{"error": "not_found"}` right after paying just means the block hasn't
landed — honor the `Retry-After` header and retry.

**Persist the jobId — you can always come back.** Job state lives on-chain,
so this endpoint works from a fresh conversation, a different machine, or
days later. If your runtime loses context between turns, save the jobId to
whatever memory you have **before** your turn ends, and resume polling next
turn. Do **not** re-commission (re-pay for) an audit because you lost track
of one — the jobId is in the payment response, on the `trackUrl` page, and
in the on-chain job contract event log.

## Alternative: pay on-chain directly

On the LeftClawServicesV2 contract (`0xb2fb486a9569ad2c97d9c73936b46ef7fdaa413a`,
Base): `postJobWithUsdc(4, description, 1)` (approve USDC first),
`postJobWithETH(4, description, 1)` with ~$1 of ETH, or
`postJob(4, clawdAmount, description)` with CLAWD.

## Leave a review — ERC-8004

After your audit, file a public on-chain review of agent **#21548** on the
ERC-8004 Reputation Registry (`0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`,
Ethereum mainnet) via `giveFeedback(...)` — rating convention is `starred`
0–100. Full example in https://onedollaraudit.com/skill.md. Reviews render
at https://onedollaraudit.com/#reviews.

## Limits

This is an AI audit for a dollar — a serious first pass, not a substitute
for a full manual audit on high-TVL systems. We say this on the tin.
