---
name: jb-v6-api
description: |
  Juicebox V6 protocol API reference. Use when: (1) looking up function signatures,
  parameters, or return types on JBController/JBMultiTerminal/JBTokens/JBDirectory/etc,
  (2) checking struct field order or types for calldata encoding, (3) finding which
  permission ID gates a function, (4) looking up protocol constants, currency IDs,
  or contract addresses, (5) "what functions exist" questions about core or ecosystem
  contracts (suckers, buyback hook, 721 hook, router terminal, revnets, croptop).
version: 6.0.0
---

# Juicebox V6 API Reference

Function signatures, parameters, return values, structs, permission gating, and constants for the Juicebox V6 protocol: core contracts plus the ecosystem (suckers, buyback hook, 721 hook, router terminal, ownable, omnichain deployer, revnets, croptop).

Addresses come from `references/shared/chain-config.json` (8 chains: Ethereum, Optimism, Base, Arbitrum + their Sepolia testnets). **Core contracts share one address on every chain (CREATE2)** — the tables below list each address once.

## Protocol Architecture

| Repository | Purpose |
|------------|---------|
| **nana-core-v6** | Core infrastructure: projects, rulesets, tokens, terminals, permissions, prices, splits |
| **nana-permission-ids-v6** | Permission ID constants (`JBPermissionIds`) |
| **nana-suckers-v6** | Cross-chain token bridging (native L2 bridges + CCIP) |
| **nana-buyback-hook-v6** | Uniswap V4 token buyback data/pay hook |
| **nana-router-terminal-v6** | Router terminal: accept any token, route through a DEX |
| **nana-721-hook-v6** | Tiered NFT minting on payment |
| **revnet-core-v6** | Autonomous tokenized treasury networks (REVDeployer, REVLoans) |
| **croptop-core-v6** | Public NFT posting (CTPublisher, CTDeployer) |

### Core Contract Addresses (same on all chains)

| Contract | Address | Role |
|----------|---------|------|
| `JBController` | `0x3fcec3572e84b624477bcff4e2cf1f7deab648f1` | Ruleset + token coordination; primary write surface |
| `JBMultiTerminal` | `0x130f5dd2bd8805443cf41755253d778a75a67f53` | Payments, cash outs, payouts, allowances, fees |
| `JBDirectory` | `0x5aff29060e023e6fb87be5596652b33c65af535b` | Terminal ↔ controller mapping per project |
| `JBProjects` | `0x6017d1fba9dc279bfa0b03fd931c22e242ab3691` | ERC-721 project ownership; creation fee |
| `JBRulesets` | `0x26f2228a4e8b0079ed1c2a3d22f12ff7f83cdfba` | Ruleset queue and scheduling |
| `JBTokens` | `0x1f80d8f057ee36b4c2656d107e4e4558b71ba7d9` | Credit + ERC-20 accounting |
| `JBSplits` | `0x28b3d11fcb8d2ad0a143c5b193cd9f2e4d43f4c3` | Split group storage |
| `JBPermissions` | `0xf92ac1ab5a00033e35a3975739124f61928c36b0` | Operator permission delegation |
| `JBPrices` | `0xad45e4627f068d1e6b21e5301870d807543a8401` | Currency price feeds |
| `JBTerminalStore` | `0x7497ae014a60561925b51c0a3b4ade7460b9927c` | Terminal bookkeeping + surplus math |
| `JBFundAccessLimits` | `0xc93360158f187fc8fc8f1062a1b31d06f185dbab` | Payout limits + surplus allowances |
| `JBFeelessAddresses` | `0x657d0e588fca6f8c49394c9ca8a1cf6505b10314` | Fee exemption registry |

Periphery contracts (`JB721TiersHook`, `JB721TiersHookDeployer`, `JBSuckerRegistry`, `JBBuybackHookRegistry`, `JBRouterTerminalRegistry`, `REVDeployer`, `REVLoans`, `CTPublisher`, `JBOmnichainDeployer`, `JBERC20` implementation, approval-hook instances `JBDeadline3Hours`/`1Day`/`3Days`/`7Days`, etc.) are also chain-invariant — read them from `references/shared/chain-config.json`. Chain-specific entries (`JBBuybackHook`, native + CCIP suckers, Chainlink price feeds, per-project token deployments) differ per chain; always resolve those per chain from the same file.

---

## Protocol Constants

`JBConstants` (library):

```solidity
uint256 FEE_BENEFICIARY_PROJECT_ID = 1;          // protocol fees go to project #1
uint16  MAX_CASH_OUT_TAX_RATE      = 10_000;     // 100% tax = holders reclaim nothing
uint16  MAX_FEE                    = 1000;       // fee denominator
uint16  STANDARD_FEE               = 25;         // fee = 25/1000 = 2.5%
uint16  MAX_RESERVED_PERCENT       = 10_000;     // 100% of mints to reserves
uint32  MAX_WEIGHT_CUT_PERCENT     = 1_000_000_000; // 100% cut per cycle
address NATIVE_TOKEN               = 0x000000000000000000000000000000000000EEEe;
uint32  NATIVE_TOKEN_CURRENCY      = uint32(uint160(NATIVE_TOKEN));
uint32  SPLITS_TOTAL_PERCENT       = 1_000_000_000; // split percent denominator
```

`JBCurrencyIds` (library) — used **only** as `baseCurrency` in ruleset metadata and for price-feed lookups in `JBPrices`:

| ID | Currency |
|----|----------|
| 1 | ETH |
| 2 | USD |

Accounting-context currencies are a different namespace: `uint32(uint160(tokenAddress))`. Do not use `1`/`2` as an accounting-context currency, and do not use a token-derived currency as `baseCurrency` unless a price feed exists for it.

`JBSplitGroupIds` (library):

| Group ID | Meaning |
|----------|---------|
| `1` (`RESERVED_TOKENS`) | Reserved token distribution splits |
| `uint256(uint160(token))` | Payout splits for terminal token `token` |

---

## Key Structs (ABI order)

### JBRulesetConfig

| Field | Type | Notes |
|-------|------|-------|
| `mustStartAtOrAfter` | `uint48` | Earliest start timestamp; 0 = as soon as possible |
| `duration` | `uint32` | Seconds per cycle; 0 = lasts until next queued ruleset |
| `weight` | `uint112` | Tokens minted per unit of `baseCurrency` paid (18-decimal fixed point). Pass `1` to inherit the decayed weight from the previous ruleset |
| `weightCutPercent` | `uint32` | Weight decay per cycle, out of `MAX_WEIGHT_CUT_PERCENT` |
| `approvalHook` | `IJBRulesetApprovalHook` | e.g. a `JBDeadline*` instance; `address(0)` = auto-approve |
| `metadata` | `JBRulesetMetadata` | See below |
| `splitGroups` | `JBSplitGroup[]` | Splits active during this ruleset |
| `fundAccessLimitGroups` | `JBFundAccessLimitGroup[]` | Payout limits + surplus allowances. **Empty array = zero payout limit = no payouts** |

### JBRulesetMetadata

| Field | Type | Notes |
|-------|------|-------|
| `reservedPercent` | `uint16` | Out of `MAX_RESERVED_PERCENT` (10,000) |
| `cashOutTaxRate` | `uint16` | Out of `MAX_CASH_OUT_TAX_RATE` (10,000). 0 = full proportional reclaim; 10,000 = no reclaim |
| `baseCurrency` | `uint32` | `JBCurrencyIds` value the weight is denominated in |
| `pausePay` | `bool` | Reverts `pay` while active |
| `pauseCreditTransfers` | `bool` | Blocks `transferCreditsFrom` |
| `allowOwnerMinting` | `bool` | Required for owner/operator `mintTokensOf` (terminals + data hook can always mint) |
| `allowSetCustomToken` | `bool` | Required for `setTokenFor` |
| `allowTerminalMigration` | `bool` | Required for `migrateBalanceOf` |
| `allowSetTerminals` | `bool` | Required for non-controller `setTerminalsOf` |
| `allowSetController` | `bool` | Required to change controller |
| `allowAddAccountingContext` | `bool` | Required for `addAccountingContextsFor` |
| `allowAddPriceFeed` | `bool` | Required for `addPriceFeedFor` |
| `ownerMustSendPayouts` | `bool` | Restricts `sendPayoutsOf` to owner / `SEND_PAYOUTS` operator |
| `holdFees` | `bool` | Hold fees instead of processing immediately |
| `scopeCashOutsToLocalBalances` | `bool` | Cash-out math uses only this terminal's balances instead of project-wide surplus |
| `useDataHookForPay` | `bool` | Call `dataHook` before recording payments |
| `useDataHookForCashOut` | `bool` | Call `dataHook` before recording cash outs |
| `dataHook` | `address` | `IJBRulesetDataHook` implementation |
| `metadata` | `uint16` | Free bits for hook-specific use |

### JBRuleset (returned by reads)

