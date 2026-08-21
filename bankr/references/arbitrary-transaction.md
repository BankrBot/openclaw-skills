# Arbitrary Transaction Reference

Submit raw EVM transactions with explicit calldata, call or read any contract, and deploy and verify contracts — on any supported EVM chain.

## Supported Chains

| Chain | Chain ID | Slug |
|-------|----------|------|
| Ethereum | 1 | `mainnet` |
| Unichain | 130 | `unichain` |
| Polygon | 137 | `polygon` |
| World Chain | 480 | `worldchain` |
| BNB Chain | 56 | `bnb` |
| Base | 8453 | `base` |
| Arbitrum | 42161 | `arbitrum` |
| Robinhood Chain | 4663 | `robinhood` |

## JSON Format

```json
{
  "to": "0x...",
  "data": "0x...",
  "value": "0",
  "chainId": 8453
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `to` | string | Yes | Target contract address (0x + 40 hex chars) |
| `data` | string | Yes | Calldata to execute (0x + hex string, or "0x" for empty) |
| `value` | string | Yes | Amount in wei (e.g., "0", "1000000000000000000" for 1 ETH) |
| `chainId` | number | Yes | Target chain ID from the table above |

## Validation Rules

| Field | Validation |
|-------|------------|
| `to` | Must be 0x followed by exactly 40 hex characters |
| `data` | Must start with 0x, can be "0x" for empty calldata |
| `value` | Wei amount as string, use "0" for no value transfer |
| `chainId` | Must be one of the supported chain IDs above |

## Prompt Examples

**Submit a raw transaction:**
```
Submit this transaction:
{
  "to": "0x1234567890abcdef1234567890abcdef12345678",
  "data": "0xa9059cbb000000000000000000000000recipient00000000000000000000000000000000000000000000000000000000000f4240",
  "value": "0",
  "chainId": 8453
}
```

**Execute calldata on a contract:**
```
Execute this calldata on Base:
{
  "to": "0xContractAddress...",
  "data": "0xFunctionSelector...",
  "value": "0",
  "chainId": 8453
}
```

**Send ETH with calldata:**
```
Submit transaction with value:
{
  "to": "0xRecipientAddress...",
  "data": "0x",
  "value": "1000000000000000000",
  "chainId": 1
}
```

**ERC-20 transfer via calldata:**
```
Submit this ERC-20 transfer:
{
  "to": "0xTokenContractAddress...",
  "data": "0xa9059cbb000000000000000000000000...",
  "value": "0",
  "chainId": 8453
}
```

## Common Issues

| Issue | Resolution |
|-------|------------|
| Unsupported chain | Use one of the chain IDs in the table above |
| Invalid address | Ensure 0x + 40 hex chars |
| Invalid calldata | Ensure proper hex encoding with 0x prefix |
| Transaction reverted | Check calldata encoding and contract state |
| Insufficient funds | Ensure wallet has enough ETH/MATIC for gas + value |
| Signature won't encode (`tuple`) | Struct parameters must be written in parenthesized form — `mint((address,uint256) params)`, not `mint(tuple params)`. Signatures Bankr reads off a contract's ABI already come back expanded; when you write one from memory and encoding fails, the error includes the corrected form |

## Reading a Contract's ABI

Ask Bankr for an unknown contract's ABI and it returns human-readable function signatures you can pass straight to a read or write call. Struct (tuple) parameters and return values are recursively expanded into the parenthesized form the encoder accepts, and every generated signature is round-tripped through the parser before being offered — so a struct-taking function like a Uniswap V4 position mint encodes on the first attempt rather than failing as the literal keyword `tuple`.

## Deploying a Contract

Bankr can deploy a contract from **compiled creation bytecode** and then verify its source on block explorers.

**What you supply:** the creation bytecode (`initCode`) with any constructor arguments **already ABI-encoded and appended**, the chain, and optionally a 32-byte CREATE2 salt. Bankr does not compile Solidity and does not encode constructor arguments for you — bring ready-to-deploy bytecode.

```
Deploy this on Base: 0x60806040...
Deploy this bytecode on Base with salt 0x00...2a
```

**How it deploys, and why that matters:**

- Deployment goes through the canonical deterministic **CREATE2 proxy** (`0x4e59…4956c`, the same address on every chain). The deployed address is therefore **deterministic and known before broadcasting**.
- Because the proxy is the deployer, **`msg.sender` inside your constructor is the proxy, not your wallet.** A constructor that assigns ownership or mints an initial supply to `msg.sender` gives those to the proxy. Prefer contracts that take the owner/recipient as an explicit constructor argument, and check this before deploying anything whose constructor may rely on `msg.sender`.
- **Deploys carry no native value** — there is no `value` field, so a payable constructor needs a different flow.
- A colliding salt (an address already taken) and a chain missing the CREATE2 proxy are both caught **before** broadcasting, so you don't pay for a failed transaction or get a "successful" deploy that deployed nothing.
- This is **not** for token launches — use the token deployment flow (`deploy_erc20_token` / `bankr launch`) for those. See [token-deployment.md](token-deployment.md).
- Bankr never sponsors gas for these deploys, and the same guards as every other arbitrary-transaction tool apply: the arbitrary-contract-calls kill switch, the Blockaid scan, wallet-safety preflight, and any recipient allowlist on your API key (which must include the CREATE2 proxy address for a recipient-scoped key to deploy).

## Verifying a Contract

Verify a deployed contract's source on **Etherscan v2 and Blockscout**. The explorer recompiles and matches against the on-chain bytecode, so it needs the exact inputs used at deploy time:

- The exact source
- The **long** compiler version (e.g. `v0.8.24+commit.e11b9ed9`)
- Optimizer settings
- ABI-encoded constructor arguments

```
Verify the contract I just deployed at 0x... on Base
```

A freshly deployed contract may need a few blocks to be indexed, so a `pending` or "unable to verify" result shortly after deployment is usually worth retrying rather than a real failure. Verification is an off-chain write — it broadcasts no transaction and needs no recipient allowlist, but it does require a read-write API key.

## Use Cases

- **Contract deployment** - Deploy compiled bytecode and verify its source
- **Custom contract interactions** - Call any function on any contract
- **Pre-built calldata execution** - Execute calldata generated by other tools
- **Advanced DeFi operations** - Complex multi-step transactions
- **Protocol integrations** - Interact with protocols not yet natively supported

## Best Practices

1. **Verify calldata** - Double-check encoding before submission
2. **Test on testnet first** - If possible, test transactions on testnets
3. **Start with zero value** - Test contract calls without sending ETH first
4. **Check gas estimates** - Ensure sufficient balance for gas costs
5. **Verify contract addresses** - Confirm target address is correct

## Security Notes

- **Irreversible** - Blockchain transactions cannot be undone
- **Verify everything** - Calldata determines exactly what happens
- **Trust the source** - Only execute calldata from trusted sources
- **Check value field** - Ensure you're not sending unintended ETH
- **Contract verification** - Confirm the target contract is legitimate
