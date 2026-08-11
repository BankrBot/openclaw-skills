---
name: jb-query
description: |
  Query Juicebox V6 project state directly from the blockchain. Use when: (1) need
  current ruleset, token supply, or terminal balance for a project, (2) checking
  split configurations or payout limits, (3) verifying on-chain state vs expected
  configuration, (4) debugging why a transaction reverted by inspecting current
  state. Covers cast commands and viem/ethers patterns for all JB contracts.
version: 6.0.0
---

# Juicebox V6 Chain Queries

Query on-chain state for Juicebox V6 projects. There is a single contract set — no version detection is ever needed. Core contracts share the same address on every supported chain (CREATE2); take addresses from `references/shared/chain-config.json`.

## Core Addresses (same on all chains)

| Contract | Address |
|----------|---------|
| JBProjects | `0x6017d1fba9dc279bfa0b03fd931c22e242ab3691` |
| JBDirectory | `0x5aff29060e023e6fb87be5596652b33c65af535b` |
| JBController | `0x3fcec3572e84b624477bcff4e2cf1f7deab648f1` |
| JBRulesets | `0x26f2228a4e8b0079ed1c2a3d22f12ff7f83cdfba` |
| JBTokens | `0x1f80d8f057ee36b4c2656d107e4e4558b71ba7d9` |
| JBSplits | `0x28b3d11fcb8d2ad0a143c5b193cd9f2e4d43f4c3` |
| JBMultiTerminal | `0x130f5dd2bd8805443cf41755253d778a75a67f53` |
| JBTerminalStore | `0x7497ae014a60561925b51c0a3b4ade7460b9927c` |
| JBFundAccessLimits | `0xc93360158f187fc8fc8f1062a1b31d06f185dbab` |
| JBPermissions | `0xf92ac1ab5a00033e35a3975739124f61928c36b0` |
| JBPrices | `0xad45e4627f068d1e6b21e5301870d807543a8401` |

ABIs: `references/shared/abis/*.json`.

## Key Constants (`JBConstants`)

| Constant | Value | Meaning |
|----------|-------|---------|
| `NATIVE_TOKEN` | `0x000000000000000000000000000000000000EEEe` | Sentinel for the chain's native token |
| `NATIVE_TOKEN_CURRENCY` | `61166` | `uint32(uint160(NATIVE_TOKEN))` — accounting-context currency for native |
| `FEE_BENEFICIARY_PROJECT_ID` | `1` | Project that receives protocol fees |
| `STANDARD_FEE / MAX_FEE` | `25 / 1000` | 2.5% protocol fee |
| `MAX_RESERVED_PERCENT` | `10_000` | 100% reserved (basis points) |
| `MAX_CASH_OUT_TAX_RATE` | `10_000` | 100% cash-out tax (basis points) |
| `MAX_WEIGHT_CUT_PERCENT` | `1_000_000_000` | 100% weight cut (9 decimals) |
| `SPLITS_TOTAL_PERCENT` | `1_000_000_000` | 100% split (9 decimals) |

**Two currency vocabularies (do not mix):**
- **Accounting-context currency** (`JBAccountingContext.currency`, surplus/limit `currency` params tied to a token): `uint32(uint160(tokenAddress))`. Native = `61166`.
- **Base currency / price-feed IDs** (`JBRulesetMetadata.baseCurrency`, `JBPrices` pairs): `JBCurrencyIds.ETH = 1`, `JBCurrencyIds.USD = 2`.

## Quick Reference — Contract Functions

### JBProjects (ERC-721)

```solidity
count() → uint256                    // Total projects created
ownerOf(projectId) → address         // Project owner (ERC-721)
tokenURI(projectId) → string         // Project metadata URI
```

### JBDirectory

```solidity
controllerOf(projectId) → IERC165              // The project's controller
terminalsOf(projectId) → IJBTerminal[]         // All terminals
primaryTerminalOf(projectId, token) → IJBTerminal  // Primary terminal for a token
isTerminalOf(projectId, terminal) → bool
```

### JBController

```solidity
currentRulesetOf(projectId) → (JBRuleset, JBRulesetMetadata)
upcomingRulesetOf(projectId) → (JBRuleset, JBRulesetMetadata)
getRulesetOf(projectId, rulesetId) → (JBRuleset, JBRulesetMetadata)
latestQueuedRulesetOf(projectId) → (JBRuleset, JBRulesetMetadata, JBApprovalStatus)
allRulesetsOf(projectId, startingId, size) → JBRulesetWithMetadata[]
totalTokenSupplyWithReservedTokensOf(projectId) → uint256
pendingReservedTokenBalanceOf(projectId) → uint256
previewMintOf(projectId, tokenCount, useReservedPercent) → (beneficiaryTokenCount, reservedTokenCount)
```

