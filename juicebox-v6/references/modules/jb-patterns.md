---
name: jb-patterns
description: |
  Common Juicebox design patterns for vesting, NFT treasuries, terminal wrappers, yield
  integration, and governance-minimal configurations. Use when: (1) need treasury vesting
  without custom contracts, (2) building NFT-gated redemptions, (3) extending pay/cash-out
  functionality on locked projects or revnets via terminal wrappers, (4) implementing custom
  ERC-20 project tokens, (5) integrating yield protocols like Aave, (6) building prediction
  games with outcome-based payouts, (7) deciding between native mechanics and custom code.
  Covers 11 patterns plus a decision tree. Golden rule: prefer configuration over custom
  contracts.
version: 6.0.0
---

# Juicebox Design Patterns

Proven patterns for common use cases using native Juicebox mechanics. **Always prefer configuration over custom contracts.**

## Golden Rule

> Before writing custom code, ask: "Can this be achieved with payout limits, surplus allowances, splits, and cycling rulesets?"

## Shared facts used throughout

- All contract addresses come from `references/shared/chain-config.json`. Core contracts (`JBController`, `JBMultiTerminal`, `JBTokens`, `JBProjects`, `JBPermissions`, `JBDirectory`, `JB721TiersHookProjectDeployer`, …) share one address across every supported chain — look each up once.
- `JBController.launchProjectFor(...)` is **payable**: `msg.value` must equal `JBProjects.creationFee()` exactly or it reverts with `JBController_InvalidCreationFee`. Every launch example below forwards the fee. `JB721TiersHookProjectDeployer.launchProjectFor(...)` is also payable and forwards `msg.value` to `JBProjects.createFor`.
- Key constants (`nana-core-v6/src/libraries/JBConstants.sol`):

| Constant | Value |
|----------|-------|
| `SPLITS_TOTAL_PERCENT` | `1_000_000_000` (9-decimal; 100%) |
| `MAX_RESERVED_PERCENT` | `10_000` |
| `MAX_CASH_OUT_TAX_RATE` | `10_000` |
| `MAX_WEIGHT_CUT_PERCENT` | `1_000_000_000` |
| `NATIVE_TOKEN` | `0x000000000000000000000000000000000000EEEe` |
| `NATIVE_TOKEN_CURRENCY` | `uint32(uint160(NATIVE_TOKEN))` = `61166` |
| `STANDARD_FEE` / `MAX_FEE` | `25` / `1000` (2.5% protocol fee) |
| `FEE_BENEFICIARY_PROJECT_ID` | `1` |

- Split group IDs (`JBSplitGroupIds.sol`): reserved tokens = `1` (`JBSplitGroupIds.RESERVED_TOKENS`); payout groups use `uint256(uint160(tokenAddress))`.
- `JBCurrencyIds`: `ETH = 1`, `USD = 2` (ruleset `baseCurrency` / price-feed lookups only; accounting-context currencies use `uint32(uint160(token))`).

`JBRulesetConfig` fields in ABI order (`nana-core-v6/src/structs/JBRulesetConfig.sol`):

| Field | Type |
|-------|------|
| `mustStartAtOrAfter` | `uint48` (0 = start immediately after the previous ruleset ends) |
| `duration` | `uint32` (seconds; 0 = active until explicitly replaced) |
| `weight` | `uint112` (tokens minted per unit of payment, 18 decimals; 1 = inherit decayed weight; 0 = no issuance) |
| `weightCutPercent` | `uint32` (out of `MAX_WEIGHT_CUT_PERCENT`; decay per cycle) |
| `approvalHook` | `IJBRulesetApprovalHook` |
| `metadata` | `JBRulesetMetadata` |
| `splitGroups` | `JBSplitGroup[]` |
| `fundAccessLimitGroups` | `JBFundAccessLimitGroup[]` |

`JBRulesetMetadata` fields in ABI order: `uint16 reservedPercent`, `uint16 cashOutTaxRate`, `uint32 baseCurrency`, `bool pausePay`, `bool pauseCreditTransfers`, `bool allowOwnerMinting`, `bool allowSetCustomToken`, `bool allowTerminalMigration`, `bool allowSetTerminals`, `bool allowSetController`, `bool allowAddAccountingContext`, `bool allowAddPriceFeed`, `bool ownerMustSendPayouts`, `bool holdFees`, `bool scopeCashOutsToLocalBalances`, `bool useDataHookForPay`, `bool useDataHookForCashOut`, `address dataHook`, `uint16 metadata`.

---

## Pattern 1: Vesting via Native Mechanics

**Use case**: Release funds to a beneficiary over time (team vesting, milestone-based releases).

**Solution**: Cycling rulesets with payout limits. No custom contracts.

### How it works

| Mechanism | Reset behavior (verified in `JBFundAccessLimits`) | Use for |
|-----------|-----------------------------------------------------|---------|
| Payout limit | Usage resets each ruleset **cycle** (by cycle number) | Recurring distributions (vesting) |
| Surplus allowance | Usage resets per ruleset **ID** (once per configuration) | Discretionary treasury access |
| Cycle `duration` | Sets distribution frequency | Monthly = `30 days` |

### Configuration

```solidity
import {JBConstants} from "@bananapus/core-v6/src/libraries/JBConstants.sol";
import {JBRulesetConfig} from "@bananapus/core-v6/src/structs/JBRulesetConfig.sol";
import {JBFundAccessLimitGroup} from "@bananapus/core-v6/src/structs/JBFundAccessLimitGroup.sol";
import {JBCurrencyAmount} from "@bananapus/core-v6/src/structs/JBCurrencyAmount.sol";

JBCurrencyAmount[] memory payoutLimits = new JBCurrencyAmount[](1);
payoutLimits[0] = JBCurrencyAmount({
    amount: 6.67 ether, // Released per 30-day cycle.
    currency: JBConstants.NATIVE_TOKEN_CURRENCY
});

JBCurrencyAmount[] memory surplusAllowances = new JBCurrencyAmount[](1);
surplusAllowances[0] = JBCurrencyAmount({
    amount: 20 ether, // One-time discretionary access for this ruleset.
    currency: JBConstants.NATIVE_TOKEN_CURRENCY
});

JBFundAccessLimitGroup[] memory fundAccessLimitGroups = new JBFundAccessLimitGroup[](1);
fundAccessLimitGroups[0] = JBFundAccessLimitGroup({
    terminal: address(MULTI_TERMINAL),
    token: JBConstants.NATIVE_TOKEN,
    payoutLimits: payoutLimits,
    surplusAllowances: surplusAllowances
});

// In the JBRulesetConfig: duration: 30 days, fundAccessLimitGroups: fundAccessLimitGroups.
// Launch: CONTROLLER.launchProjectFor{value: PROJECTS.creationFee()}(owner, uri, rulesetConfigs, terminalConfigs, memo);
```

