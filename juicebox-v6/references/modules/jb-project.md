---
name: jb-project
description: |
  Create and configure Juicebox projects. Use when: (1) deploying a new project with
  launchProjectFor, (2) launching rulesets on a pre-created project with launchRulesetsFor,
  (3) transferring project ownership or updating the project metadata URI, (4) deploying
  or attaching a project ERC-20, (5) reading project state (owner, controller, terminals,
  token), (6) generating deployment scripts with proper terminal and split configuration.
version: 6.0.0
---

# Juicebox Project Management

Create and manage Juicebox projects: deployment, configuration, tokens, and ownership.

## Project Identity

**A Juicebox project is an ERC-721 NFT minted by `JBProjects`. The token ID is the project ID, used across the entire protocol. Whoever holds the NFT owns the project.**

- **Project IDs are per-chain.** Each chain's `JBProjects.count` increments independently. Deploying on Ethereum might yield project #42 while Optimism gives #17. Always specify the chain when referencing a project.
- **Suckers link projects across chains.** An "omnichain project" is separate projects on each chain (different IDs) connected via sucker bridges for token bridging with shared treasury backing.
- **Project #1 is the protocol fee project.** Every terminal forwards 2.5% (`STANDARD_FEE / MAX_FEE` = 25/1000) of qualifying outflows to project #1.

## Core Addresses

Core contracts share one address on **every chain** (CREATE2). From `references/shared/chain-config.json`:

| Contract | Address |
|----------|---------|
| JBController | `0x3fcec3572e84b624477bcff4e2cf1f7deab648f1` |
| JBProjects | `0x6017d1fba9dc279bfa0b03fd931c22e242ab3691` |
| JBDirectory | `0x5aff29060e023e6fb87be5596652b33c65af535b` |
| JBMultiTerminal | `0x130f5dd2bd8805443cf41755253d778a75a67f53` |
| JBTokens | `0x1f80d8f057ee36b4c2656d107e4e4558b71ba7d9` |
| JBPermissions | `0xf92ac1ab5a00033e35a3975739124f61928c36b0` |
| JBDeadline3Hours / 1Day / 3Days / 7Days (approval hooks) | see `references/shared/chain-config.json` |

## Protocol Constants (`JBConstants`)

| Constant | Value | Meaning |
|----------|-------|---------|
| `SPLITS_TOTAL_PERCENT` | `1_000_000_000` | Split percent denominator (9 decimals). 100% = 1e9 |
| `MAX_RESERVED_PERCENT` | `10_000` | Reserved percent denominator (basis points) |
| `MAX_CASH_OUT_TAX_RATE` | `10_000` | Cash-out tax denominator. 10,000 = 100% tax (no reclaim) |
| `MAX_WEIGHT_CUT_PERCENT` | `1_000_000_000` | Weight cut denominator (9 decimals) |
| `NATIVE_TOKEN` | `0x000000000000000000000000000000000000EEEe` | Sentinel for the chain's native token |
| `NATIVE_TOKEN_CURRENCY` | `61166` (= `uint32(uint160(NATIVE_TOKEN))`) | Accounting currency ID for the native token |
| `FEE_BENEFICIARY_PROJECT_ID` | `1` | Protocol fee recipient project |
| `STANDARD_FEE` / `MAX_FEE` | `25` / `1000` | 2.5% protocol fee |

`JBCurrencyIds` (for `baseCurrency` price-feed lookups): `ETH = 1`, `USD = 2`. Accounting-context currencies use `uint32(uint160(tokenAddress))` — these are two different conventions; do not mix them up.

## Creation Fee

`JBProjects.createFor(address owner)` is **payable**. `msg.value` must equal `creationFee` **exactly** or the call reverts with `JBProjects_InvalidCreationFee(value, requiredFee)`.

| Fact | Detail |
|------|--------|
| Read the fee | `JBProjects.creationFee()` — always read on-chain immediately before sending |
| Hard cap | `MAX_CREATION_FEE = 0.001 ether`; the `JBProjects` owner can never set it higher |
| Zero allowed | Owner can set the fee to 0; then `msg.value` must be 0 |
| Forwarding | After minting the NFT, `JBProjects` forwards the fee to `creationFeeReceiver` |
| Payer attribution | A transient `originalPayer` exposes the true fee payer so a `pay`-routing receiver credits the caller, not an intermediary contract |

