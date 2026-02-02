# Clanker SDK Reference

This document provides reference information for interacting with the Clanker protocol.

## Protocol Overview

Clanker is an ERC20 token deployment protocol on Base that creates tokens with integrated Uniswap V4 liquidity pools.

## Contract Addresses (Base Mainnet)

| Contract | Address | Description |
|----------|---------|-------------|
| ClankerFactory | `0x...` | Main factory for token deployment |
| ClankerToken | `0x...` | Token implementation |

**Note:** Contract addresses should be fetched dynamically from the network or Clanker documentation.

## Token Creation Flow

1. User calls `ClankerFactory.deployToken(name, symbol, initialLpEth)`
2. Factory creates new ERC20 token
3. Factory deploys Uniswap V4 pool with initial liquidity
4. User receives LP tokens and initial token supply

## ERC20 Token Interface

```solidity
interface IClankerToken {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}
```

## RPC Endpoints

### Mainnet
- `https://1rpc.io/base`
- `https://base-mainnet.public.blastapi.io`

### Testnet (Base Sepolia)
- `https://base-sepolia.public.blastapi.io`

## Block Explorers

- Base Mainnet: https://basescan.org
- Base Sepolia: https://sepolia.basescan.org

## Gas Estimation

Token deployments typically require:
- Base Mainnet: ~0.01 - 0.05 ETH gas (varies with network usage)
- Base Sepolia: Free (testnet)

## Common Operations via curl

### Get Token Info (ERC20 ABI)

```bash
curl -X POST https://1rpc.io/base \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "eth_call",
    "params": [
      {
        "to": "TOKEN_ADDRESS",
        "data": "0x06fdde03"  // name() selector
      },
      "latest"
    ],
    "id": 1
  }'
```

### Get Token Symbol

```bash
# data: 0x95d89b41 (symbol() selector)
```

### Get Total Supply

```bash
# data: 0x18160ddd (totalSupply() selector)
```

## Error Codes

| Code | Meaning |
|------|---------|
| `-32000` | Execution reverted (check reason) |
| `-32005` | Rate limit exceeded |
| `-32602` | Invalid params |

## Deployment Cost Breakdown

1. Token contract deployment: ~100k gas
2. Uniswap V4 pool deployment: ~300k gas
3. Initial liquidity provision: Variable (ETH + tokens)
4. Total: ~400k-500k gas + initial LP ETH

## Security Considerations

- Never expose private keys in code or logs
- Use hardware wallets for mainnet deployments
- Verify contract addresses before interacting
- Test on Sepolia before mainnet deployment