`JBFundAccessLimitGroup` fields in ABI order: `address terminal`, `address token`, `JBCurrencyAmount[] payoutLimits`, `JBCurrencyAmount[] surplusAllowances`. `JBCurrencyAmount`: `uint224 amount`, `uint32 currency`. Include at most one group per `(terminal, token)` pair. Amounts use the terminal token's decimals.

### Capital flow

```
Month 0:  Balance = 100 ETH. Surplus = balance − remaining payout limit ≈ 93.33 ETH (cash-out-able).
Month 1:  Anyone (or only owner if ownerMustSendPayouts) calls sendPayoutsOf() → splits receive 6.67 ETH.
Month 12: Fully vested. Remaining balance accessible via the 20 ETH surplus allowance (useAllowanceOf).
```

Payout distribution: `JBMultiTerminal.sendPayoutsOf(uint256 projectId, address token, uint256 amount, uint256 currency, uint256 minTokensPaidOut)`. Owner discretionary access: `useAllowanceOf(uint256 projectId, address token, uint256 amount, uint256 currency, uint256 minTokensPaidOut, address payable beneficiary, address payable feeBeneficiary, string memo)`.

### Key insight

- Payout limits protect vesting funds from cash outs (surplus = balance above remaining payout limits).
- Surplus = unvested funds available for token-holder cash outs.
- Set `ownerMustSendPayouts: true` if only the owner should trigger distributions.

---

## Pattern 2: NFT-Gated Treasury

**Use case**: Sell NFTs; holders redeem them against treasury surplus.

**Solution**: `JB721TiersHook` (nana-721-hook-v6) with native cash outs.

### Configuration

1. Launch with `JB721TiersHookProjectDeployer.launchProjectFor(address owner, JBDeploy721TiersHookConfig deployTiersHookConfig, JBLaunchProjectConfig launchProjectConfig, IJBController controller, bytes32 salt)` — payable; send `PROJECTS.creationFee()`.
2. The deployer wires the hook as the ruleset's `dataHook` with `useDataHookForPay: true`. The launch config uses `JBPayDataHookRulesetConfig` / `JBPayDataHookRulesetMetadata`, which are `JBRulesetConfig` / `JBRulesetMetadata` minus the `dataHook` and `useDataHookForPay` fields (the deployer supplies them). Set `useDataHookForCashOut: true` yourself so the hook prices cash outs.
3. Set `cashOutTaxRate: 0` for full proportional redemption value.

```solidity
JBPayDataHookRulesetMetadata({
    reservedPercent: 0,
    cashOutTaxRate: 0,             // Full proportional redemption.
    baseCurrency: uint32(uint160(JBConstants.NATIVE_TOKEN)),
    // ... flags ...
    useDataHookForCashOut: true,   // 721 hook prices cash outs by NFT weight.
    metadata: 0
});
```

### How cash outs work

1. Holder calls `JBMultiTerminal.cashOutTokensOf(address holder, uint256 projectId, uint256 cashOutCount, address tokenToReclaim, uint256 minTokensReclaimed, address payable beneficiary, bytes metadata)` with **`cashOutCount: 0`** — the hook reverts if fungible project tokens are cashed out alongside NFTs.
2. The NFT token IDs go in `metadata`, encoded with `JBMetadataResolver` under the ID `JBMetadataResolver.getId("cashOut", hook.METADATA_ID_TARGET())`. Hooks are deployed as clones, so `METADATA_ID_TARGET()` is the shared implementation address — use the getter, not the hook's own address.
3. The hook prices the redemption: reclaim = `(cashOutWeightOf(tokenIds) / totalCashOutWeight()) × surplus`, with the ruleset's `cashOutTaxRate` applied. NFTs are burned; funds go to the beneficiary.

**No custom cash out hook needed** — the 721 hook handles everything.

---

## Pattern 3: Governance-Minimal Treasury

**Use case**: Immutable treasury with no admin controls.

**Solution**: Restrictive ruleset metadata, then transfer ownership to a burn address.

```solidity
// 1. Launch with a single ruleset (duration: 0 = lasts forever) and restrictive metadata:
JBRulesetMetadata({
    // ...
    allowOwnerMinting: false,
    allowSetCustomToken: false,
    allowTerminalMigration: false,
    allowSetTerminals: false,
    allowSetController: false,
    allowAddAccountingContext: false,
    allowAddPriceFeed: false,
    // ...
});

// 2. After deployment, burn ownership (JBProjects is an ERC-721):
PROJECTS.transferFrom(deployer, 0x000000000000000000000000000000000000dEaD, projectId);
```

### What this achieves

- No one can queue new rulesets, add/remove terminals, or mint tokens on demand.
- Payouts and cash outs work as configured forever.
- Permission grants (`JBPermissions`) become unreachable — the owner is the burn address.

---

## Pattern 4: Split Recipients Without Custom Hooks

**Use case**: Distribute payouts or reserved tokens to multiple addresses.

**Solution**: Native splits with direct beneficiaries.

`JBSplit` fields in ABI order (`nana-core-v6/src/structs/JBSplit.sol`):

| Field | Type | Notes |
|-------|------|-------|
| `percent` | `uint32` | Out of `SPLITS_TOTAL_PERCENT` (1e9). 50% = `500_000_000` |
| `projectId` | `uint64` | If non-zero, the split `pay`s that project; minted tokens go to `beneficiary` |
| `beneficiary` | `address payable` | Direct recipient when `hook` and `projectId` are zero. `address(0)` = the processing app decides (terminal uses `msg.sender` for payouts; controller uses `msg.sender` for reserved tokens) |
| `preferAddToBalance` | `bool` | When paying a project, use `addToBalanceOf` instead of `pay` |
| `lockedUntil` | `uint48` | Split can't be edited within the same split table until this timestamp. Queueing a new ruleset with different splits can still change future behavior |
| `hook` | `IJBSplitHook` | Routing priority: `hook` > `projectId` > `beneficiary` |

```solidity
JBSplit[] memory splits = new JBSplit[](3);
splits[0] = JBSplit({
    percent: 500_000_000, // 50%
    projectId: 0,
    beneficiary: payable(team1),
    preferAddToBalance: false,
    lockedUntil: 0,
    hook: IJBSplitHook(address(0)) // No hook needed.
});
splits[1] = JBSplit({percent: 300_000_000, projectId: 0, beneficiary: payable(team2), preferAddToBalance: false, lockedUntil: 0, hook: IJBSplitHook(address(0))});
splits[2] = JBSplit({percent: 200_000_000, projectId: 0, beneficiary: payable(treasury), preferAddToBalance: false, lockedUntil: 0, hook: IJBSplitHook(address(0))});
```

