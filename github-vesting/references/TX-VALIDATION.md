# Transaction validation — required before Bankr `/wallet/submit`

`POST /api/agent/lock` returns `transactions[]` from a **third-party hosted API**. Treat every field as untrusted until locally validated against `known-escrow.json` and the user's stated lock intent.

**Never** call `POST https://api.bankr.bot/wallet/submit` until **all** checks below pass. On any failure: **stop**, explain what failed, and do **not** submit.

Read `known-escrow.json` for pinned addresses, chain ID, and allowed selectors.

---

## User intent to pin

Before calling the lock API, record from the user's message:

| Field | Example |
|-------|---------|
| `repo` | `anondevv69/bankr-tmp-skill` |
| `token` | symbol or `0x` address |
| `amount` | human units (`855M`, `3.49M`) |
| `totalPushes` | default `10` if omitted |
| `pushesPerMilestone` | default = `totalPushes` |

After `POST /api/agent/lock`, also pin from the JSON response (structured fields only):

- `amountWei`, `tokenSymbol`, `lockFunction` (`lock` or `lockAllowance`)
- `totalPushes`, `pushesPerMilestone`
- resolved token contract address (from response or your prior resolution)

Compute expected `repoId` = `keccak256(bytes(utf8(repo.trim())))` — same as Solidity `keccak256(abi.encodePacked(repo))`.

---

## Batch rules

| Rule | Requirement |
|------|-------------|
| Count | **1 or 2** transactions only |
| Order | optional `approve` → then `lock` |
| Extra txs | **reject** — no third tx, no hidden steps |
| Steps | only `approve` and/or `lock` in `step` field |

---

## Per-transaction checks (every tx)

| Field | Requirement |
|-------|-------------|
| `chainId` | exactly **8453** (Base mainnet) |
| `value` | exactly **`0x0`** or **`0`** (zero ETH) |
| `to` | valid checksummed address — see step-specific rules |
| `data` | non-empty hex; selector must be allowlisted |

---

## Approve tx (if present)

| Check | Requirement |
|-------|-------------|
| Selector | `0x095ea7b3` (`approve(address,uint256)`) |
| `to` | **token contract** — must equal token address in lock calldata |
| Spender (arg 1) | exactly `known-escrow.json` → `escrowAddress` |
| Amount (arg 2) | **≤ `amountWei`** from lock API response **and** ≤ amount user requested |
| No infinite approve | reject `type(uint256).max` unless user explicitly requested max (they did not) |

---

## Lock tx (required)

| Check | Requirement |
|-------|-------------|
| `to` | exactly `known-escrow.json` → `escrowAddress` |
| Selector | `0xc9c2dca6` (`lock`) **or** `0xf2bc8198` (`lockAllowance`) only |
| Forbidden selectors | reject `lockWithPermit`, `release`, `cancel`, `setOracle`, transfers, or anything else |
| Arg 0 `repoId` | matches `keccak256(bytes(userRepo))` |
| Arg 1 `token` | matches resolved token for this lock |
| Arg 2 `amount` | equals `amountWei` from API response |
| Arg 3 `totalPushes` | matches user intent / API response |
| Arg 4 `pushesPerMilestone` | matches user intent / API response |
| `lockFunction` | streaming tokens → expect `lockAllowance`; standard ERC-20 → expect `lock` |

---

## Bankr submit format

Legacy `/agent/submit` is **removed**. Use:

```http
POST https://api.bankr.bot/wallet/submit
X-API-Key: …
Content-Type: application/json

{
  "transaction": {
    "to": "0x…",
    "chainId": 8453,
    "value": "0",
    "data": "0x…"
  },
  "description": "Proof of Dev: approve TMP for GitEscrow",
  "waitForConfirmation": true
}
```

Set `waitForConfirmation: true` on the **lock** tx (final step). Approve may use `false` unless you need the allowance before lock.

Requires API key with `walletApiEnabled` and **not** `readOnly`. See `bankr/references/sign-submit-api.md` in this repo.

---

## After submit

Only after lock tx confirms:

```http
POST https://api.proofofdev.xyz/api/agent/confirm-lock
```

Body: `{ "repo": "owner/repo", "lockTxHash": "0x…" }` — `repo` must match validated intent; hash from Bankr submit response.