| Field | Type |
|-------|------|
| `cycleNumber` | `uint48` |
| `id` | `uint48` |
| `basedOnId` | `uint48` |
| `start` | `uint48` |
| `duration` | `uint32` |
| `weight` | `uint112` |
| `weightCutPercent` | `uint32` |
| `approvalHook` | `IJBRulesetApprovalHook` |
| `metadata` | `uint256` (packed `JBRulesetMetadata`) |

### JBTerminalConfig

| Field | Type |
|-------|------|
| `terminal` | `IJBTerminal` |
| `accountingContextsToAccept` | `JBAccountingContext[]` |

### JBAccountingContext

| Field | Type | Notes |
|-------|------|-------|
| `token` | `address` | Terminal token, or `NATIVE_TOKEN` |
| `decimals` | `uint8` | The token's decimals (e.g. 6 for USDC, 18 for ETH) |
| `currency` | `uint32` | `uint32(uint160(token))` by convention |

### JBSplitGroup / JBSplit

`JBSplitGroup`: `{ uint256 groupId; JBSplit[] splits; }`

`JBSplit` fields in ABI order:

| Field | Type | Notes |
|-------|------|-------|
| `percent` | `uint32` | Out of `SPLITS_TOTAL_PERCENT` (1,000,000,000) |
| `projectId` | `uint64` | If nonzero, route to this project (`pay` or `addToBalance`) |
| `beneficiary` | `address payable` | Recipient (or token beneficiary when `projectId` set) |
| `preferAddToBalance` | `bool` | Use `addToBalanceOf` instead of `pay` for project splits |
| `lockedUntil` | `uint48` | Split cannot be removed/reduced until this timestamp |
| `hook` | `IJBSplitHook` | If set, funds are sent to the hook's `processSplitWith` |

Split percents need not sum to 100%; the leftover payout amount is sent to the project owner (leftover reserved tokens likewise).

### JBFundAccessLimitGroup / JBCurrencyAmount

`JBFundAccessLimitGroup`: `{ address terminal; address token; JBCurrencyAmount[] payoutLimits; JBCurrencyAmount[] surplusAllowances; }`

`JBCurrencyAmount`: `{ uint224 amount; uint32 currency; }`

### JBPermissionsData

| Field | Type | Notes |
|-------|------|-------|
| `operator` | `address` | Who receives the permissions |
| `projectId` | `uint64` | 0 = wildcard (all projects) |
| `permissionIds` | `uint8[]` | IDs from the table below; replaces the operator's whole set for that (account, projectId) |

### JBTokenAmount (in hook contexts)

`{ address token; uint8 decimals; uint32 currency; uint256 value; }`

### JBFee

`{ uint224 amount; address beneficiary; uint48 unlockTimestamp; }`

---

## JBController

Primary write surface for projects. Address: `0x3fcec3572e84b624477bcff4e2cf1f7deab648f1`.

### Project Lifecycle

```solidity
// Create a project, queue its initial rulesets, set up terminals.
// PAYABLE: msg.value must EXACTLY equal JBProjects.creationFee() or it reverts.
function launchProjectFor(
    address owner,                                    // receives the project ERC-721
    string calldata projectUri,                       // IPFS metadata URI
    JBRulesetConfig[] calldata rulesetConfigurations,
    JBTerminalConfig[] calldata terminalConfigurations,
    string calldata memo
) external payable returns (uint256 projectId);

// Queue the FIRST rulesets for a project that already exists (e.g. created via
// JBProjects.createFor directly). Reverts if the project already has rulesets.
// Gated: LAUNCH_RULESETS + SET_TERMINALS (+ SET_PROJECT_URI if projectUri non-empty).
function launchRulesetsFor(
    uint256 projectId,
    string calldata projectUri,                       // empty string = leave unchanged
    JBRulesetConfig[] calldata rulesetConfigurations,
    JBTerminalConfig[] calldata terminalConfigurations,
    string calldata memo
) external returns (uint256 rulesetId);

// Queue rulesets onto the end of the queue. Gated: QUEUE_RULESETS.
function queueRulesetsOf(
    uint256 projectId,
    JBRulesetConfig[] calldata rulesetConfigurations,
    string calldata memo
) external returns (uint256 rulesetId);
```

### Token Operations

```solidity
// Mint tokens. Gated: MINT_TOKENS, with automatic override for the project's
// terminals and data hook. Owner/operator minting also requires the ruleset's
// allowOwnerMinting flag.
function mintTokensOf(
    uint256 projectId,
    uint256 tokenCount,          // total, including the reserved portion
    address beneficiary,
    string calldata memo,
    bool useReservedPercent
) external returns (uint256 beneficiaryTokenCount);

// Burn tokens or credits. Gated: BURN_TOKENS (holder's permission).
function burnTokensOf(address holder, uint256 projectId, uint256 tokenCount, string calldata memo) external;

// Deploy the project's ERC-20 (ERC-1167 clone of the JBERC20 implementation).
// Gated: DEPLOY_ERC20. salt != 0 => deterministic address.
function deployERC20For(
    uint256 projectId,
    string calldata name,
    string calldata symbol,
    bytes32 salt
) external returns (IJBToken token);

// Convert credits to the project's ERC-20. Gated: CLAIM_TOKENS (holder's permission).
function claimTokensFor(address holder, uint256 projectId, uint256 tokenCount, address beneficiary) external;

// Transfer credits. Gated: TRANSFER_CREDITS (holder's permission).
// Reverts while the ruleset's pauseCreditTransfers is set.
function transferCreditsFrom(address holder, uint256 projectId, address recipient, uint256 creditCount) external;

// Distribute pending reserved tokens to the RESERVED_TOKENS (groupId 1) splits. Permissionless.
function sendReservedTokensToSplitsOf(uint256 projectId) external returns (uint256);
```

### Configuration

```solidity
// Gated: SET_PROJECT_URI.
function setUriOf(uint256 projectId, string calldata uri) external;

// Attach an existing 18-decimal IJBToken. Gated: SET_TOKEN. Ruleset must allow (allowSetCustomToken).
function setTokenFor(uint256 projectId, IJBToken token) external;

// Rename the project's ERC-20. Gated: SET_TOKEN_METADATA.
function setTokenMetadataOf(uint256 projectId, string calldata name, string calldata symbol) external;

// Gated: SET_SPLIT_GROUPS. Locked splits must be preserved.
function setSplitGroupsOf(uint256 projectId, uint256 rulesetId, JBSplitGroup[] calldata splitGroups) external;

// Gated: ADD_PRICE_FEED. Ruleset must allow (allowAddPriceFeed).
function addPriceFeedFor(
    uint256 projectId,
    uint256 pricingCurrency,
    uint256 unitCurrency,
    IJBPriceFeed feed
) external;
```

### View Functions

```solidity
function currentRulesetOf(uint256 projectId) external view
    returns (JBRuleset memory ruleset, JBRulesetMetadata memory metadata);

function upcomingRulesetOf(uint256 projectId) external view
    returns (JBRuleset memory ruleset, JBRulesetMetadata memory metadata);

function latestQueuedRulesetOf(uint256 projectId) external view
    returns (JBRuleset memory ruleset, JBRulesetMetadata memory metadata, JBApprovalStatus approvalStatus);

function getRulesetOf(uint256 projectId, uint256 rulesetId) external view
    returns (JBRuleset memory ruleset, JBRulesetMetadata memory metadata);

function allRulesetsOf(uint256 projectId, uint256 startingId, uint256 size) external view
    returns (JBRulesetWithMetadata[] memory rulesets);

function pendingReservedTokenBalanceOf(uint256 projectId) external view returns (uint256);

function totalTokenSupplyWithReservedTokensOf(uint256 projectId) external view returns (uint256);

// Preview a mintTokensOf split into beneficiary + reserved portions.
function previewMintOf(uint256 projectId, uint256 tokenCount, bool useReservedPercent) external view
    returns (uint256 beneficiaryTokenCount, uint256 reservedTokenCount);

function uriOf(uint256 projectId) external view returns (string memory);

// Immutable references: DIRECTORY(), FUND_ACCESS_LIMITS(), OMNICHAIN_RULESET_OPERATOR(),
// PRICES(), PROJECTS(), RULESETS(), SPLITS(), TOKENS().
```

`OMNICHAIN_RULESET_OPERATOR` is an address that bypasses `QUEUE_RULESETS` / `LAUNCH_RULESETS` / `SET_TERMINALS` / `SET_PROJECT_URI` checks (used for cross-chain ruleset synchronization).

---

## JBProjects

ERC-721 of project ownership. Address: `0x6017d1fba9dc279bfa0b03fd931c22e242ab3691`.

```solidity
// Mint a project NFT. PAYABLE: msg.value must EXACTLY equal creationFee() —
// both underpayment and overpayment revert. The fee is forwarded to creationFeeReceiver.
function createFor(address owner) external payable returns (uint256 projectId);

function creationFee() external view returns (uint256);            // current fee (0 = disabled)
function creationFeeReceiver() external view returns (address payable);
function MAX_CREATION_FEE() external view returns (uint256);       // 0.001 ether cap
function count() external view returns (uint256);                  // latest project ID
function tokenUriResolver() external view returns (IJBTokenUriResolver);

// Owner-of-JBProjects only:
function setCreationFee(uint256 fee, address payable receiver) external;
function setTokenUriResolver(IJBTokenUriResolver resolver) external;
```

