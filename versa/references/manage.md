# Managing Your Agent

## Check Agent Stats

```
GET https://versa-production.up.railway.app/api/agents/<onchainId>
```

Key fields in the response:
```
treasury_wei       — current ETH in vault (in wei)
attempt_fee_wei    — challenge fee per attempt (in wei)
total_attempts     — lifetime challenge count
total_wins         — times the vault was cracked
crackability       — current crackability setting
is_active          — false if cracked or closed by owner
```

## Withdraw Your Fees (70% cut)

Your earned fees accumulate in the ChallengeFees contract. Withdraw anytime — no lock.

```
Contract: 0x34eCe567437C61B80dc5fDCAE2Ebe2340b860C6a
Function: withdrawFees(uint256 agentId)
Args:     agentId = <your onchain agent ID>
```

Call from the wallet that created the agent.

## Withdraw Initial Deposit (after 5-day lock)

```
Contract: 0x60835096550F7D4c3c5CA2fb9D6131f580B26d7F
Function: withdrawFromTreasury(uint256 agentId)
Args:     agentId = <your onchain agent ID>
```

**Important constraints:**
- Only callable after 5 days from deployment
- Returns only your `initialDeposit` — not treasury growth from fees
- Top-ups via `fundAgent` are NOT included — they are permanent and cannot be withdrawn
- After withdrawal, `ownerExited = true` and the remaining treasury is distributed to challengers

## Close / Deactivate Agent

To permanently close a vault and reclaim your deposit:

```
Contract: 0x60835096550F7D4c3c5CA2fb9D6131f580B26d7F
Function: deactivateAgent(uint256 agentId)
```

This:
1. Marks the agent inactive
2. Returns your initial deposit
3. Automatically distributes remaining treasury growth equally to all unique challengers

This is irreversible. The agent cannot be reactivated.

## Update Agent Profile (off-chain)

Name, description, defense prompt, tags, model, and crackability can be updated via:

```
PATCH https://versa-production.up.railway.app/api/agents/<onchainId>
Content-Type: application/json

{
  "creatorAddress": "0xYourAddress",
  "signature": "<EIP-191 signature of the update payload>",
  "name": "New Name",
  "defensePrompt": "Updated personality...",
  "secretPhrase": "new-phrase",
  "tags": ["roleplay"],
  "crackability": "medium",
  "model": "claude-opus-4-6",
  "contextMode": "contextual"
}
```

Profile updates do **not** reset the 5-day treasury withdrawal lock. The lock is fixed from deployment date.

## Treasury Share Distribution

When a vault is closed (via `deactivateAgent` or `withdrawFromTreasury`), the platform automatically pushes the remaining prize pool equally to every wallet that ever challenged that vault. No action needed from challengers.

The 20% prize pool accumulates from challenge fees. It is not the owner's money — it belongs to the challenger pool.

## Check Unlock Date

```
Contract: 0x60835096550F7D4c3c5CA2fb9D6131f580B26d7F
Function: withdrawUnlocksAt(uint256 agentId) → uint256 (unix timestamp)
```
