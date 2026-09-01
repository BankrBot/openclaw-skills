# Single-Sided Liquidity

Deposit a single token into an auto-managed strategy on Hydrex to earn oHYDX yields and provide deep pool liquidity — without needing to supply both sides of a pair.

**Vault Deposit Guard:** `0x9A0EBEc47c85fD30F1fdc90F57d2b178e84DC8d8` (Base)
**Vault Deployer:** `0x7d11De61c219b70428Bb3199F0DD88bA9E76bfEE` (Base)

## How It Works

1. You deposit a single asset (e.g., 100% BNKR)
2. An automated liquidity manager handles the position — no need to balance both sides yourself
3. You earn oHYDX yield on your deposited value
4. On withdrawal, you receive your position back as a mix of the deposit token and counter token — typically up to 70/30 by value (e.g., roughly 70% BNKR and 30% WETH), depending on where the price sits relative to when you entered
5. The strategy address is per-pair; get all available strategies from the API

**Note on displayed values**: APR, USD balances, and TVL figures from the API are estimates based on recent activity. They're useful for comparing strategies directionally but will shift as market conditions change. As with any liquidity position, token price movements relative to each other can affect the mix you receive on withdrawal.

## Discovering Opportunities

All single-sided strategies are available from:

```
https://api.hydrex.fi/strategies?strategist=ichi
```

Filter by deposit token address:

```
https://api.hydrex.fi/strategies?strategist=ichi&depositTokens=TOKEN_ADDRESS,TOKEN_ADDRESS
```

**Example — find BNKR deposit opportunities:**

```bash
bankr agent "What single-sided liquidity vaults can I deposit BNKR into on Hydrex?"
```

The API fetches from: `https://api.hydrex.fi/strategies?strategist=ichi&depositTokens=0x22af33fe49fd1fa80c7149773dde5890d3c76f3b`

**Key API fields per strategy:**

| Field | Description |
|-------|-------------|
| `address` | Vault address (used for deposit, withdraw, and balance calls) |
| `title` | `"DEPOSIT/COUNTER"` format — e.g., `"BNKR/WETH"` means deposit BNKR |
| `depositToken` | Address of the token you deposit |
| `childAPR` | Current average APR in oHYDX for depositors |
| `lpPriceUsd` | USD value per LP share |
| `tvlUsd` | Total value locked in this vault |

**Note**: Not all tokens have single-sided strategies. If you'd like a strategy for a specific token, reach out to the Hydrex team on [Discord](https://discord.gg/hydrexfi) or [Telegram](https://t.me/larrettgee).

## Depositing

### Natural Language

Always specify the strategy by title (e.g., `"BNKR/WETH"`) or vault address so Bankr can unambiguously resolve which vault to use.

```bash
bankr agent "Deposit 100 BNKR into the BNKR/WETH strategy on Hydrex"
bankr agent "Deposit 500 USDC into the USDC/HYDX strategy on Hydrex"
bankr agent "Deposit 1000 HYDX into vault 0xABC...123 on Hydrex"
```

### Steps Bankr Executes

1. **Resolve vault** — match the strategy by `title` (e.g., `"BNKR/WETH"`) or `address` from `https://api.hydrex.fi/strategies?strategist=ichi`; if ambiguous, ask the user to confirm the strategy title or address before proceeding
2. **Check allowance**: `allowance(userAddress, DEPOSIT_GUARD)` on the deposit token contract
3. **Approve if needed**: `approve(DEPOSIT_GUARD, amount)` on the deposit token
4. **Deposit**: call `forwardDepositToICHIVault` on Deposit Guard

### Deposit

**Function**: `forwardDepositToICHIVault(address vault, address vaultDeployer, address token, uint256 amount, uint256 minimumShares, address userAddress)`
**Contract**: `0x9A0EBEc47c85fD30F1fdc90F57d2b178e84DC8d8` (Deposit Guard, Base)