- Split percents may total **less** than 100% (`JBSplits` reverts only if the total exceeds `SPLITS_TOTAL_PERCENT`). Leftover payout funds go to the project owner; leftover reserved tokens are minted to the project owner.
- Only use split hooks (`IJBSplitHook.processSplitWith(JBSplitHookContext)`) when you need custom logic (swapping, LP deposits). Tokens are transferred to the hook optimistically before the call.

---

## Pattern 5: NFT + Vesting Combined

**Use case**: Sell NFTs with funds vesting to the team over time; holders can exit by burning.

**Solution**: Combine Patterns 1 + 2.

```
JB Project with 721 hook
• NFT tier: 100 supply, 1 ETH each
• Payout limit: 6.67 ETH per 30-day cycle (vesting)
• Surplus allowance: 20 ETH (one-time treasury)
• cashOutTaxRate: 0
• Owner: burn address (Pattern 3)

Treasury flow:  Month 0 → 80 ETH surplus (unvested) … Month 12 → 0 ETH surplus (fully vested)
NFT holder:     burn anytime for pro-rata share of current surplus
```

Zero custom contracts: the 721 hook handles mint/redeem; fund access limits handle vesting; ownership burn handles immutability.

---

## Pattern 6: Custom NFT Content via Resolver

**Use case**: Custom artwork, composable assets, or dynamic metadata while using the 721 hook off-the-shelf.

**Solution**: Implement `IJB721TokenUriResolver`; keep the standard hook for treasury mechanics.

The 721 hook already handles payment processing, tier selection, minting, supply tracking, cash-out weights, and reserve mechanics. Custom code is only needed for **content**.

### Interface (`nana-721-hook-v6/src/interfaces/IJB721TokenUriResolver.sol`)

```solidity
interface IJB721TokenUriResolver {
    /// @param nft The address of the NFT contract (the 721 hook).
    /// @param tokenId The token ID to get the URI of.
    function tokenUriOf(address nft, uint256 tokenId) external view returns (string memory tokenUri);
}
```

### Basic resolver

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IJB721TokenUriResolver} from "@bananapus/721-hook-v6/src/interfaces/IJB721TokenUriResolver.sol";
import {IJB721TiersHook} from "@bananapus/721-hook-v6/src/interfaces/IJB721TiersHook.sol";

