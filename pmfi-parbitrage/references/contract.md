# PMFI pARBITRAGE contract reference

Vault:

0xd1ccbc2aa6e2f41817b62448089d4125e62df4fb

Chain:

Base mainnet, chainId 8453

USDC:

0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

## Deposit

User action:

deposit USDC into PMFI pARBITRAGE

Contract call:

requestDeposit(uint256 assets, address receiver)

Result:

PMFI processes after vault report and user receives pARB.

## Withdraw

User action:

withdraw pARB back to USDC

Contract call:

requestRedeem(uint256 shares, address receiver)

Result:

PMFI processes after vault report and available liquidity, then user receives USDC.