### JBRulesets (raw rulesets, no metadata decoding)

```solidity
currentOf(projectId) → JBRuleset
upcomingOf(projectId) → JBRuleset
latestQueuedOf(projectId) → (JBRuleset, JBApprovalStatus)
getRulesetOf(projectId, rulesetId) → JBRuleset
latestRulesetIdOf(projectId) → uint256
currentApprovalStatusForLatestRulesetOf(projectId) → JBApprovalStatus
```

Prefer the controller getters — they return decoded `JBRulesetMetadata` alongside the ruleset.

### JBTokens

```solidity
tokenOf(projectId) → IJBToken               // ERC-20 address (0x0 if none deployed)
projectIdOf(token) → uint256                // Reverse lookup
totalBalanceOf(holder, projectId) → uint256 // credits + ERC-20
creditBalanceOf(holder, projectId) → uint256
totalCreditSupplyOf(projectId) → uint256
totalSupplyOf(projectId) → uint256          // credits + ERC-20 total
```

### JBMultiTerminal (IJBTerminal)

```solidity
accountingContextsOf(projectId) → JBAccountingContext[]         // (token, decimals, currency)
accountingContextForTokenOf(projectId, token) → JBAccountingContext
currentSurplusOf(projectId, tokens[], decimals, currency) → uint256
```

### JBTerminalStore

```solidity
balanceOf(terminal, projectId, token) → uint256                 // Raw terminal balance
currentSurplusOf(projectId, terminals[], tokens[], decimals, currency) → uint256
currentTotalSurplusOf(projectId, decimals, currency) → uint256  // Across ALL terminals
currentReclaimableSurplusOf(projectId, cashOutCount, totalSupply, surplus) → uint256
currentReclaimableSurplusOf(projectId, cashOutCount, terminals[], tokens[], decimals, currency) → uint256
currentTotalReclaimableSurplusOf(projectId, cashOutCount, decimals, currency) → uint256
previewCashOutFrom(terminal, holder, projectId, cashOutCount, tokenToReclaim, metadata)
    → (JBRuleset, reclaimAmount, cashOutTaxRate, hookSpecifications)
previewPayFrom(terminal, payer, amount, projectId, beneficiary, metadata)
    → (JBRuleset, tokenCount, hookSpecifications)
usedPayoutLimitOf(terminal, projectId, token, rulesetCycleNumber, currency) → uint256
usedSurplusAllowanceOf(terminal, projectId, token, rulesetId, currency) → uint256
```

Note: the **used** payout limit / surplus allowance live on `JBTerminalStore`, not `JBFundAccessLimits`. Used payout limits are keyed by ruleset **cycle number**; used surplus allowances by ruleset **ID**.

### JBFundAccessLimits (configured limits)

```solidity
payoutLimitOf(projectId, rulesetId, terminal, token, currency) → uint256
payoutLimitsOf(projectId, rulesetId, terminal, token) → JBCurrencyAmount[]
surplusAllowanceOf(projectId, rulesetId, terminal, token, currency) → uint256
surplusAllowancesOf(projectId, rulesetId, terminal, token) → JBCurrencyAmount[]
```

An empty payout-limit configuration means **zero payouts** — funds are only reachable through cash-outs or surplus allowance.

### JBSplits

```solidity
splitsOf(projectId, rulesetId, groupId) → JBSplit[]
FALLBACK_RULESET_ID() → uint256   // 0 — splits set here apply when the ruleset has none
```

`JBSplit` fields (ABI order): `percent uint32` (of `SPLITS_TOTAL_PERCENT` = 1e9), `projectId uint64`, `beneficiary address`, `preferAddToBalance bool`, `lockedUntil uint48`, `hook address`.

Split group IDs:
- Reserved tokens: `1` (`JBSplitGroupIds.RESERVED_TOKENS`)
- Payouts of a token: `uint256(uint160(tokenAddress))` (native → `uint256(uint160(0x…EEEe))`)

### JBPermissions

