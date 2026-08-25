---
name: wolf-airdrop-claim
description: Claim from The White Wolf (WOLF) Bankr Club Top-500 airdrop on Base. Each eligible wallet can claim 6,000,000 WOLF once with a Merkle proof. Use when a user asks to claim WOLF, check WOLF airdrop eligibility or claim status, or mentions the WOLF Top-500 Bankr Club distribution.
---

# WOLF airdrop claim

Claim an equal share from the verified WOLF `BankrAirdrop` on Base. The Merkle leaf binds to `msg.sender`, so the eligible wallet must submit its own claim. Never request or handle the user's private key.

## Constants

| Field | Value |
|---|---|
| Chain | `base` (chain ID `8453`) |
| Airdrop | `0xA9C8829c74618b8B245AD8140658A75Aa19043de` |
| WOLF token | `0x73AC2806C40AB4741ea7a35B7328ACA957755ba3` |
| Merkle root | `0x98e14446c511330a5ba7dfefc8159dc2e29ed0682e8e2d5dc1464166752760b3` |
| Share | `6000000000000000000000000` raw units = 6,000,000 WOLF |
| Total claimers | `500` |
| Total distribution | `3000000000000000000000000000` raw units = 3,000,000,000 WOLF |
| Deadline | Unix `1795397419` = `2026-11-23T01:30:19Z` |
| Owner | `0x71a3A6dEF933Faed976BCB8eF39854f02fD69A0f` |
| Proofs | `https://gist.githubusercontent.com/0xdeployer/c7b78c9b3d311685f8987127808b3615/raw/f5ba3d7eb9c00cf5c1840218ab72349a933635ce/wolf-proofs.json` |
| Proof SHA-256 | `2156b1d4a9eeea61c571cbaf459ee579a2c429b33be305b3e048a057068d8006` |

## Claim workflow

### 1. Read and validate on-chain state

Use `read_contract` on Base before fetching or submitting a proof. Read:

- Airdrop `token() view returns (address)`; require the WOLF token above.
- Airdrop `merkleRoot() view returns (bytes32)`; require the root above.
- Airdrop `share() view returns (uint256)`; require the share above.
- Airdrop `totalClaimers() view returns (uint256)`; require `500`.
- Airdrop `claimDeadline() view returns (uint64)`; require `1795397419` and ensure it has not passed.
- Airdrop `hasClaimed(address) view returns (bool)` for the connected wallet; stop if `true`.
- Airdrop `claimedCount() view returns (uint256)`.
- WOLF `balanceOf(address) view returns (uint256)` for the airdrop address; require it to be at least `(500 - claimedCount) * 6000000000000000000000000`.

If the WOLF balance is below the outstanding liability, tell the user the airdrop is not fully funded or is awaiting reconciliation. Do not call `claim` and do not retry blindly. A surplus does not block claims; anyone can transfer extra WOLF to the distributor. Before the first claim, the minimum required balance is `3000000000000000000000000000` raw WOLF.

### 2. Fetch the connected wallet's proof

Use `execute_cli` with the connected wallet address. The script must validate the exact downloaded bytes, embedded campaign constants, and case-insensitive wallet lookup:

```
execute_cli(
  files='{"getProof.ts":"import { createHash } from \"node:crypto\";\nconst url = \"https://gist.githubusercontent.com/0xdeployer/c7b78c9b3d311685f8987127808b3615/raw/f5ba3d7eb9c00cf5c1840218ab72349a933635ce/wolf-proofs.json\";\nconst expectedSha = \"2156b1d4a9eeea61c571cbaf459ee579a2c429b33be305b3e048a057068d8006\";\nconst expectedRoot = \"0x98e14446c511330a5ba7dfefc8159dc2e29ed0682e8e2d5dc1464166752760b3\";\nconst expectedShare = \"6000000000000000000000000\";\nconst target = (process.argv[2] ?? \"\").trim().toLowerCase();\nif (!/^0x[a-f0-9]{40}$/.test(target)) { console.error(\"usage: bun getProof.ts <0x...wallet>\"); process.exit(2); }\nconst response = await fetch(url);\nif (!response.ok) { console.error(`proof download failed: HTTP ${response.status}`); process.exit(3); }\nconst bytes = new Uint8Array(await response.arrayBuffer());\nconst actualSha = createHash(\"sha256\").update(bytes).digest(\"hex\");\nif (actualSha !== expectedSha) { console.error(\"proof file hash mismatch — refusing to proceed\"); process.exit(4); }\nconst data = JSON.parse(new TextDecoder().decode(bytes));\nif (String(data.merkleRoot).toLowerCase() !== expectedRoot || String(data.share) !== expectedShare || data.totalClaimers !== 500) { console.error(\"proof campaign constants mismatch — refusing to proceed\"); process.exit(5); }\nconst entry = Object.entries(data.proofs).find(([address]) => address.toLowerCase() === target);\nif (!entry) { console.error(`NOT_ELIGIBLE: ${target} is not in the WOLF airdrop list`); process.exit(1); }\nconsole.log(JSON.stringify(entry[1]));\n"}',
  commands=["bun getProof.ts <CONNECTED_WALLET>"]
)
```

An exit with `NOT_ELIGIBLE` is final for that wallet. Do not call `write_contract`. A successful run prints one JSON-encoded `bytes32[]` containing 8 or 9 hashes.

### 3. Submit the claim

Call `write_contract` only after every preflight above passes:

```
write_contract(
  to="0xA9C8829c74618b8B245AD8140658A75Aa19043de",
  functionSignature="claim(bytes32[] proof)",
  args=['<JSON proof array printed by getProof.ts>'],
  value="0",
  chain="base"
)
```

Pass the complete JSON proof array as the single string in `args`. Do not add a recipient argument; the contract verifies `msg.sender`.

### 4. Verify the result

After a successful transaction:

1. Read `hasClaimed(address) view returns (bool)` for the connected wallet and require `true`.
2. Read WOLF `balanceOf(address) view returns (uint256)` for the connected wallet.
3. Report the transaction hash and current WOLF balance.

## Revert handling

| Error | Selector | Response |
|---|---|---|
| `InvalidProof()` | `0x09bde339` | The connected wallet or proof is not eligible. Stop. |
| `AlreadyClaimed()` | `0x646cf558` | The wallet already claimed. Read `hasClaimed` and stop. |
| `ClaimWindowClosed()` | `0xf0f25a33` | The deadline has passed. Stop. |
| `InsufficientBalance()` | `0xf4d678b8` | The distributor lacks one full share. Tell the user it is not funded or has insufficient claim liquidity. |

## Owner-only operations

Never call owner functions unless the connected wallet is exactly `0x71a3A6dEF933Faed976BCB8eF39854f02fD69A0f` and the user explicitly requests the operation.

- `sweep(address to)` transfers all remaining WOLF out of the airdrop and is callable at any time.
- `rescueERC20(address token,address to)` recovers a non-WOLF ERC-20 sent accidentally.
- `setToken(address)` is unavailable because WOLF was fixed in the constructor; it will revert with `TokenAlreadySet()`.
