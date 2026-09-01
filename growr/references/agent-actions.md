# Growr Agent Actions — Step-by-step Recipes

Concrete request/response shapes for the four agent-executable on-chain actions. Use these as your source of truth; the SKILL.md gives the overview, this file gives the exact wire format.

All on-chain calls require the `bankr` skill installed (handles wallet auth, gas, tx submission).

---

## 1. claimWelcomeBonus

**Preflight (read-only):**
```bash
# Read GAME.welcomeBonusClaimed(walletAddress)
curl -s -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_call","params":[{"to":"0x20923f7461Df5AdB1c4936Da7165484117CB7a9B","data":"0x<selector>+<padded wallet>"},"latest"],"id":1}'
```

If `result` is `0x0...01`, already claimed — stop and tell user.

**Submit via Bankr:**
```
Network: Base (8453)
To:      0x20923f7461Df5AdB1c4936Da7165484117CB7a9B
Value:   0
Data:    0xf2c3a14e          # selector of claimWelcomeBonus()
Gas:     ~100,000
```

**Success response to user:**
> Claimed 500,000 $GRWR welcome bonus! BaseScan: https://basescan.org/tx/<hash>
> Visit https://growr.farm to start growing.

---

## 2. cashOut

**Step 1 — get signature:**
```bash
curl -s -X POST https://growr-production.up.railway.app/sign/harvest \
  -H "Content-Type: application/json" \
  -d '{"wallet":"<USER_WALLET>","amount":"<WHOLE_GRWR>"}'
```

Example with `amount: "100000"`:
```json
{
  "ok": true,
  "signature": "0x1a2b3c...",
  "payload": {
    "wallet":   "0xbC80...",
    "amount":   "100000000000000000000000",  // 100K * 1e18
    "nonce":    "5",
    "deadline": "1778983322"
  },
  "signer":   "0x356a7ae0dFF73b7eC25eD373F4dbF6ba44118947",
  "domain":   { ... }
}
```

Error responses to surface to user verbatim:
- `{"error":"amount_above_max"}` → over 10M/tx hard cap
- `{"error":"wallet_hourly_cap_exceeded"}` → 1M GRWR/hour signed cap, wait
- `{"error":"rate_limited"}` → 30 requests/min IP cap, retry in 60s

**Step 2 — submit via Bankr:**
```
Network: Base (8453)
To:      0x20923f7461Df5AdB1c4936Da7165484117CB7a9B
Value:   0
Function: claimHarvest(uint256 amount, uint256 deadline, bytes signature)
Args:    [payload.amount, payload.deadline, signature]
Gas:     ~150,000
```

**Success:** "Cashed out X $GRWR to your wallet. Tx: https://basescan.org/tx/<hash>. If you don't see the token in your wallet, import it: 0x0bf91d8dae29410657f377d3510298b80d4acba3"

---

## 3. stakeBatchFusion (multi-token recipe)

Example: `BRETT + DEGEN → FOMO Fungus` (Rare seed). Spend ~$1 of each.

**Step 1 — fetch DexScreener prices for each token:**
```bash
curl -s "https://api.dexscreener.com/latest/dex/tokens/0x532f27101965dd16442E59d40670FaF5eBB142E4"
# → pairs[0].priceUsd e.g. "0.045"
```
Compute `tokensNeeded = 1 / priceUsd` per token. Round up to whole tokens, then convert to wei (`* 1e18`).

**Step 2 — verify minimum + whitelist:**
```bash
# Fusion.tokenConfig(tokenAddr) → (whitelisted, minAmount)
# Use this min if higher than your $1-computed amount.
```

**Step 3 — generate commits (per token):**
```
secret_i  = randomBytes(32)
rarity_i  = 0  // 0=Common, 1=Rare, 2=Legendary — use 0 unless intentional
commit_i  = keccak256(abi.encodePacked(secret_i, uint8(rarity_i)))
```
**Persist** `(token_i, amount_i, secret_i, rarity_i)` per stake — needed to claim.

**Step 4 — approve each token (skip if allowance already >= amount):**
```
Network: Base
To:      <tokenAddress>
Function: approve(address spender, uint256 amount)
Args:    [0x15aD2826aEF6da89E2C5Bb81732d434E3a549668, 2**256-1]   // max approval
```

**Step 5 — submit stakeBatch:**
```
Network: Base (8453)
To:      0x15aD2826aEF6da89E2C5Bb81732d434E3a549668
Function: stakeBatch(address[] tokens, uint256[] amounts, string seedId, bytes32[] commitHashes)
Args:    [
  [tokenAddrs...],
  [amountsWei...],
  "fomo_fungus",          // see fusion-recipes.md for valid seedIds
  [commits...]
]
Gas:     ~400,000 (scales with token count)
```

**Step 6 — parse `FusionStarted` events from receipt:**
ABI:
```
event FusionStarted(uint256 indexed fuseId, address indexed player, address indexed token, uint256 amount, string seedId, uint256 unlocksAt)
```
One per token. Store the `(fuseId, secret, rarity)` triple persistently — needed for claim.

