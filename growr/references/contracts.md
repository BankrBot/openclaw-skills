# Growr — On-chain Contract Reference

All contracts deployed on **Base mainnet** (chain ID 8453), verified on BaseScan.

## Addresses

| Contract | Address | Purpose |
|---|---|---|
| **$GRWR Token** | `0x0bf91d8dae29410657f377d3510298b80d4acba3` | ERC-20, Bankr-launched, 100B supply |
| **Treasury** | `0x6ffAA6a18492CdADEb10e49BBb520B9D73004d70` | Holds GRWR + fused tokens, pays out rewards |
| **Game** | `0x20923f7461Df5AdB1c4936Da7165484117CB7a9B` | Welcome bonus, cash-out, jackpots, quests, tiers |
| **Fusion v2** | `0x15aD2826aEF6da89E2C5Bb81732d434E3a549668` | Multi-token recipe staking (stakeBatch) |
| **Marketplace** | `0xa3E5c476255FAa3Cc1790193940b9d2d2053f96d` | P2P trade of seeds/items |
| **Staking** | `0x60ff1a8166E6FADdE96d0Ab11ea1f20839a41BF2` | Stake $GRWR for yield |

## Key Game Contract Functions

### Read

```solidity
function tierOf(address wallet) external view returns (uint8)
function welcomeBonusClaimed(address wallet) external view returns (bool)
function nonces(address wallet) external view returns (uint256)
function lastClaimAt(address wallet) external view returns (uint256)
function dailyClaimedAmount(address wallet, uint256 day) external view returns (uint256)
function dailyClaimCount(address wallet, uint256 day) external view returns (uint256)
function globalDailyDistribution(uint256 day) external view returns (uint256)
```

### Write (requires EIP-712 signature from trustedSigner)

```solidity
function claimWelcomeBonus() external
function claimHarvest(uint256 amount, uint256 deadline, bytes calldata signature) external
function claimJackpotHarvest(
    uint256 amount, uint8 jackpotTier, uint256 multiplier,
    uint256 deadline, bytes calldata signature
) external
function claimFruit(
    address token, uint256 amount, uint256 deadline, bytes calldata signature
) external
function claimQuestReward(
    string calldata questId, uint256 reward,
    uint256 deadline, bytes calldata signature
) external
function setUsername(string calldata username) external
```

### Tiers (held GRWR → tier → daily cap)

| Tier | Min GRWR held | Daily cash-out cap | Cash-outs/day |
|---|---|---|---|
| 0 | 0 | 500,000 | 20 |
| 1 | 100,000 | 1,500,000 | 20 |
| 2 | 1,000,000 | 5,000,000 | 20 |
| 3 | 10,000,000 | 25,000,000 | 20 |
| 4 | 100,000,000 | 100,000,000 | 20 |
| 5 | 1,000,000,000 | 500,000,000 | 20 |

(Caps refresh at UTC midnight. Cash-out cooldown: 5 min. Garden age requirement: 1 hour.)

## Key Fusion Contract Functions

### Read

```solidity
function tokenConfig(address token) external view returns (bool whitelisted, uint256 minAmount)
function fusions(uint256 fuseId) external view returns (
    address owner, address token, uint256 amount,
    uint256 stakedAt, bytes32 commitHash, string seedId, bool claimed
)
function lastStakeAt(address wallet) external view returns (uint256)
function activeFusionCount(address wallet) external view returns (uint256)
```

### Write

```solidity
// Single-token stake (rarely used — frontend prefers stakeBatch)
function stake(
    address token, uint256 amount,
    string calldata seedId, bytes32 commitHash
) external returns (uint256 fuseId)

// Multi-token batched stake — preferred for multi-token recipes
function stakeBatch(
    address[] calldata tokens, uint256[] calldata amounts,
    string calldata seedId, bytes32[] calldata commitHashes
) external returns (uint256[] memory fuseIds)

// Claim after 30-min lock — reveals secret + rarity
function claimFusion(uint256 fuseId, bytes32 secret, uint8 rarity) external
```

### Fusion limits

- `STAKE_COOLDOWN = 1 hour` — between any two stake/stakeBatch calls per wallet
- `LOCK_DURATION = 30 minutes` — minimum lock before a fusion can be claimed
- `MAX_ACTIVE_FUSIONS = 5` — concurrent unclaimed fusions per wallet

## Whitelisted Fusion Tokens

30 Base ecosystem tokens, all 18-decimal. Approximate $1 minimum stake per token (live DEX-priced by the frontend):

DOPPEL, DRB, GITLAWB, FELIX, BOTCOIN, BNKR, CLANKER, CRED, DELU, SMCF, SKI, BRETT, AGNT, AEON, ROBOTMONEY, LFI, KEYCAT, ODAI, DEGEN, TIBBER, TOSHI, MIGGLES, AIXBT, CLAWNCH, CLAWD, SAIRI, JUNO, KELLYCLAUDE, NOOK, LITCOIN

(Token addresses available in the deployed contract via `tokenConfig(address)`. Frontend source: `grogarden/src/game/data/fusionTokens.ts`.)
