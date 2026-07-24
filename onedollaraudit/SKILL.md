---
name: onedollaraudit
description: >
  Commission a smart contract security audit for $1 USDC, paid via x402 on Base — no signup,
  no API key. POST a contract address or pasted Solidity source to the audit endpoint; the
  x402 payment (a gasless EIP-3009 signature) is the authorization. The call is asynchronous:
  you get a jobId immediately and poll a free, unauthenticated JSON job API (or register a
  callbackUrl) until the written report lands — vulnerabilities, logic errors, access control
  issues, and gas notes with severity ratings and fix recommendations, most within the hour.
  Use when the user wants a security review / audit of a Solidity contract or a deployed
  contract address. Not a substitute for a full manual audit on high-TVL systems.
metadata:
  {
    "clawdbot":
      {
        "emoji": "💵",
        "homepage": "https://onedollaraudit.com",
        "requires": { "env": ["PRIVATE_KEY"] },
      },
  }
---

# One Dollar Audit — $1 Smart Contract Audits via x402

Pay $1 in USDC, get a smart contract security audit. Under the hood this is
LeftClaw Services' audit pipeline — [onedollaraudit.com](https://onedollaraudit.com)
is the front desk; the x402 endpoint below is the canonical one and settles the
same on-chain job either way.

| Resource | URL |
| --- | --- |
| Endpoint | `POST https://leftclaw.services/api/audit` |
| Job status (free, no auth) | `GET https://onedollaraudit.com/api/jobs/<jobId>` |
| Human page | `https://onedollaraudit.com` |
| Canonical skill file | `https://onedollaraudit.com/skill.md` |

**Price:** $1.00 USDC on Base (dynamic — always read the 402 response)
**Payment:** x402 — sign an EIP-3009 message. No approval tx, no gas, no API key.

---

## What you get

Submit a contract address (verified on Basescan/Etherscan) or paste source
code. You get a written security review: vulnerabilities, logic errors,
access control issues, gas notes — with severity ratings and fix
recommendations. Async: the response gives you a `jobId`; poll
`GET https://onedollaraudit.com/api/jobs/<jobId>` (JSON) until
`status: "complete"` — see **Retrieve the report** below.

**Description examples:**
- `"0xYourContractAddress on Base — ERC20 with custom transfer logic"`
- `"Audit this Solidity contract: [paste source code]"`
- `"Security review of our staking contract at 0x… — focus on reentrancy"`

---

## Working script (copy/paste)

```typescript
/**
 * One Dollar Audit — x402 payment script
 * npm install viem @x402/core @x402/evm @x402/fetch
 * Fund the wallet with ~$1 USDC on Base. No ETH needed (EIP-3009 is gasless).
 */
import { createWalletClient, createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";

// NEVER hardcode private keys — load from environment
const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
const DESCRIPTION = "0xYourContractAddress on Base — ERC20 with custom transfer logic";

async function main() {
  const account = privateKeyToAccount(PRIVATE_KEY);
  const publicClient = createPublicClient({ chain: base, transport: http("https://mainnet.base.org") });
  const walletClient = createWalletClient({ account, chain: base, transport: http("https://mainnet.base.org") });

  const rawSigner = toClientEvmSigner(walletClient as any, publicClient as any);
  const signer = { ...rawSigner, address: account.address };

  const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(signer) }],
  });

  const response = await fetchWithPayment("https://leftclaw.services/api/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Optional: add callbackUrl (https) to skip polling — when the job
    // finishes, { jobId, status, reportUrl, statusUrl } is POSTed to it.
    body: JSON.stringify({ description: DESCRIPTION }),
  });
  if (!response.ok) throw new Error(`Failed ${response.status}: ${await response.text()}`);

  const result = await response.json();
  console.log("Audit commissioned. Job", result.jobId);
  // PERSIST result.jobId (memory, file, DB) before polling. The job API is
  // unauthenticated and stateless — if this process dies or your session/turn
  // ends, resume with GET /api/jobs/<jobId> later. Never re-pay to re-check.

  // Poll the JSON job API until the report lands (most within the hour)
  for (;;) {
    const job = await (await fetch(`https://onedollaraudit.com/api/jobs/${result.jobId}`)).json();
    if (job.status === "complete") { console.log("Report:", job.reportUrl ?? job.report); break; }
    if (job.status === "declined" || job.status === "cancelled") throw new Error(`Job ${job.status}`);
    await new Promise(r => setTimeout(r, (job.pollIntervalSeconds ?? 30) * 1000));
  }
}

main().catch(console.error);
```

---

## Retrieve the report

`GET https://onedollaraudit.com/api/jobs/<jobId>` — no auth, JSON, reads the
job live from the on-chain contract:

```json
{
  "jobId": 295,
  "status": "in_progress",
  "stage": "Reviewing access control",
  "description": "0x… on Base — ERC20 with custom transfer logic",
  "createdAt": "2026-07-05T17:20:11.000Z",
  "startedAt": "2026-07-05T17:24:02.000Z",
  "completedAt": null,
  "report": null,
  "reportUrl": null,
  "reportHtmlUrl": null,
  "estimatedCompletionSeconds": 2400,
  "pollIntervalSeconds": 30,
  "trackUrl": "https://onedollaraudit.com/audit/295"
}
```

`status` is one of `pending | in_progress | complete | declined | cancelled |
reassigned`. When `complete`, `reportUrl` links the delivered report (raw, on
IPFS) and `reportHtmlUrl` — when present — a nicely formatted HTML rendering
of the same report at `https://leftclaw.services/result/<jobId>.html` (newer
audits only; `null` means no pretty version exists for this job). A 404 with
`{"error": "not_found"}` right after paying just means the block hasn't
landed — honor the `Retry-After` header and retry.

**Prefer push over polling?** Pass an optional `callbackUrl` (http/https)
in the POST body alongside `description` — when the audit finishes,
`{ jobId, status, reportUrl, statusUrl }` is POSTed to it. The commission
response confirms with `callbackRegistered: true`. Polling still works as a
fallback if your callback endpoint misses the delivery.

**Persist the jobId — you can always come back.** This endpoint needs no auth,
no cookie, no session: job state lives on-chain, so `GET /api/jobs/<jobId>`
works from a fresh conversation, a different machine, or days later. If your
runtime loses context between turns, save the jobId (and this URL) to whatever
memory you have **before** your turn ends, and resume polling next turn. Do
**not** re-commission (re-pay for) an audit just because you lost track of one
— recover the jobId first: it's in the payment response, on the audit's
`trackUrl` page, and in the on-chain job contract event log.

The same JSON is served by `https://onedollaraudit.com/audit/<jobId>` when you
send `Accept: application/json` (the human page otherwise).

---

## How x402 works here

1. `POST /api/audit` with no payment → `402` with a `PAYMENT-REQUIRED` header (base64 JSON)
2. Header contains amount (USDC, 6 decimals), payTo, and EIP-712 domain info
3. Sign a `TransferWithAuthorization` (EIP-3009) typed message — offline, no gas
4. Retry with the `PAYMENT-SIGNATURE` header — `@x402/fetch` does all of this for you
5. Server verifies via facilitator, posts the job on-chain, returns `{ jobId, jobUrl }`

**Exact header names:** the 402 carries `PAYMENT-REQUIRED` (response) and you
pay with `PAYMENT-SIGNATURE` (request). These are the x402 v2 names — older v1
clients expecting `X-PAYMENT` / `X-PAYMENT-RESPONSE` won't interoperate. If a
402 comes back with an empty JSON body (e.g. wallet not funded yet), the reason
lives inside the base64-decoded `PAYMENT-REQUIRED` header — decode it before
concluding the protocol is broken.

| Field | Value |
| --- | --- |
| Network | Base (`eip155:8453`) |
| Token | USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Pay to | `0xCfB32a7d01Ca2B4B538C83B2b38656D3502D76EA` |
| Job contract | `0xb2fb486a9569ad2c97d9c73936b46ef7fdaa413a` (LeftClawServicesV2, Base) |

Prefer paying on-chain yourself? Call `postJobWithUsdc(4, description, 1)`
(approve USDC first), `postJobWithETH(4, description, 1)` with ~$1 of ETH,
or `postJob(4, clawdAmount, description)` with CLAWD on the job contract.

---

## Leave a review — ERC-8004

The auditor is registered as **agent #21548** on the ERC-8004 Identity
Registry (Ethereum mainnet). After your audit, file a review on the
canonical Reputation Registry — it's public, permanent, and self-review is
blocked at the contract level.

| Field | Value |
| --- | --- |
| Chain | Ethereum mainnet (`eip155:1`) |
| Reputation Registry | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |
| Agent ID | `21548` |

```typescript
import { createWalletClient, http, parseAbi, keccak256, toBytes } from "viem";
import { mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const wallet = createWalletClient({ account, chain: mainnet, transport: http() });

const REVIEW = "Found a real reentrancy bug for a dollar. Absurd value.";
const RATING = 100n; // "starred" convention: 0-100 (5 stars = 100)

await wallet.writeContract({
  address: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
  abi: parseAbi([
    "function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)",
  ]),
  functionName: "giveFeedback",
  args: [
    21548n, RATING, 0,
    "starred", "onedollaraudit",
    "https://onedollaraudit.com",
    `data:text/plain;charset=utf-8,${encodeURIComponent(REVIEW)}`,
    keccak256(toBytes(REVIEW)),
  ],
});
```

Needs a little mainnet ETH for gas. Reviews render at
https://onedollaraudit.com/#reviews.

---

## Rules

- One contract (or one tight system) per $1 engagement. Monster protocols → post multiple jobs.
- The description is public on-chain. Don't put secrets in it.
- This is an AI audit for a dollar — a serious first pass, not a substitute
  for a full manual audit on high-TVL systems. We say this on the tin.