`JBController.launchProjectFor` is payable for the same reason: it reads `PROJECTS.creationFee()`, requires `msg.value` to match exactly (else `JBController_InvalidCreationFee`), and forwards the full value to `JBProjects.createFor{value: creationFee}(owner)`.

```solidity
uint256 fee = IJBProjects(PROJECTS).creationFee();
uint256 projectId = CONTROLLER.launchProjectFor{value: fee}(owner, uri, rulesetConfigs, terminalConfigs, memo);
```

## Before Writing Custom Code

Check whether native mechanics achieve the goal first:

| User Need | Recommended Solution |
|-----------|---------------------|
| Autonomous tokenized treasury | Deploy a **Revnet** via `revnet-core-v6` |
| Project with structured rules, no EOA owner | Contract-as-owner pattern |
| Simple fundraising project | This skill |
| Vesting/time-locked distributions | Payout limits + cycling rulesets (no custom contracts) |
| NFT-gated treasury | `nana-721-hook-v6` with native cash outs |
| Governance-minimal/immutable | Transfer ownership to burn address after setup |
| One-time treasury access | Surplus allowance (does not reset each cycle) |
| Custom token mechanics | Custom ERC-20 via `setTokenFor` (requires `allowSetCustomToken`) |

See `/jb-simplify` for the full checklist.

## launchProjectFor

Creates a project in one transaction: mints the NFT, sets the URI, sets the controller, configures terminals, queues rulesets.

```solidity
function launchProjectFor(
    address owner,                                    // Receives the project NFT
    string calldata projectUri,                       // IPFS metadata URI ("" to skip)
    JBRulesetConfig[] calldata rulesetConfigurations, // Initial ruleset(s)
    JBTerminalConfig[] calldata terminalConfigurations, // Terminal setup
    string calldata memo                              // Emitted in LaunchProject event
) external payable returns (uint256 projectId);
```

Execution order: fee check → `PROJECTS.createFor{value: creationFee}(owner)` → `uriOf[projectId] = projectUri` (if non-empty) → `DIRECTORY.setControllerOf` → configure terminals → queue rulesets.

**Anyone can call this on behalf of any owner.** It is a launch convenience, not proof of owner authorization — frontends must verify intent via the transaction sender or an owner signature.

### Project Metadata (projectUri)

Points to a JSON file (typically IPFS):

```json
{
  "name": "Project Name",
  "description": "Project description",
  "logoUri": "ipfs://...",
  "infoUri": "https://...",
  "twitter": "@handle",
  "discord": "https://discord.gg/..."
}
```

The URI is stored in `JBController.uriOf[projectId]` and updated via `JBController.setUriOf(projectId, uri)` (owner or `SET_PROJECT_URI` operator). The ERC-721 `tokenURI` is separate — it is rendered by a protocol-owned `tokenUriResolver` on `JBProjects`, which individual project owners do not control.

## Configuration Structs (ABI order)

### JBRulesetConfig

| # | Field | Type | Meaning |
|---|-------|------|---------|
| 1 | `mustStartAtOrAfter` | `uint48` | Earliest start timestamp. 0 = start immediately after previous ruleset |
| 2 | `duration` | `uint32` | Seconds per cycle. 0 = active until explicitly replaced |
| 3 | `weight` | `uint112` | Tokens minted per unit paid (18 decimals). `1` = inherit decayed weight from previous ruleset. `0` = no issuance |
| 4 | `weightCutPercent` | `uint32` | Decay per cycle, out of `MAX_WEIGHT_CUT_PERCENT`. 100,000,000 = 10% cut |
| 5 | `approvalHook` | `IJBRulesetApprovalHook` | Must approve the *next* queued ruleset (e.g. `JBDeadline3Days`). `address(0)` = none |
| 6 | `metadata` | `JBRulesetMetadata` | Behavioral flags (below) |
| 7 | `splitGroups` | `JBSplitGroup[]` | Payout and reserved-token distribution |
| 8 | `fundAccessLimitGroups` | `JBFundAccessLimitGroup[]` | Per-terminal withdrawal limits. **Empty = zero payouts** |