contract CustomTokenUriResolver is IJB721TokenUriResolver {
    function tokenUriOf(address nft, uint256 tokenId) external view override returns (string memory) {
        // Tier ID is derivable from the token ID via the hook's store (pure function).
        uint256 tierId = IJB721TiersHook(nft).STORE().tierIdOfToken(tokenId);

        string memory svg = _generateSvgForToken(tokenId, tierId);
        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(bytes(abi.encodePacked(
                '{"name":"', _nameForTier(tierId), '",',
                '"image":"data:image/svg+xml;base64,', Base64.encode(bytes(svg)), '"}'
            )))
        ));
    }
    // _generateSvgForToken / _nameForTier: your content logic.
}
```

### Wiring it up

Set the resolver in `JBDeploy721TiersHookConfig` (ABI order: `string name`, `string symbol`, `string baseUri`, `IJB721TokenUriResolver tokenUriResolver`, `string contractUri`, `JB721InitTiersConfig tiersConfig`, `JB721TiersHookFlags flags`) when launching via `JB721TiersHookProjectDeployer`.

`JB721TierConfig` fields in ABI order (`nana-721-hook-v6/src/structs/JB721TierConfig.sol`):

| Field | Type |
|-------|------|
| `price` | `uint104` |
| `initialSupply` | `uint32` |
| `votingUnits` | `uint32` |
| `reserveFrequency` | `uint16` |
| `reserveBeneficiary` | `address` |
| `encodedIpfsUri` | `bytes32` |
| `category` | `uint24` |
| `discountPercent` | `uint8` |
| `flags` | `JB721TierConfigFlags` (`allowOwnerMint`, `useReserveBeneficiaryAsDefault`, `transfersPausable`, `useVotingUnits`, `cantBeRemoved`, `cantIncreaseDiscountPercent`, `cantBuyWithCredits`) |
| `splitPercent` | `uint32` (of the tier price routed to the tier's split group on mint, out of `SPLITS_TOTAL_PERCENT`) |
| `splits` | `JBSplit[]` |

Note: `tiersOf(...)` returns `JB721Tier` structs whose stored `flags` (`JB721TierFlags`) carry 5 bools (`allowOwnerMint`, `transfersPausable`, `cantBeRemoved`, `cantIncreaseDiscountPercent`, `cantBuyWithCredits`) — `useReserveBeneficiaryAsDefault` and `useVotingUnits` are config-time-only.

### When to use a resolver

| Requirement | Use resolver? |
|-------------|---------------|
| Static tier images (IPFS) | No — use `encodedIpfsUri` in the tier config |
| Dynamic/generative art | **Yes** |
| Composable/layered NFTs | **Yes** |
| On-chain SVG storage | **Yes** |
| Token-specific metadata | **Yes** |

### Reference implementation

`banny-retail-v6` — `Banny721TokenUriResolver` (deployed; address in `references/shared/chain-config.json`): on-chain composable SVG NFTs with outfit decoration, outfit locking, and category-based slots, all on a stock `JB721TiersHook`.

---

## Pattern 7: Prediction Games with Dynamic Cash-Out Weights

**Use case**: Games where outcomes determine payout distribution (prediction markets, fantasy sports, tournaments).

**Solution**: Defifa — a 721-hook extension with phase logic, first-owner tracking, and governance-set cash-out weights. All four contracts are deployed on every supported chain (addresses in `references/shared/chain-config.json`): `DefifaDeployer`, `DefifaHook`, `DefifaGovernor`, `DefifaTokenUriResolver`.

### Why a resolver isn't enough

| Requirement | Why Pattern 6 can't do it |
|-------------|---------------------------|
| Dynamic cash-out weights | Cash-out pricing lives in the hook, not the resolver |
| First-owner tracking | Rewards original minters, not current holders |
| Phase enforcement | Different rules per game phase |
| Governance integration | Scorecard ratification changes weights |

### Game lifecycle (`defifa/src/enums/DefifaGamePhase.sol`)

```solidity
enum DefifaGamePhase {
    COUNTDOWN,  // Before minting opens.
    MINT,       // Players mint tier NFTs (pick teams).
    REFUND,     // Minting closed; refunds allowed.
    SCORING,    // Scorecards submitted and attested.
    COMPLETE,   // Scorecard ratified; cash-outs open.
    NO_CONTEST  // Game voided (min participation not met or scorecard timed out); full refunds.
}
```

Scorecard governance lifecycle (`DefifaScorecardState`): `PENDING → ACTIVE → DEFEATED | SUCCEEDED → QUEUED → RATIFIED`.

### Dynamic cash-out weights

Standard 721 hook: cash-out weight derives from tier price (fixed). Defifa: a ratified scorecard assigns each tier a share of the pot.

```solidity
/// defifa/src/structs/DefifaTierCashOutWeight.sol
struct DefifaTierCashOutWeight {
    uint256 id;            // Tier ID.
    uint256 cashOutWeight; // Relative to all other tiers' weights.
}
// Winner-take-all: winning tier gets the full weight; others 0.
// Fantasy scoring: 1st 50%, 2nd 30%, 3rd 15%, 4th 5% of total weight.
```

### First-owner tracking

`DefifaHook.firstOwnerOf(uint256 tokenId) → address` records the original minter — rewards go to first owners, not secondary buyers.

### Governance

`DefifaGovernor`: NFT holders attest to scorecards with tier-weighted voting power — `attestToScorecardFrom(uint256 gameId, uint256 scorecardId) → uint256 weight`. A scorecard that reaches `quorum(gameId)` and passes its timelock can be ratified, which sets the tiers' cash-out weights on the hook and moves the game to `COMPLETE`.

### Fits / doesn't fit

| Use case | Fits? |
|----------|-------|
| Sports/election/price predictions, fantasy leagues, brackets, judged competitions | **Yes** — outcomes = tier weights |
| Standard NFT collection | No — Pattern 6 |
| Fixed-price redemptions | No — native 721 hook (Pattern 2) |

---

## Pattern 8: Custom ERC-20 Project Tokens

**Use case**: Tokenomics beyond standard mint/burn — transfer taxes, per-holder vesting, concentration limits, compliance restrictions.

**Solution**: Implement `IJBToken` and attach via `JBController.setTokenFor(projectId, token)`.

### Check the default first

`JBERC20` (the canonical implementation, deployed as a minimal clone via `JBController.deployERC20For(uint256 projectId, string name, string symbol, bytes32 salt)`) already includes:

- **ERC20Votes** — `delegate()`, `getVotes()`, `getPastVotes()`: on-chain governance works out of the box. No custom token needed for voting.
- **ERC20Permit** and ERC-1271 signature validation.
- **Editable name/symbol** — `JBController.setTokenMetadataOf(projectId, name, symbol)` (owner or `SET_TOKEN_METADATA` permission, ID 22). No custom token needed for renaming.

Write a custom token only for behavior `JBERC20` lacks (taxes, vesting locks, holder caps, allowlists, rebasing).

### On-chain requirements (enforced by `JBTokens.setTokenFor` / `JBController.setTokenFor`)

| Requirement | Enforced where |
|-------------|----------------|
| Caller is project owner or has `SET_TOKEN` permission (ID 9) | `JBController.setTokenFor` |
| Current (or upcoming) ruleset has `allowSetCustomToken: true` | `JBController.setTokenFor` |
| Token is not `address(0)` | `JBTokens` |
| Project doesn't already have a token (one token per project, forever) | `JBTokens` |
| Token isn't already attached to another project | `JBTokens` |
| `token.decimals() == 18` | `JBTokens` |
| `token.canBeAddedTo(projectId)` returns `true` | `JBTokens` |

**WARNING** (from `JBTokens` natspec): any supply minted outside the protocol is included in `totalSupplyOf` and dilutes cash-out values for all holders. Attach tokens with zero (or carefully accounted) pre-existing supply.

### Interface (`nana-core-v6/src/interfaces/IJBToken.sol`)

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

**`mint` and `burn` are called by the `JBTokens` contract** — not the controller. Authorize the `JBTokens` address (from `references/shared/chain-config.json`; same on all chains). `setMetadata` is also called by `JBTokens` (via `JBController.setTokenMetadataOf`). `initialize` exists for the clone-deployment path; a directly-deployed custom token can make it revert.

### Example: transfer-tax token

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IJBToken} from "@bananapus/core-v6/src/interfaces/IJBToken.sol";

contract TaxedProjectToken is ERC20, IJBToken {
    error Unauthorized();
    error AlreadyInitialized();

    uint256 public constant TAX_BPS = 100; // 1%
    address public immutable TOKENS;    // The JBTokens contract — mint/burn/setMetadata caller.
    uint256 public immutable PROJECT_ID;
    address public immutable TREASURY;

    string private _tokenName;
    string private _tokenSymbol;

    constructor(
        string memory name_,
        string memory symbol_,
        address tokens,
        uint256 projectId,
        address treasury
    ) ERC20(name_, symbol_) {
        _tokenName = name_;
        _tokenSymbol = symbol_;
        TOKENS = tokens;
        PROJECT_ID = projectId;
        TREASURY = treasury;
    }

    modifier onlyTokens() {
        if (msg.sender != TOKENS) revert Unauthorized();
        _;
    }

    function name() public view override returns (string memory) { return _tokenName; }
    function symbol() public view override returns (string memory) { return _tokenSymbol; }
    function decimals() public pure override(ERC20, IJBToken) returns (uint8) { return 18; }
    function balanceOf(address account) public view override(ERC20, IJBToken) returns (uint256) { return super.balanceOf(account); }
    function totalSupply() public view override(ERC20, IJBToken) returns (uint256) { return super.totalSupply(); }

    function canBeAddedTo(uint256 projectId) external view returns (bool) { return projectId == PROJECT_ID; }

    function mint(address account, uint256 amount) external onlyTokens { _mint(account, amount); }
    function burn(address account, uint256 amount) external onlyTokens { _burn(account, amount); }

    function setMetadata(string memory name_, string memory symbol_) external onlyTokens {
        _tokenName = name_;
        _tokenSymbol = symbol_;
    }

    function initialize(string memory, string memory, address) external pure { revert AlreadyInitialized(); }

    function _update(address from, address to, uint256 amount) internal override {
        // No tax on mints or burns (protocol operations flow through JBTokens as mint/burn).
        if (from == address(0) || to == address(0)) {
            super._update(from, to, amount);
            return;
        }
        uint256 tax = (amount * TAX_BPS) / 10_000;
        super._update(from, TREASURY, tax);
        super._update(from, to, amount - tax);
    }
}
```

**Attachment** (project must have `allowSetCustomToken: true` in its current or upcoming ruleset):

```solidity
TaxedProjectToken token = new TaxedProjectToken("Taxed", "TAX", address(TOKENS), projectId, treasury);
CONTROLLER.setTokenFor(projectId, IJBToken(address(token))); // Owner or SET_TOKEN (ID 9) operator.
```

### Example: per-holder vesting token

Enforce time-based vesting at the token level — team allocations, investor locks. Vesting restricts **transfers**, not mint/burn: protocol operations (payments minting tokens, cash outs burning them) are exempt because they come from `JBTokens` as mints/burns. Combined with treasury vesting (Pattern 1), this creates layered protection.