```
Send transaction to 0x9A0EBEc47c85fD30F1fdc90F57d2b178e84DC8d8 on Base calling forwardDepositToICHIVault with vault [VAULT_ADDRESS], vaultDeployer 0x7d11De61c219b70428Bb3199F0DD88bA9E76bfEE, token [DEPOSIT_TOKEN_ADDRESS], amount [AMOUNT_IN_WEI], minimumShares 0, userAddress [USER_ADDRESS]
```

**Parameters:**
| Parameter | Value |
|-----------|-------|
| `vault` | From API `address` field |
| `vaultDeployer` | `0x7d11De61c219b70428Bb3199F0DD88bA9E76bfEE` (always) |
| `token` | Deposit token address (from API `depositToken`) |
| `amount` | Amount in wei (18 decimals for most tokens, 6 for USDC) |
| `minimumShares` | `0` (acceptable for most cases; use slippage calc for large deposits) |
| `userAddress` | User's wallet address |

**Result**: User receives LP shares (vault tokens) minted to `userAddress`.

## Withdrawing

### Natural Language

```bash
bankr agent "Withdraw my BNKR/WETH single-sided position on Hydrex"
bankr agent "Remove 50% of my BNKR single-sided liquidity on Hydrex"
bankr agent "Exit my Hydrex BNKR vault position"
```

### Steps Bankr Executes

1. **Get LP balance**: `balanceOf(userAddress)` on the vault contract
2. **Check LP allowance**: `allowance(userAddress, DEPOSIT_GUARD)` on the vault contract
3. **Approve LP if needed**: `approve(DEPOSIT_GUARD, shares)` on the vault contract
4. **Withdraw**: call `forwardWithdrawFromICHIVault` on Deposit Guard

### Withdraw Call

**Function**: `forwardWithdrawFromICHIVault(address vault, address vaultDeployer, uint256 shares, address userAddress, uint256 minAmount0, uint256 minAmount1)`
**Contract**: `0x9A0EBEc47c85fD30F1fdc90F57d2b178e84DC8d8` (Deposit Guard, Base)

```
Send transaction to 0x9A0EBEc47c85fD30F1fdc90F57d2b178e84DC8d8 on Base calling forwardWithdrawFromICHIVault with vault [VAULT_ADDRESS], vaultDeployer 0x7d11De61c219b70428Bb3199F0DD88bA9E76bfEE, shares [LP_SHARES], userAddress [USER_ADDRESS], minAmount0 0, minAmount1 0
```