### JBRulesetMetadata

| # | Field | Type | Meaning |
|---|-------|------|---------|
| 1 | `reservedPercent` | `uint16` | Minted tokens reserved for splits, out of 10,000. 5,000 = 50% |
| 2 | `cashOutTaxRate` | `uint16` | Out of 10,000. 0 = proportional reclaim, 10,000 = no reclaim |
| 3 | `baseCurrency` | `uint32` | Currency the weight is priced in (`JBCurrencyIds.ETH`/`USD` or `uint32(uint160(token))`) |
| 4 | `pausePay` | `bool` | Project cannot receive payments |
| 5 | `pauseCreditTransfers` | `bool` | Credit transfers disabled |
| 6 | `allowOwnerMinting` | `bool` | Owner/`MINT_TOKENS` operator can mint on demand |
| 7 | `allowSetCustomToken` | `bool` | `setTokenFor` allowed during this ruleset |
| 8 | `allowTerminalMigration` | `bool` | Terminals can migrate balances |
| 9 | `allowSetTerminals` | `bool` | Terminal list can be modified |
| 10 | `allowSetController` | `bool` | Controller can be changed |
| 11 | `allowAddAccountingContext` | `bool` | New token contexts can be added to terminals |
| 12 | `allowAddPriceFeed` | `bool` | New price feeds can be registered |
| 13 | `ownerMustSendPayouts` | `bool` | Only the owner can trigger payout distribution |
| 14 | `holdFees` | `bool` | Fees accumulated instead of processed immediately |
| 15 | `scopeCashOutsToLocalBalances` | `bool` | Omnichain cash-outs use only local-chain balances, not cross-chain aggregates |
| 16 | `useDataHookForPay` | `bool` | Data hook called before recording payments |
| 17 | `useDataHookForCashOut` | `bool` | Data hook called before recording cash outs |
| 18 | `dataHook` | `address` | The data hook contract |
| 19 | `metadata` | `uint16` | 14 bits of app-specific metadata (upper 2 bits ignored) |

There is no cash-out pause flag: disable cash outs with `cashOutTaxRate: 10_000`.

### JBTerminalConfig

| # | Field | Type | Meaning |
|---|-------|------|---------|
| 1 | `terminal` | `IJBTerminal` | Terminal contract (usually `JBMultiTerminal`) |
| 2 | `accountingContextsToAccept` | `JBAccountingContext[]` | Tokens the terminal accepts |

The field is `accountingContextsToAccept` — using any other name in typed encodings mis-encodes.

### JBAccountingContext

| # | Field | Type | Meaning |
|---|-------|------|---------|
| 1 | `token` | `address` | Token address. Use `JBConstants.NATIVE_TOKEN` (`0x…EEEe`) for ETH — **not** `address(0)` |
| 2 | `decimals` | `uint8` | 18 for ETH, 6 for USDC, etc. |
| 3 | `currency` | `uint32` | Price-feed currency ID: `uint32(uint160(token))` by convention |

### JBSplitGroup

| # | Field | Type | Meaning |
|---|-------|------|---------|
| 1 | `groupId` | `uint256` | `uint256(uint160(tokenAddress))` for payouts of that token; `1` (`JBSplitGroupIds.RESERVED_TOKENS`) for reserved tokens |
| 2 | `splits` | `JBSplit[]` | The splits in the group |

### JBSplit — encoding trap

**ABI order is `percent` first, `hook` last.** Encoding fields in any other order silently mis-encodes the entire `launchProjectFor` call.

| # | Field | Type | Meaning |
|---|-------|------|---------|
| 1 | `percent` | `uint32` | Out of `SPLITS_TOTAL_PERCENT` (1e9). 500,000,000 = 50% |
| 2 | `projectId` | `uint64` | If non-zero, this split `pay`s that project; resulting tokens go to `beneficiary` |
| 3 | `beneficiary` | `address payable` | Direct recipient (when `hook` and `projectId` are zero) or token recipient of the project payment |
| 4 | `preferAddToBalance` | `bool` | When paying a project, use `addToBalance` instead of `pay` |
| 5 | `lockedUntil` | `uint48` | Split cannot be edited in the same split table until this timestamp. Queueing a successor ruleset can still change future payout behavior |
| 6 | `hook` | `IJBSplitHook` | Custom split-processing contract. `address(0)` = none |

