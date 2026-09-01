# Bankr Response Patterns

Real examples of what Bankr returns for common operations. Use these to validate your parsing logic.

## Table of Contents
1. [Fee Claims](#fee-claims)
2. [Trades — Buy/Sell](#trades--buysell)
3. [Swaps](#swaps)
4. [Token Deployment](#token-deployment)
5. [Staking](#staking)
6. [Portfolio / Balance](#portfolio--balance)
7. [Failure Messages](#failure-messages)

---

## Fee Claims

### Fees claimed (single token)
```
Successfully claimed fees from your PROOFBOT token.

claimed: 0.0012 WETH / 11742.5 PROOFBOT

Transaction: https://basescan.org/tx/0xabc...
```

### Fees claimed (bulk, multiple tokens)
```
Claimed fees from 3 tokens:

• ZOOMER: 0.0008 WETH / 5,200 ZOOMER
• MATH: 0.0003 WETH / 1,100 MATH
• SELL: 0.0001 WETH / 800 SELL

Total: 0.0012 WETH + various tokens
```

### No fees to claim
```
You have no unclaimed fees at this time.
```
```
No fees available for this token.
```
```
Nothing to claim — fees are below the minimum threshold.
```

### Token not in Bankr system
```
This token was not found in the Bankr token launcher system. Fee claiming is only available for tokens deployed through Bankr.
```
```
This token wasn't launched via the bankr token launcher, so fees can't be claimed through this interface.
```

**Parsing note:** Amount pattern for claimed fees is `claimed: {N} {SYM} / {N} {SYM}` — always two amounts (ETH-side / token-side). Filter out pairs where `amount === 0`.

---

## Trades — Buy/Sell

### Buy confirmation
```
Successfully purchased 0.5 ETH for $1,820.45

Transaction confirmed on Base: https://basescan.org/tx/0xabc...
```
```
Bought 1,234.5 TOKEN for 0.05 ETH

tx: 0xdef...
```
```
Your purchase of 500 BNKR is confirmed. You paid approximately $4.25 USDC.
```

### Sell confirmation
```
Sold 500 BNKR for 0.012 ETH ($43.80)

Transaction: https://basescan.org/tx/0xghi...
```
```
Successfully sold your TOKEN position. Received 0.008 ETH.
```

### Detecting buy vs sell
```js
const isBuy  = text => /bought|purchased|acquiring|buy.*confirmed/i.test(text);
const isSell = text => /sold|selling|sell.*confirmed|disposed/i.test(text);
```

### Extracting token received from buy
```js
function tokensReceived(text) {
  // "Bought 1,234.5 TOKEN for" or "purchased 0.5 ETH"
  const m = text.match(/(?:bought|purchased|acquired)\s+([\d,]+\.?\d*)\s+([A-Z]{2,10})/i);
  return m ? { amount: parseFloat(m[1].replace(/,/g, '')), symbol: m[2].toUpperCase() } : null;
}
```

---

## Swaps

### Token → token swap
```
Swapped 100 USDC for 0.027 ETH

Rate: 1 ETH = $3,700
Transaction: https://basescan.org/tx/0xjkl...
```
```
Converted 0.01 ETH to 1,250 BNKR
```

### WETH wrap/unwrap
```
Wrapped 0.01 ETH → 0.01 WETH
Transaction: https://basescan.org/tx/0xmno...
```
```
Unwrapped 0.01 WETH → 0.01 ETH
```

### Parsing swap direction
```js
function parseSwap(text) {
  // Arrow notation: "X TOKEN → Y TOKEN"
  const arrow = text.match(/([\d,]+\.?\d*)\s+([A-Z]+)\s*(?:→|to)\s*([\d,]+\.?\d*)\s+([A-Z]+)/i);
  if (arrow) return {
    from: { amount: parseFloat(arrow[1].replace(/,/g, '')), symbol: arrow[2].toUpperCase() },
    to:   { amount: parseFloat(arrow[3].replace(/,/g, '')), symbol: arrow[4].toUpperCase() },
  };
  // "swapped X FROM for Y TO"
  const swapped = text.match(/swapped?\s+([\d,]+\.?\d*)\s+([A-Z]+)\s+for\s+([\d,]+\.?\d*)\s+([A-Z]+)/i);
  if (swapped) return {
    from: { amount: parseFloat(swapped[1].replace(/,/g, '')), symbol: swapped[2].toUpperCase() },
    to:   { amount: parseFloat(swapped[3].replace(/,/g, '')), symbol: swapped[4].toUpperCase() },
  };
  return null;
}
```

---

## Token Deployment

### Successful deployment
```
Your token has been deployed successfully!

Name: Vibe Check
Symbol: VIBE
Chain: Base
Contract: 0x1234...abcd

View on Basescan: https://basescan.org/token/0x1234...abcd
```

### Extracting contract address from deployment
```js
function extractContractAddress(text) {
  // "Contract: 0x..." or "contract address: 0x..."
  const m = text.match(/(?:contract|address)[:\s]+(0x[a-fA-F0-9]{40})/i);
  if (m) return m[1];
  // Fallback: any 40-char hex address (not a 64-char tx hash)
  const addrs = text.match(/0x[a-fA-F0-9]{40}\b/g) || [];
  return addrs.find(a => a.length === 42) || null;
}
```

**Note:** TX hashes are 66 chars (`0x` + 64 hex). Contract addresses are 42 chars (`0x` + 40 hex). Don't confuse them.

---

## Staking

### Stake confirmation
```
Successfully staked 100 BNKR.

Your BNKR is now earning staking rewards.
Transaction: https://basescan.org/tx/0xpqr...
```

### Parsing staked amount
```js
function parseStaked(text) {
  const m = text.match(/staked?\s+([\d,]+\.?\d*)\s+([A-Z]{2,10})/i);
  return m ? { amount: parseFloat(m[1].replace(/,/g, '')), symbol: m[2].toUpperCase() } : null;
}
```

---

## Portfolio / Balance

### Balance response
```
Your portfolio on Base:

• ETH: 0.024 ($87.60)
• USDC: 45.00
• BNKR: 1,250 ($10.63)

Total: ~$143.23
```

### Extracting total portfolio value
```js
function extractPortfolioTotal(text) {
  const m = text.match(/total[:\s~]*\$?([\d,]+\.?\d*)/i);
  return m ? parseFloat(m[1].replace(/,/g, '')) : null;
}
```

### Extracting individual token balance
```js
function extractTokenBalance(text, symbol) {
  const re = new RegExp(`${symbol}[:\\s]+([\d,]+\\.?\\d*)`, 'i');
  const m = text.match(re);
  return m ? parseFloat(m[1].replace(/,/g, '')) : null;
}
```

---

## Failure Messages

### Patterns and what they mean

| Response contains | Meaning | Retry? |
|---|---|---|
| `insufficient balance` / `insufficient funds` | Wallet too low | No — add funds first |
| `transaction failed` / `reverted` | On-chain failure | Maybe — check params |
| `slippage too high` / `slippage exceeded` | Price moved | Yes — retry or increase slippage |
| `token not found` | Wrong symbol/chain | No — fix params |
| `not found in.*bankr` | Not a Bankr-deployed token | Never — won't work |
| `job timed out` | Took too long | Maybe — may have executed, check on-chain |
| `rate limit exceeded` | Too many requests | Yes — wait 60s+ |
| `unauthorized` / `invalid api key` | Auth failure | No — fix key |
| `below.*minimum` | Amount too small | No — accumulate more first |

### Full failure detector
```js
const FAILURES = [
  /insufficient\s+(balance|funds|eth|sol|matic)/i,
  /transaction\s+(?:failed|reverted|rejected)/i,
  /slippage\s+(?:too high|exceeded|tolerance)/i,
  /token\s+not\s+found/i,
  /not found in.*bankr/i,
  /unauthorized|invalid.*api.*key/i,
  /rate\s+limit\s+exceeded/i,
  /job\s+(?:timed?\s*out|failed|errored)/i,
  /below.*minimum|too small for/i,
];

const isFailure = text => !text || FAILURES.some(p => p.test(text));
```

### Timeout vs failure — important distinction
A `null` response from `bankr()` means the process timed out, **not** that the transaction failed. The operation may have completed on-chain. Always:
1. Log that you got a timeout
2. Wait before retrying
3. If possible, verify on-chain separately
4. Never assume timeout = transaction failed