```solidity
hasPermission(operator, account, projectId, permissionId, includeRoot, includeWildcardProjectId) → bool
hasPermissions(operator, account, projectId, permissionIds[], includeRoot, includeWildcardProjectId) → bool
permissionsOf(operator, account, projectId) → uint256   // packed bitmap
```

### JBPrices

```solidity
pricePerUnitOf(projectId, pricingCurrency, unitCurrency, decimals) → uint256
```

Use `JBCurrencyIds` (ETH=1, USD=2) for the currency args, and projectId `0` for the protocol-wide default feeds.

## Ruleset Struct Fields

`JBRuleset` (as returned):

| Field | Type |
|-------|------|
| `cycleNumber` | `uint48` |
| `id` | `uint48` |
| `basedOnId` | `uint48` |
| `start` | `uint48` |
| `duration` | `uint32` |
| `weight` | `uint112` |
| `weightCutPercent` | `uint32` |
| `approvalHook` | `address` |
| `metadata` | `uint256` (packed) |

`JBRulesetMetadata` (decoded by controller getters):

| Field | Type |
|-------|------|
| `reservedPercent` | `uint16` |
| `cashOutTaxRate` | `uint16` |
| `baseCurrency` | `uint32` |
| `pausePay` | `bool` |
| `pauseCreditTransfers` | `bool` |
| `allowOwnerMinting` | `bool` |
| `allowSetCustomToken` | `bool` |
| `allowTerminalMigration` | `bool` |
| `allowSetTerminals` | `bool` |
| `allowSetController` | `bool` |
| `allowAddAccountingContext` | `bool` |
| `allowAddPriceFeed` | `bool` |
| `ownerMustSendPayouts` | `bool` |
| `holdFees` | `bool` |
| `scopeCashOutsToLocalBalances` | `bool` |
| `useDataHookForPay` | `bool` |
| `useDataHookForCashOut` | `bool` |
| `dataHook` | `address` |
| `metadata` | `uint16` |

## Cast Commands (Foundry)

```bash
JB_PROJECTS=0x6017d1fba9dc279bfa0b03fd931c22e242ab3691
JB_DIRECTORY=0x5aff29060e023e6fb87be5596652b33c65af535b
JB_CONTROLLER=0x3fcec3572e84b624477bcff4e2cf1f7deab648f1
JB_TOKENS=0x1f80d8f057ee36b4c2656d107e4e4558b71ba7d9
JB_SPLITS=0x28b3d11fcb8d2ad0a143c5b193cd9f2e4d43f4c3
JB_TERMINAL=0x130f5dd2bd8805443cf41755253d778a75a67f53
JB_TERMINAL_STORE=0x7497ae014a60561925b51c0a3b4ade7460b9927c
NATIVE_TOKEN=0x000000000000000000000000000000000000EEEe
NATIVE_CURRENCY=61166
```

### Project owner

```bash
cast call $JB_PROJECTS "ownerOf(uint256)(address)" $PROJECT_ID --rpc-url $RPC_URL
```

### Current ruleset

```bash
cast call $JB_CONTROLLER "currentRulesetOf(uint256)((uint48,uint48,uint48,uint48,uint32,uint112,uint32,address,uint256),(uint16,uint16,uint32,bool,bool,bool,bool,bool,bool,bool,bool,bool,bool,bool,bool,bool,bool,address,uint16))" \
    $PROJECT_ID --rpc-url $RPC_URL
```

### Project token + supply

```bash
cast call $JB_TOKENS "tokenOf(uint256)(address)" $PROJECT_ID --rpc-url $RPC_URL
cast call $JB_CONTROLLER "totalTokenSupplyWithReservedTokensOf(uint256)(uint256)" $PROJECT_ID --rpc-url $RPC_URL
```

### Terminal balance vs surplus

```bash
# Raw balance held by the terminal for a token
cast call $JB_TERMINAL_STORE "balanceOf(address,uint256,address)(uint256)" \
    $JB_TERMINAL $PROJECT_ID $NATIVE_TOKEN --rpc-url $RPC_URL

# Surplus (balance minus remaining payout limits), in native terms
cast call $JB_TERMINAL "currentSurplusOf(uint256,address[],uint256,uint256)(uint256)" \
    $PROJECT_ID "[$NATIVE_TOKEN]" 18 $NATIVE_CURRENCY --rpc-url $RPC_URL
```

### Splits

