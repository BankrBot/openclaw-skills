---
name: Empire Builder
description: Empire Builder AI skill — SmartVault treasuries, leaderboards, boosters, prepare→executeBatch→store distributions, burns, airdrops, Clanker deploys. Self-contained in this skill folder; follow references/http-api.md and references/workflows.md exactly.
version: 1.3.0
lastUpdated: 2026-05-18
homepage: https://empirebuilder.world/skill/SKILL.md
dependencies: [clanker-sdk@4.2.16, viem@2.48.0]
metadata: {"clawdbot":{"emoji":"👑","homepage":"https://empirebuilder.world","requires":{"env":["EMPIRE_API_KEY"],"bins":["curl"]}}}
---

# Empire Builder Skill

**Empires** are community treasuries (ERC-4337 SmartVaults on Base `8453` and Arbitrum `42161`) paired with an identity (**Empire ID**). Agents orchestrate HTTP APIs plus wallet-signed txs (`executeBatch` for payouts).

**Base URL:** `https://empirebuilder.world` — **mainnet only.** There is no testnet or sandbox API documented here.

**Packages (pinned):** `npm install clanker-sdk@4.2.16 viem@2.48.0` — versions match the YAML frontmatter; use a lockfile in automation; avoid `@latest` for reproducibility.

**Skill copies:** If you sync from `homepage`, diff against a trusted checkout before relying on it in scripts.

<a id="intentional-product-behavior"></a>

## Intentional product behavior (not documentation bugs)

The integration surface is **meant** to hit **production** chains with **vault `owner()`** authority. “Hardening” belongs in **product code, infra, and operator tooling**—this skill only describes the API/contract shape.