```solidity
contract VestingProjectToken is ERC20 /* + IJBToken members as above */ {
    struct VestingSchedule {
        uint256 totalAmount; // Tokens subject to vesting.
        uint40 start;
        uint40 cliff;        // No transfers before this timestamp.
        uint40 duration;     // Full vest at start + duration.
    }

    mapping(address => VestingSchedule) public vestingOf;

    /// Owner sets a schedule AFTER tokens are minted to the beneficiary.
    function setVestingSchedule(address beneficiary, uint256 totalAmount, uint40 start, uint40 cliffDuration, uint40 vestingDuration)
        external
        onlyProjectOwner
    {
        if (vestingOf[beneficiary].totalAmount > 0) revert VestingAlreadyExists();
        vestingOf[beneficiary] = VestingSchedule(totalAmount, start, start + cliffDuration, vestingDuration);
    }

    function vestedAmountOf(address account) public view returns (uint256) {
        VestingSchedule memory s = vestingOf[account];
        if (s.totalAmount == 0) return balanceOf(account);
        if (block.timestamp < s.cliff) return 0;
        if (block.timestamp >= s.start + s.duration) return s.totalAmount;
        return (s.totalAmount * (block.timestamp - s.start)) / s.duration;
    }

    function _update(address from, address to, uint256 amount) internal override {
        // Mints and burns (JBTokens operations) bypass vesting.
        if (from == address(0) || to == address(0)) return super._update(from, to, amount);
        VestingSchedule memory s = vestingOf[from];
        if (s.totalAmount > 0) {
            uint256 locked = s.totalAmount - vestedAmountOf(from);
            if (balanceOf(from) - amount < locked) revert InsufficientVestedBalance();
        }
        super._update(from, to, amount);
    }
}
```

When to use which vesting layer:

| Scenario | Token vesting | Treasury vesting (Pattern 1) |
|----------|---------------|------------------------------|
| Team allocations with cliff | ✅ | optional |
| Investor lock-ups | ✅ | optional |
| Recurring payroll/grants | ❌ | ✅ |
| Milestone-based releases | ❌ | ✅ |
| Per-person schedules | ✅ | ❌ |

Tradeoff: token vesting does not prevent cash outs — burns bypass `_update` restrictions. Pair with a non-zero `cashOutTaxRate` or accept that vested holders can exit via the treasury.

### Example: concentration-limited token

```solidity
function _update(address from, address to, uint256 amount) internal override {
    if (from == address(0) || to == address(0) || isExempt[to]) return super._update(from, to, amount);
    uint256 maxBalance = (totalSupply() * maxHolderBps) / 10_000;
    if (balanceOf(to) + amount > maxBalance) revert ExceedsMaxHolding();
    super._update(from, to, amount);
}
```

Mark liquidity pools exempt. Mints are exempt by the `from == address(0)` branch, so payments always succeed.

### Critical constraints

1. **18 decimals mandatory** — enforced on-chain by `JBTokens`.
2. **`JBTokens` must be authorized for `mint`/`burn`** — no allowance flow; direct authorization.
3. **One token per project, forever** — `setTokenFor` reverts if a token is already set. There is no token swap.
4. **`totalSupply()` accuracy** — cash-out pricing uses credits + token supply (`JBTokens.totalSupplyOf`).
5. **No fee-on-transfer during mint** — the minted amount must equal the requested amount (mints come from `address(0)`, so `_update` tax logic must exempt them).

### Deployment checklist

- [ ] `canBeAddedTo(projectId)` returns `true` for the target project
- [ ] `decimals()` returns exactly 18
- [ ] `JBTokens` address authorized for `mint` and `burn` (no approval needed)
- [ ] `setMetadata` restricted to `JBTokens` (or reverts, accepting that renames are disabled)
- [ ] Custom `_update` logic exempts mints and burns
- [ ] Ruleset has `allowSetCustomToken: true`
- [ ] Tested against pay → mint, cash out → burn, and credit claiming flows

---

## Pattern 9: Time-Limited Campaign

**Use case**: Fundraise for a fixed period, then close payments permanently.

**Solution**: Launch with two queued rulesets — active campaign, then paused-forever.

```solidity
JBRulesetConfig[] memory rulesetConfigurations = new JBRulesetConfig[](2);

// Ruleset 1: active campaign.
rulesetConfigurations[0] = JBRulesetConfig({
    mustStartAtOrAfter: 0,
    duration: 30 days,                // Campaign length.
    weight: 1e18,                     // Issuance rate.
    weightCutPercent: 0,
    approvalHook: IJBRulesetApprovalHook(address(0)),
    metadata: /* pausePay: false */ activeMetadata,
    splitGroups: splitGroups,
    fundAccessLimitGroups: fundAccessLimitGroups
});

// Ruleset 2: campaign over (starts when ruleset 1's duration ends).
rulesetConfigurations[1] = JBRulesetConfig({
    mustStartAtOrAfter: 0,            // 0 = immediately after the previous ruleset ends.
    duration: 0,                      // Lasts until explicitly replaced (forever if ownership is burned).
    weight: 0,                        // No more issuance.
    weightCutPercent: 0,
    approvalHook: IJBRulesetApprovalHook(address(0)),
    metadata: /* pausePay: true; keep cash outs available */ closedMetadata,
    splitGroups: new JBSplitGroup[](0),
    fundAccessLimitGroups: new JBFundAccessLimitGroup[](0) // No payout limits → everything is surplus.
});

CONTROLLER.launchProjectFor{value: PROJECTS.creationFee()}(
    owner, projectUri, rulesetConfigurations, terminalConfigurations, memo
);
```

### Ownership options after deployment

- **Keep ownership** — can queue new rulesets later (`queueRulesetsOf`), run another campaign, adjust splits.
- **Lock forever** — `PROJECTS.transferFrom(deployer, 0x000000000000000000000000000000000000dEaD, projectId)`. Irreversible; no one can ever change the rules; cash outs keep working as configured.

| Scenario | Good fit? |
|----------|-----------|
| One-time crowdfund / NFT mint with deadline / grant round | ✅ |
| Ongoing membership or subscription | ❌ cycling rulesets |
| Autonomous tokenized treasury | ❌ revnet (`REVDeployer`) |

---

## Pattern 10: Terminal Wrapper (Pay Wrapper)

**Use case**: Extend payment or cash-out functionality without modifying rulesets — the only extension path for revnets and locked projects, whose data hooks can't be edited post-deploy.

**Solution**: A contract implementing `IJBTerminal` that transforms inputs and forwards to `JBMultiTerminal`. `JBRouterTerminal` (nana-router-terminal-v6, deployed — address in `references/shared/chain-config.json`) is the canonical example: it accepts arbitrary tokens, swaps to a token the project accepts, then forwards.

| Need | How the wrapper solves it |
|------|---------------------------|
| Dynamic splits at pay time | Parse from metadata, set split groups before forwarding |
| Pay + distribute atomically | Bundle operations in one tx |
| Token interception / staking | Set `beneficiary` to the wrapper, then act on the tokens |
| Referral tracking | Parse referrer from metadata, record on-chain |
| Multi-hop payments | Receive tokens, swap, pay another project |