`JBController.launchProjectFor` forwards its exact `msg.value` to `createFor`, so the same exact-fee rule applies there.

---

## JBMultiTerminal

Payments, cash outs, payouts, allowances, fee lifecycle. Address: `0x130f5dd2bd8805443cf41755253d778a75a67f53`. Supports Permit2 (`PERMIT2()`).

### Payments

```solidity
// Pay a project. For the native token, pass token = JBConstants.NATIVE_TOKEN;
// the amount argument is IGNORED and msg.value is used instead.
// Reverts while the ruleset's pausePay is set.
function pay(
    uint256 projectId,
    address token,
    uint256 amount,              // in the token accounting context's decimals
    address beneficiary,         // receives minted project tokens
    uint256 minReturnedTokens,   // slippage floor on minted tokens (18 decimals)
    string calldata memo,
    bytes calldata metadata      // forwarded to data hook / pay hooks
) external payable returns (uint256 beneficiaryTokenCount);

// Add funds without minting tokens. If shouldReturnHeldFees, offsets held fees proportionally.
function addToBalanceOf(
    uint256 projectId,
    address token,
    uint256 amount,
    bool shouldReturnHeldFees,
    string calldata memo,
    bytes calldata metadata
) external payable;
```

### Cash Outs

```solidity
// Burn project tokens, reclaim a share of surplus in a terminal token.
// Gated: CASH_OUT_TOKENS (holder's permission).
function cashOutTokensOf(
    address holder,
    uint256 projectId,
    uint256 cashOutCount,        // project tokens to burn (18 decimals)
    address tokenToReclaim,      // terminal token to receive
    uint256 minTokensReclaimed,  // slippage floor, in the terminal token's decimals
    address payable beneficiary,
    bytes calldata metadata
) external returns (uint256 reclaimAmount);
```

### Payouts and Allowances

```solidity
// Send payouts to the token's payout splits, up to the ruleset's payout limit.
// Permissionless unless the ruleset sets ownerMustSendPayouts (then gated: SEND_PAYOUTS).
// amount is denominated in `currency`, NOT necessarily in the token.
function sendPayoutsOf(
    uint256 projectId,
    address token,
    uint256 amount,
    uint256 currency,
    uint256 minTokensPaidOut
) external returns (uint256 amountPaidOut);

// Discretionary withdrawal from surplus, up to the ruleset's surplus allowance.
// Gated: USE_ALLOWANCE. Always incurs the fee (unless feeless).
function useAllowanceOf(
    uint256 projectId,
    address token,
    uint256 amount,
    uint256 currency,
    uint256 minTokensPaidOut,
    address payable beneficiary,
    address payable feeBeneficiary,   // credited with project-1 tokens minted by the fee
    string calldata memo
) external returns (uint256 netAmountPaidOut);
```

### Terminal Management

```solidity
// Register tokens the terminal accepts for a project.
// Gated: ADD_ACCOUNTING_CONTEXTS, with override for the project's controller.
// Ruleset must allow (allowAddAccountingContext).
function addAccountingContextsFor(uint256 projectId, JBAccountingContext[] calldata accountingContexts) external;

// Move a token balance to another terminal. Gated: MIGRATE_TERMINAL.
// Ruleset must allow (allowTerminalMigration).
function migrateBalanceOf(uint256 projectId, address token, IJBTerminal to) external returns (uint256 balance);

// Process up to `count` held fees for (project, token). Permissionless.
function processHeldFeesOf(uint256 projectId, address token, uint256 count) external;
```

### View Functions

```solidity
function accountingContextForTokenOf(uint256 projectId, address token) external view
    returns (JBAccountingContext memory);

function accountingContextsOf(uint256 projectId) external view returns (JBAccountingContext[] memory);

// Surplus of the given tokens, normalized to (decimals, currency).
function currentSurplusOf(uint256 projectId, address[] calldata tokens, uint256 decimals, uint256 currency)
    external view returns (uint256);

// Simulate a payment: resulting ruleset, token counts, and hook specifications.
function previewPayFor(uint256 projectId, address token, uint256 amount, address beneficiary, bytes calldata metadata)
    external view returns (
        JBRuleset memory ruleset,
        uint256 beneficiaryTokenCount,
        uint256 reservedTokenCount,
        JBPayHookSpecification[] memory hookSpecifications
    );

// Simulate a cash out: reclaim amount BEFORE the protocol fee is subtracted.
function previewCashOutFrom(
    address holder,
    uint256 projectId,
    uint256 cashOutCount,
    address tokenToReclaim,
    address payable beneficiary,
    bytes calldata metadata
) external view returns (
    JBRuleset memory ruleset,
    uint256 reclaimAmount,
    uint256 cashOutTaxRate,
    JBCashOutHookSpecification[] memory hookSpecifications
);

function heldFeesOf(uint256 projectId, address token, uint256 count) external view returns (JBFee[] memory);

// Cumulative fee-free intra-terminal payouts not yet consumed by zero-tax cash outs
// (round-trip fee-bypass prevention).
function feeFreeSurplusOf(uint256 projectId, address token) external view returns (uint256);

// Immutable references: DIRECTORY(), FEELESS_ADDRESSES(), PERMIT2(), PROJECTS(),
// SPLITS(), STORE(), TOKENS().
```

---

## JBTokens

Credit (unclaimed) + ERC-20 token accounting. Address: `0x1f80d8f057ee36b4c2656d107e4e4558b71ba7d9`.

**Every write function is `onlyControllerOf(projectId)`** — call through `JBController`, never directly:
`burnFrom`, `claimTokensFor`, `deployERC20For`, `mintFor`, `setTokenFor`, `setTokenMetadataFor`, `transferCreditsFrom`.

### View Functions

```solidity
function tokenOf(uint256 projectId) external view returns (IJBToken);          // address(0) = credits only
function projectIdOf(IJBToken token) external view returns (uint256);
function creditBalanceOf(address holder, uint256 projectId) external view returns (uint256);
function totalCreditSupplyOf(uint256 projectId) external view returns (uint256);
function totalBalanceOf(address holder, uint256 projectId) external view returns (uint256); // credits + ERC-20
function totalSupplyOf(uint256 projectId) external view returns (uint256);                  // credits + ERC-20
```

### IJBToken (custom token interface)

```solidity
interface IJBToken {
    function balanceOf(address account) external view returns (uint256);
    function canBeAddedTo(uint256 projectId) external view returns (bool);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
    function burn(address account, uint256 amount) external;
    function initialize(string memory name, string memory symbol, address tokensAddress) external;
    function mint(address account, uint256 amount) external;
    function setMetadata(string memory name, string memory symbol) external;
}
```

`setTokenFor` requirements (enforced on-chain): non-zero token; project has no token yet; token not attached to another project; `decimals() == 18`; `canBeAddedTo(projectId)` returns true. Warning: any pre-existing external supply counts in `totalSupplyOf` and dilutes cash outs.

---

## JBDirectory

Terminal and controller registry. Address: `0x5aff29060e023e6fb87be5596652b33c65af535b`.

```solidity
// Views
function controllerOf(uint256 projectId) external view returns (IERC165);
function primaryTerminalOf(uint256 projectId, address token) external view returns (IJBTerminal);
function terminalsOf(uint256 projectId) external view returns (IJBTerminal[] memory);
function isTerminalOf(uint256 projectId, IJBTerminal terminal) external view returns (bool);
function isAllowedToSetFirstController(address addr) external view returns (bool);

// Gated: SET_CONTROLLER (override: allowlisted first-controller setters when no controller yet).
// Existing controller's setControllerAllowed(projectId) must permit the change.
function setControllerOf(uint256 projectId, IERC165 controller) external;

// Gated: SET_PRIMARY_TERMINAL. Terminal must accept the token. If the terminal
// isn't in the project's list yet, additionally requires ADD_TERMINALS (implicit add).
function setPrimaryTerminalOf(uint256 projectId, address token, IJBTerminal terminal) external;

// Replaces the whole terminal list. Gated: SET_TERMINALS, with override for the
// project's controller. Non-controller callers need the ruleset's allowSetTerminals.
function setTerminalsOf(uint256 projectId, IJBTerminal[] calldata terminals) external;

// Owner-of-JBDirectory only.
function setIsAllowedToSetFirstController(address addr, bool flag) external;
```

---

## JBRulesets

Ruleset queue storage. Address: `0x26f2228a4e8b0079ed1c2a3d22f12ff7f83cdfba`. `queueFor` is `onlyControllerOf` — queue through `JBController`.

