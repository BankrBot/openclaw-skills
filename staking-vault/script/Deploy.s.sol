// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {StakingVault} from "../src/StakingVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Deploy StakingVault using env vars. Run via `scripts/deploy.sh`
///         or manually:
///
///   STAKE_TOKEN=0x...      \  # ERC-20 that users deposit
///   OWNER=0x...            \  # initial owner (Ownable2Step) — usually treasury / multisig
///   VAULT_NAME="Staked X"  \  # ERC-20 name for share token
///   VAULT_SYMBOL="xX"      \  # ERC-20 symbol for share token
///   COOLDOWN_PERIOD=259200 \  # seconds (defaults to 3 days if unset)
///   WITHDRAW_WINDOW=172800 \  # seconds (defaults to 2 days if unset)
///   forge script script/Deploy.s.sol --rpc-url base --broadcast --verify --slow
contract DeployStakingVault is Script {
    function run() external returns (StakingVault vault) {
        address stakeToken    = vm.envAddress("STAKE_TOKEN");
        address owner         = vm.envAddress("OWNER");
        string memory name_   = vm.envString("VAULT_NAME");
        string memory symbol_ = vm.envString("VAULT_SYMBOL");

        uint256 cooldownPeriod = vm.envOr("COOLDOWN_PERIOD", uint256(3 days));
        uint256 withdrawWindow = vm.envOr("WITHDRAW_WINDOW", uint256(2 days));

        require(stakeToken != address(0), "STAKE_TOKEN required");
        require(owner != address(0), "OWNER required");
        require(bytes(name_).length > 0, "VAULT_NAME required");
        require(bytes(symbol_).length > 0, "VAULT_SYMBOL required");

        vm.startBroadcast();
        vault = new StakingVault(
            IERC20(stakeToken),
            name_,
            symbol_,
            owner,
            cooldownPeriod,
            withdrawWindow
        );
        vm.stopBroadcast();

        console2.log("StakingVault deployed at:", address(vault));
        console2.log("  stake token:    ", vault.asset());
        console2.log("  share name:     ", name_);
        console2.log("  share symbol:   ", symbol_);
        console2.log("  owner:          ", vault.owner());
        console2.log("  cooldownPeriod: ", vault.cooldownPeriod());
        console2.log("  withdrawWindow: ", vault.withdrawWindow());
    }
}
