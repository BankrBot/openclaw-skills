# Odyssey $ROBIN Staking — Contract Reference

Robinhood Chain mainnet · chainId **4663**

## Addresses

```
ROBIN   = 0xfB4729659eeF22Bfc1c2B680F6F873f8147aaaab  (6 decimals)
STAKING = 0x9047DCAB97C2CfE20955f6b3Ff7438788AD02a86  (OFunStaking)
```

## Function selectors

| Function | Selector |
|----------|----------|
| `approve(address,uint256)` | `0x095ea7b3` |
| `balanceOf(address)` | `0x70a08231` |
| `allowance(address,address)` | `0xdd62ed3e` |
| `stake(uint256)` | `0xa694fc3a` |
| `unstake(uint256)` | `0x2e17de78` |
| `claim()` | `0x4e71d92d` |
| `exit()` | `0xe9fad8ee` |
| `pending(address)` | `0x5eebea20` |
| `totalStaked()` | `0x817b1cd2` |
| `users(address)` | `0xa87430ba` |

## Calldata encoding

All dynamic args are 32-byte left-padded hex (no `0x` in the padded segments).

### approve(spender, amount) on $ROBIN

```
0x095ea7b3
  0000000000000000000000009047dcab97c2cfe20955f6b3ff7438788ad02a86
  <amount_uint256_32bytes>
```

### stake(amount) on STAKING

```
0xa694fc3a
  <amount_uint256_32bytes>
```

### unstake(amount) on STAKING

```
0x2e17de78
  <amount_uint256_32bytes>
```

### claim() / exit()

```
0x4e71d92d   # claim — no args
0xe9fad8ee   # exit — no args
```

### pending(user) view

```
0x5eebea20
  <user_address_32bytes>
```

## Amount helpers

$ROBIN uses **6 decimals**:

```
raw = human_amount * 1_000_000
```

Examples:
- 500 ROBIN → `500000000`
- 1.5 ROBIN → `1500000`

ETH rewards use **18 decimals** when decoding `pending()` results.

## Bankr submit template

```json
{
  "transaction": {
    "to": "0x9047DCAB97C2CfE20955f6b3Ff7438788AD02a86",
    "chainId": 4663,
    "value": "0",
    "data": "0xa694fc3a0000000000000000000000000000000000000000000000000000000003b9aca00"
  },
  "description": "Stake 1000 ROBIN on Odyssey pool",
  "waitForConfirmation": true
}
```

(`0x3b9aca00` = 1,000,000,000 = 1000 ROBIN)

## ABI (minimal)

```solidity
interface IERC20Robin {
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

interface OFunStaking {
    function stake(uint256 amount) external;
    function unstake(uint256 amount) external;
    function claim() external returns (uint256);
    function exit() external;
    function pending(address u) external view returns (uint256);
    function users(address u) external view returns (uint256 amount, uint256 rewardDebt, uint256 accrued);
    function totalStaked() external view returns (uint256);
    function stakeToken() external view returns (address);
}
```