- **All writes are live** on Base `8453` / Arbitrum `42161` unless you stick to reads.
- **`distribute-prepare`** + owner-broadcast **`executeBatch`** is the designed API path; SmartVault **`owner()`** is required on-chain (see [`references/contracts.md`](references/contracts.md)).
- **`POST /api/store-distribution`** persists from **mined `transactionHashes`** (receipt-backed): recorded payouts follow **on-chain execution**, not prepare JSON alone. You still must pass correct **`empireAddress`**, **`baseToken`** (Empire ID), and leaderboard fields so rows attach to the right empire ([`http-api.md`](references/http-api.md#post-apistore-distribution)).
- Registry/scanner warnings about “agent + wallet + mainnet” reflect **that intentional design**, not missing caveats in this file.

---

## How agents should use this skill

Models usually load **`SKILL.md` first** only. Treat this file as **routing + constraints**. Before writing HTTP bodies, signing flows, or multi-step flows, **open the reference files** listed below—otherwise you will guess missing fields (`signer` vs `signerAddress`, `leaderboardType` values, booster payloads). For **one pipeline story** (especially payouts), follow [`references/workflows.md`](references/workflows.md) step order.

---

## When NOT to use this skill

Stop and pick a different approach if any of these apply:

- **End-user wallet UX inside the Empire web app.** The website signs **sponsored ERC‑4337 UserOperations** (paymaster-funded `executeBatch` via EntryPoint) for co-signers — **not** the prepare → owner-broadcast → store path this skill describes. Use the in-app flow (or its dedicated front-end client code), not these HTTP routes.
- **Co-signer / "authorized signer" automation.** Co-signers **cannot** call vault `execute`/`executeBatch` directly (reverts `Unauthorized`) and **cannot** drive `POST /api/distribute-prepare` — that route requires `owner()`. If you are a co-signer, either (a) trigger a UserOp through the web app, or (b) escalate to the vault owner.
- **Generic ERC-4337 / paymaster / bundler tutorials.** This skill does not teach you to build a sponsor, bundler, or EntryPoint integration. Don't graft `/alchemy-sponsor-userop`-style helpers or legacy `distribute-v3` endpoints onto these flows.
- **Non-Empire token deploys.** Plain Clanker SDK deploys without an Empire are out of scope — use the Clanker docs directly. This skill only covers Clanker → `deploy-empire` wiring.
- **Testnets / local dev.** No sandbox endpoint exists. If you need a dry-run, read-only GETs are safe; do not invent `/sepolia/...`, `chainId: 84532`, or staging hosts.
- **Mass user-to-user transfers from random EOAs.** Use a normal ERC-20 `transfer` from the holding wallet — vault roles, prepare/store, and distribution routes don't apply.

---

## Empire ID vs SmartVault address (read this first)

Three input shapes resolve to **one Empire**, but they are **not** the SmartVault address:

| Shape | Looks like | Where it appears |
|-------|------------|------------------|
| Token empire | `0x` + 40 hex (the ERC‑20 base token) | most `tokenAddress` / `baseToken` params |
| Farcaster tokenless | `fid` + digits (e.g. `fid12345`) | tokenless empires anchored to a Farcaster fid |
| Custom tokenless slug | alphanumeric slug | tokenless empires with a custom identity |

- **Empire ID** is identity. Often spelled `tokenAddress`, `baseToken`, `empire_id`, or sits in the path segment `/api/empires/[empire_id]`.
- **SmartVault address** is the on-chain treasury contract. Spelled `empire_address` / `empireAddress` / `treasuryAddress`. Resolve it from `GET /api/empires/[empire_id]`.
- They are **never interchangeable** unless an endpoint explicitly takes both. Do not pass an `fid…` Empire ID where a contract address is required, and do not pass the SmartVault address where Empire ID is required (e.g. `store-distribution` wants both, with distinct field names).

See [`references/http-api.md` → Empire ID](references/http-api.md#empire-id-base_token) for the full type table.

---

## How this skill is structured

Everything agents need lives **inside this skill folder** — no dependency on other folders.

| File | Role |
|------|------|
| **`SKILL.md`** (this file) | Scope, rules, orientation |
| [`references/http-api.md`](references/http-api.md) | Canonical HTTP routes, auth, Empire ID, key JSON shapes |
| [`references/workflows.md`](references/workflows.md) | End-to-end sequences (deploy, distribute, burn, …) |
| [`references/contracts.md`](references/contracts.md) | SmartVault `execute` / `executeBatch`, chains |

---

## Agent constraints (mandatory)

1. **Catalog fidelity.** Only use routes and semantics described in [`references/http-api.md`](references/http-api.md). Do not invent paths or composite undocumented URLs.

2. **Authentication.** Send **`x-api-key`** where [`references/http-api.md`](references/http-api.md) says so. Writes often require EIP-191 **`signature`**, **`message`**, and **`signer`** or **`signerAddress`** — match field names per route.

3. **Treasury payouts.** Integration flow only: **`POST /api/distribute-prepare`** → vault **`owner()`** wallet submits vault **`executeBatch`** txs (**you pay gas**) → **`POST /api/store-distribution`**. Do not substitute random sponsor/UserOp tutorials unless working purely inside the official web app (different pipeline).

4. **`POST /api/distribute-prepare`** signer must equal **`owner()`** on the vault — **not** co-signers / “authorized” SmartVault signers. Those addresses can authorize **UserOperations** in the web app (sponsored **`executeBatch`** via EntryPoint), but they **cannot** use this API path and **cannot** **`execute`** or **`executeBatch`** on the vault with a normal EOA transaction — the contract reverts **`Unauthorized`**. See [`references/contracts.md`](references/contracts.md). On **other** routes, recovered **`signer`** may be checked against **`owner`** / **`co_emperors`** per backend rules — do not assume the same rule as **`distribute-prepare`**.

5. **Empire ID vs SmartVault address.** Per the dedicated section above, `tokenAddress` / `baseToken` / `empire_id` is **identity** (ERC‑20, `fid…`, or slug); `empireAddress` / `treasuryAddress` is the **on-chain vault**. Confusing them is the most common skill-failure mode — re-check field names against [`references/http-api.md`](references/http-api.md) before sending any write.

6. **Burns.** Decoded from the burn tx receipt: ERC‑20 **Transfer** to **`0x000…0000`** or **`0x000…dEaD`** for the empire **base** (or attached base if tokenless), then **`POST /api/store-burn`**. If tokens sit **in the SmartVault**, only **`owner()`** can fire a direct vault **`execute`** / **`executeBatch`**; co-signers burn from the treasury in the **website** via sponsored **`executeBatch`** UserOps (Base / Arbitrum). If tokens sit in **any other wallet**, that wallet **`transfer`**s to a burn address — no vault role needed.

---

## At-a-glance: integration surfaces

| Area | Mechanism |
|------|-----------|
| Reads | Mostly open GETs; some routes require API key (see [`references/http-api.md`](references/http-api.md)) |
| Leaderboard payouts | prepare (owner-signed) → `transactions[]` → owner broadcasts `executeBatch` → store-distribution |
| Burns | Eligible **Transfer** in mined tx → store-burn; treasury burns: owner self-paid **`execute`**, or web app UserOp **`executeBatch`** for co-signers |
| Boosters | [`references/http-api.md`](references/http-api.md) — `/api/boosters/...` |
| Token deploy | `get-token-config` → Clanker SDK deploy → `deploy-empire` |

---

## Example prompts

- Walk distribution preparation using leaderboard **`main`** and two ERC‑20s from [`references/workflows.md`](references/workflows.md).
- Build **`curl`** skeletons for `store-distribution` given mined hashes.
- Explain why **`baseToken`** in storage payloads differs from **`empireAddress`**.

---

## Error handling

| HTTP | Meaning |
|------|--------|
| `400` | Bad parameters |
| `401` | API key / signature invalid |
| `403` | Forbidden |
| `404` | Not found |
| `429` | Rate limited |
| `500` | Server error — retry with backoff |

---

## Detail sections — open references next

- **Routes & payloads:** [`references/http-api.md`](references/http-api.md)
- **Step-by-step flows:** [`references/workflows.md`](references/workflows.md)
- **On-chain primitives:** [`references/contracts.md`](references/contracts.md)
