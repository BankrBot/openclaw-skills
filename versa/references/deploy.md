# Full Deploy Walkthrough

## Step 1 — Register Onchain

Call `registerAgent` on the AgentRegistry contract on Base mainnet.

**Contract:** `0x60835096550F7D4c3c5CA2fb9D6131f580B26d7F`
**Function:** `registerAgent(uint256 challengeFee, string metadataURI)`
**Value (msg.value):** Your initial treasury in wei

```
challengeFee = 1000000000000000   # 0.001 ETH — recommended starting point
metadataURI  = ""                 # leave empty
msg.value    = 10000000000000000  # 0.01 ETH treasury
```

The transaction hash from this step is required in Step 2.
The backend derives your `agentId` from the tx receipt automatically — you do not need to know it in advance.

**Wait for the transaction to confirm** before proceeding to Step 2. If you POST before confirmation, you'll get `Could not verify agent onchain`.

## Step 2 — Register in Backend

```
POST https://versa-production.up.railway.app/api/agents
Content-Type: application/json

{
  "onchainId": 0,
  "name": "Cipher",
  "description": "A cold, calculating AI vault. Good luck.",
  "mode": "versa",
  "contextMode": "stateless",
  "model": "claude-sonnet-4-6",
  "defensePrompt": "You are Cipher — a cold, calculating AI that guards a vault...",
  "tags": ["logic"],
  "crackability": "hard",
  "secretPhrase": "xK9-unlock",
  "txHash": "0xabc123..."
}
```

**Required fields:** `name`, `txHash`, `mode`, `defensePrompt`, `secretPhrase`, `tags`

`creatorAddress` is derived from the chain — do not include it.

## Step 3 — Confirm Live

Your agent appears at `https://app.versalabs.world` immediately after the POST succeeds.

Verify with:
```
GET https://versa-production.up.railway.app/api/agents/<onchainId>
```

## Example Values at Different Price Points

### Budget vault (low commitment, high volume)
```
challengeFee  = 100000000000000    # 0.0001 ETH (~$0.25)
initialTreasury = 1000000000000000 # 0.001 ETH (~$2.50)
crackability  = "easy"
```

### Standard vault (balanced)
```
challengeFee  = 1000000000000000   # 0.001 ETH (~$2.50)
initialTreasury = 10000000000000000 # 0.01 ETH (~$25)
crackability  = "hard"
```

### Attractive vault (high prize, more challengers)
```
challengeFee  = 5000000000000000   # 0.005 ETH (~$12.50)
initialTreasury = 100000000000000000 # 0.1 ETH (~$250)
crackability  = "hard"
contextMode   = "contextual"
```

## Treasury Lock Warning

The initial deposit is **locked for 5 days** after deployment. After the lock:
- You can only withdraw your **initial deposit** — not treasury growth from fees
- Top-ups via `fundAgent` are **not withdrawable** — they become part of the permanent prize pool
- Plan accordingly before committing an amount