Routing priority: `hook` > `projectId` > `beneficiary`.

### JBFundAccessLimitGroup

| # | Field | Type | Meaning |
|---|-------|------|---------|
| 1 | `terminal` | `address` | Terminal the limits apply to |
| 2 | `token` | `address` | Token within that terminal |
| 3 | `payoutLimits` | `JBCurrencyAmount[]` | Max distributable to splits per cycle, per currency |
| 4 | `surplusAllowances` | `JBCurrencyAmount[]` | Max owner-discretionary withdrawal from surplus per ruleset, per currency |

### JBCurrencyAmount

| # | Field | Type | Meaning |
|---|-------|------|---------|
| 1 | `amount` | `uint224` | Amount in the terminal token's decimals |
| 2 | `currency` | `uint32` | Currency the amount is denominated in |

## Deployment Script (Foundry)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script} from "forge-std/Script.sol";
import {IJBController} from "@bananapus/core-v6/src/interfaces/IJBController.sol";
import {IJBProjects} from "@bananapus/core-v6/src/interfaces/IJBProjects.sol";
import {IJBTerminal} from "@bananapus/core-v6/src/interfaces/IJBTerminal.sol";
import {IJBRulesetApprovalHook} from "@bananapus/core-v6/src/interfaces/IJBRulesetApprovalHook.sol";
import {JBRulesetConfig} from "@bananapus/core-v6/src/structs/JBRulesetConfig.sol";
import {JBRulesetMetadata} from "@bananapus/core-v6/src/structs/JBRulesetMetadata.sol";
import {JBTerminalConfig} from "@bananapus/core-v6/src/structs/JBTerminalConfig.sol";
import {JBAccountingContext} from "@bananapus/core-v6/src/structs/JBAccountingContext.sol";
import {JBSplitGroup} from "@bananapus/core-v6/src/structs/JBSplitGroup.sol";
import {JBFundAccessLimitGroup} from "@bananapus/core-v6/src/structs/JBFundAccessLimitGroup.sol";
import {JBConstants} from "@bananapus/core-v6/src/libraries/JBConstants.sol";

contract DeployProject is Script {
    // Same address on every chain.
    IJBController constant CONTROLLER = IJBController(0x3Fcec3572e84b624477BcfF4E2CF1f7dEAb648F1);
    IJBProjects constant PROJECTS = IJBProjects(0x6017d1FBa9DC279BFA0B03fD931C22E242AB3691);
    IJBTerminal constant TERMINAL = IJBTerminal(0x130f5Dd2bD8805443Cf41755253D778a75a67f53);

    function run() external {
        vm.startBroadcast();

        JBRulesetMetadata memory metadata = JBRulesetMetadata({
            reservedPercent: 0,                    // No reserved tokens
            cashOutTaxRate: 0,                     // Proportional cash outs
            baseCurrency: uint32(uint160(JBConstants.NATIVE_TOKEN)),
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
        });

        JBRulesetConfig[] memory rulesetConfigs = new JBRulesetConfig[](1);
        rulesetConfigs[0] = JBRulesetConfig({
            mustStartAtOrAfter: 0,
            duration: 0,                           // Indefinite
            weight: 1e18,                          // 1 token per unit paid
            weightCutPercent: 0,
            approvalHook: IJBRulesetApprovalHook(address(0)),
            metadata: metadata,
            splitGroups: new JBSplitGroup[](0),
            fundAccessLimitGroups: new JBFundAccessLimitGroup[](0) // Empty = ZERO payouts
        });

        JBAccountingContext[] memory accountingContexts = new JBAccountingContext[](1);
        accountingContexts[0] = JBAccountingContext({
            token: JBConstants.NATIVE_TOKEN,
            decimals: 18,
            currency: uint32(uint160(JBConstants.NATIVE_TOKEN))
        });

        JBTerminalConfig[] memory terminalConfigs = new JBTerminalConfig[](1);
        terminalConfigs[0] = JBTerminalConfig({
            terminal: TERMINAL,
            accountingContextsToAccept: accountingContexts
        });

        // Read the creation fee and forward it exactly.
        uint256 fee = PROJECTS.creationFee();

        uint256 projectId = CONTROLLER.launchProjectFor{value: fee}(
            msg.sender,
            "ipfs://...",
            rulesetConfigs,
            terminalConfigs,
            "Project launch"
        );

        vm.stopBroadcast();
    }
}
```

## viem Example

```typescript
import { parseAbi, parseEther } from "viem";

