# Smart Contract Reference

## Contract Overview

The Spraay contract is a batch payment dispatcher on Base. It accepts a list of recipients and amounts, distributes funds in a single transaction, and collects a 0.3% protocol fee.

## Contract Address

- **Base Mainnet**: `0x1646452F98E36A3c9Cfc3eDD8868221E207B5eEC`
- **Base Sepolia (testnet)**: See deployment guide for testnet setup

## ABI Summary

### sprayETH

```solidity
function sprayETH(
    SprayRecipient[] calldata recipients
) external payable

struct SprayRecipient {
    address recipient;
    uint256 amount;
}
```

Sends ETH to multiple recipients. `msg.value` must equal sum of all amounts plus the 0.3% protocol fee.

### sprayToken

```solidity
function sprayToken(
    address token,
    SprayRecipient[] calldata recipients
) external
```

Sends ERC-20 tokens to multiple recipients. Caller must have approved the Spraay contract to spend `totalAmount + fee` tokens beforehand.

### Read Functions

```solidity
function owner() external view returns (address)
function paused() external view returns (bool)
function protocolFeePercent() external view returns (uint256)  // Returns 30 (basis points)
function collectedFees(address token) external view returns (uint256)
```

## Events

```solidity
event SprayETH(address indexed sender, uint256 totalAmount, uint256 fee, uint256 recipientCount);
event SprayToken(address indexed sender, address indexed token, uint256 totalAmount, uint256 fee, uint256 recipientCount);
```

## Security Features

- **ReentrancyGuard**: Prevents reentrancy attacks on ETH transfers
- **Pausable**: Owner can pause contract in emergencies
- **Input Validation**: Checks for zero addresses, zero amounts, empty arrays
- **Overflow Protection**: Solidity 0.8+ built-in overflow checks

## Building Calldata for Bankr

To submit a Spraay transaction through Bankr's arbitrary transaction system:

### ETH Spray Calldata

```javascript
// Using ethers.js
const iface = new ethers.Interface(SPRAAY_ABI);
const recipients = [
    { recipient: "0xAAA...", amount: ethers.parseEther("0.1") },
    { recipient: "0xBBB...", amount: ethers.parseEther("0.2") },
];
const totalAmount = recipients.reduce((sum, r) => sum + r.amount, 0n);
const fee = (totalAmount * 30n) / 10000n;

const calldata = iface.encodeFunctionData("sprayETH", [recipients]);

// Submit via Bankr
const bankrPrompt = `Submit this transaction: {
    to: "${SPRAAY_CONTRACT}",
    data: "${calldata}",
    value: ${(totalAmount + fee).toString()},
    chainId: 8453
}`;
```

### ERC-20 Spray Calldata

```javascript
// Step 1: Approve (if needed)
const approveCalldata = tokenIface.encodeFunctionData("approve", [
    SPRAAY_CONTRACT,
    totalAmount + fee
]);

// Step 2: Spray
const sprayCalldata = iface.encodeFunctionData("sprayToken", [
    TOKEN_ADDRESS,
    recipients
]);

// Submit via Bankr as two transactions
```

## Deployment Info

- **Compiler**: Solidity ^0.8.20
- **Framework**: Hardhat
- **Dependencies**: OpenZeppelin Contracts (ReentrancyGuard, Pausable, Ownable)
- **Chain**: Base (chainId: 8453)
- **Gas Optimization**: Uses `calldata` for arrays, minimal storage writes
