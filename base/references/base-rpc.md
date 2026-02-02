# Base RPC Endpoints Reference

## Public RPC
- **URL:** `https://1rpc.io/base`
- **No API key required** for read operations

## Key Endpoints

### eth_blockNumber
Returns the latest block number.
```json
{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}
```

### eth_getBalance
Returns the balance of an address.
```json
{"jsonrpc":"2.0","method":"eth_getBalance","params":["0x...","latest"],"id":1}
```

### eth_gasPrice
Returns the current gas price in wei.
```json
{"jsonrpc":"2.0","method":"eth_gasPrice","params":[],"id":1}
```

### eth_getTransactionReceipt
Returns the receipt of a transaction by hash.
```json
{"jsonrpc":"2.0","method":"eth_getTransactionReceipt","params":["0x..."],"id":1}
```

### eth_call
Execute a call without creating a transaction (for contract reads).
```json
{"jsonrpc":"2.0","method":"eth_call","params":[{"to":"0x...","data":"0x..."},"latest"],"id":1}
```

## Token Addresses (Base Mainnet)
- **ETH:** Native token (no address)
- **USDC:** `0x833589fCD6eDb6E08f4c7C32D4f71b54bdD02913`
- **CBETH:** `0x2Ae3F1Ec7F1F5012CFEab0ac41f13631f1D4aEA8`
- **DAI:** `0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb`