const CONTROLLER = "0x3fcec3572e84b624477bcff4e2cf1f7deab648f1";
const PROJECTS = "0x6017d1fba9dc279bfa0b03fd931c22e242ab3691";
const TERMINAL = "0x130f5dd2bd8805443cf41755253d778a75a67f53";
const NATIVE_TOKEN = "0x000000000000000000000000000000000000EEEe";
const NATIVE_TOKEN_CURRENCY = 61166; // uint32(uint160(NATIVE_TOKEN))

// Full ABI in references/shared/abis/JBController.json — the tuple layouts below match it exactly.
const controllerAbi = parseAbi([
  "function launchProjectFor(address owner, string projectUri, (uint48 mustStartAtOrAfter, uint32 duration, uint112 weight, uint32 weightCutPercent, address approvalHook, (uint16 reservedPercent, uint16 cashOutTaxRate, uint32 baseCurrency, bool pausePay, bool pauseCreditTransfers, bool allowOwnerMinting, bool allowSetCustomToken, bool allowTerminalMigration, bool allowSetTerminals, bool allowSetController, bool allowAddAccountingContext, bool allowAddPriceFeed, bool ownerMustSendPayouts, bool holdFees, bool scopeCashOutsToLocalBalances, bool useDataHookForPay, bool useDataHookForCashOut, address dataHook, uint16 metadata) metadata, (uint256 groupId, (uint32 percent, uint64 projectId, address beneficiary, bool preferAddToBalance, uint48 lockedUntil, address hook)[] splits)[] splitGroups, (address terminal, address token, (uint224 amount, uint32 currency)[] payoutLimits, (uint224 amount, uint32 currency)[] surplusAllowances)[] fundAccessLimitGroups)[] rulesetConfigurations, (address terminal, (address token, uint8 decimals, uint32 currency)[] accountingContextsToAccept)[] terminalConfigurations, string memo) payable returns (uint256 projectId)",
]);
const projectsAbi = parseAbi(["function creationFee() view returns (uint256)"]);

// 1. Read the exact creation fee.
const fee = await publicClient.readContract({
  address: PROJECTS, abi: projectsAbi, functionName: "creationFee",
});