### Critical mental model

```
WRAPPER IS ADDITIVE
Client A ──► Wrapper ──► JBMultiTerminal   (gets special features)
Client B ────────────────► JBMultiTerminal (still works!)
Both are valid. A wrapper cannot block direct access. Permissionless = feature.
```

Bad: "I'll use a wrapper to block payments that don't meet criteria X." Good: "I'll provide enhanced functionality for clients that opt in."

### IJBTerminal surface to implement

`IJBTerminal` extends `IERC165`. Functions (all verified against `nana-core-v6/src/interfaces/IJBTerminal.sol`):

| Function | Notes |
|----------|-------|
| `pay(uint256 projectId, address token, uint256 amount, address beneficiary, uint256 minReturnedTokens, string memo, bytes metadata) payable → uint256` | Main entry |
| `addToBalanceOf(uint256 projectId, address token, uint256 amount, bool shouldReturnHeldFees, string memo, bytes metadata) payable` | No tokens minted |
| `previewPayFor(uint256 projectId, address token, uint256 amount, address beneficiary, bytes metadata) view → (JBRuleset, uint256, uint256, JBPayHookSpecification[])` | Simulation |
| `accountingContextForTokenOf(uint256 projectId, address token) view → JBAccountingContext` | Delegate to underlying |
| `accountingContextsOf(uint256 projectId) view → JBAccountingContext[]` | Delegate |
| `currentSurplusOf(uint256 projectId, address[] tokens, uint256 decimals, uint256 currency) view → uint256` | Note: takes `address[] tokens` (empty = all) |
| `addAccountingContextsFor(uint256 projectId, JBAccountingContext[] accountingContexts)` | Delegate or revert |
| `migrateBalanceOf(uint256 projectId, address token, IJBTerminal to) → uint256` | Delegate or revert |

### Complete example: pay-time splits terminal

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IJBTerminal} from "@bananapus/core-v6/src/interfaces/IJBTerminal.sol";
import {IJBController} from "@bananapus/core-v6/src/interfaces/IJBController.sol";
import {JBRuleset} from "@bananapus/core-v6/src/structs/JBRuleset.sol";
import {JBSplit} from "@bananapus/core-v6/src/structs/JBSplit.sol";
import {JBSplitGroup} from "@bananapus/core-v6/src/structs/JBSplitGroup.sol";
import {JBConstants} from "@bananapus/core-v6/src/libraries/JBConstants.sol";
import {JBSplitGroupIds} from "@bananapus/core-v6/src/libraries/JBSplitGroupIds.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Lets payers specify reserved-token splits at pay time, then pays the underlying terminal
/// and distributes reserved tokens atomically. Useful when ruleset hooks can't be modified post-deploy.
contract PayWithSplitsTerminal {
    using SafeERC20 for IERC20;

    error InvalidSplitTotal();

    IJBTerminal public immutable MULTI_TERMINAL;
    IJBController public immutable CONTROLLER;

    constructor(IJBTerminal multiTerminal, IJBController controller) {
        MULTI_TERMINAL = multiTerminal;
        CONTROLLER = controller;
    }

    /// @param metadata ABI-encoded `(JBSplit[] splits, bytes innerMetadata)`. Empty splits array = skip.
    function pay(
        uint256 projectId,
        address token,
        uint256 amount,
        address beneficiary,
        uint256 minReturnedTokens,
        string calldata memo,
        bytes calldata metadata
    )
        external
        payable
        returns (uint256 beneficiaryTokenCount)
    {
        bytes memory innerMetadata;
        if (metadata.length > 0) {
            JBSplit[] memory splits;
            (splits, innerMetadata) = abi.decode(metadata, (JBSplit[], bytes));
            if (splits.length > 0) _validateAndSetSplits(projectId, splits);
        }

        uint256 valueToSend = _acceptFunds(token, amount, address(MULTI_TERMINAL));

        beneficiaryTokenCount = MULTI_TERMINAL.pay{value: valueToSend}(
            projectId, token, amount, beneficiary, minReturnedTokens, memo, innerMetadata
        );

        // Distribute reserved tokens to the just-configured splits.
        CONTROLLER.sendReservedTokensToSplitsOf(projectId);
    }

    function _acceptFunds(address token, uint256 amount, address spender) internal returns (uint256 valueToSend) {
        if (token == JBConstants.NATIVE_TOKEN) return msg.value;
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        IERC20(token).forceApprove(spender, amount); // JBMultiTerminal pulls via transferFrom (or permit2).
        return 0;
    }

    /// @dev Requires SET_SPLIT_GROUPS permission (ID 19) on the project.
    function _validateAndSetSplits(uint256 projectId, JBSplit[] memory splits) internal {
        uint256 total;
        for (uint256 i; i < splits.length; i++) total += splits[i].percent;
        if (total != JBConstants.SPLITS_TOTAL_PERCENT) revert InvalidSplitTotal();

        (JBRuleset memory ruleset,) = CONTROLLER.currentRulesetOf(projectId);

        JBSplitGroup[] memory groups = new JBSplitGroup[](1);
        groups[0] = JBSplitGroup({groupId: JBSplitGroupIds.RESERVED_TOKENS, splits: splits});

        CONTROLLER.setSplitGroupsOf(projectId, ruleset.id, groups);
    }

    receive() external payable {}
}
```

For a production wrapper, also implement the delegating view functions and `supportsInterface` from the `IJBTerminal` table above.

### Granting the wrapper permission

`JBPermissions.setPermissionsFor(address account, JBPermissionsData permissionsData)` — takes a **single** `JBPermissionsData` struct (`address operator`, `uint64 projectId`, `uint8[] permissionIds`). Called by the granting account (the project owner) or its `ROOT` operator.

```solidity
uint8[] memory ids = new uint8[](1);
ids[0] = 19; // JBPermissionIds.SET_SPLIT_GROUPS

PERMISSIONS.setPermissionsFor(
    projectOwner,
    JBPermissionsData({operator: address(wrapper), projectId: uint64(projectId), permissionIds: ids})
);
```

Warning: an operator with `SET_SPLIT_GROUPS` can redirect **all** unlocked reserved-token splits, not just for its own callers. Use `lockedUntil` on splits that must survive, or accept the trust assumption.

### Beneficiary-to-self and cash-out wrappers

Intercept minted tokens by paying with `beneficiary: address(this)`, then stake/forward them. The same shape works for cash outs — call `cashOutTokensOf(holder, projectId, cashOutCount, tokenToReclaim, minTokensReclaimed, payable(address(this)), metadata)` with the wrapper as beneficiary, then bridge/swap/stake the reclaimed funds. Cashing out on behalf of `holder` requires the holder's `CASH_OUT_TOKENS` permission (ID 4) unless `holder == msg.sender`.

### Client-side metadata encoding (TypeScript)

```typescript
import { encodeAbiParameters, parseAbiParameters, type Address } from 'viem';

