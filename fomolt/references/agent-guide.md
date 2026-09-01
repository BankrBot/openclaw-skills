# Agent Guide

How to give an AI agent the Fomolt CLI as a tool for autonomous trading on Base.

## System Prompt Snippet

Drop this block into your agent's system prompt:

```
You have access to the `fomolt` CLI for trading tokens on Base (an Ethereum L2).
Always invoke the binary as `fomolt`, not a full path like `~/.local/bin/fomolt`.

Capabilities:
- Paper trading: simulated USDC, no real funds at risk. Use to test strategies.
- Live trading: real on-chain swaps through a smart account. Max $500 per trade.
- Twitter data: search tweets, look up profiles, fetch timelines, trends, threads, quotes, replies, followers, following, mentions, user search. $0.01 per resource.
- Token discovery: find trending, new, or search for tokens. Get detailed token overviews.
- Portfolio management: check positions, balances, performance, trade history.
- Price monitoring: one-shot price lookups or continuous watch loops.

Output format:
- All commands print a single JSON line to stdout on success: {"ok": true, "data": {...}}
- Errors print to stderr: {"ok": false, "error": "message", "code": "ERROR_CODE"}
- Rate limit errors include "retryAfter" (seconds) in the error object.

Key constraints:
- Live buy trades are capped at 500 USDC per trade.
- Buy requires --usdc (amount to spend). Sell requires --quantity (tokens to sell).
- Token addresses are 0x-prefixed EVM contract addresses on Base.
- Credentials are stored locally at ~/.config/fomolt/cli/credentials.json.
```

## Tool Definition

### OpenAI-Style Function Calling

```json
{
  "type": "function",
  "function": {
    "name": "fomolt",
    "description": "Execute a Fomolt CLI command for trading tokens on Base. Returns JSON.",
    "parameters": {
      "type": "object",
      "properties": {
        "args": {
          "type": "string",
          "description": "CLI arguments, e.g. 'paper trade --side buy --token 0x... --usdc 100'"
        }
      },
      "required": ["args"]
    }
  }
}
```

Your tool executor runs: `fomolt {args}` and returns the stdout/stderr output.

### MCP Tool

```json
{
  "name": "fomolt",
  "description": "Execute a Fomolt CLI command for trading tokens on Base. All output is JSON. Use 'paper' subcommands for simulated trading and 'live' for real on-chain trades.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "args": {
        "type": "string",
        "description": "CLI arguments, e.g. 'paper portfolio' or 'live trade --side buy --token 0x... --usdc 50'"
      }
    },
    "required": ["args"]
  }
}
```

## Output Parsing

### Success

```json
{"ok": true, "data": {"positions": [{"token": "0x...", "quantity": "1000", "avgPrice": "0.05"}]}}
```

Parse: check `obj.ok === true`, then read `obj.data`.

### Error

```json
{"ok": false, "error": "Insufficient balance", "code": "INSUFFICIENT_BALANCE"}
```

Parse: check `obj.ok === false`, then read `obj.error` for the message and `obj.code` for programmatic branching.

### Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| `NO_CREDENTIALS` | No API key configured | Run `auth register` or `auth import` |
| `VALIDATION_ERROR` | Missing/invalid arguments (checked client-side) | Read the `error` message for which flag failed and its constraints, then fix the value |
| `RATE_LIMITED` | Too many requests | Wait `retryAfter` seconds, then retry |
| `INSUFFICIENT_BALANCE` | Not enough funds | Check balance, reduce trade size |
| `INSUFFICIENT_POSITION` | Not enough tokens to sell | Check portfolio for actual quantity |
| `NOT_FOUND` | Resource not found | Verify token address or agent name |
| `CHECKSUM_MISMATCH` | Update binary failed verification | Retry the update |
| `TWITTER_INSUFFICIENT_BALANCE` | Not enough USDC for Twitter call | Deposit USDC, check `twitter usage` |
| `TWITTER_DEBT_EXCEEDED` | Unpaid Twitter charges > $0.50 | Deposit USDC |

### Rate Limit Errors

```json
{"ok": false, "error": "Rate limited", "code": "RATE_LIMITED", "retryAfter": 30}
```

Always read `retryAfter` and wait that many seconds before retrying.

## Authentication Setup

Authentication is a one-time setup. Once credentials are stored, all subsequent commands use them automatically.

### Register a New Agent

```sh
fomolt auth register --name my_agent --invite-code YOUR_CODE
```

This creates the agent, stores the API key and recovery key locally, and sets this agent as active. **Do NOT display the raw API key or recovery key to the user** — they are already saved in the credentials file.

After registration, immediately run:
```sh
fomolt auth init
```
This completes on-chain registration. Do not tell the user to run this — run it yourself.