// 2. Launch, forwarding the fee exactly as msg.value.
const hash = await walletClient.writeContract({
  address: CONTROLLER,
  abi: controllerAbi,
  functionName: "launchProjectFor",
  value: fee,
  args: [
    owner,
    "ipfs://...",
    [{
      mustStartAtOrAfter: 0,
      duration: 0,
      weight: parseEther("1"),
      weightCutPercent: 0,
      approvalHook: "0x0000000000000000000000000000000000000000",
      metadata: {
        reservedPercent: 0,
        cashOutTaxRate: 0,
        baseCurrency: NATIVE_TOKEN_CURRENCY,
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
        dataHook: "0x0000000000000000000000000000000000000000",
        metadata: 0,
      },
      splitGroups: [],
      fundAccessLimitGroups: [],
    }],
    [{
      terminal: TERMINAL,
      accountingContextsToAccept: [
        { token: NATIVE_TOKEN, decimals: 18, currency: NATIVE_TOKEN_CURRENCY },
      ],
    }],
    "Project launch",
  ],
});
```

## launchRulesetsFor — Pre-created Projects

For a project created directly with `JBProjects.createFor` (NFT exists, no rulesets yet):

```solidity
function launchRulesetsFor(
    uint256 projectId,
    string calldata projectUri,                       // "" to leave unchanged
    JBRulesetConfig[] calldata rulesetConfigurations,
    JBTerminalConfig[] calldata terminalConfigurations,
    string calldata memo
) external returns (uint256 rulesetId);
```

| Fact | Detail |
|------|--------|
| Not payable | The creation fee was already paid at `createFor` |
| Permissions | Owner, or operator with `LAUNCH_RULESETS` **and** `SET_TERMINALS` (plus `SET_PROJECT_URI` if `projectUri` is non-empty) |
| One-shot | Reverts `JBController_RulesetsAlreadyLaunched` if the project already has rulesets — use `queueRulesetsOf(projectId, rulesetConfigurations, memo)` after that (needs `QUEUE_RULESETS`) |
| Side effects | Sets the controller in the directory, configures terminals, queues the first ruleset |

Two-step pattern (create now, configure later):

```solidity
uint256 fee = PROJECTS.creationFee();
uint256 projectId = PROJECTS.createFor{value: fee}(owner);
// ... later, by owner or LAUNCH_RULESETS operator:
CONTROLLER.launchRulesetsFor(projectId, "ipfs://...", rulesetConfigs, terminalConfigs, "Configure");
```

## Project Tokens

Payments mint **credits** (internal balances in `JBTokens`) by default. Deploy or attach an ERC-20 so holders can claim credits as transferable tokens. Burns always consume credits first. `JBTokens.totalSupplyOf(projectId)` = credits + ERC-20 supply, and drives cash-out math.

### Option 1: Deploy the standard JBERC20

```solidity
IJBToken token = CONTROLLER.deployERC20For(
    projectId,
    "Project Token",   // name (non-empty)
    "PROJ",            // symbol (non-empty)
    bytes32(0)         // salt; non-zero = deterministic clone, namespaced by caller
);
```

- Permission: owner or `DEPLOY_ERC20` operator.
- Deploys a minimal clone of the canonical `JBERC20` implementation: `ERC20Votes` (governance delegation) + `ERC20Permit` (gasless approvals) + ERC-1271.
- With a non-zero salt, the clone address is deterministic; the salt is hashed with the caller's address, so different callers with the same salt get different addresses.
- Name/symbol can be updated later via `CONTROLLER.setTokenMetadataOf` (`SET_TOKEN_METADATA` permission).

### Option 2: Attach a custom ERC-20

```solidity
CONTROLLER.setTokenFor(projectId, IJBToken(myCustomToken));
```

Requirements enforced by `JBTokens.setTokenFor` and `JBController.setTokenFor`:

| Requirement | Revert if violated |
|-------------|--------------------|
| Current (or upcoming) ruleset has `allowSetCustomToken: true` | `JBController_RulesetSetTokenNotAllowed` |
| Caller is owner or `SET_TOKEN` operator | permission revert |
| `token.decimals() == 18` | `JBTokens_TokensMustHave18Decimals` |
| `token.canBeAddedTo(projectId)` returns `true` | `JBTokens_TokenCantBeAdded` |
| Project has no token yet | `JBTokens_ProjectAlreadyHasToken` |
| Token not used by another project | `JBTokens_TokenAlreadyBeingUsed` |

**Pre-existing supply warning**: supply minted outside `JBTokens` is counted in `totalSupplyOf` and dilutes cash-out values for all holders.

### IJBToken interface (custom tokens must implement)

```solidity
interface IJBToken {
    function balanceOf(address account) external view returns (uint256);
    function canBeAddedTo(uint256 projectId) external view returns (bool);
    function decimals() external view returns (uint8);          // must return 18
    function totalSupply() external view returns (uint256);
    function burn(address account, uint256 amount) external;    // authorize JBTokens
    function initialize(string memory name, string memory symbol, address tokensAddress) external;
    function mint(address account, uint256 amount) external;    // authorize JBTokens
    function setMetadata(string memory name, string memory symbol) external;
}
```

**`mint`/`burn`/`setMetadata` are called by the `JBTokens` contract** (`0x1f80d8f057ee36b4c2656d107e4e4558b71ba7d9`), not by the controller. Custom tokens must authorize `JBTokens` as the minter/burner. A pre-attached custom token can no-op `initialize` (it is only called on clones deployed through `deployERC20For`).

```solidity
// Minimal custom-token authorization pattern:
address constant JB_TOKENS = 0x1f80d8f057eE36b4C2656D107E4e4558B71bA7D9;