```bash
# Reserved token splits (group 1)
cast call $JB_SPLITS "splitsOf(uint256,uint256,uint256)((uint32,uint64,address,bool,uint48,address)[])" \
    $PROJECT_ID $RULESET_ID 1 --rpc-url $RPC_URL

# Payout splits — group = uint256(uint160(token))
NATIVE_PAYOUT_GROUP=$(cast to-dec $NATIVE_TOKEN)
cast call $JB_SPLITS "splitsOf(uint256,uint256,uint256)((uint32,uint64,address,bool,uint48,address)[])" \
    $PROJECT_ID $RULESET_ID $NATIVE_PAYOUT_GROUP --rpc-url $RPC_URL

# USDC payout splits (mainnet USDC)
USDC=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
cast call $JB_SPLITS "splitsOf(uint256,uint256,uint256)((uint32,uint64,address,bool,uint48,address)[])" \
    $PROJECT_ID $RULESET_ID $(cast to-dec $USDC) --rpc-url $RPC_URL
```

### Holder balance

```bash
cast call $JB_TOKENS "totalBalanceOf(address,uint256)(uint256)" \
    $HOLDER $PROJECT_ID --rpc-url $RPC_URL
```

### Payout limits (remaining = limit − used)

```bash
JB_FUND_ACCESS=0xc93360158f187fc8fc8f1062a1b31d06f185dbab
cast call $JB_FUND_ACCESS "payoutLimitOf(uint256,uint256,address,address,uint256)(uint256)" \
    $PROJECT_ID $RULESET_ID $JB_TERMINAL $NATIVE_TOKEN $NATIVE_CURRENCY --rpc-url $RPC_URL
cast call $JB_TERMINAL_STORE "usedPayoutLimitOf(address,uint256,address,uint256,uint256)(uint256)" \
    $JB_TERMINAL $PROJECT_ID $NATIVE_TOKEN $RULESET_CYCLE_NUMBER $NATIVE_CURRENCY --rpc-url $RPC_URL
```

### Cash-out quote

```bash
cast call $JB_TERMINAL_STORE \
    "previewCashOutFrom(address,address,uint256,uint256,address,bytes)" \
    $JB_TERMINAL $HOLDER $PROJECT_ID $CASH_OUT_COUNT $NATIVE_TOKEN 0x --rpc-url $RPC_URL
```

## TypeScript (viem)

```typescript
import { createPublicClient, http, parseAbi } from 'viem';
import { mainnet } from 'viem/chains';

const client = createPublicClient({ chain: mainnet, transport: http() });

const JB_CONTROLLER = '0x3fcec3572e84b624477bcff4e2cf1f7deab648f1';
const JB_TOKENS = '0x1f80d8f057ee36b4c2656d107e4e4558b71ba7d9';
const JB_PROJECTS = '0x6017d1fba9dc279bfa0b03fd931c22e242ab3691';

const controllerAbi = parseAbi([
  'struct JBRuleset { uint48 cycleNumber; uint48 id; uint48 basedOnId; uint48 start; uint32 duration; uint112 weight; uint32 weightCutPercent; address approvalHook; uint256 metadata; }',
  'struct JBRulesetMetadata { uint16 reservedPercent; uint16 cashOutTaxRate; uint32 baseCurrency; bool pausePay; bool pauseCreditTransfers; bool allowOwnerMinting; bool allowSetCustomToken; bool allowTerminalMigration; bool allowSetTerminals; bool allowSetController; bool allowAddAccountingContext; bool allowAddPriceFeed; bool ownerMustSendPayouts; bool holdFees; bool scopeCashOutsToLocalBalances; bool useDataHookForPay; bool useDataHookForCashOut; address dataHook; uint16 metadata; }',
  'function currentRulesetOf(uint256 projectId) view returns (JBRuleset ruleset, JBRulesetMetadata metadata)',
]);

async function getProjectInfo(projectId: bigint) {
  const [owner, [ruleset, metadata], token] = await Promise.all([
    client.readContract({
      address: JB_PROJECTS,
      abi: parseAbi(['function ownerOf(uint256) view returns (address)']),
      functionName: 'ownerOf',
      args: [projectId],
    }),
    client.readContract({
      address: JB_CONTROLLER,
      abi: controllerAbi,
      functionName: 'currentRulesetOf',
      args: [projectId],
    }),
    client.readContract({
      address: JB_TOKENS,
      abi: parseAbi(['function tokenOf(uint256) view returns (address)']),
      functionName: 'tokenOf',
      args: [projectId],
    }),
  ]);

  return {
    owner,
    ruleset: { cycleNumber: ruleset.cycleNumber, weight: ruleset.weight, duration: ruleset.duration },
    metadata: {
      reservedPercent: metadata.reservedPercent,
      cashOutTaxRate: metadata.cashOutTaxRate,
      baseCurrency: metadata.baseCurrency,
      dataHook: metadata.dataHook,
    },
    token, // 0x0 = no ERC-20 deployed; holders have credits only
  };
}
```