```solidity
function currentOf(uint256 projectId) external view returns (JBRuleset memory);
function upcomingOf(uint256 projectId) external view returns (JBRuleset memory);
function latestQueuedOf(uint256 projectId) external view
    returns (JBRuleset memory ruleset, JBApprovalStatus approvalStatus);
function latestRulesetIdOf(uint256 projectId) external view returns (uint256);
function getRulesetOf(uint256 projectId, uint256 rulesetId) external view returns (JBRuleset memory);
function allOf(uint256 projectId, uint256 startingId, uint256 size) external view
    returns (JBRuleset[] memory);
function currentApprovalStatusForLatestRulesetOf(uint256 projectId) external view returns (JBApprovalStatus);

// Permissionless gas-optimization for long weight-decay chains.
function updateRulesetWeightCache(uint256 projectId, uint256 rulesetId) external;
```

Note: `JBRulesets` views return the packed `uint256 metadata`; use `JBController.currentRulesetOf` / `upcomingRulesetOf` / `getRulesetOf` to get the expanded `JBRulesetMetadata` struct.

### JBApprovalStatus (enum)

| Value | Name | Meaning |
|-------|------|---------|
| 0 | `Empty` | No ruleset exists |
| 1 | `Upcoming` | Queued, not yet eligible for approval check |
| 2 | `Active` | Currently governing |
| 3 | `ApprovalExpected` | Provisionally approved, still replaceable |
| 4 | `Approved` | Final for its scheduled cycle |
| 5 | `Failed` | Rejected; previous ruleset continues |

---

## JBSplits

Split storage. Address: `0x28b3d11fcb8d2ad0a143c5b193cd9f2e4d43f4c3`. `setSplitGroupsOf` is controller-only — set splits through `JBController.setSplitGroupsOf`.

```solidity
function splitsOf(uint256 projectId, uint256 rulesetId, uint256 groupId) external view
    returns (JBSplit[] memory);
function FALLBACK_RULESET_ID() external view returns (uint256);  // = 0
```

Splits set with `rulesetId = 0` act as the fallback for any ruleset without its own splits.

---

## JBPrices

Price feed registry. Address: `0xad45e4627f068d1e6b21e5301870d807543a8401`.

```solidity
// Price of one `unitCurrency` denominated in `pricingCurrency`, as a fixed point
// number with `decimals` decimals. Project-specific feeds take priority; falls
// back to project 0 (DEFAULT_PROJECT_ID) shared default feeds; reverts if none found.
function pricePerUnitOf(uint256 projectId, uint256 pricingCurrency, uint256 unitCurrency, uint256 decimals)
    external view returns (uint256 price);

function priceFeedFor(uint256 projectId, uint256 pricingCurrency, uint256 unitCurrency)
    external view returns (IJBPriceFeed feed);
function priceFeedCountFor(uint256 projectId, uint256 pricingCurrency, uint256 unitCurrency)
    external view returns (uint256 count);
function priceFeedAt(uint256 projectId, uint256 pricingCurrency, uint256 unitCurrency, uint256 index)
    external view returns (IJBPriceFeed);
function DEFAULT_PROJECT_ID() external view returns (uint256);   // = 0

// projectId == 0: only the JBPrices owner. projectId != 0: controller-only —
// go through JBController.addPriceFeedFor (gated: ADD_PRICE_FEED + allowAddPriceFeed).
function addPriceFeedFor(uint256 projectId, uint256 pricingCurrency, uint256 unitCurrency, IJBPriceFeed feed)
    external;
```

---

## JBFundAccessLimits

Payout limit + surplus allowance storage. Address: `0xc93360158f187fc8fc8f1062a1b31d06f185dbab`. `setFundAccessLimitsFor` is controller-only — limits are set via the `fundAccessLimitGroups` in a `JBRulesetConfig`.

```solidity
function payoutLimitOf(uint256 projectId, uint256 rulesetId, address terminal, address token, uint256 currency)
    external view returns (uint256 payoutLimit);
function payoutLimitsOf(uint256 projectId, uint256 rulesetId, address terminal, address token)
    external view returns (JBCurrencyAmount[] memory);
function surplusAllowanceOf(uint256 projectId, uint256 rulesetId, address terminal, address token, uint256 currency)
    external view returns (uint256 surplusAllowance);
function surplusAllowancesOf(uint256 projectId, uint256 rulesetId, address terminal, address token)
    external view returns (JBCurrencyAmount[] memory);
```

Limits are scoped to (project, ruleset, terminal, token, currency). Anything not explicitly set is 0: no payout limit configured means `sendPayoutsOf` pays out nothing, and no surplus allowance means `useAllowanceOf` reverts.

---

## JBTerminalStore

Bookkeeping + surplus math. Address: `0x7497ae014a60561925b51c0a3b4ade7460b9927c`. `record*` functions are terminal-internal; the views are the useful surface:

```solidity
function balanceOf(address terminal, uint256 projectId, address token) external view returns (uint256);

function currentSurplusOf(
    uint256 projectId,
    IJBTerminal[] calldata terminals,   // empty array = all of the project's terminals
    address[] calldata tokens,          // empty array = all accounting contexts
    uint256 decimals,
    uint256 currency
) external view returns (uint256);

function currentTotalSurplusOf(uint256 projectId, uint256 decimals, uint256 currency)
    external view returns (uint256);

// Terminal tokens reclaimable for burning `cashOutCount` project tokens.
function currentReclaimableSurplusOf(
    uint256 projectId,
    uint256 cashOutCount,
    IJBTerminal[] calldata terminals,
    address[] calldata tokens,
    uint256 decimals,
    uint256 currency
) external view returns (uint256);

// Overload with pre-computed supply/surplus.
function currentReclaimableSurplusOf(uint256 projectId, uint256 cashOutCount, uint256 totalSupply, uint256 surplus)
    external view returns (uint256);

function currentTotalReclaimableSurplusOf(uint256 projectId, uint256 cashOutCount, uint256 decimals, uint256 currency)
    external view returns (uint256);

function usedPayoutLimitOf(address terminal, uint256 projectId, address token, uint256 rulesetCycleNumber, uint256 currency)
    external view returns (uint256);
function usedSurplusAllowanceOf(address terminal, uint256 projectId, address token, uint256 rulesetId, uint256 currency)
    external view returns (uint256);
```

---

## JBFeelessAddresses

Fee exemption registry. Address: `0x657d0e588fca6f8c49394c9ca8a1cf6505b10314`. All setters are owner-of-JBFeelessAddresses only.

```solidity
function isFeelessFor(address addr, uint256 projectId, address caller) external view returns (bool);
function feelessHook() external view returns (IJBFeelessHook);

function setFeelessAddress(address addr, bool flag) external;                        // global (projectId 0)
function setFeelessAddressFor(uint256 projectId, address addr, bool flag) external;  // per-project
function setFeelessHook(IJBFeelessHook hook) external;                               // dynamic exemption logic
```

---

## JBPermissions

Operator permission delegation. Address: `0xf92ac1ab5a00033e35a3975739124f61928c36b0`.

```solidity
// Grant/replace an operator's permission set for (account, projectId).
// The account itself can set anything. A ROOT operator for the project can set
// non-ROOT permissions on the account's behalf, but cannot grant ROOT or set
// wildcard (projectId 0) permissions. Permission ID 0 is invalid.
function setPermissionsFor(address account, JBPermissionsData calldata permissionsData) external;

function hasPermission(
    address operator, address account, uint256 projectId, uint256 permissionId,
    bool includeRoot,                // also accept ROOT permission
    bool includeWildcardProjectId    // also accept a grant on projectId 0
) external view returns (bool);

function hasPermissions(
    address operator, address account, uint256 projectId, uint256[] calldata permissionIds,
    bool includeRoot, bool includeWildcardProjectId
) external view returns (bool);

// Packed bitmap of the operator's permissions (bit N = permission ID N).
function permissionsOf(address operator, address account, uint256 projectId) external view returns (uint256);

function WILDCARD_PROJECT_ID() external view returns (uint256);  // = 0
```

### Permission IDs (`JBPermissionIds`, uint8)