function mint(address account, uint256 amount) external {
    require(msg.sender == JB_TOKENS, "UNAUTHORIZED");
    _mint(account, amount);
}

function burn(address account, uint256 amount) external {
    require(msg.sender == JB_TOKENS, "UNAUTHORIZED");
    _burn(account, amount);
}

function canBeAddedTo(uint256 _projectId) external view returns (bool) {
    return _projectId == projectId; // bind to one project
}

function decimals() public pure returns (uint8) {
    return 18; // REQUIRED
}
```

### Claiming credits

```solidity
CONTROLLER.claimTokensFor(holder, projectId, tokenCount, beneficiary);
```

Callable by the holder or a `CLAIM_TOKENS` operator, once the project has a token.

### Tradeoffs

| Approach | Pros | Cons |
|----------|------|------|
| Credits only | Zero deployment cost, simplest | Not transferable, no DeFi integration |
| Standard `JBERC20` | Votes + Permit built in, audited, renameable | No custom mechanics |
| Custom ERC-20 | Full control over tokenomics | Must be 18 decimals, must authorize `JBTokens`, needs `allowSetCustomToken`, irreversible once set |

## Ownership and Permissions

Project ownership is the ERC-721 itself:

```solidity
IJBProjects(PROJECTS).transferFrom(currentOwner, newOwner, projectId);
```

Owners delegate specific capabilities via `JBPermissions.setPermissionsFor`:

```solidity
struct JBPermissionsData {
    address operator;      // Who gets the permissions
    uint64 projectId;      // Scope; 0 = wildcard across all the granter's projects
    uint8[] permissionIds; // From JBPermissionIds
}