const SPLITS_TOTAL_PERCENT = 1_000_000_000n;

// JBSplit ABI order: percent, projectId, beneficiary, preferAddToBalance, lockedUntil, hook.
const splits = [
  { percent: 500_000_000, projectId: 0n, beneficiary: '0xaaa…' as Address, preferAddToBalance: false, lockedUntil: 0, hook: '0x0000000000000000000000000000000000000000' as Address },
  { percent: 500_000_000, projectId: 0n, beneficiary: '0xbbb…' as Address, preferAddToBalance: false, lockedUntil: 0, hook: '0x0000000000000000000000000000000000000000' as Address },
];

const metadata = encodeAbiParameters(
  parseAbiParameters([
    '(uint32 percent, uint64 projectId, address beneficiary, bool preferAddToBalance, uint48 lockedUntil, address hook)[]',
    'bytes',
  ]),
  [splits, '0x'],
);
```

### Key notes

- Multiple wrappers can coexist; they don't conflict, and they can be chained.
- For revnets this is often the only way to add functionality post-deploy.
- Validate decoded metadata carefully — parsing is attack surface.

---

## Pattern 11: Yield-Generating Hook (Aave Integration)

**Use case**: Deposit contributions into a yield protocol; route yield to the project balance while investors can always cash out principal.

**Solution**: One contract implementing `IJBRulesetDataHook` + `IJBPayHook` + `IJBCashOutHook`.

```
Payment flow:  pay → data hook forwards full amount to pay hook → hook supplies Aave → principal tracked
Yield flow:    aToken balance grows → hook withdraws yield → addToBalanceOf() → team uses sendPayoutsOf()
Cash-out flow: cashOutTokensOf → data hook routes pro-rata principal to the cash-out hook → hook withdraws
               from Aave to the beneficiary
```

### Ruleset configuration

```solidity
JBRulesetMetadata({
    // ...
    useDataHookForPay: true,
    useDataHookForCashOut: true,
    dataHook: address(yieldHook),
    // ...
});
```

### Data hook: route payment funds to the pay hook

```solidity
function beforePayRecordedWith(JBBeforePayRecordedContext calldata context)
    external
    view
    override
    returns (uint256 weight, JBPayHookSpecification[] memory hookSpecifications)
{
    weight = context.weight;

    // Forward ALL payment funds to this hook for the Aave deposit.
    hookSpecifications = new JBPayHookSpecification[](1);
    hookSpecifications[0] = JBPayHookSpecification({
        hook: IJBPayHook(address(this)),
        noop: false,                  // Set true to skip the callback while still diverting no funds.
        amount: context.amount.value, // Must be explicit — 0 forwards nothing.
        metadata: ""
    });
}
```

`JBPayHookSpecification` ABI order: `IJBPayHook hook`, `bool noop`, `uint256 amount`, `bytes metadata`. Same shape for `JBCashOutHookSpecification`.

### Pay hook: deposit to Aave

```solidity
function afterPayRecordedWith(JBAfterPayRecordedContext calldata context) external payable override {
    if (msg.sender != address(TERMINAL)) revert Unauthorized(); // Only the terminal may call.
    uint256 amount = context.forwardedAmount.value;

    IERC20(config.principalToken).forceApprove(address(AAVE_POOL), amount);
    AAVE_POOL.supply(config.principalToken, amount, address(this), 0);

    principalDeposited[context.projectId] += amount;
    _maybeTransferYield(context.projectId);
}
```

### Data hook: cash-out pricing (five return values)

```solidity
function beforeCashOutRecordedWith(JBBeforeCashOutRecordedContext calldata context)
    external
    view
    override
    returns (
        uint256 cashOutTaxRate,
        uint256 effectiveCashOutCount,
        uint256 effectiveTotalSupply,
        uint256 effectiveSurplusValue,
        JBCashOutHookSpecification[] memory hookSpecifications
    )
{
    uint256 availablePrincipal = principalDeposited[context.projectId] - principalWithdrawn[context.projectId];
    uint256 userShare = (availablePrincipal * context.cashOutCount) / context.totalSupply;

    cashOutTaxRate = 0; // No tax on principal.
    effectiveCashOutCount = context.cashOutCount;
    effectiveTotalSupply = context.totalSupply;
    effectiveSurplusValue = context.surplus.value;

    hookSpecifications = new JBCashOutHookSpecification[](1);
    hookSpecifications[0] = JBCashOutHookSpecification({
        hook: IJBCashOutHook(address(this)),
        noop: false,
        amount: userShare,
        metadata: ""
    });
}
```

Note: the terminal caps the reclaim at locally available funds, and it burns the caller-supplied token count regardless of `effectiveCashOutCount`.

### Cash-out hook: withdraw principal from Aave

```solidity
function afterCashOutRecordedWith(JBAfterCashOutRecordedContext calldata context) external payable override {
    if (msg.sender != address(TERMINAL)) revert Unauthorized();
    uint256 amount = context.forwardedAmount.value;

    AAVE_POOL.withdraw(config.principalToken, amount, context.beneficiary);
    principalWithdrawn[context.projectId] += amount;
}
```

### Yield management: route to project balance

```solidity
function _maybeTransferYield(uint256 projectId) internal {
    uint256 availableYield = _availableYieldOf(projectId);
    if (availableYield < config.yieldThreshold) return;

    uint256 withdrawn = AAVE_POOL.withdraw(config.principalToken, availableYield, address(this));
    IERC20(config.principalToken).forceApprove(address(TERMINAL), withdrawn);

    // Yield lands in the project balance; the team distributes it via sendPayoutsOf().
    TERMINAL.addToBalanceOf(projectId, config.principalToken, withdrawn, false, "", "");
}

function _availableYieldOf(uint256 projectId) internal view returns (uint256) {
    uint256 total = IERC20(config.aToken).balanceOf(address(this));
    uint256 principalRemaining = principalDeposited[projectId] - principalWithdrawn[projectId];
    return total > principalRemaining ? total - principalRemaining : 0;
}
```

### Key implementation notes

1. `JBPayHookSpecification.amount` must be `context.amount.value` to forward funds — `0` forwards nothing.
2. Both `after*RecordedWith` hooks MUST check `msg.sender` is the terminal — they are externally callable.
3. Track principal deposits and withdrawals separately; the aToken balance above principal is yield.
4. Route yield through `addToBalanceOf` so it shows up as regular project balance.
5. Use a yield threshold to batch transfers (gas).
6. Include an emergency direct-withdrawal path.

See the `jb-pay-hook` and `jb-cash-out-hook` skills for full hook-authoring detail.

---

## Decision Tree: When to Write Custom Code

```
Need custom payment logic?
├── Token buybacks via Uniswap? → JBBuybackHook (deployed; chain-config.json)
├── Tiered NFTs on payment? → JB721TiersHook
└── Neither works? → Write a custom pay hook (jb-pay-hook skill)