| ID | Name | Gates |
|----|------|-------|
| 1 | `ROOT` | All operations for the account (superuser) |
| 2 | `QUEUE_RULESETS` | `JBController.queueRulesetsOf` |
| 3 | `LAUNCH_RULESETS` | `JBController.launchRulesetsFor` |
| 4 | `CASH_OUT_TOKENS` | `JBMultiTerminal.cashOutTokensOf` (holder's permission) |
| 5 | `SEND_PAYOUTS` | `JBMultiTerminal.sendPayoutsOf` when `ownerMustSendPayouts` |
| 6 | `MIGRATE_TERMINAL` | `JBMultiTerminal.migrateBalanceOf` |
| 7 | `SET_PROJECT_URI` | `JBController.setUriOf` (+ URI in `launchRulesetsFor`) |
| 8 | `DEPLOY_ERC20` | `JBController.deployERC20For` |
| 9 | `SET_TOKEN` | `JBController.setTokenFor` |
| 10 | `MINT_TOKENS` | `JBController.mintTokensOf` |
| 11 | `BURN_TOKENS` | `JBController.burnTokensOf` (holder's permission) |
| 12 | `CLAIM_TOKENS` | `JBController.claimTokensFor` (holder's permission) |
| 13 | `TRANSFER_CREDITS` | `JBController.transferCreditsFrom` (holder's permission) |
| 14 | `SET_CONTROLLER` | `JBDirectory.setControllerOf` |
| 15 | `SET_TERMINALS` | `JBDirectory.setTerminalsOf` (+ terminals in `launchRulesetsFor`) |
| 16 | `ADD_TERMINALS` | Implicit terminal add inside `JBDirectory.setPrimaryTerminalOf` |
| 17 | `SET_PRIMARY_TERMINAL` | `JBDirectory.setPrimaryTerminalOf` |
| 18 | `USE_ALLOWANCE` | `JBMultiTerminal.useAllowanceOf` |
| 19 | `SET_SPLIT_GROUPS` | `JBController.setSplitGroupsOf` |
| 20 | `ADD_PRICE_FEED` | `JBController.addPriceFeedFor` |
| 21 | `ADD_ACCOUNTING_CONTEXTS` | `JBMultiTerminal.addAccountingContextsFor` |
| 22 | `SET_TOKEN_METADATA` | `JBController.setTokenMetadataOf` |
| 23 | `SIGN_FOR_ERC20` | ERC-1271 signing on behalf of the project's ERC-20 |
| 24 | `ADJUST_721_TIERS` | 721 hook: add/remove NFT tiers |
| 25 | `SET_721_METADATA` | 721 hook: base URI / contract URI / resolver |
| 26 | `MINT_721` | 721 hook: mint NFTs without payment |
| 27 | `SET_721_DISCOUNT_PERCENT` | 721 hook: per-tier discount |
| 28 | `SET_BUYBACK_TWAP` | Buyback hook: TWAP window |
| 29 | `SET_BUYBACK_POOL` | Buyback hook: Uniswap V4 pool |
| 30 | `SET_BUYBACK_HOOK` | Buyback hook registry: configure/lock a project's hook |
| 31 | `SET_ROUTER_TERMINAL` | Router terminal registry: configure/lock a project's router terminal |
| 32 | `MAP_SUCKER_TOKEN` | Suckers: map local ↔ remote token |
| 33 | `DEPLOY_SUCKERS` | Suckers: deploy sucker pairs |
| 34 | `SET_SUCKER_PEER` | Suckers: set peer sucker |
| 35 | `SUCKER_SAFETY` | Suckers: emergency hatch |
| 36 | `SET_SUCKER_DEPRECATION` | Suckers: deprecation lifecycle |
| 37 | `OPEN_LOAN` | REVLoans: open loan on behalf of a holder |
| 38 | `REALLOCATE_LOAN` | REVLoans: move loan collateral |
| 39 | `REPAY_LOAN` | REVLoans: repay on behalf of the loan owner |

Permission checks accept: the account itself, an operator with the specific ID, an operator with `ROOT`, and a wildcard-project grant (projectId 0) — plus per-function overrides noted in each section (controller, terminals, data hook, omnichain operator).

---

## Fee Structure

- Fee rate: `STANDARD_FEE / MAX_FEE` = 25/1000 = **2.5%**. Fees are paid to project #1 (`FEE_BENEFICIARY_PROJECT_ID`) by paying its primary terminal for the token — the fee payer's beneficiary receives project-1 tokens.
- Fee is charged on:
  - Payouts (`sendPayoutsOf`) to recipients that are not projects and not feeless.
  - Surplus allowance withdrawals (`useAllowanceOf`), unless feeless.
  - Cash outs with `cashOutTaxRate != 0` — the fee applies to **every** such cash out, on the full reclaim amount.
  - Cash outs with `cashOutTaxRate == 0` — fee applies only up to the project's accumulated `feeFreeSurplusOf` (prevents fee bypass via intra-terminal payout → zero-tax cash-out round trips); beyond that, zero-tax cash outs are fee-free.
- `holdFees` ruleset flag: fees are recorded as `JBFee` entries instead of processed immediately; `addToBalanceOf(..., shouldReturnHeldFees: true, ...)` returns them proportionally before the `unlockTimestamp`; `processHeldFeesOf` processes them after.
- Feeless addresses (`JBFeelessAddresses`) are exempt everywhere fees apply.

---

## Suckers (nana-suckers-v6): Cross-Chain Token Bridging

Suckers bridge project tokens between chains: burn locally via `prepare`, bridge the merkle root via `toRemote`, claim on the peer chain via `claim`. Sucker instances are per-project and chain-specific — resolve them via `JBSuckerRegistry.suckersOf(projectId)`. Registry address (all chains): `0x7903a854ae91eaf635430d120a1a434085cef297`. Deployers: native bridges (`JBOptimismSuckerDeployer`, `JBBaseSuckerDeployer`, `JBArbitrumSuckerDeployer`) and CCIP (`JBCCIPSuckerDeployer__*`) — chain-specific, from `chain-config.json`.

### JBSuckerRegistry

```solidity
// Deploy sucker pairs. Gated: DEPLOY_SUCKERS. A configuration with an explicit
// non-default peer additionally requires SET_SUCKER_PEER.
function deploySuckersFor(uint256 projectId, bytes32 salt, JBSuckerDeployerConfig[] calldata configurations)
    external returns (address[] memory suckers);

// Views
function suckersOf(uint256 projectId) external view returns (address[] memory);
function allSuckersOf(uint256 projectId) external view returns (address[] memory);   // incl. deprecated
function suckerPairsOf(uint256 projectId) external view returns (JBSuckersPair[] memory);
function isSuckerOf(uint256 projectId, address addr) external view returns (bool);
function tokenMappingIsAllowed(address localToken, uint256 remoteChainId, bytes32 remoteToken)
    external view returns (bool);
function toRemoteFee() external view returns (uint256);            // capped by MAX_TO_REMOTE_FEE
function remoteTotalSupplyOf(uint256 projectId) external view returns (uint256);
function totalRemoteBalanceOf(uint256 projectId, uint256 currency, uint256 decimals)
    external view returns (uint256);
function totalRemoteSurplusOf(uint256 projectId, uint256 currency, uint256 decimals)
    external view returns (uint256);

// Owner-of-registry only: allowSuckerDeployer(s), removeSuckerDeployer,
// allowTokenMapping(s), removeTokenMapping(s), setToRemoteFee.
```

`JBSuckerDeployerConfig`: `{ IJBSuckerDeployer deployer; bytes32 peer; JBTokenMapping[] mappings; }`
`JBTokenMapping`: `{ address localToken; uint32 minGas; bytes32 remoteToken; }`

### JBSucker (per-project instance)

```solidity
// Burn project tokens + reclaim terminal tokens into the outbox for bridging.
// beneficiary is bytes32 (cross-VM address encoding), NOT address.
function prepare(
    uint256 projectTokenCount,
    bytes32 beneficiary,
    uint256 minTokensReclaimed,
    address token,               // terminal token to bridge
    bytes32 metadata
) external;

// Bridge the outbox tree root for `token` to the peer chain. Payable: bridge/transport fee.
function toRemote(address token) external payable;

// Claim bridged tokens on the receiving chain with a merkle proof. Permissionless.
function claim(JBClaim calldata claimData) external;
function claim(JBClaim[] calldata claims) external;

// Map a local terminal token to its remote counterpart. Gated: MAP_SUCKER_TOKEN
// (with override for the registry during authorized deployment). The registry
// owner must have allowed the mapping (requireTokenMappingAllowed) when it
// asserts economic equivalence across distinct chain assets.
// Mapping and allowlist checks do not validate an external native bridge's
// ERC-20 pair; OP Stack and Arbitrum routes must name the exact token delivered
// or burned by the live bridge in both directions.
function mapToken(JBTokenMapping calldata map) external payable;
function mapTokens(JBTokenMapping[] calldata maps) external payable;

// Push accounting snapshots to the peer chain. Payable, permissionless.
function syncAccountingData() external payable;

// Emergency + lifecycle (IJBSuckerExtended):
function enableEmergencyHatchFor(address[] calldata tokens) external;  // gated: SUCKER_SAFETY
function exitThroughEmergencyHatch(JBClaim calldata claimData) external;
function setDeprecation(uint40 timestamp) external;                    // gated: SET_SUCKER_DEPRECATION

// Views: peer(), peerChainId(), state() (JBSuckerState: ENABLED, DEPRECATION_PENDING,
// SENDING_DISABLED, DEPRECATED), isMapped(token), remoteTokenFor(token),
// outboxOf(token), inboxOf(token), amountToAddToBalanceOf(token).
```

`JBClaim`: `{ address token; JBLeaf leaf; bytes32[32] proof; }`
`JBLeaf`: `{ uint256 index; bytes32 beneficiary; uint256 projectTokenCount; uint256 terminalTokenAmount; bytes32 metadata; }`

---

## Buyback Hook (nana-buyback-hook-v6): Uniswap V4

`JBBuybackHook` is a ruleset data hook + pay hook + cash-out hook. On pay, it compares minting vs swapping through a Uniswap V4 pool and routes to whichever yields more project tokens. `JBBuybackHook` address is chain-specific; `JBBuybackHookRegistry` (`0x72f55a54cd53410a5ff175508a5a384227081788`) is chain-invariant.

### JBBuybackHook

```solidity
// Register the project-token/terminal-token V4 pool. Gated: SET_BUYBACK_POOL.
function setPoolFor(uint256 projectId, PoolKey calldata poolKey, uint256 twapWindow, address terminalToken) external;
function setPoolFor(uint256 projectId, uint24 fee, int24 tickSpacing, uint256 twapWindow, address terminalToken) external;

// Create + register the pool in one call. Gated: SET_BUYBACK_POOL.
function initializePoolFor(
    uint256 projectId, uint24 fee, int24 tickSpacing, uint256 twapWindow,
    address terminalToken, uint160 sqrtPriceX96
) external;

// Gated: SET_BUYBACK_TWAP. Bounded by MIN_TWAP_WINDOW()/MAX_TWAP_WINDOW().
function setTwapWindowOf(uint256 projectId, address terminalToken, uint256 newWindow) external;

// Views: poolKeyOf(projectId, terminalToken), twapWindowOf(projectId, terminalToken),
// projectTokenOf(projectId), poolManager(), TWAP_SLIPPAGE_DENOMINATOR().
```

### JBBuybackHookRegistry

Projects set the **registry** as their ruleset `dataHook`; the registry forwards data-hook calls to the project's chosen buyback hook (`hookOf(projectId)`, falling back to `defaultHook()`).

```solidity
// Choose which allowed hook serves the project. Gated: SET_BUYBACK_HOOK.
function setHookFor(uint256 projectId, IJBRulesetDataHook hook) external;

// Permanently pin the project's hook. Gated: SET_BUYBACK_HOOK.
function lockHookFor(uint256 projectId, IJBRulesetDataHook expectedHook) external;

// Convenience forwards to the project's hook. Gated: SET_BUYBACK_POOL.
function setPoolFor(uint256 projectId, uint24 fee, int24 tickSpacing, uint256 twapWindow, address terminalToken) external;
function initializePoolFor(uint256 projectId, uint24 fee, int24 tickSpacing, uint256 twapWindow,
    address terminalToken, uint160 sqrtPriceX96) external;

// Owner-of-registry only: allowHook, disallowHook, setDefaultHook.
// Views: hookOf(projectId), defaultHook(), hasLockedHook(projectId), isHookAllowed(hook).
```

---

## 721 Tiers Hook (nana-721-hook-v6): Tiered NFTs

Pay hook + data hook that mints tiered ERC-721s on payment. `JB721TiersHook` implementation (cloned per project), `JB721TiersHookDeployer`, `JB721TiersHookProjectDeployer`, and `JB721TiersHookStore` are all chain-invariant (see chain-config). Tier reads go through the **store**.

### JB721TierConfig (ABI order)

| Field | Type | Notes |
|-------|------|-------|
| `price` | `uint104` | Cost to mint, in the hook's pricing context |
| `initialSupply` | `uint32` | Max mintable; 999,999,999 = "unlimited" convention |
| `votingUnits` | `uint32` | Governance votes per NFT |
| `reserveFrequency` | `uint16` | 1 reserve mint accrues per N sold |
| `reserveBeneficiary` | `address` | Receives reserve mints |
| `encodedIpfsUri` | `bytes32` | Encoded artwork/metadata IPFS hash |
| `category` | `uint24` | Grouping for organizing tiers |
| `discountPercent` | `uint8` | Discount on `price` |
| `flags` | `JB721TierConfigFlags` | Owner-mint / transfer behavior flags |
| `splitPercent` | `uint32` | Portion of this tier's pay value routed to `splits` |
| `splits` | `JBSplit[]` | Per-tier payout splits |

### JB721TiersHook

```solidity
// Add and remove tiers in one call. Gated: ADJUST_721_TIERS.
function adjustTiers(JB721TierConfig[] calldata tiersToAdd, uint256[] calldata tierIdsToRemove) external;

// Owner-mint from tiers (tiers must allow owner minting). Gated: MINT_721.
function mintFor(uint16[] calldata tierIds, address beneficiary) external returns (uint256[] memory tokenIds);

// Mint accumulated reserve NFTs. Permissionless.
function mintPendingReservesFor(uint256 tierId, uint256 count) external;
function mintPendingReservesFor(JB721TiersMintReservesConfig[] calldata reserveMintConfigs) external;

// Update collection metadata. Gated: SET_721_METADATA.
function setMetadata(
    string calldata name, string calldata symbol, string calldata baseUri, string calldata contractUri,
    IJB721TokenUriResolver tokenUriResolver, uint256 encodedIpfsUriTierId, bytes32 encodedIpfsUri
) external;

// Gated: SET_721_DISCOUNT_PERCENT.
function setDiscountPercentOf(uint256 tierId, uint256 discountPercent) external;
function setDiscountPercentsOf(JB721TiersSetDiscountPercentConfig[] calldata configs) external;

// Views: STORE(), payCreditsOf(addr), pricingContext() → (currency, decimals),
// firstOwnerOf(tokenId), baseURI(), contractURI(), checkpoints().
```

Tier reads (on `JB721TiersHookStore`):

```solidity
function tiersOf(
    address hook,
    uint256[] calldata categories,   // empty = all categories
    bool includeResolvedUri,
    uint256 startingId,
    uint256 size
) external view returns (JB721Tier[] memory tiers);
```

### Deployers

```solidity
// JB721TiersHookDeployer — clone + initialize a hook for an existing project.
function deployHookFor(uint256 projectId, JBDeploy721TiersHookConfig memory deployTiersHookConfig, bytes32 salt)
    external returns (IJB721TiersHook newHook);

// JB721TiersHookProjectDeployer — project + hook in one tx.
// PAYABLE (forwards the project creation fee).
function launchProjectFor(
    address owner,
    JBDeploy721TiersHookConfig memory deployTiersHookConfig,
    JBLaunchProjectConfig memory launchProjectConfig,
    IJBController controller,
    bytes32 salt
) external payable returns (uint256 projectId, IJB721TiersHook hook);

// Also: launchRulesetsFor (gated LAUNCH_RULESETS + SET_TERMINALS + SET_PROJECT_URI if URI set)
// and queueRulesetsOf (gated QUEUE_RULESETS) — each deploys a fresh hook wired as dataHook.
```

`JBDeploy721TiersHookConfig`: `{ string name; string symbol; string baseUri; IJB721TokenUriResolver tokenUriResolver; string contractUri; JB721InitTiersConfig tiersConfig; JB721TiersHookFlags flags; }`
`JB721InitTiersConfig`: `{ JB721TierConfig[] tiers; uint32 currency; uint8 decimals; }`
`JB721TiersHookFlags`: `{ bool noNewTiersWithReserves; bool noNewTiersWithVotes; bool noNewTiersWithOwnerMinting; bool preventOverspending; bool issueTokensForSplits; }`

---

## Router Terminal (nana-router-terminal-v6): Pay With Any Token

`JBRouterTerminalRegistry` (`0xe0427f250fdb0379c8e98e884ee4570521208cbc`, chain-invariant) is itself an `IJBTerminal` a project adds to its terminal list. It forwards `pay`/`addToBalanceOf` to the project's effective router terminal (`JBRouterTerminal`, chain-specific), which swaps the paid token through discovered Uniswap V3 pools and forwards proceeds to the project's primary terminal.

```solidity
// JBRouterTerminalRegistry — per-project routing. Gated: SET_ROUTER_TERMINAL.
function setTerminalFor(uint256 projectId, IJBTerminal terminal) external;
function lockTerminalFor(uint256 projectId, IJBTerminal expectedTerminal) external;  // permanent

// Owner-of-registry only: allowTerminal, disallowTerminal, setDefaultTerminal.

// Views: defaultTerminal(), defaultTerminalFor(projectId), hasLockedTerminal(projectId),
// isTerminalAllowed(terminal), defaultTerminalProjectIdThreshold().

// JBRouterTerminal — pool discovery views:
function discoverBestPool(address normalizedTokenIn, address normalizedTokenOut)
    external view returns (PoolInfo memory pool);
function discoverPool(address normalizedTokenIn, address normalizedTokenOut)
    external view returns (IUniswapV3Pool pool);
```

Resolution semantics: the registry's `accountingContextForTokenOf` delegates to the project's resolved terminal and **fails open** — if no terminal resolves (no per-project terminal set and no applicable default), it returns an empty context (`token == address(0)`, meaning "not accepted") instead of reverting. Transactional paths (`pay`, `addToBalanceOf`) still revert when no terminal resolves.

---

## JBOwnable (nana-ownable-v6): Project-Based Ownership

Ownership pattern used by hooks and periphery (e.g. `JB721TiersHook`). Ownership can be a wallet **or a Juicebox project** — when project-owned, `owner()` resolves to the project NFT's current owner, and `onlyOwner` access can be delegated through `JBPermissions` via a configurable permission ID.

```solidity
function jbOwner() external view returns (address owner, uint88 projectId, uint8 permissionId);
function owner() external view returns (address);
function transferOwnership(address newOwner) external;
function transferOwnershipToProject(uint256 projectId) external;
function setPermissionId(uint8 permissionId) external;   // which permission ID grants onlyOwner access
function renounceOwnership() external;
```

Contracts: `JBOwnable` (fresh ownership) and `JBOwnableOverrides` (for contracts inheriting OpenZeppelin `Ownable`).

---

## JBOmnichainDeployer (nana-omnichain-deployers-v6)

Launches a project + optional 721 hook + suckers in one call, and keeps ruleset changes deployable across chains. Address (all chains): `0xb853758a70a6b4216c09f1d071ea2344aba0a34f`.

```solidity
// PAYABLE (forwards the project creation fee). Overload without deploy721Config exists.
function launchProjectFor(
    address owner,
    string calldata projectUri,
    JBOmnichain721Config calldata deploy721Config,
    JBRulesetConfig[] memory rulesetConfigurations,
    JBTerminalConfig[] calldata terminalConfigurations,
    string calldata memo,
    JBSuckerDeploymentConfig calldata suckerDeploymentConfiguration
) external payable returns (uint256 projectId, IJB721TiersHook hook, address[] memory suckers);

// launchRulesetsFor overloads: gated LAUNCH_RULESETS + SET_TERMINALS (+ SET_PROJECT_URI if URI set).
// queueRulesetsOf overloads: gated QUEUE_RULESETS.
// deploySuckersFor: gated DEPLOY_SUCKERS (+ SET_SUCKER_PEER for explicit non-default peers).
```

---

## Revnets (revnet-core-v6): REVDeployer + REVLoans

A revnet is a Juicebox project owned by `REVDeployer` (`0xb552eb94284f94b833837d4b2cbb237128415d4e`), configured once at deploy and operated autonomously through staged rulesets. `REVLoans` (`0x056265c31157748818f0910d1859acd2f7d427de`) lends against revnet tokens as collateral.

### REVDeployer

```solidity
// Deploy a revnet. PAYABLE (creation fee). An overload adds a tiered-721 hook
// config + croptop allowed posts.
function deployFor(
    uint256 revnetId,                    // 0 = create a new project
    REVConfig memory configuration,
    JBAccountingContext[] memory accountingContextsToAccept,
    REVSuckerDeploymentConfig memory suckerDeploymentConfiguration
) external payable returns (uint256, IJB721TiersHook hook);

function deploySuckersFor(uint256 revnetId, REVSuckerDeploymentConfig calldata suckerDeploymentConfiguration)
    external returns (address[] memory suckers);

// Views: CASH_OUT_DELAY(), FEE_REVNET_ID(), LOANS(), BUYBACK_HOOK(),
// SUCKER_REGISTRY(), hashedEncodedConfigurationOf(revnetId).
```

`REVConfig`: `{ REVDescription description; uint32 baseCurrency; address operator; bool scopeCashOutsToLocalBalances; REVStageConfig[] stageConfigurations; }`
`REVStageConfig`: `{ uint48 startsAtOrAfter; REVAutoIssuance[] autoIssuances; uint16 splitPercent; JBSplit[] splits; uint112 initialIssuance; uint32 issuanceCutFrequency; uint32 issuanceCutPercent; uint16 cashOutTaxRate; uint16 extraMetadata; }`
`REVAutoIssuance`: `{ uint32 chainId; uint104 count; address beneficiary; }`
`REVDescription`: `{ string name; string ticker; string uri; bytes32 salt; }`
`REVSuckerDeploymentConfig`: `{ JBSuckerDeployerConfig[] deployerConfigurations; bytes32 salt; }`

### REVLoans

```solidity
// Open a loan against revnet tokens. Gated: OPEN_LOAN (holder's permission).
// prepaidFeePercent must be within [MIN_PREPAID_FEE_PERCENT (25 = 2.5%),
// MAX_PREPAID_FEE_PERCENT (500 = 50%)] — 0 REVERTS. The prepaid percent buys a
// proportional share of LOAN_LIQUIDATION_DURATION fee-free.
function borrowFrom(
    uint256 revnetId,
    address token,               // loan source terminal token
    uint256 minBorrowAmount,
    uint256 collateralCount,     // revnet tokens to lock (0 reverts)
    address payable beneficiary,
    uint256 prepaidFeePercent,
    address holder
) external returns (uint256 loanId, REVLoan memory);

// Repay (partially or fully) and reclaim collateral. PAYABLE.
// Gated: REPAY_LOAN (loan owner's permission).
function repayLoan(
    uint256 loanId,
    uint256 maxRepayBorrowAmount,
    uint256 collateralCountToReturn,
    address payable beneficiary,
    JBSingleAllowance calldata allowance
) external payable returns (uint256 paidOffLoanId, REVLoan memory paidOffloan);

// Move collateral out of an existing loan into a new one. Gated: REALLOCATE_LOAN,
// PLUS OPEN_LOAN when collateralCountToAdd > 0 (fresh collateral from the owner's balance).
function reallocateCollateralFromLoan(
    uint256 loanId,
    uint256 collateralCountToTransfer,
    address token,
    uint256 minBorrowAmount,
    uint256 collateralCountToAdd,
    address payable beneficiary,
    uint256 prepaidFeePercent
) external returns (uint256 reallocatedLoanId, uint256 newLoanId, REVLoan memory reallocatedLoan, REVLoan memory newLoan);

// Liquidate loans past LOAN_LIQUIDATION_DURATION. Permissionless.
function liquidateExpiredLoansFrom(uint256 revnetId, uint256 startingLoanId, uint256 count) external;

// Views: loanOf(loanId), revnetIdOfLoanWith(loanId),
// borrowableAmountFrom(revnetId, collateralCount, decimals, currency) → (borrowableNow, borrowableCapacity),
// totalBorrowedFrom(revnetId, token), totalCollateralOf(revnetId), isLoanSourceOf(revnetId, token),
// REV_PREPAID_FEE_PERCENT() (= 10 = 1%, added on top of the source fee).
```

`REVLoan`: `{ uint112 amount; uint112 collateral; uint48 createdAt; uint16 prepaidFeePercent; uint32 prepaidDuration; address sourceToken; }`

Operator caveat (from natspec): `OPEN_LOAN` / `REALLOCATE_LOAN` / `REPAY_LOAN` operators can direct borrowed funds or returned collateral to **any** `beneficiary` — grant only to fully trusted operators.

---

## Croptop (croptop-core-v6): Public NFT Posting

`CTPublisher` (`0xcbc84cf9b0293efe3ac7dd1bea128a404f2e6a1c`) lets anyone add NFT tiers ("posts") to a project's 721 hook within owner-configured criteria. `CTDeployer` (`0xf21b8717cb50e497e90f375ec532557dd9022655`) deploys a croptop-ready project.

### CTPublisher

```solidity
// Configure posting criteria. Caller must have ADJUST_721_TIERS for the hook's project.
function configurePostingCriteriaFor(CTAllowedPost[] memory allowedPosts) external;

// Post new tiers and mint from them. PAYABLE. A 1/FEE_DIVISOR (= 1/20 = 5%) fee
// of the post value goes to FEE_PROJECT_ID.
function mintFrom(
    IJB721TiersHook hook,
    CTPost[] calldata posts,
    address token,               // payment token
    uint256 amount,              // ignored for native token (msg.value used)
    address nftBeneficiary,
    address feeBeneficiary,
    bytes calldata additionalPayMetadata
) external payable;

// Views
function allowanceFor(address hook, uint256 category) external view returns (
    uint256 minimumPrice, uint256 minimumTotalSupply, uint256 maximumTotalSupply,
    uint256 maximumSplitPercent, address[] memory allowedAddresses
);
function tiersFor(address hook, bytes32[] memory encodedIpfsUris) external view returns (JB721Tier[] memory);
function tierIdForEncodedIpfsUriOf(address hook, bytes32 encodedIpfsUri) external view returns (uint256);
```

`CTAllowedPost`: `{ address hook; uint24 category; uint104 minimumPrice; uint32 minimumTotalSupply; uint32 maximumTotalSupply; uint32 maximumSplitPercent; address[] allowedAddresses; }`
`CTPost`: `{ bytes32 encodedIpfsUri; uint32 totalSupply; uint104 price; uint24 category; uint32 splitPercent; JBSplit[] splits; }`

### CTDeployer

```solidity
// Deploy a project pre-wired for croptop posting. PAYABLE (creation fee).
function deployProjectFor(
    address owner,
    CTProjectConfig calldata projectConfig,
    CTSuckerDeploymentConfig calldata suckerDeploymentConfiguration,
    IJBController controller
) external payable returns (uint256 projectId, IJB721TiersHook hook);

// Gated: DEPLOY_SUCKERS (+ SET_SUCKER_PEER for explicit non-default peers).
function deploySuckersFor(uint256 projectId, CTSuckerDeploymentConfig calldata suckerDeploymentConfiguration)
    external returns (address[] memory suckers);

// Project owner claims ownership of the 721 collection from the deployer.
function claimCollectionOwnershipOf(IJB721TiersHook hook) external;
```

---

## Common Call Patterns

### Launch a project

```solidity
JBRulesetConfig[] memory rulesets = new JBRulesetConfig[](1);
rulesets[0] = JBRulesetConfig({
    mustStartAtOrAfter: 0,
    duration: 0,                         // open-ended
    weight: 1_000_000 * 1e18,            // 1M tokens per base-currency unit
    weightCutPercent: 0,
    approvalHook: IJBRulesetApprovalHook(address(0)),
    metadata: JBRulesetMetadata({
        reservedPercent: 2000,           // 20%
        cashOutTaxRate: 0,               // full proportional cash outs
        baseCurrency: JBCurrencyIds.ETH, // = 1
        pausePay: false,
        pauseCreditTransfers: false,
        allowOwnerMinting: false,
        allowSetCustomToken: false,
        allowTerminalMigration: false,
        allowSetTerminals: false,
        allowSetController: false,
        allowAddAccountingContext: false,
        allowAddPriceFeed: false,
        ownerMustSendPayouts: false,
        holdFees: false,
        scopeCashOutsToLocalBalances: false,
        useDataHookForPay: false,
        useDataHookForCashOut: false,
        dataHook: address(0),
        metadata: 0
    }),
    splitGroups: splitGroups,
    fundAccessLimitGroups: fundAccessLimitGroups  // empty = NO payouts possible
});

JBAccountingContext[] memory contexts = new JBAccountingContext[](1);
contexts[0] = JBAccountingContext({
    token: JBConstants.NATIVE_TOKEN,
    decimals: 18,
    currency: JBConstants.NATIVE_TOKEN_CURRENCY
});
JBTerminalConfig[] memory terminals = new JBTerminalConfig[](1);
terminals[0] = JBTerminalConfig({terminal: multiTerminal, accountingContextsToAccept: contexts});

uint256 fee = projects.creationFee();
uint256 projectId = controller.launchProjectFor{value: fee}({
    owner: owner,
    projectUri: "ipfs://...",
    rulesetConfigurations: rulesets,
    terminalConfigurations: terminals,
    memo: ""
});
```

### Pay a project

```solidity
// Native token: token = NATIVE_TOKEN, amount ignored, msg.value used.
terminal.pay{value: 1 ether}({
    projectId: projectId,
    token: JBConstants.NATIVE_TOKEN,
    amount: 1 ether,
    beneficiary: msg.sender,
    minReturnedTokens: 0,
    memo: "",
    metadata: ""
});

// ERC-20: approve the terminal first (or use Permit2 metadata); msg.value must be 0.
IERC20(usdc).approve(address(terminal), 1_000e6);
terminal.pay({
    projectId: projectId,
    token: usdc,
    amount: 1_000e6,      // in the token's decimals
    beneficiary: msg.sender,
    minReturnedTokens: 0,
    memo: "",
    metadata: ""
});
```

### Cash out tokens

```solidity
uint256 reclaimed = terminal.cashOutTokensOf({
    holder: msg.sender,
    projectId: projectId,
    cashOutCount: 100e18,                    // project tokens (18 decimals)
    tokenToReclaim: JBConstants.NATIVE_TOKEN,
    minTokensReclaimed: minOut,              // terminal-token decimals
    beneficiary: payable(msg.sender),
    metadata: ""
});
```

### Grant an operator permission

```solidity
uint8[] memory ids = new uint8[](2);
ids[0] = JBPermissionIds.QUEUE_RULESETS;   // 2
ids[1] = JBPermissionIds.SET_SPLIT_GROUPS; // 19
permissions.setPermissionsFor({
    account: msg.sender,
    permissionsData: JBPermissionsData({operator: operator, projectId: uint64(projectId), permissionIds: ids})
});
```

### Distribute payouts

```solidity
// amount is denominated in `currency` — e.g. a USD-denominated payout limit paid in USDC.
// Auto-capped to the remaining payout limit for the cycle.
terminal.sendPayoutsOf({
    projectId: projectId,
    token: usdc,
    amount: 10_000e6,
    currency: uint32(uint160(usdc)),
    minTokensPaidOut: 0
});
```

---

## Common mistakes

- **Sending the wrong creation fee.** `JBProjects.createFor` and `JBController.launchProjectFor` require `msg.value == creationFee()` **exactly** — both 0 and overpayment revert. Read `creationFee()` first; it can be 0 (disabled) up to `MAX_CREATION_FEE` (0.001 ether).
- **Passing `amount` for native-token payments.** For `NATIVE_TOKEN`, `pay`/`addToBalanceOf` ignore the `amount` argument and use `msg.value`.
- **Mixing the two currency namespaces.** `JBCurrencyIds.ETH = 1` / `USD = 2` are only for `baseCurrency` and price-feed lookups. Accounting contexts, payout limits, and `sendPayoutsOf` use `uint32(uint160(tokenAddress))` (native = `NATIVE_TOKEN_CURRENCY`). Passing `1` or `2` where a token-derived currency is expected silently references the wrong price context.
- **`sendPayoutsOf` amount decimals.** The `amount` is denominated in the `currency` argument, not necessarily the token — a USD-denominated payout paid in 6-decimal USDC still uses the currency's fixed-point convention. It also auto-caps at the remaining payout limit rather than reverting.
- **Empty `fundAccessLimitGroups` means zero payouts.** Payout limits and surplus allowances default to 0. A ruleset without fund access limits locks all funds in for that ruleset (cash outs still work).
- **Calling state contracts directly.** `JBTokens`, `JBRulesets`, `JBSplits`, `JBFundAccessLimits`, and `JBPrices` (for nonzero projects) write functions are controller-only. Route writes through `JBController`.
- **Forgetting metadata flags on config functions.** `setTokenFor` needs `allowSetCustomToken`, `migrateBalanceOf` needs `allowTerminalMigration`, `addAccountingContextsFor` needs `allowAddAccountingContext`, `addPriceFeedFor` needs `allowAddPriceFeed`, non-controller `setTerminalsOf` needs `allowSetTerminals`, and owner/operator `mintTokensOf` needs `allowOwnerMinting`. The permission grant alone is not enough.
- **Assuming zero-tax cash outs are always fee-free.** `cashOutTaxRate != 0` incurs the 2.5% fee on every cash out; `cashOutTaxRate == 0` incurs it up to `feeFreeSurplusOf(projectId, token)`.
- **Wrong split group ID.** Reserved token splits live at group ID `1`; payout splits at `uint256(uint160(token))`. Splits set for `rulesetId 0` are the fallback for all rulesets.
- **Permission IDs are `uint8` and `setPermissionsFor` replaces.** `JBPermissionsData.permissionIds` is a `uint8[]`, `projectId` is `uint64`, and each call overwrites the operator's entire permission set for that (account, projectId) — include every ID the operator should keep.
- **Custom tokens must have 18 decimals** and pass `canBeAddedTo(projectId)`; a token already attached to another project is rejected. External pre-minted supply dilutes every holder's cash-out value.
- **Reading packed ruleset metadata.** `JBRulesets` returns `metadata` as a packed `uint256`; use the `JBController` ruleset views to get the decoded `JBRulesetMetadata` struct.
- **`DEPLOY_SUCKERS` alone doesn't cover custom peers.** `deploySuckersFor` with an explicit non-default `peer` in a `JBSuckerDeployerConfig` additionally requires `SET_SUCKER_PEER` (34). Default-peer deployments need only `DEPLOY_SUCKERS` (33).
- **Sucker beneficiaries are `bytes32`.** `prepare` and `JBLeaf.beneficiary` use `bytes32` (cross-VM encoding), not `address`. Token mappings also need registry-owner approval (`tokenMappingIsAllowed`) beyond the project's `MAP_SUCKER_TOKEN` permission.
- **721 hook signatures.** `adjustTiers` takes two arrays (`tiersToAdd`, `tierIdsToRemove`); `mintFor` takes `uint16[] tierIds`. Tier reads (`tiersOf`) live on `JB721TiersHookStore`, not the hook.
- **Buyback config routes through the registry.** When a project's ruleset `dataHook` is `JBBuybackHookRegistry`, use the registry's `setPoolFor`/`setHookFor`; `lockHookFor` is permanent.
- **REVLoans `prepaidFeePercent: 0` reverts.** It must be in `[25, 500]` (2.5%–50%). `collateralCount: 0` also reverts. Loan operators (`OPEN_LOAN`/`REALLOCATE_LOAN`/`REPAY_LOAN`) control the `beneficiary` — funds can be directed anywhere.
- **Router registry resolution is fail-open on views.** `JBRouterTerminalRegistry.accountingContextForTokenOf` returns an empty context (`token == address(0)`) when no per-project or default terminal resolves — check for the empty context before treating a token as accepted; `pay` on an unresolved project reverts.
