---
name: aerodrome
description: Interact with Aerodrome Finance on Base — the leading Velodrome-style DEX. Use when the user wants to swap tokens on Base via Aerodrome, view or manage Aerodrome liquidity positions, deposit or withdraw liquidity into Aerodrome pools, stake or unstake LP tokens in Aerodrome gauges, or claim AERO emissions and trading fees. Prefer this skill over generic swap tools when the user explicitly mentions Aerodrome, AERO, or Aerodrome LP positions.
tags: [defi, trading, base, dex, liquidity, lp, staking, aerodrome, aero]
version: 1
visibility: public
metadata:
  clawdbot:
    emoji: 🛫
    homepage: https://aerodrome.finance
    requires:
      bins: [python3, bankr, uvx]
---

# Aerodrome Finance

Aerodrome is the main Velodrome-style DEX on Base. This skill uses the Sugar SDK CLI to build unsigned Aerodrome transaction calldata and submits it through the Bankr Submit API.

**Chain:** Base mainnet only (chainId `8453`).

> [!IMPORTANT]
> Before running any command that submits a transaction, confirm the user's intent and the amounts involved. Always show the Sugar CLI output (pool data, quote, positions) to the user before submitting.

---

## Safety Rules

- Never ask for or use a private key.
- Submit transactions only through `scripts/aerodrome.py`, which routes through the Bankr Submit API.
- If slippage exceeds 5%, warn the user and ask for explicit confirmation before proceeding.
- If slippage exceeds 20%, refuse to submit without the user re-entering the exact number.

---

## Quick Start

All operations go through a single script. Run it via `execute_cli`:

```bash
python3 scripts/aerodrome.py <command> [args...]
```

The script automatically reads your Bankr API key from `~/.bankr/config.json` and fetches your wallet address.

---

## Commands

### View Positions

List all current Aerodrome LP positions for the Bankr wallet:

```bash
python3 scripts/aerodrome.py positions
```

This is read-only — it prints JSON position data and does not submit any transaction.

### Pool Discovery

Find pools for a token pair before depositing or swapping:

```bash
# WETH / USDC pools
python3 scripts/aerodrome.py pools \
  --token0=0x4200000000000000000000000000000000000006 \
  --token1=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --limit=5
```

This is read-only — it prints pool JSON and does not submit any transaction.

### Swap

Swap native ETH to USDC:

```bash
python3 scripts/aerodrome.py swap \
  --from-token=ETH \
  --to-token=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --amount=0.01 \
  --use-decimals
```

Swap USDC to AERO:

```bash
python3 scripts/aerodrome.py swap \
  --from-token=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --to-token=0x940181a94A35A4569E4529A3CDfB74e38FD98631 \
  --amount=5 \
  --use-decimals
```

- `--amount` is in human-readable units (e.g., `0.01` ETH, `5` USDC).
- Default slippage is 1%. Override with `--slippage=0.02` (2%).
- Use token addresses, not symbols, for USDC and AERO to avoid ambiguity.

### Deposit Liquidity

Deposit into an existing pool by pool address:

```bash
python3 scripts/aerodrome.py deposit \
  --pool=0xcDAC0d6c6C59727a65F871236188350531885C43 \
  --amount0=0.001 \
  --use-decimals
```

Deposit into a derived pool by token pair:

```bash
python3 scripts/aerodrome.py deposit \
  --token0=0x4200000000000000000000000000000000000006 \
  --token1=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --pool-type=volatile \
  --amount0=0.001 \
  --amount1=3 \
  --use-decimals
```

Deposit calldata includes a deadline (default 30 min). Submit promptly and rebuild calldata if the user waits too long.

### Withdraw Liquidity

Withdraw a fraction of an LP position:

```bash
python3 scripts/aerodrome.py withdraw \
  --pool=0xcDAC0d6c6C59727a65F871236188350531885C43 \
  --fraction=0.5
```

`--fraction=1.0` withdraws everything.

### Stake LP Tokens

Stake LP tokens in the Aerodrome gauge to earn AERO emissions:

```bash
python3 scripts/aerodrome.py stake \
  --pool=0xcDAC0d6c6C59727a65F871236188350531885C43
```

### Unstake LP Tokens

Unstake LP tokens from the gauge:

```bash
python3 scripts/aerodrome.py unstake \
  --pool=0xcDAC0d6c6C59727a65F871236188350531885C43
```

### Claim AERO Emissions

Claim pending AERO emissions from a gauge:

```bash
python3 scripts/aerodrome.py claim-emissions \
  --pool=0xcDAC0d6c6C59727a65F871236188350531885C43
```

### Claim Trading Fees

Claim accrued trading fees (LP must be unstaked first):

```bash
python3 scripts/aerodrome.py claim-fees \
  --pool=0xcDAC0d6c6C59727a65F871236188350531885C43
```

---

## Slippage Reference

| Value | Level | Action |
|-------|-------|--------|
| ≤ 1% | Normal | Proceed |
| > 1% and ≤ 5% | Elevated | Mention and confirm |
| > 5% and ≤ 20% | High | Warn and require confirmation |
| > 20% | Very high | Refuse without explicit re-confirmation |

---

## Key Addresses

See [references/tokens-and-contracts.md](references/tokens-and-contracts.md) for Base token addresses and Aerodrome contract addresses.

---

## How It Works

1. The script reads `~/.bankr/config.json` for the Bankr API key.
2. It fetches the Bankr wallet address from `GET https://api.bankr.bot/agent/balances?chains=base`.
3. It runs the Sugar SDK CLI via `uvx` to build unsigned calldata (`--chain=8453`, `--wallet=<address>`).
4. It normalizes Sugar's JSON output and submits each transaction in order via `POST https://api.bankr.bot/agent/submit`.
5. Transactions are submitted with `waitForConfirmation: true`.

If `uvx` fails on first run due to cache directory permissions, it retries with `UV_TOOL_DIR=/tmp/uv-tools` and `UV_CACHE_DIR=/tmp/uv-cache`.

## RPC Configuration

The script defaults to `https://mainnet.base.org`. For heavy operations like `positions` or `deposit`, set a reliable RPC:

```bash
export SUGAR_RPC_URI_8453=<your-rpc-url>
python3 scripts/aerodrome.py positions
```

If you have an Alchemy or QuickNode key, use that endpoint to avoid rate-limit errors on `positions` and `deposit`.

## Common Errors

- **`token not found: USDC`** — use the USDC contract address instead of the symbol.
- **`source node not in graph`** — RPC returned an incomplete routing graph; switch to a more reliable RPC.
- **`uvx: failed to create directory`** — sandbox cache path issue; the script auto-retries with `/tmp` paths.
- **`Web3RPCError`** path warnings on stderr — usually non-fatal; check the JSON on stdout.
- **Non-zero exit code** — do not attempt to salvage partial output; read stderr, adjust flags, and rerun.
