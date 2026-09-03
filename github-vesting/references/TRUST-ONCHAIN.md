# On-chain trust — GitEscrow (Proof of Dev)

Third-party skill installers should understand what they are approving before locking tokens.

Pinned values live in `known-escrow.json`. Verify on-chain before first use.

---

## GitEscrow contract (Base)

| Field | Value |
|-------|-------|
| Address | `0x76dd4C6ea986684CDf822eC0832e142A2D5C8165` |
| Chain | Base mainnet (`chainId` **8453**) |
| Explorer | [basescan.org/address/0x76dd…C8165](https://basescan.org/address/0x76dd4C6ea986684CDf822eC0832e142A2D5C8165) |
| Source | [github.com/anondevv69/github-vesting — `contracts/GitEscrow.sol`](https://github.com/anondevv69/github-vesting/blob/main/contracts/GitEscrow.sol) |
| Verification | Source **verified** on BaseScan (exact match) |

Read live `owner()` and `oracle()` on Base — as of deploy they match:

| Role | Address |
|------|---------|
| Owner | `0x252b98b9fA80D3644Ebcea6CceAB6293430e64a0` |
| Oracle | `0x252b98b9fA80D3644Ebcea6CceAB6293430e64a0` |

Owner can call `setOracle(address)` — oracle rotation is a **trust assumption**.

---

## Agent-callable selectors only

| Function | Selector | When used |
|----------|----------|-----------|
| `approve(address,uint256)` on ERC-20 | `0x095ea7b3` | Token contract — spender must be escrow |
| `lock(bytes32,address,uint256,uint256,uint256)` | `0xc9c2dca6` | Standard ERC-20 — tokens move into escrow |
| `lockAllowance(bytes32,address,uint256,uint256,uint256)` | `0xf2bc8198` | Streaming / Bankr tokens — tokens stay in wallet |

**Not used in agent lock flow:** `lockWithPermit`, `release`, `cancel`, `setOracle` — agents must **never** submit these.

Minimal escrow ABI (agent path):

```solidity
function lock(bytes32 repoId, address token, uint256 amount, uint256 totalPushes, uint256 pushesPerMile) external;
function lockAllowance(bytes32 repoId, address token, uint256 amount, uint256 totalPushes, uint256 pushesPerMile) external;
```

---

## Trust model

1. **Escrow custody (standard `lock`)** — tokens leave the wallet and sit in GitEscrow until released or cancelled.
2. **Streaming (`lockAllowance`)** — tokens remain in the wallet; escrow holds an **ERC-20 allowance** and the oracle pulls per milestone via `transferFrom`.
3. **Oracle** — only the oracle address can call `release()`. Push verification is off-chain; the contract trusts the oracle's milestone reports.
4. **Owner** — can rotate oracle; cannot directly steal locked balances, but a malicious oracle could release early if the off-chain verifier fails.
5. **Recipient** — can `cancel()` to reclaim **remaining** locked tokens (standard lock) or stop vesting.

---

## Allowance & revocation risks (streaming locks)

For `lockAllowance` / streaming tokens (e.g. Space):

- You **approve** GitEscrow for the full lock `amount`.
- Until vesting completes or you **cancel**, that allowance lets the escrow pull tokens on each milestone.
- **Revoke risk:** if you `approve(escrow, 0)` or lower allowance below remaining obligation, `release()` may fail and vesting stalls.
- **Cancel:** call `cancel(repoId)` on GitEscrow to end the grant and reclaim remaining balance (per contract rules).
- Check allowance anytime: ERC-20 `allowance(yourWallet, escrowAddress)`.

Always disclose before streaming lock:

> "This lock uses an ERC-20 allowance. GitEscrow can pull tokens from your wallet as milestones are hit until the grant completes or you cancel on-chain."

---

## Off-chain services

| Service | URL | Role |
|---------|-----|------|
| Agent API | `https://api.proofofdev.xyz` | Builds tx calldata, tracks pushes |
| Web UI | `https://www.proofofdev.xyz` | Manual create / link flows |
| GitHub App | `bankr-vesting` | Push webhooks for milestone verification |

The API constructs transactions — that is why `references/TX-VALIDATION.md` is mandatory before submit.