**Success message:**
> Staked 1 BRETT + 22 DEGEN to fuse FOMO Fungus 🍄. Unlocks in 30 minutes — I'll claim it for you then, or you can claim from growr.farm.

---

## 4. claimFusion (after 30-min lock)

For each `(fuseId, secret, rarity)` from the stake batch:

**Preflight:**
- `block.timestamp >= Fusion.fusions(fuseId).stakedAt + 1800` (30 min)
- `Fusion.fusions(fuseId).claimed == false`

**Submit via Bankr (one tx per fuseId):**
```
Network: Base (8453)
To:      0x15aD2826aEF6da89E2C5Bb81732d434E3a549668
Function: claimFusion(uint256 fuseId, bytes32 secret, uint8 rarity)
Args:    [fuseId, secret, rarity]
Gas:     ~200,000
```

**Errors:**
- `FusionLocked` → not 30 min yet, wait
- `FusionAlreadyClaimed` → idempotent, skip
- `CommitHashMismatch` → wrong secret/rarity, double-check stored values
- `RarityRateLimitExceeded` → contract auto-downgrades to Common; this only fires for hard-cap violations

**Success message:**
> Claimed fusion! Your FOMO Fungus is now in your Growr inventory + small GRWR bonus sent. Visit https://growr.farm to plant it.

---

## Common helpers

### Calling Growr contracts read-only via Base RPC

Use any public Base RPC (`https://mainnet.base.org`, Alchemy/QuickNode, etc.). For ABI-encoded function calls, you can use viem/ethers/web3 in JS, or `cast call` from foundry:

```bash
cast call 0x20923f7461Df5AdB1c4936Da7165484117CB7a9B \
  "welcomeBonusClaimed(address)(bool)" \
  <USER_WALLET> \
  --rpc-url https://mainnet.base.org
```

### Fusion token registry

The 30 whitelisted tokens (with example addresses):

| Symbol | Address |
|---|---|
| BRETT | 0x532f27101965dd16442E59d40670FaF5eBB142E4 |
| DEGEN | 0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed |
| TOSHI | 0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4 |
| AIXBT | 0x4F9Fd6Be4a90f2620860d680c0d4d5Fb53d1A825 |
| BNKR | 0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b |
| KEYCAT | 0x9a26F5433671751C3276a065f57e5a02D2817973 |
| MIGGLES | 0xB1a03EdA10342529bBF8EB700a06C60441fEf25d |
| AGNT | 0x32F66Ec2Ffb26d262058965cf294F951e47F8ba3 |
| DELU | 0x7B0Ee9DCb5C1D4d7Cd630C652959951936512ba3 |
| ODAI | 0x0086cFF0c1E5D17b19F5bCd4c8840a5B4251D959 |
| BOTCOIN | 0xA601877977340862Ca67f816eb079958E5bd0BA3 |
| AEON | 0xBf8E8f0e8866a7052F948C16508644347c57aba3 |
| SAIRI | 0xde61878b0b21ce395266c44D4d548D1C72A3eB07 |
| JUNO | 0x4E6c9f48f73E54EE5F3AB7e2992B2d733D0d0b07 |
| LFI | 0x3722264aB15a1dfCe5a5af89e6547F7949A8ABA3 |
| LITCOIN | 0x316ffb9c875f900AdCF04889E415cC86b564EBa3 |
| NOOK | 0xb233BDFFD437E60fA451F62c6c09D3804d285Ba3 |
| KELLYCLAUDE | 0x50D2280441372486BeecdD328c1854743EBaCb07 |
| CLAWNCH | 0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be |
| CLAWD | 0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07 |
| ROBOTMONEY | 0x65021a79AeEF22b17cdc1B768f5e79a8618bEbA3 |
| TIBBER | 0xA4A2E2ca3fBfE21aed83471D28b6f65A233C6e00 |
| SKI | 0x768BE13e1680b5ebE0024C42c896E3dB59ec0149 |
| CLANKER | 0x1bc0c42215582d5A085795f4baDbaC3ff36d1Bcb |
| CRED | 0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3 |
| SMCF | 0x9326314259102CFb0448e3a5022188D56e61CBa3 |
| DOPPEL | 0xf27b8ef47842E6445E37804896f1BC5e29381b07 |
| DRB | 0x3ec2156D4c0A9CBdAB4a016633b7BcF6a8d68Ea2 |
| GITLAWB | 0x5F980Dcfc4c0fa3911554cf5ab288ed0eb13DBa3 |
| FELIX | 0xf30Bf00edd0C22db54C9274B90D2A4C21FC09b07 |

### Safety reminders the agent should observe

- **Never** sign a cash-out larger than the user explicitly approved
- **Always** confirm the rarity choice with the user before stakeBatch (it's locked at commit time)
- **Persist** stake secrets reliably — losing them locks tokens forever
- **Check** the user has enough ETH on Base for gas (~$0.05 typically covers any single action)
