// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title StakingVault
/// @notice Generic single-asset staking vault. Daily protocol rewards are
///         delivered by transferring the stake token directly to this contract;
///         each transfer increases the share price pro rata for all stakers.
///         No claim step, no reward debt, no per-user gas at distribution time.
/// @dev    ERC4626 vault. Withdrawals require a two-step cooldown
///         (Aave-style) to neutralize just-in-time staking around reward
///         distribution. Inflation attack on the first depositor is
///         mitigated by OZ's ERC4626 virtual-shares offset.
///
///         Originally `StakedAxiom` (xAXIOM) on Base. Generalized so any
///         protocol can spin up a share-price-rebase staking vault for their
///         own ERC-20 with their own name/symbol/cooldown.
contract StakingVault is ERC4626, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @dev Period a user must wait after `cooldown()` before they can withdraw.
    uint256 public cooldownPeriod;

    /// @dev Once the cooldown elapses, the user has this long to withdraw
    ///      before the request expires and they must cooldown again.
    uint256 public withdrawWindow;

    /// @dev Hard upper bounds so a malicious / compromised owner can't
    ///      lock funds forever. cooldownPeriod ≤ 30d, withdrawWindow ≥ 1d.
    uint256 public constant MAX_COOLDOWN = 30 days;
    uint256 public constant MIN_WITHDRAW_WINDOW = 1 days;

    /// @dev Cooldown state per user. timestamp = block.timestamp at request,
    ///      so the user can withdraw between
    ///      [timestamp + cooldownPeriod, timestamp + cooldownPeriod + withdrawWindow].
    mapping(address => uint256) public cooldownStartedAt;

    error CooldownNotStarted();
    error CooldownNotElapsed();
    error WithdrawWindowExpired();
    error InvalidCooldownPeriod();
    error InvalidWithdrawWindow();
    error TransfersDisabledDuringCooldown();
    error NoSharesToCooldown();

    event CooldownStarted(address indexed user, uint256 startedAt);
    event CooldownParamsUpdated(uint256 cooldownPeriod, uint256 withdrawWindow);

    /// @param stakeToken_     ERC-20 token users deposit (e.g. AXIOM, your project's token).
    /// @param name_           Share-token name (e.g. "Staked AXIOM").
    /// @param symbol_         Share-token symbol (e.g. "xAXIOM").
    /// @param initialOwner    Address that can adjust cooldown params + rescue non-stake tokens.
    /// @param cooldownPeriod_ Seconds users must wait after `cooldown()` before redeem (≤ 30 days).
    /// @param withdrawWindow_ Seconds the redeem window stays open once cooldown elapses (≥ 1 day).
    constructor(
        IERC20 stakeToken_,
        string memory name_,
        string memory symbol_,
        address initialOwner,
        uint256 cooldownPeriod_,
        uint256 withdrawWindow_
    )
        ERC20(name_, symbol_)
        ERC4626(stakeToken_)
        Ownable(initialOwner)
    {
        _setCooldownParams(cooldownPeriod_, withdrawWindow_);
    }

    // -----------------------------------------------------------------------
    //  Cooldown
    // -----------------------------------------------------------------------

    /// @notice Start the unstake cooldown for `msg.sender`. Resets the timer
    ///         if a previous cooldown was in progress. User must hold shares.
    function cooldown() external {
        if (balanceOf(msg.sender) == 0) revert NoSharesToCooldown();
        cooldownStartedAt[msg.sender] = block.timestamp;
        emit CooldownStarted(msg.sender, block.timestamp);
    }

    /// @notice Returns (start, readyAt, expiresAt) for a user's cooldown.
    function cooldownStatus(address user)
        external
        view
        returns (uint256 startedAt, uint256 readyAt, uint256 expiresAt)
    {
        startedAt = cooldownStartedAt[user];
        if (startedAt == 0) return (0, 0, 0);
        readyAt = startedAt + cooldownPeriod;
        expiresAt = readyAt + withdrawWindow;
    }

    function setCooldownParams(uint256 cooldownPeriod_, uint256 withdrawWindow_) external onlyOwner {
        _setCooldownParams(cooldownPeriod_, withdrawWindow_);
    }

    function _setCooldownParams(uint256 cooldownPeriod_, uint256 withdrawWindow_) internal {
        if (cooldownPeriod_ > MAX_COOLDOWN) revert InvalidCooldownPeriod();
        if (withdrawWindow_ < MIN_WITHDRAW_WINDOW) revert InvalidWithdrawWindow();
        cooldownPeriod = cooldownPeriod_;
        withdrawWindow = withdrawWindow_;
        emit CooldownParamsUpdated(cooldownPeriod_, withdrawWindow_);
    }

    // -----------------------------------------------------------------------
    //  ERC4626 overrides — gate withdraw/redeem on cooldown.
    // -----------------------------------------------------------------------

    /// @dev Hook on every withdraw/redeem. Verifies cooldown window for `owner`
    ///      (the shareholder being burned), then clears the cooldown.
    function _withdraw(address caller, address receiver, address owner, uint256 assets, uint256 shares)
        internal
        override
        nonReentrant
    {
        uint256 startedAt = cooldownStartedAt[owner];
        if (startedAt == 0) revert CooldownNotStarted();

        uint256 readyAt = startedAt + cooldownPeriod;
        if (block.timestamp < readyAt) revert CooldownNotElapsed();
        if (block.timestamp > readyAt + withdrawWindow) revert WithdrawWindowExpired();

        // One cooldown = one withdrawal. Any leftover shares must cooldown again.
        cooldownStartedAt[owner] = 0;

        super._withdraw(caller, receiver, owner, assets, shares);
    }

    /// @dev Two cooldown-related rules enforced on every share movement:
    ///
    ///      1. SENDER guard. If `from` has an active cooldown, transfers (not
    ///         mints / burns) are blocked. Otherwise a user could escape the
    ///         cooldown by shipping their shares to a fresh address.
    ///
    ///      2. RECEIVER cooldown rebase. If `to` has an active cooldown and
    ///         receives more shares (mint or inbound transfer), the cooldown
    ///         timestamp is weighted-averaged toward `block.timestamp`:
    ///
    ///             new = (incoming * now + currentBalance * old) /
    ///                   (incoming + currentBalance)
    ///
    ///         This is the Aave `stkAAVE` pattern. It defeats the JIT attack
    ///         where a user calls `cooldown()` on a tiny position, waits the
    ///         full period, then deposits a massive amount right before
    ///         redeeming to capture pending rewards on an oversized stake —
    ///         the cooldown timestamp slides forward in proportion to the
    ///         incoming amount, forcing them to wait again. Small top-ups
    ///         barely move it; large ones push the timestamp nearly to `now`.
    function _update(address from, address to, uint256 value) internal override {
        // (1) Sender guard.
        if (from != address(0) && to != address(0)) {
            if (cooldownStartedAt[from] != 0) revert TransfersDisabledDuringCooldown();
        }
        // (2) Receiver cooldown rebase. Only fires on mint or inbound transfer,
        //     and only when the recipient already has an active cooldown.
        if (to != address(0)) {
            uint256 oldCooldown = cooldownStartedAt[to];
            if (oldCooldown != 0) {
                uint256 currentBalance = balanceOf(to); // pre-update
                uint256 denom = value + currentBalance;
                if (denom != 0) {
                    cooldownStartedAt[to] =
                        (value * block.timestamp + currentBalance * oldCooldown) / denom;
                }
            }
        }
        super._update(from, to, value);
    }

    // -----------------------------------------------------------------------
    //  Rescue (non-stake-token only) — protocol may airdrop unrelated tokens
    //  to the vault address by mistake; recoverable. The stake token itself
    //  is NOT recoverable — it's locked as backing for shares.
    // -----------------------------------------------------------------------

    function rescueToken(IERC20 token, address to, uint256 amount) external onlyOwner {
        require(address(token) != asset(), "cannot rescue stake token");
        token.safeTransfer(to, amount);
    }

    // -----------------------------------------------------------------------
    //  ERC4626 hardening
    // -----------------------------------------------------------------------

    /// @dev Inflation-attack hardening. With offset = 6, an attacker needs to
    ///      donate ~1e6× the smallest deposit to grief share-price math, which
    ///      is cost-prohibitive for any realistically priced stake token.
    ///      Note: this makes the share token nominally 24-decimal (18 + 6);
    ///      frontends should display `convertToAssets(shares)` for
    ///      stake-token-denominated user balances.
    function _decimalsOffset() internal pure override returns (uint8) {
        return 6;
    }

    /// @dev Spec-compliant: `maxRedeem` reflects what the user can redeem RIGHT
    ///      NOW. Without an active, in-window cooldown, that's 0.
    function maxRedeem(address owner) public view override returns (uint256) {
        uint256 startedAt = cooldownStartedAt[owner];
        if (startedAt == 0) return 0;
        uint256 readyAt = startedAt + cooldownPeriod;
        if (block.timestamp < readyAt) return 0;
        if (block.timestamp > readyAt + withdrawWindow) return 0;
        return balanceOf(owner);
    }

    function maxWithdraw(address owner) public view override returns (uint256) {
        return convertToAssets(maxRedeem(owner));
    }
}
