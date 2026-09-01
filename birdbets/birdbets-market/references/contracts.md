# BirdBets Contracts

Fetch `https://birdbets.mykclawd.xyz/api/bankr/context` before using these values. The context endpoint is canonical if it differs from this file.

## Chain

- Chain: Base mainnet
- Chain ID: `8453`

## MYKCLAWD Token

- Symbol: `MYKCLAWD`
- Decimals: `18`
- Address: `0xE3C5FCfBfea42D5CE2492FD82c239B5503f17ba3`

## Market IDs

Market IDs use `YYYYMMDD` in the BirdBets timezone, for example `20260527`.

Prefer the `marketIds.today` and `marketIds.tomorrow` values from `/api/bankr/context`.

## ERC-20 ABI

```json
[
  {
    "type": "function",
    "name": "balanceOf",
    "stateMutability": "view",
    "inputs": [{ "name": "account", "type": "address" }],
    "outputs": [{ "name": "", "type": "uint256" }]
  },
  {
    "type": "function",
    "name": "allowance",
    "stateMutability": "view",
    "inputs": [
      { "name": "owner", "type": "address" },
      { "name": "spender", "type": "address" }
    ],
    "outputs": [{ "name": "", "type": "uint256" }]
  },
  {
    "type": "function",
    "name": "approve",
    "stateMutability": "nonpayable",
    "inputs": [
      { "name": "spender", "type": "address" },
      { "name": "value", "type": "uint256" }
    ],
    "outputs": [{ "name": "", "type": "bool" }]
  }
]
```

## Prediction Market ABI

```json
[
  {
    "type": "function",
    "name": "markets",
    "stateMutability": "view",
    "inputs": [{ "name": "marketId", "type": "uint256" }],
    "outputs": [
      { "name": "exists", "type": "bool" },
      { "name": "resolved", "type": "bool" },
      { "name": "date", "type": "string" },
      { "name": "threshold", "type": "uint256" },
      { "name": "yesPool", "type": "uint256" },
      { "name": "noPool", "type": "uint256" },
      { "name": "createdAt", "type": "uint256" },
      { "name": "bettingClosesAt", "type": "uint256" },
      { "name": "resolvedAt", "type": "uint256" },
      { "name": "actualVisits", "type": "uint256" },
      { "name": "winningSide", "type": "uint8" }
    ]
  },
  {
    "type": "function",
    "name": "oddsBps",
    "stateMutability": "view",
    "inputs": [{ "name": "marketId", "type": "uint256" }],
    "outputs": [
      { "name": "yesBps", "type": "uint256" },
      { "name": "noBps", "type": "uint256" }
    ]
  },
  {
    "type": "function",
    "name": "positions",
    "stateMutability": "view",
    "inputs": [
      { "name": "marketId", "type": "uint256" },
      { "name": "bettor", "type": "address" }
    ],
    "outputs": [
      { "name": "yesAmount", "type": "uint256" },
      { "name": "noAmount", "type": "uint256" },
      { "name": "claimed", "type": "bool" },
      { "name": "exists", "type": "bool" }
    ]
  },
  {
    "type": "function",
    "name": "betYes",
    "stateMutability": "nonpayable",
    "inputs": [
      { "name": "marketId", "type": "uint256" },
      { "name": "amount", "type": "uint256" }
    ],
    "outputs": []
  },
  {
    "type": "function",
    "name": "betNo",
    "stateMutability": "nonpayable",
    "inputs": [
      { "name": "marketId", "type": "uint256" },
      { "name": "amount", "type": "uint256" }
    ],
    "outputs": []
  }
]
```

## Market Tuple

`markets(marketId)` returns:

1. `exists`
2. `resolved`
3. `date`
4. `threshold`
5. `yesPool`
6. `noPool`
7. `createdAt`
8. `bettingClosesAt`
9. `resolvedAt`
10. `actualVisits`
11. `winningSide`

`winningSide` values:

- `0`: none
- `1`: YES
- `2`: NO
