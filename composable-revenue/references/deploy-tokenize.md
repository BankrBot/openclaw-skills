# Deploy Token with Fee Tokenization

## Overview

Deploy new Clanker V4 tokens with automatic fee tokenization in a single transaction.

## Fee Collection Modes

| Mode | Description | When to Use |
|------|-------------|-------------|
| `WETH_ONLY` | Collect fees as WETH only | Want stable asset exposure |
| `TOKEN_ONLY` | Collect fees as your token | Want to accumulate your token |
| `BOTH` | Collect fees in both assets | Maximum flexibility |

## Contract

**V4 Tokenizer Factory**: `0xea8127533F7be6d04b3DBA8f0a496F2DCfd27728`

## Function

```solidity
function tokenizeAndDeployV4Clanker(
    DeploymentConfig calldata config,
    address[] calldata recipients
) external returns (address token, address vault)
```

## Parameters

```typescript
interface DeploymentConfig {
  name: string;           // Token name
  symbol: string;         // Token symbol (no $ prefix)
  image: string;          // Token image URL (optional)
  feePreference: number;  // 0=WETH, 1=TOKEN, 2=BOTH
}
```

## Example

```typescript
import { V4TokenizerFactory } from './abis';

const factory = new Contract(
  "0xea8127533F7be6d04b3DBA8f0a496F2DCfd27728",
  V4TokenizerFactory.abi,
  signer
);

const config = {
  name: "ClawdFans",
  symbol: "CLAWDFANS",
  image: "",
  feePreference: 0, // WETH_ONLY
};

const recipients = [userAddress]; // Who gets fee tokens

const tx = await factory.tokenizeAndDeployV4Clanker(
  config,
  recipients
);

const receipt = await tx.wait();
// Parse TokenDeployed and VaultCreated events
```

## Output

- **Token Address**: The deployed ERC20 token
- **Vault Address**: The fee vault holding tokenized fees
- **Fee Tokens**: Recipients receive fee share tokens (80/20 split)

## Fee Distribution

- **80%** to specified recipients
- **20%** to protocol treasury

## Next Steps

After deployment:
1. Add liquidity to token/WETH pool
2. Share token address
3. Set up fee strategies (wrappers, routing, automation)