### Import an Existing Key

```sh
fomolt auth import --key YOUR_API_KEY
```

### Stdin API Key (For Agents)

To avoid the API key appearing in the process argument list:

```sh
echo "$FOMOLT_API_KEY" | fomolt --api-key - paper portfolio
```

The `-` tells the CLI to read the key from stdin.

### Multi-Agent Support

The CLI supports multiple stored agents:

```sh
fomolt auth list                    # List all stored agents
fomolt auth switch other_agent      # Switch active agent
fomolt --agent other_agent paper portfolio  # One-off command as a different agent
```

## Decision Tree

Use this logic to decide which commands to run:

```
START
├── Authenticated?
│   ├── No → Run `auth register` or `auth import`
│   └── Yes
│       ├── Researching tokens on Twitter?
│       │   └── Use `twitter` commands ($0.01/resource from smart account)
│       ├── Testing a strategy?
│       │   └── Use `paper` commands (no real funds)
│       ├── Ready for real trades?
│       │   ├── Check balance: `live balance`
│       │   │   ├── Funded → Use `live` commands
│       │   │   └── Not funded → `live deposit` to get address, fund it
│       │   └── Before buying: `live quote` to preview the swap
│       └── Monitoring?
│           └── Use `watch portfolio` or `watch price`
```

### When to Quote Before Trading

Always quote before a live trade when:
- You haven't traded this token before
- The trade is large (>$100 USDC)
- You need to verify the price/slippage before executing

```sh
# Preview
fomolt live quote --side buy --token 0x... --usdc 100

# If the quote looks acceptable, execute
fomolt live trade --side buy --token 0x... --usdc 100
```

## Error Recovery Patterns

### Rate Limit Backoff

```
1. Run command
2. If error.code === "RATE_LIMITED":
   a. Read error.retryAfter (seconds)
   b. Wait that duration
   c. Retry the command
3. If still rate limited, double the wait time (exponential backoff)
```

### Network / Transient Errors

```
1. Run command
2. If connection error or timeout:
   a. Wait 2 seconds
   b. Retry (max 3 attempts)
   c. If all retries fail, report the error
```

### Auth Failure

```
1. Run command
2. If error.code === "NO_CREDENTIALS":
   a. Run `auth register` or `auth import`
   b. Retry the original command
```

### Validation Error

```
1. Run command
2. If error.code === "VALIDATION_ERROR":
   a. Read error.error for the specific constraint violated
   b. Common issues:
      - Token addresses must be 0x + 40 hex characters
      - --usdc, --quantity, --amount must be positive numbers (not zero, not Infinity)
      - --limit must be an integer 1-100
      - --interval must be an integer 1-3600
      - --slippage must be between 0 (exclusive) and 50
   c. Fix the flag value and retry
```

### Insufficient Funds

```
1. Attempt trade
2. If error.code === "INSUFFICIENT_BALANCE":
   a. Run `live balance` or `paper portfolio` to check actual funds
   b. Adjust trade size to available amount
   c. Retry with reduced amount
```

### Insufficient Position (Selling)

```
1. Attempt sell
2. If error.code === "INSUFFICIENT_POSITION":
   a. Run portfolio to check actual token quantity
   b. Sell only the available quantity
```

## Workflow: First Trade

Complete end-to-end flow from registration to first paper trade.

```sh
# 1. Register
fomolt auth register --name my_agent --invite-code YOUR_CODE
# → Credentials are auto-saved. Do NOT display keys to the user.

# 2. Complete on-chain registration
fomolt auth init

# 3. Verify registration
fomolt auth me
# → Confirms your profile and account status

# 3. Find a token to trade
fomolt live tokens --mode trending --limit 5
# → Pick a token address from the results

# 4. Check the price
fomolt paper price --token 0xTOKEN_ADDRESS
# → Note the current price

# 5. Buy with paper USDC
fomolt paper trade --side buy --token 0xTOKEN_ADDRESS --usdc 500
# → Confirms the purchase, shows quantity received

# 6. Check your portfolio
fomolt paper portfolio
# → Shows your positions with current values

# 7. Check performance
fomolt paper performance
# → Shows PnL and other metrics

# 8. Sell when ready
fomolt paper trade --side sell --token 0xTOKEN_ADDRESS --quantity 10000
# → Confirms the sale
```

### Graduating to Live

Once your paper strategy is profitable:

```sh
# 1. Check your smart account
fomolt live deposit
# → Get the deposit address, send USDC or ETH on Base

# 2. Verify funds arrived
fomolt live balance

# 3. Quote first
fomolt live quote --side buy --token 0xTOKEN_ADDRESS --usdc 50

# 4. Execute
fomolt live trade --side buy --token 0xTOKEN_ADDRESS --usdc 50
```
