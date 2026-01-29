# Security Review Guide

Patterns to check when reviewing Solidity PRs.

## Critical Issues (Request Changes)

### Ownership & Access Control
```solidity
// 🚨 RED FLAG: Ownership transfer without timelock
function transferOwnership(address newOwner) external onlyOwner {
    owner = newOwner;
}

// 🚨 RED FLAG: Missing access control
function withdraw() external {
    payable(msg.sender).transfer(address(this).balance);
}
```

### Fund Movement
```solidity
// 🚨 RED FLAG: Arbitrary token transfers
function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
    IERC20(token).transfer(owner, amount);
}

// 🚨 RED FLAG: Unchecked external calls
(bool success,) = recipient.call{value: amount}("");
```

### Unsafe Randomness
```solidity
// 🚨 RED FLAG: Predictable randomness
uint256 random = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender)));

// 🚨 RED FLAG: Using blockhash for randomness
uint256 random = uint256(blockhash(block.number - 1));
```

### Reentrancy
```solidity
// 🚨 RED FLAG: State update after external call
function withdraw() external {
    uint256 bal = balances[msg.sender];
    (bool success,) = msg.sender.call{value: bal}("");
    require(success);
    balances[msg.sender] = 0;  // Should be BEFORE the call
}
```

## Safe Patterns (Approve)

### Checks-Effects-Interactions
```solidity
// ✅ SAFE: CEI pattern
function withdraw() external nonReentrant {
    uint256 bal = balances[msg.sender];
    balances[msg.sender] = 0;  // Effect before interaction
    (bool success,) = msg.sender.call{value: bal}("");
    require(success);
}
```

### Two-Step Ownership Transfer
```solidity
// ✅ SAFE: Pending owner pattern
function transferOwnership(address newOwner) external onlyOwner {
    pendingOwner = newOwner;
}

function acceptOwnership() external {
    require(msg.sender == pendingOwner);
    owner = pendingOwner;
    pendingOwner = address(0);
}
```

### SafeERC20
```solidity
// ✅ SAFE: Using SafeERC20
using SafeERC20 for IERC20;
token.safeTransfer(recipient, amount);
```

### Chainlink VRF for Randomness
```solidity
// ✅ SAFE: Verifiable randomness
function requestRandomness() external returns (uint256 requestId) {
    requestId = COORDINATOR.requestRandomWords(...);
}
```

## Review Checklist

```
□ Access control on sensitive functions
□ ReentrancyGuard on external calls
□ SafeERC20 for token transfers  
□ No hardcoded addresses (use immutable/constructor)
□ Events emitted for state changes
□ Input validation present
□ Integer overflow handled (Solidity 0.8+)
□ Return values checked
□ No tx.origin usage
□ No delegatecall to untrusted contracts
```

## Test Coverage Requirements

For approval, PRs should include tests for:
- Happy path scenarios
- Edge cases (zero values, max values)
- Revert conditions
- Access control enforcement
- Event emissions
