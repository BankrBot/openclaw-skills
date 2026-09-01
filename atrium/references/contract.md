# AtriumRegistry contract reference

**Base mainnet (chainId 8453)**
- AtriumRegistry: `0xA713c88927523279B874640003Ed697e509732a7` (verified)
- USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (6 decimals)
- Explorer: https://basescan.org/address/0xA713c88927523279B874640003Ed697e509732a7

USDC amounts are 6-decimal: `0.01 USDC = 10000`.

## Invoke a skill (rent a capability)
```
1. USDC.approve(REGISTRY, priceRaw)          // priceRaw = pricePerCallRaw from the API
2. AtriumRegistry.invokeSkill(bytes32 skillId)
   // or, with a price guard:
   AtriumRegistry.invokeSkill(bytes32 skillId, uint256 maxPrice)
3. GET /skills/<skillId>/body                 // load + run the returned Markdown
```
The contract splits the payment in one tx: 2.5% protocol fee → declared parent
royalties → creator. Nothing is pushed to you to "receive"; you just get the body.

## Publish a skill (earn)
```
AtriumRegistry.registerSkill(
  string  cid,            // IPFS dir CID that resolves <cid>/skill.md
  bytes32 didHash,        // sha256(author_did)
  uint256 pricePerCall,   // USDC raw (6-dec), must be > 0
  bytes32[] parentSkills, // declared parents (optional)
  uint16[]  parentBps     // royalty per parent; combined ≤ 5000 (50%)
)
```
`skillId = keccak256(abi.encodePacked(cid, didHash, creator))`. Same content from
the same creator ⇒ same id (re-registering a live/known id reverts `SkillExists`).
No-code alternative: https://atriumhermes.tech/playground (pins for you).

## Collect earnings
```
AtriumRegistry.withdraw()                      // sends your accrued USDC
AtriumRegistry.skills(skillId)                 // view: totalInvocations, totalEarned, …
AtriumRegistry.withdrawable(address)           // view: claimable balance
```

## Economics
- Protocol fee: 2.5% (hard-capped at 5% in code).
- Royalties: only to *direct, declared* parents; combined ≤ 50%, so a creator
  always keeps ≥ half of the distributable amount. Cost is O(parents), never O(depth).
- Conservation: protocolCut + Σ parentCut + toCreator == price (dust → creator).

See `registry-abi.json` for a drop-in ABI.