JBPermissions(PERMISSIONS).setPermissionsFor(ownerAccount, permissionsData);
```

Permission IDs relevant here (`JBPermissionIds`):

| ID | Name | Gates |
|----|------|-------|
| 1 | `ROOT` | Everything (use with extreme caution) |
| 2 | `QUEUE_RULESETS` | `JBController.queueRulesetsOf` |
| 3 | `LAUNCH_RULESETS` | `JBController.launchRulesetsFor` |
| 7 | `SET_PROJECT_URI` | `JBController.setUriOf` |
| 8 | `DEPLOY_ERC20` | `JBController.deployERC20For` |
| 9 | `SET_TOKEN` | `JBController.setTokenFor` |
| 10 | `MINT_TOKENS` | `JBController.mintTokensOf` (ruleset must `allowOwnerMinting`) |
| 14 | `SET_CONTROLLER` | `JBDirectory.setControllerOf` |
| 15 | `SET_TERMINALS` | `JBDirectory.setTerminalsOf` |
| 17 | `SET_PRIMARY_TERMINAL` | `JBDirectory.setPrimaryTerminalOf` |
| 19 | `SET_SPLIT_GROUPS` | `JBController.setSplitGroupsOf` |
| 22 | `SET_TOKEN_METADATA` | `JBController.setTokenMetadataOf` |

## Reading Project State

| What | Call |
|------|------|
| Owner | `JBProjects.ownerOf(projectId)` |
| Total projects created | `JBProjects.count()` |
| Creation fee | `JBProjects.creationFee()` |
| Controller | `JBDirectory.controllerOf(projectId)` |
| All terminals | `JBDirectory.terminalsOf(projectId)` |
| Primary terminal for a token | `JBDirectory.primaryTerminalOf(projectId, token)` |
| Uses a terminal? | `JBDirectory.isTerminalOf(projectId, terminal)` |
| Metadata URI | `JBController.uriOf(projectId)` |
| Current ruleset + metadata | `JBController.currentRulesetOf(projectId)` returns `(JBRuleset, JBRulesetMetadata)` |
| ERC-20 token | `JBTokens.tokenOf(projectId)` (`address(0)` = credits only) |
| Project for a token | `JBTokens.projectIdOf(token)` |
| Total token supply (credits + ERC-20) | `JBTokens.totalSupplyOf(projectId)` |
| Holder balance (credits + ERC-20) | `JBTokens.totalBalanceOf(holder, projectId)` |
| Holder credit balance | `JBTokens.creditBalanceOf(holder, projectId)` |

Post-launch reconfiguration:

```solidity
CONTROLLER.setUriOf(projectId, "ipfs://newUri");            // SET_PROJECT_URI
CONTROLLER.queueRulesetsOf(projectId, rulesetConfigs, "");  // QUEUE_RULESETS
DIRECTORY.setTerminalsOf(projectId, terminals);             // SET_TERMINALS + ruleset allowSetTerminals
```

## Example Prompts

- "Create a project that mints 1000 tokens per ETH with 10% reserved" → `weight: 1000e18`, `reservedPercent: 1000`
- "Set up a project with weekly payout cycles to 3 addresses" → `duration: 604800`, payout split group + fund access limits
- "Deploy a project with a 3-day approval delay for ruleset changes" → `approvalHook: JBDeadline3Days`
- "Create a project that accepts both ETH and USDC" → two `JBAccountingContext` entries (and a USD price feed if `baseCurrency` differs)

## Common mistakes

- **Sending the wrong `msg.value`.** `launchProjectFor` and `createFor` require `msg.value == creationFee` exactly — over- or underpaying reverts. Read `JBProjects.creationFee()` in the same block as the call; do not hardcode it (the owner can change it, capped at 0.001 ether).
- **Encoding `JBSplit` fields out of order.** ABI order is `(percent, projectId, beneficiary, preferAddToBalance, lockedUntil, hook)` — `percent` first. Encoding `beneficiary` first (a common guess) silently corrupts the whole calldata.
- **Misnaming `accountingContextsToAccept`.** The `JBTerminalConfig` field is `accountingContextsToAccept`, not `accountingContexts`.
- **Using `address(0)` for native ETH.** The native-token sentinel is `0x000000000000000000000000000000000000EEEe` (`JBConstants.NATIVE_TOKEN`); its currency ID is `61166`.
- **Mixing currency conventions.** `baseCurrency` and price feeds use `JBCurrencyIds` (`ETH = 1`, `USD = 2`) or `uint32(uint160(token))`; splits `groupId` uses `uint256(uint160(token))` for payouts and `1` for reserved tokens. These are not interchangeable numbers.
- **Mixing percent scales.** Splits use 9 decimals (`SPLITS_TOTAL_PERCENT = 1e9`); `reservedPercent` and `cashOutTaxRate` use basis points (max 10,000); `weightCutPercent` uses 9 decimals.
- **Empty `fundAccessLimitGroups` with expected payouts.** No fund access limits means the project can pay out **zero** — funds stay in the terminal until a ruleset with limits takes effect.
- **Forgetting `allowSetCustomToken`.** `setTokenFor` reverts unless the current (or upcoming) ruleset sets `allowSetCustomToken: true`. `deployERC20For` needs no flag.
- **Authorizing the controller for custom-token mint/burn.** `JBTokens` calls `token.mint`/`token.burn`, not the controller. Custom tokens gating on the controller address brick minting.
- **Updating the project URI on `JBProjects`.** The metadata URI lives in `JBController.uriOf` and is set with `JBController.setUriOf`. `JBProjects.tokenURI` is rendered by a protocol-owned resolver.
- **Treating `weight: 1` as "1 wei of issuance".** `1` is a sentinel meaning "inherit the decayed weight from the previous ruleset". `0` means no issuance.
- **Assuming `launchProjectFor`'s caller is authorized.** Anyone can launch a project for any owner. Verify intent from the transaction sender or an owner signature.
- **Relying on `lockedUntil` across rulesets.** The lock only guards rewrites of the same split table; a queued successor ruleset with a different `rulesetId` can still change future payout behavior before `lockedUntil`.

## Related Skills

- `/jb-simplify` — checklist to avoid custom code
