// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console2} from "forge-std/Test.sol";
import {StakingVault} from "../src/StakingVault.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockToken is ERC20 {
    constructor() ERC20("MOCK", "MOCK") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract StakingVaultTest is Test {
    StakingVault internal vault;
    MockToken internal token;

    address internal owner = address(0xA11CE);
    address internal alice = address(0xA);
    address internal bob   = address(0xB);
    address internal carol = address(0xC);
    address internal treasury = address(0xDEAD); // simulates reward distributor

    uint256 internal constant COOLDOWN = 7 days;
    uint256 internal constant WINDOW = 2 days;

    function setUp() public {
        token = new MockToken();
        vault = new StakingVault(
            IERC20(address(token)),
            "Staked MOCK",
            "xMOCK",
            owner,
            COOLDOWN,
            WINDOW
        );

        // Fund actors
        token.mint(alice, 1_000_000 ether);
        token.mint(bob,   1_000_000 ether);
        token.mint(carol, 1_000_000 ether);
        token.mint(treasury, 10_000_000 ether);

        vm.prank(alice); token.approve(address(vault), type(uint256).max);
        vm.prank(bob);   token.approve(address(vault), type(uint256).max);
        vm.prank(carol); token.approve(address(vault), type(uint256).max);
    }

    // -------------------- Basic stake / share math --------------------

    /// @notice With `_decimalsOffset() = 6`, the first depositor receives shares
    ///         scaled by 1e6 (share token nominally has 24 decimals).
    function test_stake_firstDepositorGetsScaledShares() public {
        vm.prank(alice);
        uint256 shares = vault.deposit(100 ether, alice);
        // Empty-vault math: shares = assets * (0 + 1e6) / (0 + 1) = assets * 1e6
        assertEq(shares, 100 ether * 1e6);
        assertEq(vault.balanceOf(alice), 100 ether * 1e6);
        assertEq(vault.totalAssets(), 100 ether);
        assertApproxEqAbs(vault.convertToAssets(shares), 100 ether, 1);
    }

    function test_secondStake_followsCurrentPricePerShare() public {
        vm.prank(alice); vault.deposit(100 ether, alice);

        // simulate reward arriving
        vm.prank(treasury); token.transfer(address(vault), 100 ether);
        // pricePerShare doubled

        vm.prank(bob); uint256 bobShares = vault.deposit(100 ether, bob);
        uint256 bobAssets = vault.convertToAssets(bobShares);
        assertApproxEqAbs(bobAssets, 100 ether, 1e10);
    }

    // -------------------- Reward distribution --------------------

    function test_rewardDistribution_isProRata() public {
        vm.prank(alice); vault.deposit(100 ether, alice);
        vm.prank(bob);   vault.deposit(300 ether, bob);
        vm.prank(carol); vault.deposit(600 ether, carol); // 10/30/60 split

        vm.prank(treasury); token.transfer(address(vault), 1000 ether);

        uint256 aliceAssets = vault.convertToAssets(vault.balanceOf(alice));
        uint256 bobAssets   = vault.convertToAssets(vault.balanceOf(bob));
        uint256 carolAssets = vault.convertToAssets(vault.balanceOf(carol));

        assertApproxEqAbs(aliceAssets, 200 ether, 1);
        assertApproxEqAbs(bobAssets,   600 ether, 1);
        assertApproxEqAbs(carolAssets, 1200 ether, 1);
    }

    // -------------------- Cooldown gating --------------------

    function test_withdraw_revertsWithoutCooldown() public {
        vm.prank(alice); vault.deposit(100 ether, alice);
        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        vm.expectRevert(); // ERC4626ExceededMaxRedeem
        vault.redeem(shares, alice, alice);
    }

    function test_withdraw_revertsBeforeCooldownElapsed() public {
        vm.prank(alice); vault.deposit(100 ether, alice);
        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice); vault.cooldown();
        vm.warp(block.timestamp + COOLDOWN - 1);
        vm.prank(alice);
        vm.expectRevert();
        vault.redeem(shares, alice, alice);
    }

    function test_withdraw_succeedsInsideWindow() public {
        vm.prank(alice); vault.deposit(100 ether, alice);
        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice); vault.cooldown();
        vm.warp(block.timestamp + COOLDOWN);
        vm.prank(alice); vault.redeem(shares, alice, alice);
        assertApproxEqAbs(token.balanceOf(alice), 1_000_000 ether, 1);
        assertEq(vault.balanceOf(alice), 0);
        (uint256 startedAt,,) = vault.cooldownStatus(alice);
        assertEq(startedAt, 0);
    }

    function test_withdraw_revertsAfterWindowExpired() public {
        vm.prank(alice); vault.deposit(100 ether, alice);
        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice); vault.cooldown();
        vm.warp(block.timestamp + COOLDOWN + WINDOW + 1);
        vm.prank(alice);
        vm.expectRevert();
        vault.redeem(shares, alice, alice);
    }

    function test_partialWithdraw_requiresNewCooldown() public {
        vm.prank(alice); vault.deposit(100 ether, alice);
        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice); vault.cooldown();
        vm.warp(block.timestamp + COOLDOWN);
        vm.prank(alice); vault.redeem(shares / 2, alice, alice);
        vm.prank(alice);
        vm.expectRevert();
        vault.redeem(shares / 2, alice, alice);
    }

    // -------------------- Transfer-during-cooldown blocked --------------------

    function test_transferBlockedDuringCooldown() public {
        vm.prank(alice); vault.deposit(100 ether, alice);
        uint256 half = vault.balanceOf(alice) / 2;
        vm.prank(alice); vault.cooldown();
        vm.prank(alice);
        vm.expectRevert(StakingVault.TransfersDisabledDuringCooldown.selector);
        vault.transfer(bob, half);
    }

    function test_transferAllowedWithoutCooldown() public {
        vm.prank(alice); vault.deposit(100 ether, alice);
        uint256 half = vault.balanceOf(alice) / 2;
        vm.prank(alice); vault.transfer(bob, half);
        assertEq(vault.balanceOf(bob), half);
    }

    // -------------------- JIT attacks --------------------

    /// @notice Audit regression: a tiny-position cooldown followed by a huge
    ///         JIT deposit must rebase the cooldown timestamp toward `now`.
    function test_jitDepositAttack_midCooldownRebases() public {
        vm.prank(carol); vault.deposit(10_000 ether, carol);

        vm.prank(bob); vault.deposit(1 ether, bob);
        vm.prank(bob); vault.cooldown();

        vm.warp(block.timestamp + COOLDOWN - 1);

        vm.prank(bob); vault.deposit(100_000 ether, bob);

        vm.warp(block.timestamp + 2);

        uint256 bobShares = vault.balanceOf(bob);
        vm.prank(bob);
        vm.expectRevert();
        vault.redeem(bobShares, bob, bob);

        (uint256 startedAt,,) = vault.cooldownStatus(bob);
        assertGt(startedAt, block.timestamp - 60);
    }

    /// @notice Inverse: a 1-wei top-up must NOT meaningfully reset cooldown for
    ///         a user with a large existing balance.
    function test_smallTopUp_barelyShiftsCooldown() public {
        vm.prank(alice); vault.deposit(100_000 ether, alice);
        vm.prank(alice); vault.cooldown();

        uint256 t0 = block.timestamp;
        vm.warp(t0 + COOLDOWN - 1 hours);

        vm.prank(treasury); token.transfer(alice, 1);
        vm.prank(alice); token.approve(address(vault), 1);
        vm.prank(alice); vault.deposit(1, alice);

        (uint256 startedAt,,) = vault.cooldownStatus(alice);
        assertApproxEqAbs(startedAt, t0, 5);
    }

    /// @notice Inbound transfer also rebases the recipient's cooldown.
    function test_inboundTransferRebasesCooldown() public {
        vm.prank(alice); vault.deposit(100 ether, alice);
        vm.prank(bob);   vault.deposit(100 ether, bob);

        vm.prank(alice); vault.cooldown();
        uint256 t0 = block.timestamp;
        vm.warp(t0 + COOLDOWN - 1);

        uint256 bobShares = vault.balanceOf(bob);
        vm.prank(bob); vault.transfer(alice, bobShares);

        (uint256 startedAt,,) = vault.cooldownStatus(alice);
        assertGt(startedAt, t0);
        vm.warp(t0 + COOLDOWN);
        uint256 aliceShares = vault.balanceOf(alice);
        vm.prank(alice);
        vm.expectRevert();
        vault.redeem(aliceShares, alice, alice);
    }

    /// @notice Bot cannot stake, wait for reward, and immediately exit.
    function test_jitStakeAttack_rejected() public {
        vm.prank(alice); vault.deposit(1000 ether, alice);

        vm.prank(bob); vault.deposit(1_000_000 ether, bob);

        vm.prank(treasury); token.transfer(address(vault), 10_000 ether);

        uint256 bobShares = vault.balanceOf(bob);
        vm.prank(bob);
        vm.expectRevert();
        vault.redeem(bobShares, bob, bob);

        vm.prank(bob); vault.cooldown();
        vm.warp(block.timestamp + COOLDOWN - 1);
        vm.prank(bob);
        vm.expectRevert();
        vault.redeem(bobShares, bob, bob);
    }

    // -------------------- Owner / params --------------------

    function test_setCooldownParams_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        vault.setCooldownParams(1 days, 1 days);

        vm.prank(owner);
        vault.setCooldownParams(14 days, 3 days);
        assertEq(vault.cooldownPeriod(), 14 days);
        assertEq(vault.withdrawWindow(), 3 days);
    }

    function test_setCooldownParams_enforcesBounds() public {
        vm.prank(owner);
        vm.expectRevert(StakingVault.InvalidCooldownPeriod.selector);
        vault.setCooldownParams(31 days, 2 days);

        vm.prank(owner);
        vm.expectRevert(StakingVault.InvalidWithdrawWindow.selector);
        vault.setCooldownParams(7 days, 12 hours);
    }

    // -------------------- Rescue --------------------

    function test_rescueToken_revertsForStakeToken() public {
        vm.prank(owner);
        vm.expectRevert(bytes("cannot rescue stake token"));
        vault.rescueToken(IERC20(address(token)), owner, 1 ether);
    }

    function test_rescueToken_recoversForeignToken() public {
        MockToken foreign = new MockToken();
        foreign.mint(address(vault), 500 ether);
        vm.prank(owner);
        vault.rescueToken(IERC20(address(foreign)), owner, 500 ether);
        assertEq(foreign.balanceOf(owner), 500 ether);
    }

    // -------------------- maxRedeem / maxWithdraw spec --------------------

    function test_maxRedeem_zeroWithoutCooldown() public {
        vm.prank(alice); vault.deposit(100 ether, alice);
        assertEq(vault.maxRedeem(alice), 0);
        assertEq(vault.maxWithdraw(alice), 0);
    }

    function test_maxRedeem_zeroBeforeCooldownElapsed() public {
        vm.prank(alice); vault.deposit(100 ether, alice);
        vm.prank(alice); vault.cooldown();
        vm.warp(block.timestamp + COOLDOWN - 1);
        assertEq(vault.maxRedeem(alice), 0);
        assertEq(vault.maxWithdraw(alice), 0);
    }

    function test_maxRedeem_matchesBalanceInWindow() public {
        vm.prank(alice); vault.deposit(100 ether, alice);
        vm.prank(alice); vault.cooldown();
        vm.warp(block.timestamp + COOLDOWN);
        assertEq(vault.maxRedeem(alice), vault.balanceOf(alice));
        assertApproxEqAbs(vault.maxWithdraw(alice), 100 ether, 1);
    }

    function test_maxRedeem_zeroAfterWindowExpired() public {
        vm.prank(alice); vault.deposit(100 ether, alice);
        vm.prank(alice); vault.cooldown();
        vm.warp(block.timestamp + COOLDOWN + WINDOW + 1);
        assertEq(vault.maxRedeem(alice), 0);
        assertEq(vault.maxWithdraw(alice), 0);
    }

    // -------------------- cooldown() preconditions --------------------

    function test_cooldown_revertsWithoutShares() public {
        vm.prank(alice);
        vm.expectRevert(StakingVault.NoSharesToCooldown.selector);
        vault.cooldown();
    }

    // -------------------- Inflation attack mitigation --------------------

    function test_inflationAttack_mitigated_largeDonation() public {
        vm.prank(alice); vault.deposit(1, alice);

        vm.prank(alice); token.transfer(address(vault), 1000 ether);

        vm.prank(bob); uint256 victimShares = vault.deposit(100 ether, bob);
        assertGt(victimShares, 0);

        uint256 redeemable = vault.convertToAssets(victimShares);
        assertGt(redeemable, 99 ether);
    }
}