**Parameters:**
| Parameter | Value |
|-----------|-------|
| `vault` | Vault address (from API `address` or user's existing position) |
| `vaultDeployer` | `0x7d11De61c219b70428Bb3199F0DD88bA9E76bfEE` (always) |
| `shares` | LP token balance from `balanceOf` (partial withdrawals: multiply by fraction) |
| `userAddress` | User's wallet address |
| `minAmount0` | `0` (or calculate slippage on token0) |
| `minAmount1` | `0` (or calculate slippage on token1) |

**Result**: User receives both token0 and token1 from the vault (up to 70/30 deposit/counter split depending on vault position).

## Viewing Your Position

### Natural Language

The deposit token is the key input for finding a position — without it, there's no efficient way to look up vaults. Encourage prompts like **"check my deposit for [TOKEN]"** rather than open-ended ones.

**Good prompts (specify the deposit token):**

```bash
bankr agent "Check my Hydrex deposit for BNKR"
bankr agent "What's my BNKR/WETH vault balance on Hydrex?"
bankr agent "How much is my Hydrex USDC single-sided position worth?"
```

**Vague prompts (require a follow-up):**

If a user asks something like `"What are my Hydrex deposits?"` or `"Show my Hydrex single-sided positions"`, **ask them which deposit token(s) to check** before proceeding. The API requires a `depositTokens` filter — there's no global "list all my positions across every strategy" endpoint without iterating every supported token.

Suggested clarification:

> "Which deposit token(s) should I check? For example: BNKR, USDC, WETH, HYDX. You can say 'check my deposit for BNKR' to look up a specific one."

### Checking Balance and USD Value

The simplest way to value a position: get your LP share balance on-chain, then multiply by `lpPriceUsd` from the API.

**Step 1 — Find the strategy in the API**

Query by deposit token:

```
GET https://api.hydrex.fi/strategies?depositTokens=0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b
```

The response is an array of strategies for that deposit token. Locate the one you want by `title` (e.g., `"BNKR/WETH"`):

```json
{
  "address": "0xed14CC089C687695565079E816fBAd4132BcaccE",
  "title": "BNKR/WETH",
  "depositToken": "0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b",
  "lpPriceUsd": 1.2955258547,
  "totalSupply": 6917.17573045859,
  "totalSupplyRaw": "6917175730458589475992",
  "tvlUsd": 8961.38,
  "childApr": 97.86172988601074,
  "rawTotal0": "15550864461774049747853445",
  "rawTotal1": "1082559751422063922",
  "type": "Single Sided"
}
```

**Step 2 — Grab the vault `address`** from that object.

**Step 3 — Query `balanceOf(userAddress)` on the vault**

**Function**: `balanceOf(address)` — selector `0x70a08231`
**Contract**: Vault `address` from Step 2

Encode the user address as 32-byte padded hex (strip `0x`, left-pad with 24 zeros) and `eth_call` the vault. Returns `uint256` raw LP shares (18 decimals).

**Step 4 — Normalize and value**

```
userShares = rawBalance / 1e18              # Vault LP tokens are 18 decimals
positionUsd = userShares × lpPriceUsd
```

**Example:** If `balanceOf` returns `5000000000000000000000` (raw) on the BNKR/WETH vault:
- `userShares = 5000` (after dividing by 1e18)
- `positionUsd = 5000 × 1.2955258547 ≈ $6,477.63`

### Breaking Down Underlying Tokens (Optional)

If you need to know how many of each underlying token your position represents (not just total USD), use the on-chain `getTotalAmounts()` call or the API's `rawTotal0` / `rawTotal1` fields:

```
userToken0 = (userShares × rawTotal0) / totalSupplyRaw
userToken1 = (userShares × rawTotal1) / totalSupplyRaw
```

Where `userShares` is the **raw** LP balance from `balanceOf` (don't normalize first when using `totalSupplyRaw`).

Alternatively, query `getTotalAmounts()` on-chain (selector returns `(uint256 totalToken0, uint256 totalToken1)`) for live totals instead of API-cached values.

## Function Reference

| Function | Contract | Parameters | Returns |
|----------|----------|------------|---------|
| `forwardDepositToICHIVault(address,address,address,uint256,uint256,address)` | Deposit Guard | vault, vaultDeployer, token, amount, minShares, user | — |
| `forwardWithdrawFromICHIVault(address,address,uint256,address,uint256,uint256)` | Deposit Guard | vault, vaultDeployer, shares, user, min0, min1 | — |
| `balanceOf(address)` | Vault | user address | uint256 LP shares |
| `totalSupply()` | Vault | — | uint256 total shares |
| `getTotalAmounts()` | Vault | — | (uint256 token0, uint256 token1) |
| `allowance(address,address)` | Token / Vault | owner, spender | uint256 |
| `approve(address,uint256)` | Token / Vault | spender, amount | bool |

## Contracts (Base Mainnet)

| Contract | Address |
|----------|---------|
| Vault Deposit Guard | `0x9A0EBEc47c85fD30F1fdc90F57d2b178e84DC8d8` |
| Vault Deployer | `0x7d11De61c219b70428Bb3199F0DD88bA9E76bfEE` |

Vault addresses are per-pair — always retrieve from `https://api.hydrex.fi/strategies?strategist=ichi` (`address` field).

## Complete Workflow Examples

### Deposit BNKR into BNKR/WETH Vault

```bash
# 1. Find available BNKR vaults
bankr agent "What single-sided liquidity vaults can I deposit BNKR into on Hydrex?"

# 2. Check BNKR balance
bankr agent "What's my BNKR balance on Base?"

# 3. Deposit
bankr agent "Deposit 500 BNKR into the BNKR/WETH single-sided vault on Hydrex"

# 4. Confirm position
bankr agent "Show my Hydrex single-sided liquidity positions"
```

### Withdraw from BNKR/WETH Vault

```bash
# 1. Check current position
bankr agent "What's my BNKR/WETH vault balance on Hydrex?"

# 2. Full withdrawal
bankr agent "Withdraw my full BNKR/WETH single-sided position on Hydrex"

# 3. Partial withdrawal
bankr agent "Withdraw 25% of my BNKR single-sided position on Hydrex"
```

## Implementation Guide for Bankr

When a user requests single-sided liquidity operations:

### Resolving the Vault

1. Fetch strategies: `GET https://api.hydrex.fi/strategies?strategist=ichi`
2. Match by user intent:
   - By name: `title == "BNKR/WETH"` (first token = deposit token)
   - By token: `depositToken == userSpecifiedTokenAddress`
   - List all: return all strategies with `childAPR`, `tvlUsd`, `title`
3. Extract `address` (vault) and `depositToken` for the selected strategy

### Deposit Flow

```
1. GET https://api.hydrex.fi/strategies?strategist=ichi → find vault
2. eth_call allowance(userAddress, 0x9A0EBEc47c85fD30F1fdc90F57d2b178e84DC8d8) on depositToken
3. If allowance < amount:
     approve(0x9A0EBEc47c85fD30F1fdc90F57d2b178e84DC8d8, amount) on depositToken
4. forwardDepositToICHIVault(vault, 0x7d11De61c219b70428Bb3199F0DD88bA9E76bfEE, depositToken, amount, 0, userAddress)
   on Deposit Guard 0x9A0EBEc47c85fD30F1fdc90F57d2b178e84DC8d8
```

### Withdraw Flow

```
1. eth_call balanceOf(userAddress) on vault → get LP shares
2. eth_call allowance(userAddress, 0x9A0EBEc47c85fD30F1fdc90F57d2b178e84DC8d8) on vault
3. If allowance < shares:
     approve(0x9A0EBEc47c85fD30F1fdc90F57d2b178e84DC8d8, shares) on vault
4. forwardWithdrawFromICHIVault(vault, 0x7d11De61c219b70428Bb3199F0DD88bA9E76bfEE, shares, userAddress, 0, 0)
   on Deposit Guard 0x9A0EBEc47c85fD30F1fdc90F57d2b178e84DC8d8
```

### View Position Flow

**For total USD value (recommended):**

```
1. GET https://api.hydrex.fi/strategies?depositTokens=<DEPOSIT_TOKEN_ADDRESS>
2. Find target strategy in the response array by title (e.g., "BNKR/WETH")
3. Extract vault `address` and `lpPriceUsd` from the matched object
4. eth_call balanceOf(userAddress) on vault → rawShares
5. userShares = rawShares / 1e18
   positionUsd = userShares × lpPriceUsd
```

**For underlying token breakdown:**

```
1. Steps 1-4 above to get rawShares, plus pull `totalSupplyRaw`, `rawTotal0`, `rawTotal1` from the API object
2. userToken0 = (rawShares × rawTotal0) / totalSupplyRaw
   userToken1 = (rawShares × rawTotal1) / totalSupplyRaw
   (or eth_call getTotalAmounts() / totalSupply() on the vault for live values)
```

## Tips

- **Partial withdrawals**: Multiply LP balance by the fraction to withdraw (e.g., 50% = `shares / 2`)
- **Slippage**: `minimumShares = 0` and `minAmount0/1 = 0` is acceptable for most users; for large positions consider calculating 1% slippage
- **Token ordering**: `title` format is always `"DEPOSIT/COUNTER"` — the first token is what you put in
- **APR**: `childAPR` is the oHYDX yield; actual returns also include trading fees from the pool
- **IL risk**: Wider price swings between the two tokens = larger impermanent loss potential
- **No strategy for your token?** Contact Hydrex on [Discord](https://discord.gg/hydrexfi) or [Telegram](https://t.me/larrettgee)