## Common Query Recipes

### "What's the current state of project X?"

1. Owner: `JBProjects.ownerOf(projectId)`
2. Ruleset + metadata: `JBController.currentRulesetOf(projectId)`
3. Token: `JBTokens.tokenOf(projectId)`
4. Terminals: `JBDirectory.terminalsOf(projectId)`
5. Accounting contexts: `terminal.accountingContextsOf(projectId)` — gives (token, decimals, currency) per accepted token
6. Balance/surplus: `JBTerminalStore.balanceOf(terminal, projectId, token)` / `terminal.currentSurplusOf(...)`

### "Who are the split recipients?"

1. Ruleset ID from `currentRulesetOf` (the `ruleset.id` field)
2. Reserved splits: `JBSplits.splitsOf(projectId, rulesetId, 1)`
3. Payout splits: `JBSplits.splitsOf(projectId, rulesetId, uint256(uint160(token)))`
4. If a group is empty, also check `splitsOf(projectId, 0, groupId)` — the fallback ruleset ID

### "How much can be paid out?"

1. Limit: `JBFundAccessLimits.payoutLimitOf(projectId, rulesetId, terminal, token, currency)`
2. Used: `JBTerminalStore.usedPayoutLimitOf(terminal, projectId, token, rulesetCycleNumber, currency)`
3. Remaining = limit − used (also capped by the terminal's actual balance)

### "What hooks are configured?"

1. `currentRulesetOf` → metadata
2. Check `useDataHookForPay` / `useDataHookForCashOut` and `dataHook`
3. Buyback and 721 hooks surface as the ruleset `dataHook`

### "How much would a cash-out return?"

`JBTerminalStore.previewCashOutFrom(terminal, holder, projectId, cashOutCount, tokenToReclaim, metadata)` — returns the reclaim amount after the cash-out tax curve. A 2.5% protocol fee applies on top whenever `cashOutTaxRate != 0`.

## Network RPC URLs

| Network | Chain ID | RPC URL |
|---------|----------|---------|
| Ethereum | 1 | `https://eth.llamarpc.com` |
| Optimism | 10 | `https://mainnet.optimism.io` |
| Base | 8453 | `https://mainnet.base.org` |
| Arbitrum | 42161 | `https://arb1.arbitrum.io/rpc` |
| Sepolia | 11155111 | `https://ethereum-sepolia-rpc.publicnode.com` |
| Optimism Sepolia | 11155420 | `https://sepolia.optimism.io` |
| Base Sepolia | 84532 | `https://sepolia.base.org` |

## Common mistakes

- **Mixing currency vocabularies.** Surplus/limit `currency` params that pair with a token use `uint32(uint160(token))` (native = `61166`); `JBRulesetMetadata.baseCurrency` and `JBPrices` pairs use `JBCurrencyIds` (ETH=1, USD=2). Passing `1` where `61166` is expected returns 0 or reverts on a missing price feed.
- **Assuming 18 decimals.** A USDC-accounted project's amounts are 6-decimal. Read `accountingContextsOf(projectId)` for `(token, decimals, currency)` before formatting or constructing amounts.
- **Looking for `usedPayoutLimitOf` on JBFundAccessLimits.** Configured limits live on `JBFundAccessLimits`; used amounts live on `JBTerminalStore` — and used payout limits key on `rulesetCycleNumber`, used surplus allowances on `rulesetId`.
- **Wrong split group for payouts.** Payout split groups are `uint256(uint160(token))`, not `0` — group `1` is reserved tokens only.
- **Treating `tokenOf == address(0)` as an error.** It means no ERC-20 has been deployed; holders hold credits (`creditBalanceOf`). `totalBalanceOf` covers both.
- **Reading surplus when you want balance.** `currentSurplusOf` subtracts remaining payout limits and can be 0 on a funded project; `JBTerminalStore.balanceOf` is the raw held amount.
- **Empty fund access limits = zero payouts**, not unlimited. `sendPayoutsOf` also auto-caps at the available balance.
