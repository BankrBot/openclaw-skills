// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title DeployerFactory — deploy ANY contract via a normal contract CALL (no creation tx needed).
/// @notice Some agent transaction pipelines (e.g. Bankr's submit_raw_transaction) REQUIRE a `to`
/// field, so they can never send a contract-CREATION transaction (which needs `to` omitted).
/// This factory turns deployment into a plain call: send the creation bytecode (with ABI-encoded
/// constructor args already appended) to deploy() / deployDeterministic() and the factory runs
/// CREATE / CREATE2. The new address is emitted in the Deployed event (readable off the receipt)
/// and returned (readable via eth_call simulation).
///
/// Fee: `fee` is in the NATIVE token (wei), default 0. Non-exempt callers must send
/// msg.value >= fee; the fee is forwarded to the ops wallet on success (fee only charged when the
/// deploy succeeds — reverts refund everything). The admin address is fee-exempt. Any msg.value
/// ABOVE the fee is forwarded to the new contract's constructor as its endowment (the constructor
/// must be payable to accept it — otherwise send exactly the fee).
///
/// IMPORTANT for deployers: inside the child's constructor, msg.sender is THIS FACTORY, not you.
/// If your contract assigns ownership from msg.sender in its constructor, the factory becomes the
/// owner (usually wrong). Pass the owner/admin as an explicit constructor argument instead.
///
/// Trust model (renounce-capable, per the MfT queue standard): admin may setFee / setOpsWallet /
/// withdrawStuck during the build phase; renounceAdmin() is ONE-WAY and permanently locks all
/// three (no un-set path) — the factory becomes trustless at ship. Deploys themselves are
/// permissionless forever and are never pausable.
contract DeployerFactory {
    address public admin;        // fee-exempt caller; may configure until renounced
    address public opsWallet;    // fee destination
    uint256 public fee;          // native wei charged per deploy to non-exempt callers (0 = free)
    bool public adminRenounced;  // ONE-WAY ship-time lock: true = config frozen forever

    uint256 private _locked = 1;
    modifier nonReentrant() { require(_locked == 1, "reentrant"); _locked = 2; _; _locked = 1; }
    modifier onlyAdmin() {
        require(msg.sender == admin, "not admin");
        require(!adminRenounced, "renounced");
        _;
    }

    event Deployed(address indexed deployer, address indexed addr, uint256 feePaid);
    event FeeSet(uint256 oldFee, uint256 newFee);
    event OpsWalletSet(address indexed oldOps, address indexed newOps);
    event StuckWithdrawn(address indexed token, uint256 amount);
    event AdminRenounced();

    constructor(address _ops, address _admin) {
        require(_ops != address(0) && _admin != address(0), "zero addr");
        opsWallet = _ops;
        admin = _admin;
    }

    /// @notice Deploy a contract with CREATE.
    /// @param initCode creation bytecode with ABI-encoded constructor args appended.
    /// @return addr the new contract's address (also emitted in Deployed).
    function deploy(bytes memory initCode) external payable nonReentrant returns (address addr) {
        uint256 feePaid = _feeDue();
        uint256 endowment = msg.value - feePaid;
        assembly { addr := create(endowment, add(initCode, 0x20), mload(initCode)) }
        require(addr != address(0), "create failed");
        _forwardFee(feePaid);
        emit Deployed(msg.sender, addr, feePaid);
    }

    /// @notice Deploy with CREATE2 — the address is deterministic; predict it with computeAddress().
    /// @dev The CREATE2 namespace is factory-wide: the address depends only on (factory, salt,
    /// initCode), NOT on the caller — a distinct salt claims a distinct address, first come first
    /// served. Mix something caller-specific into the salt if that matters to you.
    function deployDeterministic(bytes memory initCode, bytes32 salt)
        external payable nonReentrant returns (address addr)
    {
        uint256 feePaid = _feeDue();
        uint256 endowment = msg.value - feePaid;
        assembly { addr := create2(endowment, add(initCode, 0x20), mload(initCode), salt) }
        require(addr != address(0), "create2 failed");
        _forwardFee(feePaid);
        emit Deployed(msg.sender, addr, feePaid);
    }

    /// @notice Predict the CREATE2 address for (initCodeHash, salt). initCodeHash = keccak256(initCode).
    function computeAddress(bytes32 initCodeHash, bytes32 salt) external view returns (address) {
        return address(uint160(uint256(
            keccak256(abi.encodePacked(hex"ff", address(this), salt, initCodeHash))
        )));
    }

    // ── admin config (all three locked forever by renounceAdmin) ──
    function setFee(uint256 newFee) external onlyAdmin {
        emit FeeSet(fee, newFee);
        fee = newFee;
    }

    function setOpsWallet(address newOps) external onlyAdmin {
        require(newOps != address(0), "zero addr");
        emit OpsWalletSet(opsWallet, newOps);
        opsWallet = newOps;
    }

    /// @notice Recover funds stranded here by mistake. Fees auto-forward on every deploy, and there
    /// is no receive()/fallback, so only force-sent native (selfdestruct) or mis-sent ERC20s can
    /// strand. token = address(0) withdraws native. Disabled FOREVER after renounceAdmin().
    function withdrawStuck(address token, uint256 amount) external onlyAdmin {
        if (token == address(0)) {
            (bool ok, ) = admin.call{value: amount}("");
            require(ok, "native withdraw failed");
        } else {
            (bool ok, bytes memory data) =
                token.call(abi.encodeWithSignature("transfer(address,uint256)", admin, amount));
            require(ok && (data.length == 0 || abi.decode(data, (bool))), "token withdraw failed");
        }
        emit StuckWithdrawn(token, amount);
    }

    /// @notice ONE-WAY: permanently lock setFee / setOpsWallet / withdrawStuck. No un-set path.
    /// The admin address stays fee-exempt after renouncing (an exemption is not a rug vector).
    function renounceAdmin() external onlyAdmin {
        adminRenounced = true;
        emit AdminRenounced();
    }

    // ── internal ──
    function _feeDue() internal view returns (uint256 feePaid) {
        feePaid = (msg.sender == admin) ? 0 : fee;
        require(msg.value >= feePaid, "fee not paid");
    }

    function _forwardFee(uint256 feePaid) internal {
        if (feePaid > 0) {
            (bool ok, ) = opsWallet.call{value: feePaid}("");
            require(ok, "fee forward failed");
        }
    }
}
