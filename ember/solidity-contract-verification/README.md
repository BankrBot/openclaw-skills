# Solidity Contract Verification

A Claude Code skill for verifying Solidity smart contracts on Etherscan, Basescan, and other block explorers using the Etherscan V2 Multichain API.

## Installation

```bash
# From BankrBot/moltbot-skills monorepo
npx skills add BankrBot/moltbot-skills/ember/solidity-contract-verification
```

## When to Use

- Contract deployed but shows "unverified" on block explorer
- Hardhat verify plugin failing with cryptic errors
- Need to verify contracts with complex inheritance
- Flattening source files for manual verification

## What's Covered

- Etherscan V2 API with single API key for 60+ chains
- Source code flattening and cleaning (removing Node.js warnings, duplicate pragmas)
- Constructor argument ABI-encoding
- Common chain IDs and license types
- Complete verification script template
- Troubleshooting common errors (bytecode mismatch, invalid constructor args, etc.)

## Key Insight

The `chainid` parameter must be in the URL query string, NOT in the POST body. This is a common source of verification failures.

## References

- [Etherscan V2 API Docs](https://docs.etherscan.io/)
- [Hardhat Verify Plugin](https://hardhat.org/hardhat-runner/plugins/nomicfoundation-hardhat-verify)
- [Solidity Compiler Versions](https://etherscan.io/solcversions)

## License

MIT