Need custom redemption logic?
├── Burn-NFT-to-redeem? → JB721TiersHook (Pattern 2)
├── Redemption just against surplus? → Native cash outs (cashOutTaxRate)
└── External data source / custom pricing? → Custom cash out hook (jb-cash-out-hook skill)

Need custom payout routing?
├── Multi-recipient with fixed addresses? → Native splits (Pattern 4)
├── Pay another project? → Set split.projectId (no hook)
└── Swapping / LP deposits? → Split hook (jb-split-hook skill)

Need vesting/time-locks?
├── Treasury funds over time? → Cycling rulesets + payout limits (Pattern 1)
├── Milestone-based releases? → Queue multiple rulesets
├── Per-holder token cliffs? → Custom ERC-20 with vesting schedules (Pattern 8)
└── Complex conditions? → Consider revnet or custom code

Need a time-limited campaign?
├── Fundraise then close forever? → Two rulesets: active + paused (Pattern 9)
├── Want immutability? → Burn ownership after deploy (Pattern 3)
└── May run another campaign? → Keep ownership

Need custom NFT content?
├── Static images per tier? → encodedIpfsUri in JB721TierConfig
└── Dynamic / composable / on-chain SVG? → IJB721TokenUriResolver (Pattern 6)

Need prediction/game mechanics?
├── Fixed redemption values? → Standard JB721TiersHook
└── Outcome-based payouts + voting + first-owner rewards? → Defifa (Pattern 7)

Need custom token mechanics?
├── Standard ERC-20? → deployERC20For() — JBERC20 clone
├── Governance voting? → JBERC20 already has ERC20Votes — no custom token needed
├── Editable name/symbol? → setTokenMetadataOf() — no custom token needed
├── Transfer taxes / holder caps / per-holder vesting? → Custom IJBToken (Pattern 8)
└── Pre-existing token? → Must be 18 decimals + implement IJBToken; beware pre-minted supply dilution

Need to accept tokens the project doesn't hold accounting contexts for?
└── JBRouterTerminal (deployed) swaps into an accepted token

Need extended pay functionality on a locked project/revnet?
├── Dynamic splits at pay time? → Terminal wrapper (Pattern 10)
├── Atomic pay + distribute? → Terminal wrapper
├── Token interception / staking? → Terminal wrapper (beneficiary-to-self)
├── Cash out + bridge/swap in one tx? → Cash-out wrapper
├── Block certain payments? → CAN'T DO — permissionless access is a feature
└── Standard payments work fine? → Use JBMultiTerminal directly
```

---

## Reference implementations

- **Vesting + NFT**: any project combining Patterns 1 + 2 (see `jb-project` skill for deployment scripts)
- **Autonomous tokenized treasury**: revnet (`revnet-core-v6`, `REVDeployer`)
- **Custom NFT content**: `banny-retail-v6` — `Banny721TokenUriResolver`, composable on-chain SVG NFTs
- **Prediction games**: `defifa` — `DefifaDeployer` / `DefifaHook` / `DefifaGovernor` / `DefifaTokenUriResolver`, all deployed (chain-config.json)
- **Terminal wrapper**: `nana-router-terminal-v6` — `JBRouterTerminal` + `JBRouterTerminalRegistry`

## Related skills

- `jb-simplify` — checklist to reduce custom code
- `jb-project` — project deployment and configuration
- `jb-ruleset` — ruleset configuration details
- `jb-pay-hook`, `jb-cash-out-hook`, `jb-split-hook` — hook authoring
- `jb-721-tier-content` — 721 tier content configuration
- `jb-v6-api` — contract API lookup

---

## Common mistakes

1. **Forgetting the creation fee.** `launchProjectFor` reverts unless `msg.value == JBProjects.creationFee()` exactly — more also reverts. Applies to `JB721TiersHookProjectDeployer.launchProjectFor` too (it forwards `msg.value`).
2. **Authorizing the controller for custom-token mint/burn.** `JBTokens` calls `mint`/`burn`/`setMetadata` on the project token — gate those functions on the `JBTokens` address, not `JBController`.
3. **Missing `allowSetCustomToken: true`.** `JBController.setTokenFor` reverts unless the current (or upcoming) ruleset sets this flag. Plan it into the launch config — you can't retrofit it without queueing a new ruleset.
4. **Custom token for features JBERC20 already has.** Governance voting (ERC20Votes), permit approvals, and name/symbol edits (`setTokenMetadataOf`, permission ID 22) are built into the default token.
5. **Non-18-decimal custom tokens.** `JBTokens.setTokenFor` reverts on `decimals() != 18`.
6. **Wrapping the 721 hook.** Don't write a data hook that delegates to the 721 hook — use it directly and get vesting via ruleset configuration (Pattern 5).
7. **Custom vesting contracts for treasury funds.** Payout limits reset each ruleset cycle — that IS vesting. Exception: per-holder token cliffs are legitimately a custom ERC-20 (Pattern 8).
8. **Queueing 12 rulesets for 12-month vesting.** One ruleset with `duration: 30 days` cycles automatically with the same limits.
9. **Split hooks for direct transfers.** A hook that just forwards funds should be a plain `beneficiary`. Splits route `hook` > `projectId` > `beneficiary` — use the simplest slot that works.
10. **Custom cash out hooks for standard redemptions.** Proportional redemption is native: set `cashOutTaxRate: 0`. The 721 hook's burn-to-redeem is also native (Pattern 2).
11. **Passing `cashOutCount > 0` when cashing out NFTs.** `JB721Hook.beforeCashOutRecordedWith` reverts if fungible project tokens accompany an NFT cash out — token IDs go in `JBMetadataResolver`-encoded metadata keyed by `hook.METADATA_ID_TARGET()` (the implementation address, since hooks are clones).
12. **Trying to block payments with a terminal wrapper.** Anyone can always call `JBMultiTerminal` directly. Wrappers add features for opt-in clients; they cannot gate the project.
13. **Assuming split percents must sum to 100%.** They may sum to less; leftovers go to the project owner (payout funds and reserved tokens alike). Only totals above `SPLITS_TOTAL_PERCENT` revert.
14. **Forwarding `amount: 0` in a `JBPayHookSpecification`.** The hook gets called but receives no funds — use `context.amount.value` to divert the full payment. Don't forget the `noop` field when constructing the struct (ABI order: `hook`, `noop`, `amount`, `metadata`).
15. **Unprotected `after*RecordedWith` hooks.** Pay/cash-out hooks are externally callable — always require `msg.sender` is the terminal.
16. **Pre-minted supply on attached tokens.** Supply minted outside the protocol counts in `totalSupplyOf` and dilutes every holder's cash-out value.
