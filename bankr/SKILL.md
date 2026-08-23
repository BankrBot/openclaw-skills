---
name: bankr
description: AI-powered crypto trading agent, wallet API, and LLM gateway via natural language. Use when the user wants to trade crypto, trade tokenized stocks and ETFs (spot or leveraged), check portfolio balances (with PnL and NFTs), view token prices, search tokens, research token holders, transfer crypto, manage NFTs, use leverage (Hyperliquid or Avantis), bet on Polymarket, deploy tokens, set up automated trading, sign and submit raw transactions, call or deploy x402 paid API endpoints, browse the web, store and query files on their wallet's filesystem, or access LLM models through the Bankr LLM gateway funded by your Bankr wallet — including zero-data-retention and TEE-private inference tiers, plus topping up and sending LLM credits to another Bankr user. Supports Base, Ethereum, Polygon, Solana, Unichain, World Chain, Arbitrum, BNB Chain, and Robinhood Chain.
metadata:
  {
    "clawdbot":
      {
        "emoji": "📺",
        "homepage": "https://bankr.bot",
        "requires": { "bins": ["bankr"] },
      },
  }
---

# Bankr

Execute crypto trading and DeFi operations using natural language. Two integration options:

1. **Bankr CLI** (recommended) — Install `@bankr/cli` for a batteries-included terminal experience
2. **REST API** — Call `https://api.bankr.bot` directly from any language or tool

Both use the same API key. The API has two layers:
- **Wallet API** (`/wallet/*`) — Direct, synchronous endpoints for portfolio, transfers, signing, and transaction submission
- **Agent API** (`/agent/*`) — AI-powered async prompt endpoint for natural language operations

## Getting an API Key

Before using either option, you need a Bankr API key. Two ways to get one:

**Option A: Headless email login (recommended for agents)**

Two-step flow — send OTP, then verify and complete setup. See "First-Time Setup" below for the full guided flow with user preference prompts.

```bash
# Step 1 — send OTP to email
bankr login email user@example.com

# Step 2 — verify OTP and generate API key (options based on user preferences)
bankr login email user@example.com --code 123456 --accept-terms --key-name "My Agent" --read-write
```

This creates a wallet, accepts terms, and generates an API key — no browser needed. Before running step 2, ask the user which APIs they need (wallet, agent, both via `--read-write`, LLM gateway) and their preferred key name.

**Option B: Bankr Terminal**

1. Visit [bankr.bot/api-keys](https://bankr.bot/api-keys)
2. **Sign up / Sign in** — Enter your email and the one-time passcode (OTP) sent to it
3. **Generate an API key** — Create a key with **Wallet & Agent API** access enabled (the key starts with `bk_...`)

Both options automatically provision **EVM wallets** (Base, Ethereum, Polygon, Unichain) and a **Solana wallet** — no manual wallet setup needed.

## Option 1: Bankr CLI (Recommended)

### Install

```bash
bun install -g @bankr/cli
```

Or with npm:

```bash
npm install -g @bankr/cli
```

### First-Time Setup

#### Headless email login (recommended for agents)

When the user asks to log in with an email, walk them through this flow:

**Step 1 — Send verification code**

```bash
bankr login email <user-email>
```

**Step 2 — Ask the user for the OTP code and all preferences in a single message.** This avoids unnecessary back-and-forth. Ask for:

1. **OTP code** — the code they received via email
2. **Accept Terms of Service (REQUIRED)** — Present the [Terms of Service](https://bankr.bot/terms) link and confirm the user agrees. **The login command will fail for new users without `--accept-terms`.** You MUST ask for ToS acceptance and do not pass `--accept-terms` unless the user has explicitly confirmed.
3. **Which APIs do they need?**
   - **Wallet API** — enabled by default, use `--no-wallet-api` to disable
   - **Agent API** (`--agent-api`) — AI-powered prompts and natural language operations
   - **Token Launch** — enabled by default, use `--no-token-launch` to disable
   - Add `--read-write` to allow transactions (without it, enabled APIs are read-only)
4. **Enable LLM gateway access?** (`--llm`) — multi-model API at `llm.bankr.bot` (currently limited to beta testers). Skip if user doesn't need it.
5. **Key name?** (`--key-name`) — a display name for the API key (e.g. "My Agent", "Trading Bot")

**Step 3 — Construct and run the step 2 command** with the user's choices. **Do NOT execute if the user has not explicitly accepted the Terms of Service** — ask again if needed:

```bash
# Full access: wallet + agent with write + LLM
bankr login email <user-email> --code <otp> --accept-terms --key-name "My Agent" --agent-api --read-write --llm

# Agent with write access (AI can execute transactions)
bankr login email <user-email> --code <otp> --accept-terms --key-name "Trading Agent" --agent-api --read-write

# Default key (wallet + token launch, read-only)
bankr login email <user-email> --code <otp> --accept-terms --key-name "My Key"

# Agent read-only (research, prices, balances — no transactions)
bankr login email <user-email> --code <otp> --accept-terms --key-name "Research Agent" --agent-api

# LLM-only (no wallet, no token launch)
bankr login email <user-email> --code <otp> --accept-terms --key-name "LLM Client" --no-wallet-api --no-token-launch --llm
```

#### Login options reference

| Option | Description |
|--------|-------------|
| `--code <otp>` | OTP code received via email (step 2) |
| `--accept-terms` | Accept [Terms of Service](https://bankr.bot/terms) without prompting (required for new users) |
| `--key-name <name>` | Display name for the API key (e.g. "My Agent"). Prompted if omitted |
| `--no-wallet-api` | Disable Wallet API (enabled by default) |
| `--agent-api` | Enable Agent API (AI prompts, natural language operations) |
| `--read-write` | Disable read-only mode (allow transactions). Without this, enabled APIs are read-only |
| `--no-token-launch` | Disable Token Launch API (enabled by default) |
| `--llm` | Enable [LLM gateway](https://docs.bankr.bot/llm-gateway/overview) access (multi-model API at `llm.bankr.bot`). Currently limited to beta testers |
| `--allowed-ips <ips>` | Comma-separated IP/CIDR allowlist for the API key (e.g., `1.2.3.4,10.0.0.0/24`) |
| `--allowed-recipients <addresses>` | Comma-separated EVM/Solana addresses the key can send to (auto-classified by 0x prefix) |

**New key defaults** (when no flags are passed):

| Flag | Default | To change |
|------|---------|-----------|
| `walletApiEnabled` | Enabled | `--no-wallet-api` |
| `agentApiEnabled` | Disabled | `--agent-api` |
| `tokenLaunchApiEnabled` | Enabled | `--no-token-launch` |
| `llmGatewayEnabled` | Disabled | `--llm` |
| `readOnly` | Enabled (read-only) | `--read-write` |

Any option not provided on the command line will be prompted interactively by the CLI, so you can mix headless and interactive as needed.

#### Login with existing API key

If the user already has an API key:

```bash
bankr login --api-key bk_YOUR_KEY_HERE
```

If they need to create one at the Bankr Terminal:
1. Run `bankr login --url` — prints the terminal URL
2. Present the URL to the user, ask them to generate a `bk_...` key
3. Run `bankr login --api-key bk_THE_KEY`

#### Separate LLM Gateway Key (Optional)

If your LLM gateway key differs from your API key, pass `--llm-key` during login or run `bankr config set llmKey YOUR_LLM_KEY` afterward. When not set, the API key is used for both. See [references/llm-gateway.md](references/llm-gateway.md) for full details.

#### Verify Setup

```bash
bankr whoami
bankr wallet portfolio
bankr agent prompt "What is my balance?"
```

## Option 2: REST API (Direct)

No CLI installation required — call the API directly with `curl`, `fetch`, or any HTTP client.

### Authentication

All requests require an `X-API-Key` header:

```bash
curl -X POST "https://api.bankr.bot/agent/prompt" \
  -H "X-API-Key: bk_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is my ETH balance?"}'
```

### Quick Example: Submit → Poll → Complete

```bash
# 1. Submit a prompt — returns a job ID
JOB=$(curl -s -X POST "https://api.bankr.bot/agent/prompt" \
  -H "X-API-Key: $BANKR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is my ETH balance?"}')
JOB_ID=$(echo "$JOB" | jq -r '.jobId')

# 2. Poll until terminal status
while true; do
  RESULT=$(curl -s "https://api.bankr.bot/agent/job/$JOB_ID" \
    -H "X-API-Key: $BANKR_API_KEY")
  STATUS=$(echo "$RESULT" | jq -r '.status')
  [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ] || [ "$STATUS" = "cancelled" ] && break
  sleep 2
done

# 3. Read the response
echo "$RESULT" | jq -r '.response'
```

### Conversation Threads

Every prompt response includes a `threadId`. Pass it back to continue the conversation:

```bash
# Start — the response includes a threadId
curl -X POST "https://api.bankr.bot/agent/prompt" \
  -H "X-API-Key: $BANKR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is the price of ETH?"}'
# → {"jobId": "job_abc", "threadId": "thr_XYZ", ...}

# Continue — pass threadId to maintain context
curl -X POST "https://api.bankr.bot/agent/prompt" \
  -H "X-API-Key: $BANKR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "And what about SOL?", "threadId": "thr_XYZ"}'
```

Omit `threadId` to start a new conversation. CLI equivalent: `bankr agent prompt --continue` (reuses last thread) or `bankr agent prompt --thread <id>`.

### API Endpoints Summary

#### Wallet API (`/wallet/*`) — Direct endpoints (synchronous)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/wallet/me` | GET | Read | Wallet info (address, chains) |
| `/wallet/portfolio` | GET | Read | Portfolio balances, supports `?include=pnl,nfts` for progressive loading |
| `/wallet/swap-quote` | POST | Read | Quote a swap (same-chain EVM, cross-chain, or Solana) without executing |
| `/wallet/swap` | POST | Write | Execute a swap — same-chain EVM, cross-chain, or any Solana leg (output returns to your wallet) |
| `/wallet/transfer` | POST | Write | Transfer tokens (multi-chain, supports `allowedRecipients` enforcement) |
| `/wallet/sign` | POST | Write | Sign messages, typed data, or transactions |
| `/wallet/submit` | POST | Write | Submit raw transactions to chain |

- **Read endpoints** (`/wallet/me`, `/wallet/portfolio`) — any valid API key with a wallet
- **Swap quote** (`/wallet/swap-quote`) — a quote is a read, so read-only API keys are allowed; API-key callers still need `walletApiEnabled`
- **Write endpoints** (`/wallet/swap`, `/wallet/transfer`, `/wallet/sign`, `/wallet/submit`) — require `walletApiEnabled` and reject read-only keys. `/wallet/transfer` also enforces `allowedRecipients`; `/wallet/swap` does not (output returns to your own wallet)
- IP allowlist enforced on all endpoints

#### Recipient & user lookup helpers (public, no auth)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/addresses/resolve?value=<recipient>&type=<address\|ens\|twitter\|farcaster>` | GET | Resolve a recipient (0x address, ENS-style name `.eth`/`.base.eth`/`.cb.id`, or social handle) to a 0x address. Used by `bankr wallet transfer --to` to support ENS input. |
| `/users/search?...` | GET | Search Bankr users by Twitter or Farcaster username. |

The legacy aliases `/public/resolve-recipient` and `/public/search-users` have been **removed** — use the structured `/addresses/resolve` and `/users/search` endpoints instead.

#### Agent API (`/agent/*`) — AI-powered endpoints (async)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/agent/prompt` | POST | Submit a prompt (async, returns job ID) |
| `/agent/job/{jobId}` | GET | Check job status and results |
| `/agent/job/{jobId}/cancel` | POST | Cancel a running job |

#### Public endpoints (no auth required)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/token-launches` | GET | List recent token launches (cached, public) |

#### Removed legacy endpoints

The following `/agent/*` endpoints have been removed. Use the `/wallet/*` equivalents:

| Removed | Use Instead |
|---------|-------------|
| `GET /agent/me` | `GET /wallet/me` |
| `GET /agent/balances` | `GET /wallet/portfolio` |
| `POST /agent/sign` | `POST /wallet/sign` |
| `POST /agent/submit` | `POST /wallet/submit` |

For full API details (request/response schemas, job states, rich data, polling strategy), see:

**Reference**: [references/api-workflow.md](references/api-workflow.md) | [references/sign-submit-api.md](references/sign-submit-api.md)

## CLI Command Reference (v0.3.x)

`@bankr/cli` 0.2+ organizes commands into three namespaces: `wallet`, `agent`, and `tokens`. Old flat commands (`balances`, `prompt`, `status`, etc.) still work as deprecated aliases.

### `bankr wallet` — Wallet Operations

| Command | Description |
|---------|-------------|
| `bankr wallet` | Show wallet info (default: whoami) |
| `bankr wallet portfolio` | Portfolio balances across all chains (hides tokens under $1 by default) |
| `bankr wallet portfolio --pnl` | Include profit/loss data |
| `bankr wallet portfolio --nfts` | Include NFT holdings |
| `bankr wallet portfolio --all` | Include both PnL and NFTs |
| `bankr wallet portfolio --chain <chains>` | Filter by chain(s): base, polygon, mainnet, unichain, arbitrum, bnb, worldchain, robinhood, solana (comma-separated) |
| `bankr wallet portfolio --json` | Output raw JSON |
| `bankr wallet transfer --to <recipient> --token <symbol> --amount <amount>` | Transfer tokens; `--to` accepts a 0x address or ENS-style name (`.eth`, `.base.eth`, `.cb.id`), `--token` resolves symbols to contracts. Social handles work via the AI agent only. |
| `bankr wallet transfer --to vitalik.eth --token USDC --amount 50 --chain base` | ENS recipient with explicit chain |
| `bankr wallet swap --from <symbol/addr> --to <symbol/addr> --amount <amount>` | Swap tokens on a single EVM chain (same-chain). Resolves symbols to contracts; `--from`/`--to`/`--amount` required; `--chain` defaults to `base`. Solana is not supported (use the Wallet API or agent for cross-chain and Solana swaps). |
| `bankr wallet swap --from ETH --to USDC --amount 0.1 --chain base --quote-only` | Print the swap quote (you pay / you receive / min received) without executing |
| `bankr wallet sign` | Sign messages/typed data/transactions |
| `bankr wallet submit` | Submit raw transactions |

### `bankr agent` — AI Agent Operations

| Command | Description |
|---------|-------------|
| `bankr agent prompt <text>` | Send a prompt to the Bankr AI agent |
| `bankr agent prompt <text> --model <id>` | Max Mode — run this prompt on a specific gateway model, billed from LLM credits (`-m` also works) |
| `bankr agent prompt --continue <text>` | Continue the most recent conversation thread |
| `bankr agent prompt --thread <id> <text>` | Continue a specific conversation thread |
| `bankr agent status <jobId>` | Check the status of a running job |
| `bankr agent cancel <jobId>` | Cancel a running job |
| `bankr agent profile` | View/manage agent profile |
| `bankr agent skills` | Show all Bankr AI agent skills with examples |

### `bankr tokens` — Token Discovery

| Command | Description |
|---------|-------------|
| `bankr tokens search <query>` | Search for tokens by name or symbol |
| `bankr tokens info <symbol-or-address>` | Get detailed token information |

### `bankr files` — File Storage

| Command | Description |
|---------|-------------|
| `bankr files ls [--folder <path>]` | List files, optionally scoped to a folder |
| `bankr files upload <file> [--folder <path>]` | Upload a local file |
| `bankr files download <fileId>` | Get a download URL |
| `bankr files cat <fileId>` | Print file contents to stdout (or save locally) |
| `bankr files edit <fileId> --find <text> --replace <text>` | Find/replace in place (`--all` for every occurrence) |
| `bankr files write <fileId> [--from <path>]` | Overwrite text content from a local file or stdin |
| `bankr files search <query> [--folder <path>] [--limit <n>]` | Search by filename, extension, or description |
| `bankr files mkdir <name> [--parent <path>]` | Create a folder |
| `bankr files rm <fileId>` | Delete a file (soft — recoverable for 24h) |
| `bankr files storage` | Show storage usage and quota |

### `bankr club` — Bankr Club Membership

Manage Bankr Club subscription from the CLI (status, signup, cancel). Pay with USDC (default), BNKR, ETH, or any Base ERC-20 — non-USDC/BNKR tokens are swapped to USDC at checkout.

| Command | Description |
|---------|-------------|
| `bankr club` | Show membership status (default; same as `status`) |
| `bankr club status` | Show plan, renewal date, and daily message count |
| `bankr club signup` | Subscribe (monthly, USDC default) |
| `bankr club signup --yearly` | Subscribe yearly ($198 — saves ~$42/year) |
| `bankr club signup --token <symbol-or-addr>` | Pay with `USDC` (default), `BNKR`, `ETH`, or any 0x-prefixed Base ERC-20 |
| `bankr club signup -y` | Skip the confirmation prompt |
| `bankr club cancel` | Cancel subscription (access continues until period ends) |

Pricing is $20/mo or $198/yr USD-equivalent. Actual on-chain amount depends on the chosen token's price at quote time. The `--token` flag was added in CLI 0.3.4; older versions only support USDC.

**What Club actually gates** (everything else works without it):

| Perk | Standard | Bankr Club |
|------|----------|------------|
| Swap fee | 0.65% | **0.15%** |
| Terminal messages | 5/day | Unlimited |
| Agent API requests | 100/day | 1,000/day |
| Concurrent recurring agent-command automations | — | Up to 20 |
| Gas-sponsored token deploys | 3/day | 10/day |
| Token deploys | 50/day | 100/day |
| File storage | 1 GB (10 MB/file) | 10 GB (50 MB/file) |
| Monthly file downloads | 10 GB | 100 GB |
| Model routing | Standard | Top-tier models |
| Browser sessions, advanced research (Bankr score, PnL & volume analytics, web search, social sentiment) | — | Included |

**Max Mode is the alternative to a subscription** — pay per request from LLM credits for unlimited terminal messages, and it works with external/connected wallets, which Club checkout does not (Club requires an embedded Bankr wallet). On the Agent API, non-Club Max Mode is still capped at 100 requests/day. Holding a legacy Bankr Club NFT does **not** grant membership; it was a commemorative token for the first 1,000 subscribers.

**Monthly → yearly upgrade**: active monthly members can upgrade to yearly by asking the agent (e.g. "upgrade me to yearly"). The full yearly price is charged and the new 365-day term stacks on top of any remaining monthly time, so no paid time is lost. Yearly → monthly downgrades and yearly resubscribes are not supported.

### Auth & Config Commands

| Command | Description |
|---------|-------------|
| `bankr login` | Authenticate with the Bankr API (interactive menu) |
| `bankr login email <address>` | Send OTP to email (headless step 1) |
| `bankr login email <address> --code <otp> [options]` | Verify OTP and complete setup (headless step 2) |
| `bankr login --api-key <key>` | Login with an existing API key directly |
| `bankr login --api-key <key> --llm-key <key>` | Login with separate LLM gateway key |
| `bankr login --url` | Print Bankr Terminal URL for API key generation |
| `bankr logout` | Clear stored credentials |
| `bankr whoami` | Show current authentication info |
| `bankr config get [key]` | Get config value(s) |
| `bankr config set <key> <value>` | Set a config value |
| `bankr --config <path> <command>` | Use a custom config file path |

Valid config keys: `apiKey`, `apiUrl`, `llmKey`, `llmUrl`

Default config location: `~/.bankr/config.json`. Override with `--config` or `BANKR_CONFIG` env var.

### Non-Interactive Mode

For headless environments — CI pipelines, Docker containers, cron jobs — pass the `--not-interactive` (alias `--ni`) global flag, or set `BANKR_NOT_INTERACTIVE=1`. Both forms work before or after the subcommand.

The flag implies `--yes` on every confirmation prompt and fails fast (exit 1, clear error) when a command would otherwise hang on a required prompt. Use it whenever the user asks for an automated/scripted invocation.

| Command | Required headless flag(s) when --ni is set |
|---------|---------------------------------------------|
| `bankr login` | `--api-key <key>`, `login siwe --private-key <key>`, or `login email <addr> [--code <otp>]` |
| `bankr launch` | `--name <name>` (other fields default to empty) |
| `bankr fees claim-wallet` | `--all` (plus `--private-key` or `BANKR_PRIVATE_KEY`) |
| `bankr agent` | a prompt argument or piped stdin |

Read-only commands (`whoami`, `wallet portfolio`, `tokens`, `agent status`, etc.) don't prompt at all — `--ni` is harmless but redundant.

Examples:

```bash
# Cron — claim creator fees nightly
BANKR_PRIVATE_KEY=0x... bankr --ni fees claim-wallet --all

# CI — programmatic token launch (simulate, no broadcast)
bankr --ni launch --name MyToken --symbol MTK --simulate

# Pipeline — agent prompt from stdin
echo "summarize today's trades" | bankr --ni agent prompt
```

### Deprecated Aliases

Old flat commands still work but prefer the namespaced versions:

| Deprecated | Use Instead |
|-----------|-------------|
| `bankr prompt` | `bankr agent` |
| `bankr status` | `bankr agent status` |
| `bankr cancel` | `bankr agent cancel` |
| `bankr balances` | `bankr wallet portfolio` |
| `bankr profile` | `bankr agent profile` |
| `bankr sign` | `bankr wallet sign` |
| `bankr submit` | `bankr wallet submit` |
| `bankr skills` | `bankr agent skills` |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `BANKR_API_KEY` | API key (overrides stored key) |
| `BANKR_API_URL` | API URL (default: `https://api.bankr.bot`) |
| `BANKR_LLM_KEY` | LLM gateway key (falls back to `BANKR_API_KEY` if not set) |
| `BANKR_LLM_URL` | LLM gateway URL (default: `https://llm.bankr.bot`) |
| `BANKR_NOT_INTERACTIVE` | Set to `1` to enable non-interactive mode globally (equivalent to passing `--ni` / `--not-interactive` on every invocation) |

Environment variables override config file values. Config file values override defaults.

### LLM Gateway Commands

| Command | Description |
|---------|-------------|
| `bankr llm models` | List available LLM models |
| `bankr llm credits` | Check credit balance |
| `bankr llm credits add <amount> [--token <addr>] [-y]` | Top up LLM credits from wallet |
| `bankr llm credits auto [--enable/--disable] [--amount] [--threshold] [--tokens]` | View or configure auto top-up |
| `bankr llm setup openclaw [--install]` | Generate or install OpenClaw config |
| `bankr llm setup opencode [--install]` | Generate or install OpenCode config |
| `bankr llm setup claude` | Show Claude Code environment setup |
| `bankr llm setup cursor` | Show Cursor IDE setup instructions |
| `bankr llm claude [args...]` | Launch Claude Code via the Bankr LLM Gateway |
| `bankr claude [args...]` | Top-level alias for `bankr llm claude` |
| `bankr llm opencode [args...]` | Launch OpenCode via the Bankr LLM Gateway |

On the launcher commands (`bankr claude`, `bankr llm claude`, `bankr llm opencode`) all arguments — including `-h` / `--help` — are forwarded to the spawned tool, and a help run doesn't require authentication. Use `bankr --help` / `bankr llm --help` for the Bankr CLI's own help. Named commands also take precedence over the prompt fallthrough, so `bankr claude ...` launches Claude Code instead of prompting the agent; use `bankr agent "..."` when a prompt starts with a command name.

The `bankr claude` alias and the `--help` passthrough require **@bankr/cli 0.3.18+**; on older versions use `bankr llm claude`.

## Core Usage

### Simple Query

For straightforward requests that complete quickly:

```bash
bankr agent prompt "What is my ETH balance?"
bankr agent prompt "What's the price of Bitcoin?"
```

The CLI handles the full submit-poll-complete workflow automatically. You can also use the shorthand — any unrecognized command is treated as a prompt:

```bash
bankr What is the price of ETH?
```

### Interactive Prompt

For prompts containing `$` or special characters that the shell would expand:

```bash
# Interactive mode — no shell expansion issues
bankr agent prompt
# Then type: Buy $50 of ETH on Base

# Or pipe input
echo 'Buy $50 of ETH on Base' | bankr agent prompt
```

### Conversation Threads

Continue a multi-turn conversation with the agent:

```bash
# First prompt — starts a new thread automatically
bankr agent prompt "What is the price of ETH?"
# → Thread: thr_ABC123

# Continue the conversation (agent remembers the ETH context)
bankr agent prompt --continue "And what about BTC?"
bankr agent prompt -c "Compare them"

# Resume any thread by ID
bankr agent prompt --thread thr_ABC123 "Show me ETH chart"
```

Thread IDs are automatically saved to config after each prompt. The `--continue` / `-c` flag reuses the last thread.

### Manual Job Control

For advanced use or long-running operations:

```bash
# Submit and get job ID
bankr agent prompt "Buy $100 of ETH"
# → Job submitted: job_abc123

# Check status of a specific job
bankr agent status job_abc123

# Cancel if needed
bankr agent cancel job_abc123
```

## LLM Gateway

The [Bankr LLM Gateway](https://docs.bankr.bot/llm-gateway/overview) is a unified API for Claude, Gemini, GPT, Grok, DeepSeek, Qwen, Kimi, MiniMax, GLM, and other models — multi-provider access, cost tracking, automatic failover, and SDK compatibility through a single endpoint.

**Base URL:** `https://llm.bankr.bot` | **Dashboard:** [bankr.bot/llm](https://bankr.bot/llm) | **API Keys:** [bankr.bot/api-keys](https://bankr.bot/api-keys)

### Key Concepts

- Uses your `llmKey` if configured, otherwise falls back to your API key
- **LLM credits** (USD) and **trading wallet** (crypto) are completely separate balances — having crypto does NOT give you LLM credits
- **New accounts start with $0 LLM credits** — top up via `bankr llm credits add 25` or at [bankr.bot/llm?tab=credits](https://bankr.bot/llm?tab=credits) before making any LLM calls, or you will get a 402 error
- Check credits: `bankr llm credits` | Top up: `bankr llm credits add <amount>` | Auto top-up: `bankr llm credits auto --enable --amount 25 --tokens USDC`
- In OpenClaw config, prefix model IDs with `bankr/` (e.g. `bankr/claude-sonnet-5`). In direct API calls, use bare IDs (e.g. `claude-sonnet-5`). Run `bankr llm models` for the current model list
- **Claude Code's `[1m]` context-tier suffix is optional through the gateway** — it's stripped before model lookup and the 1M window comes from the model's own context window, so `claude-opus-5` and `claude-opus-5[1m]` behave identically. If you do use it, quote it (`--model "claude-opus-5[1m]"`) — in zsh it's a glob character class and the command aborts before the CLI runs
- **Per-model discounts** available for Bankr Club members and partners — applied automatically at billing time
- **Image generation**: generate images via the OpenAI-native `/v1/images/generations` endpoint (model `gpt-image-2`), billed from the same LLM credit balance — see the reference
- **Expiring credit grants**: promotional or developer grants may carry an expiry date. Your spendable balance is your permanent (purchased) credits plus any unexpired grants — grants are spent first (soonest-expiring first) and drop off automatically at expiry
- **Privacy tiers**: every request is served at `standard`, `zdr` (zero data retention), or `private` (TEE). Ask for a tier per request, per model, per base URL, or account-wide — see below

### Privacy Tiers

Three nesting levels of data-handling guarantee, requested the same way on every endpoint:

| Tier | Guarantee | Coverage |
|------|-----------|----------|
| `standard` (default) | Never routed to a provider that trains on your prompts. Providers may still retain them. | Every model |
| `zdr` | Only providers that retain nothing. | Subset — filter with `bankr llm models --zdr` |
| `private` | Runs inside a hardware-secured enclave (TEE), attestation verified per request. Zero-retention by construction. | Open-weight models only |

Four ways to ask, so any client can reach any tier:

```bash
# 1. The `privacy` request field
curl -X POST https://llm.bankr.bot/v1/chat/completions -H "X-API-Key: $BANKR_LLM_KEY" \
  -d '{"model":"glm-5.2","privacy":"zdr","messages":[{"role":"user","content":"Hello"}]}'

# 2. A base-path prefix — for tools that only take a base URL, key, and model
export OPENAI_BASE_URL=https://llm.bankr.bot/zdr/v1      # OpenAI-compatible clients
export ANTHROPIC_BASE_URL=https://llm.bankr.bot/zdr      # Anthropic-compatible clients

# 3. A model-ID suffix
bankr llm models --zdr                                   # which models have a ZDR slot
# → use `glm-5.2:zdr` or `glm-5.2:private` as the model ID

# 4. Account-wide — Settings in the web terminal, applies to every request
```

- **Every tier fails closed.** If no provider can serve your model at the tier you asked for, the request is rejected (`422 zdr_unavailable`) — never quietly downgraded.
- **Account setting and request combine, strongest wins.** A request can tighten past the account setting; nothing in a request can drop below it.
- **A tier endpoint is authoritative.** Sending a request that names a *different* tier to `/zdr` or `/private` returns `400 privacy_conflict` rather than merging. An unparseable `privacy` value returns `400 invalid_privacy` rather than being ignored.
- **`X-Privacy-Tier` response header** reports the tier the request was actually handled under, so the guarantee is verifiable rather than assumed.
- Tier matching is case-insensitive, and only a *trailing* `:zdr` / `:private` token counts as the suffix opt-in.

### Max Mode — Pick the Agent's Model

Max Mode overrides the Bankr agent's default model with any model from the gateway, billed per token from your **LLM credit balance** (not your trading wallet):

```bash
bankr agent "analyze my portfolio" --model claude-opus-5     # or -m
bankr agent "what are the top memecoins today?" -m gemini-3.1-pro
bankr agent prompt "tell me more" --continue --model claude-sonnet-5
```

The setting is stored on your wallet and applies across every surface — CLI, web terminal, social platforms, and automations. In the web terminal, toggle the **Max** button and pick a model from the picker.

- **Credits are enforced per LLM call, not after the fact.** Your spendable balance (minus anything already metered but not yet deducted) becomes the run's budget, re-checked before every call — the turn ends honestly when it's exhausted instead of overspending.
- **Shortfalls survive.** If a batch can't be fully covered, the credit is left untouched and the usage stays owed, so a later top-up settles it rather than the overspend being written off.
- Top up before enabling, or Max Mode messages will fail.

### Quick Commands

```bash
bankr llm models                           # List available models
bankr llm credits                          # Check credit balance
bankr llm credits add 25                   # Top up $25 credits (defaults to Base USDC)
bankr llm credits add 25 --token USDT      # Pay USDT on whichever chain holds the most
bankr llm credits add 25 --token ETH       # Native token; auto-swapped on its chain
bankr llm credits auto --enable --amount 25 --tokens USDC,USDT  # Multi-chain auto top-up
bankr llm setup openclaw --install         # Install Bankr provider into OpenClaw
bankr llm setup claude                     # Print Claude Code env vars
bankr claude                               # Launch Claude Code through gateway
bankr claude --model claude-opus-5         # Any tool flags are forwarded
bankr llm opencode                         # Launch OpenCode through gateway
```

### Agent Credit Top-Up

The AI agent can top up your LLM credits directly in conversation — no CLI or web dashboard needed:

```bash
bankr agent prompt "Top up my LLM credits with $25"
bankr agent prompt "Add $10 of LLM credits using my ETH"
bankr agent prompt "How many LLM credits do I have left?"
```

The agent can also report your current LLM credit balance in conversation — including any expiring grants and when they lapse — without needing the `bankr llm credits` command.

**Sending credits to another Bankr user.** Purchased credit is transferable peer-to-peer — ask the agent ("send $20 of LLM credits to @alice") or `POST /llm/credits/transfer`. The recipient must already be a Bankr user (X username or `0x` address; no ENS on this path), only purchased credit moves (grants are not transferable), the minimum is $1, and a wallet may send at most **$500 per trailing 24 hours**. Read-only API keys are refused; pass your own `transferId` so a retry can't double-send.

**Daily spend budget.** You can cap what the gateway spends on your behalf, independently of your balance. The window is a **trailing 24 hours**, not a calendar day — nothing resets at midnight, capacity returns as charges age out. Over budget, spending requests return `402` with `type: daily_budget_exceeded` (distinct from `insufficient_credits`), while read-only `GET` endpoints keep working so you can poll for when you're unblocked. The same budget also ends Max Mode agent runs early.

1 credit = $1 USD. Multi-chain: pay with USDC or USDT directly on Base, Polygon, Ethereum, Arbitrum, or BNB Chain, or with any other ERC-20 (auto-swapped to the chain's preferred stablecoin — USDC on most chains, USDT on BNB). When using `--token`, the CLI picks the chain with the highest USD balance of that token. Maximum $1,000 per top-up.

### Model Deprecation

The gateway supports model deprecation with auto-redirect to replacement models. Deprecated models return `X-Model-Deprecated` and `X-Model-Replacement` response headers. Hard-deprecated models return HTTP 410 — update your model ID to the replacement indicated in the header.

For full details — setup paths, model list, provider config, SDK examples, key management, and troubleshooting — see:

**Reference**: [references/llm-gateway.md](references/llm-gateway.md)

## Capabilities Overview

### Trading Operations

- **Token Swaps**: Buy/sell/swap tokens across chains
- **Cross-Chain**: Bridge tokens between chains
- **Limit Orders**: Execute at target prices
- **Stop Loss**: Automatic sell protection
- **DCA**: Dollar-cost averaging strategies
- **TWAP**: Time-weighted average pricing

**Reference**: [references/token-trading.md](references/token-trading.md)

### Portfolio Management

- Check balances across all chains (`bankr wallet portfolio` or `GET /wallet/portfolio`)
- View USD valuations with optional PnL tracking (`--pnl` or `?include=pnl`)
- View NFT holdings (`--nfts` or `?include=nfts`)
- Track holdings by token or chain
- Real-time price updates
- Multi-chain aggregation
- Wrapping/unwrapping the native token (ETH ↔ WETH and equivalents) is reflected in both balances right away
- Filter by chain: `bankr wallet portfolio --chain base,solana` or `GET /wallet/portfolio?chains=base,solana`

**Reference**: [references/portfolio.md](references/portfolio.md)

### Market Research

- Token prices and market data
- Technical analysis (RSI, MACD, etc.)
- Social sentiment analysis
- Price charts
- Trending tokens
- Token comparisons
- **Holder snapshots** — largest-first holder lists with USD value and supply percentage, plus a concentration summary. Supports a minimum-USD floor, which makes it usable for airdrop targeting ("holders of X with $50+")

**Reference**: [references/market-research.md](references/market-research.md)

### Transfers

- Send to 0x addresses, ENS-style names (`.eth`, `.base.eth`, `.cb.id`), or social handles
- CLI direct (`bankr wallet transfer`) accepts 0x addresses + ENS only — social handles go through the AI agent
- Multi-chain support
- **Bulk / multi-recipient** sends via the agent — same-chain ERC-20 transfers to many recipients batch into a single on-chain transaction (one set of gas)
- Flexible amount formats
- Social handle resolution (Twitter, Farcaster, Telegram) via the agent

**Reference**: [references/transfers.md](references/transfers.md)

### NFT Operations

- Browse and search collections
- View floor prices and listings
- Purchase NFTs via OpenSea — including listings priced in an **ERC-20** rather than the native token (e.g. USDG on Robinhood Chain). The token approval, the payment-currency balance check, and decimals-aware pricing are all handled for you
- Accept offers on NFTs you own
- View your NFT portfolio
- Transfer NFTs
- Mint from supported platforms

**Reference**: [references/nft-operations.md](references/nft-operations.md)

### Polymarket Betting

- Search prediction markets
- Check odds
- Place bets on outcomes
- View positions — including any unspent collateral left in the Polymarket deposit wallet, which is recoverable with "sweep my polymarket deposit wallet"
- Redeem winnings

**Reference**: [references/polymarket.md](references/polymarket.md)

### Leverage Trading

- **Hyperliquid** (primary) — Perpetual futures on Hyperliquid L1 with on-chain order book. Crypto, stocks (TSLA, AAPL, NVDA via HIP-3), spot trading. Up to 50x leverage.
- **Avantis** (secondary) — Perpetuals on Base for crypto, equities (NVDA, TSLA, AAPL, HOOD, and more), forex, and commodities. Equity, forex, and commodity pairs trade during their underlying market hours only.
- Stop loss, take profit, and position management on both platforms
- Funding Hyperliquid is a **venue** deposit/withdraw, not a bridge: a deposit only reaches Hyperliquid, a withdrawal only lands on Arbitrum. Name the venue ("deposit $500 to hyperliquid") rather than saying "bridge"; to move withdrawn funds onward, chain a cross-chain swap after the withdrawal
- Hyperliquid charges a **1 USDC withdrawal fee, taken out of the requested amount** — so your full withdrawable balance is requestable (you receive amount − 1), and withdrawals under $1 are refused rather than netting to zero

**Reference**: [references/leverage-trading.md](references/leverage-trading.md) | [references/hyperliquid.md](references/hyperliquid.md)

### Tokenized Stock Trading

Trade tokenized stocks and ETFs — real-world equities issued as on-chain tokens — with a plain prompt, the same way you trade any other asset. Bankr resolves the best venue automatically when you name a ticker, or you can specify a chain/venue:

- **Robinhood Chain** — spot tokens issued by Robinhood (200 stocks and ETFs: NVDA, AAPL, TSLA, SPY, QQQ, and more). Trades settle against USDG (Global Dollar); Bankr routes funding through it automatically. **Requires one-time location verification.**
- **Base (B20 tokenized equities)** — Coinbase-issued equity tokens on Base: AAPL, AMZN, COIN, CRCL, GOOGL, INTC, META, MSFT, MSTR, NVDA, SNDK, SPCX, TSLA. **Same location verification as Robinhood stocks.**
- **Solana** — spot tokens from third-party issuers such as xStocks (AAPLx, TSLAx). No verification required; trade like any other token.
- **Base (third-party issuers)** — other issuers' spot stock tokens on Base. No verification required.
- **Leveraged (perps)** — for long/short exposure without owning the token, use Avantis (Base) or Hyperliquid.

Location verification is a one-time step — log in to the [Bankr console](https://bankr.bot) (verified automatically from your connection, renews on login, expires after 30 days). Not available in the US, UK, or sanctioned countries/regions.

Spot stocks work with swaps, transfers, limit orders, and DCA. Only issuer-tokenized stock trades (Robinhood Chain and Base B20) are location-gated — memecoins, bridging, and transfers work without verification. Tickers collide across chains (12 of the 13 B20 tickers also exist on Robinhood Chain), so name the chain when you mean a specific one.

**Reference**: [references/tokenized-stocks.md](references/tokenized-stocks.md)

### Token Deployment

- **EVM (Base or Robinhood Chain)**: Launch ERC20 tokens via Doppler on a Uniswap V4 pool with customizable metadata and social links. Fixed **100 billion** supply. Every trade pays a **0.7% swap fee on the pool and 95% of it goes to you** (0.665% of volume, claimable anytime); the hook adds the Bankr protocol fee + BNKR buyback and LP fee on top, for **1.75% all-in**. The **0.285% LP fee is creator-side too** — it compounds as locked liquidity in your own pool, strengthening your token's liquidity on every swap, so the creator side totals **0.95% of volume**. **The default chain depends on the surface**: the CLI (`bankr launch`) and the web launch form preselect **Base**, while the AI agent and the deploy API fall back to **Robinhood Chain** when no chain is named. Name the chain explicitly (`bankr launch --chain robinhood`, `"chain": "base"`, or "launch it on Base") whenever it matters. Legacy Clanker tokens remain claimable (claims auto-detect Doppler vs Clanker).
- **Stock-paired launches** (EVM, optional): pair the new token's pool with a registry tokenized stock instead of WETH, so the token trades against equity exposure. Available on Base (B20 equities) and Robinhood Chain — pass `pairedStockAddress` to the deploy API, or ask the agent to pair the launch with a ticker. Only stocks Bankr can price are offered, since launch-curve math needs a USD price.
- **Quote-only fees** (EVM, optional): opt in at launch to collect all creator fees in the quote token (e.g. WETH) instead of a mix of the launched token and quote token — your total take is identical either way. Ask for "quote-only fees", pass `quoteOnlyFees: true` to the deploy API, or use `bankr launch --quote-only-fees`. Fixed at launch, like the fee schedule itself.
- **Degen mode** (EVM, optional): start the token at a **$2,500 market cap** instead of the standard starting cap, for maximum early volatility. Explicit opt-in only — ask for "degen mode" by name, or pass `degenMode: true` to the deploy API. The figure is fixed; there is no custom starting market cap, a token *named* DEGEN does not opt you in, and the mode is unavailable on partner deploys.
- **Solana**: Launch SPL tokens via Raydium LaunchLab with bonding curve and auto-migration to CPMM
- Creator fee claiming on both chains
- Fee Key NFTs for Solana (50% LP trading fees post-migration)
- Optional fee recipient designation with 99.9%/0.1% split (Solana)
- Both creator AND fee recipient can claim bonding curve fees (gas sponsored)
- Optional vesting parameters (Solana)
- Base launch limits: 50/day standard, 100/day Bankr Club (gas sponsored within limits)
- Tokens deployed through Bankr are always visible in your portfolio, even without market price data

**Reference**: [references/token-deployment.md](references/token-deployment.md)

> **Selling your own creator-fee token:** Bankr blocks selling a token you earn fees on through the ordinary swap/limit/stop/DCA/TWAP tools (buying and transferring are unaffected). Builders take profit gradually instead via **Glidepath** — an AI-paced gradual exit managed from the token page at [bankr.bot](https://bankr.bot). Glidepath is a web feature; it isn't a CLI/API action. Details: https://docs.bankr.bot/token-launching/glidepath

### Automation

- Limit orders
- Stop loss orders
- DCA (dollar-cost averaging)
- TWAP (time-weighted average price)
- Scheduled commands

**Reference**: [references/automation.md](references/automation.md)

### x402 Paid API Calls

The agent can discover, call, and deploy x402-protected API endpoints, automatically handling token payments on Base:

- **Discover** endpoints in the Bankr registry or via web search
- **Inspect** endpoint pricing, methods, and input/output schemas
- **Call** endpoints with automatic payment signing in the endpoint's required token — USDC or any supported ERC-20 (max $10/request). From the CLI, `--max-payment <usd>` is your cap and is what gets sent: an endpoint's advertised price is display-only and can never raise it, and a call whose advertised price exceeds your cap fails closed rather than paying
- **Deploy** new x402 endpoints directly through the agent (write handler code, set pricing, deploy)
- **Price** your own endpoints in USDC or any supported ERC-20; revenue settles on-chain and is accounted in USD at settlement time
- Works with any x402-compatible endpoint (Bankr-hosted or external)

**Reference**: [references/x402-cloud.md](references/x402-cloud.md)

### Web Browsing

The agent has a built-in headless browser for web interactions:

- **Open** URLs and navigate web pages
- **Read** page content, extract data, and take screenshots
- **Interact** with page elements (click, type, scroll)
- **Persist** browser sessions across multi-step workflows
- Useful for research, data extraction, and interacting with web apps that don't have APIs

**Reference**: [references/x402-cloud.md](references/x402-cloud.md)

### File Storage

Every Bankr wallet has a persistent filesystem, shared across the CLI, web terminal, API, and every social surface the agent runs on.

- Create, read, edit, search, move, rename, and delete files by asking the agent — a path (`/research/notes.md`) works anywhere a file ID does
- `bankr files ls|upload|download|cat|edit|write|search|mkdir|rm|storage` from the CLI; `/user/files/*` over REST
- **Ask questions about a file without loading it** — the agent runs a read-only `jq`/`grep`/`awk`-style pipeline in a sandbox and returns only the answer, so a 4 MB CSV never enters the conversation. Available on every wallet, no Club subscription needed
- **Run outputs (`/runs`)** — a separate, conversation-scoped scratch namespace. Deliverables a sandboxed run writes to `./output/` persist there automatically and stay readable by path in later turns, and oversized tool results are stored there instead of crowding the conversation. Text only, ~14 days, 10 MB per file / 100 MB per conversation. Save anything that matters longer into your own filesystem
- Quotas: 1 GB / 10 MB per file / 10 GB monthly downloads on the free tier; 10 GB / 50 MB / 100 GB on Bankr Club. Checked at write time, resolved live from your current Club status
- Deletion is soft — files are recoverable via support for 24 hours, then permanently gone

**Reference**: [references/files.md](references/files.md)

### Ask About Bankr

The agent can answer questions about Bankr itself — how features work, official domains and links, the official Telegram bot, and support channels — grounded in Bankr's own documentation. When it doesn't have a confident answer it abstains rather than guessing, so you won't get fabricated links or facts. Useful for onboarding questions and for verifying that a link or channel is genuinely official.

### Arbitrary Transactions

- Submit raw EVM transactions with explicit calldata
- Custom contract calls to any address
- Execute pre-built calldata from other tools
- Value transfers with data
- Read an unknown contract's ABI and call it — struct (tuple) parameters are expanded into the parenthesized signature form the encoder accepts, so struct-taking functions like Uniswap V4 position mints encode on the first try instead of failing as `tuple`

**Reference**: [references/arbitrary-transaction.md](references/arbitrary-transaction.md)

## Supported Chains

| Chain       | Native Token | Best For                      | Gas Cost |
| ----------- | ------------ | ----------------------------- | -------- |
| Base        | ETH          | Memecoins, general trading, B20 tokenized equities | Very Low |
| Polygon     | POL          | Gaming, NFTs, frequent trades | Very Low |
| Ethereum    | ETH          | Blue chips, high liquidity    | High     |
| Solana      | SOL          | High-speed trading            | Minimal  |
| Unichain    | ETH          | Newer L2 option               | Very Low |
| World Chain | ETH          | Uniswap V3/V4 swaps          | Very Low |
| Arbitrum    | ETH          | DeFi, low-cost transactions   | Very Low |
| BNB Chain   | BNB          | BSC ecosystem trading         | Low      |
| Robinhood Chain | ETH      | Tokenized stocks & ETFs (USDG), memecoins, token launches | Very Low |

**Robinhood Chain** is an EVM L2 (chainId `4663`) whose native stablecoin is **USDG** (Global Dollar). It hosts 200 Robinhood-issued tokenized stocks and ETFs alongside memecoins, and supports Bankr token launches (Doppler). Tokenized-stock trades require location verification (see [Tokenized Stock Trading](#tokenized-stock-trading)); memecoin swaps, token launches, bridging, and transfers do not.

**Base** additionally hosts the **B20 tokenized equities** — Coinbase-issued, 8-decimal equity tokens whose redemption ratio to the underlying share is an on-chain multiplier that moves on corporate actions. Trading them is gated by the same location verification as Robinhood stocks; everything else on Base is not.

## Safety & Access Control

Bankr has two independent layers of safety controls. A transaction must satisfy **both** to broadcast.

### Wallet-Level Security (bankr.bot → Security)

User-controlled settings that apply to every surface — chat, agent, API, CLI. Configured at [bankr.bot](https://bankr.bot) → Security; requires web authentication (an API key cannot change them).

| Control | Default | Effect |
|---------|---------|--------|
| Pause all transactions | Off | Blocks every outbound transaction until unpaused |
| Daily spending limit | $500 / 24h | Rejects any tx that pushes rolling-24h USD outflow past the limit |
| Per-transaction limit | $500 | Rejects any single tx priced above the limit |
| Price impact limit | On (15%) | Rejects a swap whose estimated price impact exceeds the limit — guards against catastrophic fills in thin/low-liquidity pools. Adjustable 1–100% or turned off |
| Permitted recipients | Off | Restricts transfers/swaps to an allowlist; new entries enter a configurable cooldown (default 24h) |
| Disable arbitrary contract calls | Off | Blocks `write_contract`, raw `/wallet/submit`, and arbitrary transaction tools (named operations like swaps still work) |

If USD pricing is unavailable and a limit is enabled, the transaction is **rejected** (fail-closed) rather than waved through. Your own wallet addresses are always implicitly allowed as recipients.

Spend limits apply to **every** swap path, including cross-chain and Solana legs — the sell side is priced and checked before execution, and a successful swap counts toward your rolling 24h total.

One side effect worth knowing: the price-impact limit also fails closed on venues that can't report an impact figure. The clearest case is a brand-new Solana token still on its LaunchLab bonding curve — with the limit enabled, that fallback is refused rather than filled unguarded. Turn the limit off if you specifically need those fills.

### Protected-Token Swap Guard

Bankr blocks **swaps** of a small set of protected tokens where swapping is almost always a costly mistake — for example staked positions that should be unwound through their own redeem flow. The block is swap-only: the token stays visible in your portfolio, transferable, and usable with the relevant staking/redeem tools. When a swap is blocked, the agent returns a clear reason pointing you to the correct exit path. This guard applies across the swap/limit/stop/DCA/TWAP tools on the EVM swap paths.

### Impostor-Token Screening

A common attack is to airdrop dust that reports a **canonical currency's ticker** — `USDG`, `USDC`, `USDT`, `EURC`, a chain's native or wrapped symbol — from an address that isn't the real one, hoping an agent copies the address straight out of a balance listing and trades into it. Bankr treats a negative security verdict on that shape as decisive: the token drops out of your portfolio listing rather than reaching the agent as a clean-looking `symbol: "USDG"` entry.

The screen is narrow on purpose. Genuine canonical tokens match on address and are unaffected, fresh launches with real liquidity keep the more forgiving classification they need, and **a token you actually bought through Bankr is never hidden by a spam verdict** — only unsolicited dust drops. When you mean a specific asset, naming the ticker (not an address pasted from a balance list) lets Bankr resolve it to the vetted contract.

### BNKR Staking Is Withdraw-Only

BNKR staking is deprecated and **no longer accepts new deposits**. Asking the agent to stake BNKR gets an explanation rather than a transaction. Existing stakers keep the full exit path — initiate cooldown, redeem shares, withdraw — and can still view their staked position. Don't build flows that assume a deposit will go through.

### API-Key Level Controls (bankr.bot/api-keys)

Per-key settings configured at [bankr.bot/api-keys](https://bankr.bot/api-keys):

**API Key Types**: Bankr uses a single key format (`bk_...`) with capability flags (`walletApiEnabled`, `agentApiEnabled`, `tokenLaunchApiEnabled`, `llmGatewayEnabled`). You can optionally configure a separate LLM Gateway key via `bankr config set llmKey` or `BANKR_LLM_KEY` — useful when you want independent revocation or different permissions for agent vs LLM access.

**Read-Only API Keys**: New keys default to `readOnly: true`. This filters all write tools (swaps, transfers, staking, token launches, etc.) from agent sessions. The `/wallet/swap`, `/wallet/sign`, `/wallet/submit`, and `/wallet/transfer` write endpoints return 403 (the `/wallet/swap-quote` read endpoint still works). Use `--read-write` during login or toggle in the web settings to disable. Ideal for monitoring bots and research agents.

**IP Whitelisting**: Set `allowedIps` on your API key to restrict usage to specific IPs or CIDR ranges (e.g., `10.0.0.0/24`). Requests from non-whitelisted IPs are rejected with 403 at the auth layer.

**Recipient Allowlist**: Restrict which addresses the key can send funds to. Independent from the wallet-level permitted recipients — when both are configured, both must pass.

### Incident Response

If you suspect a key is compromised:

1. **Pause** the wallet at [bankr.bot](https://bankr.bot) → Security — halts every outbound transaction immediately
2. **Revoke** the key at [bankr.bot/api-keys](https://bankr.bot/api-keys)
3. **Rotate** — generate a new key and update deployments
4. **Audit** — review recent transactions and agent job history before unpausing

### General

**Dedicated Agent Wallet**: When building autonomous agents, create a separate Bankr account rather than using your personal wallet. This isolates agent funds — if a key is compromised, only the agent wallet is exposed. Fund it with limited amounts and replenish as needed.

**Rate Limits**: 100 messages/day (standard), 1,000/day (Bankr Club), or custom per key. Resets 24h from first message (rolling window). LLM Gateway uses a credit-based system.

**Key safety rules:**
- Store keys in environment variables (`BANKR_API_KEY`, `BANKR_LLM_KEY`), never in source code
- Add `~/.bankr/` and `.env` to `.gitignore` — the CLI stores credentials in `~/.bankr/config.json`
- Test with small amounts on low-cost chains (Base, Polygon) before production use
- Use `waitForConfirmation: true` with `/wallet/submit` — transactions execute immediately with no confirmation prompt
- Rotate keys periodically via the dashboard or API key rotation endpoint, and revoke immediately if compromised at [bankr.bot/api-keys](https://bankr.bot/api-keys)

**Reference**: [references/safety.md](references/safety.md)

## Common Patterns

### Check Before Trading

```bash
# Check balance
bankr wallet portfolio --chain base

# Check price
bankr agent prompt "What's the current price of PEPE?"

# Then trade
bankr agent prompt "Buy $20 of PEPE on Base"
```

### Portfolio Review

```bash
# Direct portfolio check (no AI agent, instant response)
bankr wallet portfolio
bankr wallet portfolio --pnl        # Include profit/loss data
bankr wallet portfolio --nfts       # Include NFT holdings
bankr wallet portfolio --all        # PnL + NFTs
bankr wallet portfolio --chain base
bankr wallet portfolio --chain base,solana
bankr wallet portfolio --json

# Via AI agent (natural language, richer context)
bankr agent prompt "Show my complete portfolio"

# Chain-specific
bankr agent prompt "What tokens do I have on Base?"

# Token-specific
bankr agent prompt "Show my ETH across all chains"
```

### Set Up Automation

```bash
# DCA strategy
bankr agent prompt "DCA $100 into ETH every week"

# Stop loss protection
bankr agent prompt "Set stop loss for my ETH at $2,500"

# Limit order
bankr agent prompt "Buy ETH if price drops to $3,000"
```

### Market Research

```bash
# Token discovery
bankr tokens search PEPE
bankr tokens info USDC

# Price and analysis
bankr agent prompt "Do technical analysis on ETH"

# Trending tokens
bankr agent prompt "What tokens are trending on Base?"

# Compare tokens
bankr agent prompt "Compare ETH vs SOL"
```

## API Workflow

Bankr uses an asynchronous job-based API:

1. **Submit** — Send prompt (with optional `threadId`), get job ID and thread ID
2. **Poll** — Check status every 2 seconds
3. **Complete** — Process results when done
4. **Continue** — Reuse `threadId` for multi-turn conversations

The `bankr agent prompt` command handles this automatically. When using the REST API directly, implement the poll loop yourself (see Option 2 above or the reference below). For manual job control via CLI, use `bankr agent status <jobId>` and `bankr agent cancel <jobId>`.

For details on the API structure, job states, polling strategy, and error handling, see:

**Reference**: [references/api-workflow.md](references/api-workflow.md)

### Synchronous Endpoints (Wallet API)

For direct signing and transaction submission, use the Wallet API synchronous endpoints:

- **POST /wallet/sign** - Sign messages, typed data, or transactions without broadcasting
- **POST /wallet/submit** - Submit raw transactions directly to the blockchain
- **POST /wallet/transfer** - Transfer tokens with symbol resolution and multi-chain support

These endpoints return immediately (no polling required) and are ideal for:
- Authentication flows (sign messages)
- Gasless approvals (sign EIP-712 permits)
- Pre-built transactions (submit raw calldata)
- Programmatic token transfers

**Reference**: [references/sign-submit-api.md](references/sign-submit-api.md)

## Error Handling

Common issues and fixes:

- **Authentication errors** → Run `bankr login` or check `bankr whoami` (CLI), or verify your `X-API-Key` header (REST API)
- **Insufficient balance** → Add funds or reduce amount
- **Token not found** → Verify symbol and chain
- **Transaction reverted** → Check parameters and balances
- **Rate limiting** → Wait and retry

For comprehensive error troubleshooting, setup instructions, and debugging steps, see:

**Reference**: [references/error-handling.md](references/error-handling.md)

## Best Practices

### Security

1. Never share your API key or LLM key
2. Use a dedicated agent wallet with limited funds for autonomous agents
3. Use read-only API keys for monitoring and research-only agents
4. Set IP whitelisting for server-side agents with known IPs
5. Verify addresses before large transfers
6. Use stop losses for leverage trading
7. Store keys in environment variables, not source code — add `~/.bankr/` to `.gitignore`

See [references/safety.md](references/safety.md) for comprehensive safety guidance.

### Trading

1. Check balance before trades
2. Specify chain for lesser-known tokens
3. Consider gas costs (use Base/Polygon for small amounts)
4. Start small, scale up after testing
5. Use limit orders for better prices

### Automation

1. Test automation with small amounts first
2. Review active orders regularly
3. Set realistic price targets
4. Always use stop loss for leverage
5. Monitor execution and adjust as needed

## Tips for Success

### For New Users

- Start with balance checks and price queries
- Test with $5-10 trades first
- Use Base for lower fees
- Enable trading confirmations initially
- Learn one feature at a time

### For Experienced Users

- Leverage automation for strategies
- Use multiple chains for diversification
- Combine DCA with stop losses
- Explore advanced features (leverage, Polymarket)
- Monitor gas costs across chains

## Prompt Examples by Category

### Trading

- "Buy $50 of ETH on Base"
- "Swap 0.1 ETH for USDC"
- "Sell 50% of my PEPE"
- "Bridge 100 USDC from Polygon to Base"

### Tokenized Stocks

- "Buy $100 of NVDA on robinhood" (spot, location verification required)
- "Swap $50 of ETH to SPY on robinhood"
- "Sell half my AAPL on robinhood"
- "Buy $100 of NVDA on base" (B20 equity, location verification required)
- "Swap $50 of USDC to GOOGL on base"
- "Buy $50 of AAPLx on solana" (xStocks, no verification)
- "DCA $50 into SPY every friday"
- "Long TSLA with 5x leverage on avantis" (leveraged perp)
- "Short HOOD on hyperliquid"

### Portfolio

- `bankr wallet portfolio` (direct, no AI processing — hides low-value tokens by default)
- `bankr wallet portfolio --pnl` (include profit/loss)
- `bankr wallet portfolio --nfts` (include NFT holdings)
- `bankr wallet portfolio --all` (PnL + NFTs)
- `bankr wallet portfolio --chain base` (single chain)
- "Show my portfolio"
- "What's my ETH balance?"
- "Total portfolio value"
- "Holdings on Base"

### Market Research

- "What's the price of Bitcoin?"
- "Analyze ETH price"
- "Trending tokens on Base"
- "Compare UNI vs SUSHI"
- "Who are the top holders of 0x... on base?"
- "List holders of 0x... on solana with at least $50" (airdrop targeting)

### Files

- "Save this analysis as /research/base-vs-solana.md"
- "Search my files for hyperliquid"
- "How many rows in /exports/portfolio.csv have a negative pnl?"
- "What's the highest score in /data/candidates.json?"

### Transfers

- "Send 0.1 ETH to vitalik.eth"
- "Transfer $20 USDC to @friend"
- "Send 50 USDC to 0x123..."
- "Send 5 USDC to each of these addresses: 0x..., 0x..., 0x..." (bulk — batched into one transaction)

### NFTs

- "Show Bored Ape floor price"
- "Buy cheapest Pudgy Penguin"
- "Show my NFTs"

### Polymarket

- "What are the odds Trump wins?"
- "Bet $10 on Yes for [market]"
- "Show my Polymarket positions"

### Leverage

- "Long $100 of BTC on hyperliquid with 10x"
- "Short ETH with 5x on hyperliquid"
- "Open 5x long on ETH with $100"
- "Short BTC 10x with stop loss at $45k"
- "Long TSLA with 5x on hyperliquid" (stocks via HIP-3)
- "Long spacex on hyperliquid" (company names resolve to their HIP-3 ticker, e.g. SPCX)
- "Show my hyperliquid positions"
- "Show my Avantis positions"

### Automation

- "DCA $100 into ETH weekly"
- "Set limit order to buy ETH at $3,000"
- "Stop loss for all holdings at -20%"

### Token Deployment

**Solana (LaunchLab):**

- "Launch a token called MOON on Solana"
- "Launch a token called FROG and give fees to @0xDeployer"
- "Deploy SpaceRocket with symbol ROCK"
- "Launch BRAIN and route fees to 7xKXtg..."
- "How much fees can I claim for MOON?"
- "Claim my fees for MOON" (works for creator or fee recipient)
- "Show my Fee Key NFTs"
- "Claim my fee NFT for ROCKET" (post-migration)
- "Transfer fees for MOON to 7xKXtg..."

**EVM (Base & Robinhood Chain, via Doppler):**

- "Deploy a token called BankrFan with symbol BFAN on Base"
- "Launch a token with quote-only fees" (all creator fees collected in the quote token)
- "Launch MOON in degen mode" (starts at a $2,500 market cap)
- "Claim fees for my token MTK"

### LLM Credits

- "Top up my LLM credits with $25"
- "Add $50 of LLM credits"
- "How many LLM credits do I have left?"
- "Top up LLM credits using my ETH"
- "Top up my LLM credits with $25 using USDT on Polygon"
- "Add $10 of LLM credits paid in USDT on BNB"
- "Send $20 of LLM credits to @alice"
- "Transfer 5 dollars of my LLM credits to 0xRecipient"

### x402 Paid API Calls

- "Find x402 endpoints for sentiment analysis"
- "Call the weather endpoint on x402"
- "What x402 endpoints are available for price data?"
- "Deploy an x402 endpoint that returns crypto prices"
- "Create an x402 service that summarizes articles"

### Web Browsing

- "Browse coingecko.com and get the top trending tokens"
- "Go to this URL and extract the token contract address"
- "Check the Uniswap UI for the current ETH/USDC pool stats"

### Arbitrary Transactions

- "Submit this transaction: {to: 0x..., data: 0x..., value: 0, chainId: 8453}"
- "Execute this calldata on Base: {...}"
- "Send raw transaction with this JSON: {...}"

### Transfers (Direct)

Transfer tokens via CLI or Wallet API without AI processing. The CLI's `--to` accepts a 0x address or ENS-style name (`.eth`, `.base.eth`, `.cb.id`); the Wallet API accepts the same plus anything `/addresses/resolve` understands. For social handles (Twitter, Farcaster, Telegram) use the AI agent.

```bash
# CLI — token symbol resolution + ENS resolution built in
bankr wallet transfer --to vitalik.eth --token USDC --amount 50 --chain base
bankr wallet transfer --to name.base.eth --native --amount 0.01
bankr wallet transfer --to 0x1234... --token ETH --amount 0.1

# REST API
curl -X POST "https://api.bankr.bot/wallet/transfer" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"to": "vitalik.eth", "token": "USDC", "amount": "50", "chain": "base"}'
```

### Swap (Direct)

Swap tokens via CLI or Wallet API without AI processing. The **CLI** (`bankr wallet swap`) executes **same-chain EVM** swaps only. The **Wallet API** (`/wallet/swap`, `/wallet/swap-quote`) also handles **cross-chain and Solana** legs: same-chain EVM stays on the fast direct path, while cross-chain or any Solana leg routes through Relay behind the same endpoints. The CLI resolves token symbols to contracts and uses the quote's `minBuyAmount` as slippage protection when executing.

Venue selection is automatic and the Wallet API now covers the same edge cases the agent does — you don't pick a route:

- **Same-chain EVM** goes through the DEX aggregator, with a direct-pool venue preferred on thin-liquidity chains; **cross-chain and any Solana leg** goes through the bridge/swap aggregator
- **Brand-new Solana tokens** still on their Raydium LaunchLab bonding curve fall back to the curve when no aggregator route exists yet, instead of failing with "no route". The fallback is narrow: both legs on Solana, a SOL ↔ token pair with an un-migrated curve, a genuine no-route from the aggregator, and **no price-impact limit set on the wallet** — the curve exposes no impact figure to check, so Bankr fails closed rather than fill an unguardable venue. With price-impact protection on, these swaps are rejected by design (the `minBuyAmount` floor still applies inside the fill)
- **Polygon `pUSD` → `USDC.e`** uses the 1:1 on-chain Offramp unwrap rather than a DEX quote: no fee, no slippage, no price impact. Asking the agent to convert pUSD to plain "USDC" on Polygon resolves to `USDC.e` and takes this path — the request is read as the one routable thing it can mean, so the quote, the signing card, and the confirmation all name `USDC.e` rather than the pair failing to route. The reverse direction (`USDC.e` → `pUSD`) is quoted like any ordinary pair, and **buying** pUSD is untouched — the Offramp can only unwrap. The unwrap settles to your own wallet, so a **swap-and-send** naming a different recipient routes through the normal venues instead — it never silently settles to you
- **Robinhood Chain tokenized stocks** are quoted and filled through the aggregator's RFQ makers, settling against USDG, while ordinary Robinhood Chain pairs keep their thin-pool protection
- **Wallet-mode swaps** — where you sign from an external/connected wallet rather than a Bankr-custodied one — now walk the same venue order as every other swap, so a thin-liquidity pair reaches its direct-pool venue instead of being diverted to the bridge aggregator. Practical effects: a route that used to need an approval plus a router call can now come back as a single transaction to sign, and a leg whose build fails is reported as **failed** rather than handed to you as something to sign under a success message

```bash
# CLI — quote only (no execution)
bankr wallet swap --from ETH --to USDC --amount 0.1 --chain base --quote-only

# CLI — quote then execute
bankr wallet swap --from ETH --to USDC --amount 0.1 --chain base

# REST API — quote (read; read-only keys allowed)
curl -X POST "https://api.bankr.bot/wallet/swap-quote" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"fromChain": "base", "fromToken": "0x...", "toChain": "base", "toToken": "0x...", "amount": "0.1"}'

# REST API — execute (write; pass the quote's minBuyAmount for slippage protection)
# Always send an idempotencyKey so a retried request can't broadcast a second swap
curl -X POST "https://api.bankr.bot/wallet/swap" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"fromChain": "base", "fromToken": "0x...", "toChain": "base", "toToken": "0x...", "amount": "0.1", "minBuyAmount": "...", "idempotencyKey": "<uuid>"}'

# REST API — cross-chain (Base → Solana): distinct fromChain/toChain, base58 mint on the Solana leg
curl -X POST "https://api.bankr.bot/wallet/swap-quote" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"fromChain": "base", "fromToken": "0x...", "toChain": "solana", "toToken": "<base58-mint>", "amount": "25"}'
```

The `/wallet/swap*` endpoints take token **contract addresses** — EVM legs use a 0x address (zero address for the chain's native token), Solana legs use a base58 mint; the CLI resolves symbols for you. For a **cross-chain or Solana** swap, set `fromChain`/`toChain` to different chains (or to `solana`) and the endpoints quote/execute the route automatically. Swap output is always returned to your own wallet, so `allowedRecipients` does not apply. Supported EVM chains include `base`, `mainnet`, `polygon`, `unichain`, `arbitrum`, `bnb`, `worldchain`, and `robinhood`, plus `solana`. **Executing** a swap that touches tokenized stocks on `robinhood` requires a passed location check on **either leg** — without one `/wallet/swap` returns `403` with instructions to verify at the Bankr console. Quotes are **not** gated, so a successful `/wallet/swap-quote` is not clearance to execute. Execution is also checked against your Bankr Terminal per-transaction and daily spend limits (a `403` is returned when a limit would be exceeded).

#### Optional swap parameters

| Field | Where | Description |
|-------|-------|-------------|
| `slippageBps` | quote + execute | Max slippage tolerance in bps, `10`–`2000`. Defaults to `500` (5%) and sets the quote's `minBuyAmount` |
| `quoteId` | execute | Echo the `quoteId` from a fresh quote to reuse it and skip re-pricing. Stale, unknown or mismatched ids fall back to a fresh quote silently |
| `idempotencyKey` | execute | UUID duplicate-submit guard. A repeat POST with the same key returns the original result instead of broadcasting again |

Only `from`, `to` and `minBuyAmount` are guaranteed on a quote response. Depending on the venue that priced it you may also get `feeBps` (`0` = fee-free), `feeWaivedForEcosystemToken`, `slippageBps`, `priceImpactBps` (display estimate), `swapImpactBps` (the fee-exclusive figure execution gates on), `networkCostsUsd`, `maxPriceImpactBps` (your wallet's protection limit), `sellTokenPriceUsd`, `buyTokenPriceUsd`, and `quoteId`. Treat a missing field as `null`/unknown rather than hard-blocking on it.

Two caveats worth coding against:

- **`slippageBps` is clamped at execution on the aggregator path.** It always shapes the quote's `minBuyAmount`, but only Relay-routed pairs (cross-chain, Solana, the relay-first chains — tokenized-stock legs excepted) carry your full tolerance into the fill. Elsewhere the execution re-quote is clamped to **2% (200 bps)** by design, so the gap between a looser quote tolerance and the tighter execution tolerance is headroom for price drift, not the slippage you'll get.
- **`quoteId` reuse only affects same-chain EVM.** Cross-chain and Solana executions route before the stored-quote lookup, so the id is accepted and ignored there.

#### Swap error semantics

| Status | Meaning |
|--------|---------|
| `400` | Invalid body, unsupported chain, same-token swap, amount too small, insufficient balance/gas, untradable pair, venue-side price impact too high, or no Solana address on the wallet |
| `403` | Read-only key, wallet paused, failed location check, buy token banned or scan-flagged, price impact above **your wallet's** limit, fee beneficiary selling its own fee token, or a spend limit would be exceeded |
| `409` | A swap with the same `idempotencyKey` is still processing, or a pending transaction is in the way |
| `429` | Rate limited — safe to retry |
| `502` | No fresh quote at execution, a Relay fill failed, or a LaunchLab fill was broadcast but couldn't be confirmed |
| `503` | Swap service temporarily unavailable — safe to retry |
| `504` | Submitted, but confirmation is taking longer than expected |

> **Never blind-retry a `504` or a LaunchLab `502`.** Both mean the transaction **may already be on-chain** — it was broadcast and only the confirmation is missing. Check the wallet's activity for the hash before retrying. Everything else is either pre-broadcast (safe to retry, ideally with the same `idempotencyKey`) or terminal.

Note the two different price-impact rejections: a `400` is the **venue** refusing the trade (the pool can't absorb it — retry smaller), while a `403` is **your own wallet's** price-impact protection rejecting the fresh execution quote. Don't read that `403` as an auth or location problem.

### Sign API (Synchronous)

Direct message signing without AI processing:

```bash
# Sign a plain text message
curl -X POST "https://api.bankr.bot/wallet/sign" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"signatureType": "personal_sign", "message": "Hello, Bankr!"}'

# Sign EIP-712 typed data (permits, orders)
curl -X POST "https://api.bankr.bot/wallet/sign" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"signatureType": "eth_signTypedData_v4", "typedData": {...}}'

# Sign a transaction without broadcasting
curl -X POST "https://api.bankr.bot/wallet/sign" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"signatureType": "eth_signTransaction", "transaction": {"to": "0x...", "chainId": 8453}}'
```

### Submit API (Synchronous)

Direct transaction submission without AI processing:

```bash
# Submit a raw transaction
curl -X POST "https://api.bankr.bot/wallet/submit" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "transaction": {"to": "0x...", "chainId": 8453, "value": "1000000000000000000"},
    "waitForConfirmation": true
  }'
```

**Reference**: [references/sign-submit-api.md](references/sign-submit-api.md)

## Resources

- **Documentation**: https://docs.bankr.bot
- **LLM Gateway Docs**: https://docs.bankr.bot/llm-gateway/overview
- **API Key Management**: https://bankr.bot/api-keys
- **Terminal**: https://bankr.bot/terminal
- **CLI Package**: https://www.npmjs.com/package/@bankr/cli
- **Twitter**: @bankr_bot

## Troubleshooting

### CLI Not Found

```bash
# Verify installation
which bankr

# Reinstall if needed
bun install -g @bankr/cli
```

### Authentication Issues

**CLI:**
```bash
# Check current auth
bankr whoami

# Re-authenticate
bankr login

# Check LLM key specifically
bankr config get llmKey
```

**REST API:**
```bash
# Test your API key
curl -s "https://api.bankr.bot/_health" -H "X-API-Key: $BANKR_API_KEY"
```

### API Errors

See [references/error-handling.md](references/error-handling.md) for comprehensive troubleshooting.

### Getting Help

1. Check error message in CLI output or API response
2. Run `bankr whoami` to verify auth (CLI) or test with a curl to `/_health` (REST API)
3. Consult relevant reference document
4. Test with simple queries first (`bankr agent prompt "What is my balance?"` or `POST /agent/prompt`)

---

**Pro Tip**: The most common issue is not specifying the chain for tokens. When in doubt, always include "on Base" or "on Ethereum" in your prompt — or paste the contract address, which Bankr verifies against the chain that actually hosts it.

**Security**: Keep your API key private. Never commit your config file to version control. Only trade amounts you can afford to lose.

**Quick Win**: Start by checking your portfolio (`bankr wallet portfolio`) to see what's possible, then try a small $5-10 trade on Base to get familiar with the flow.

---

## Profile Management

Agents can create and manage public profile pages at [bankr.bot/agents](https://bankr.bot/agents). Profiles showcase project metadata, team info, token data (chart + market cap), weekly fee revenue, shipped products, and a Twitter activity feed.

**Eligibility**: You must have deployed a token through Bankr (Doppler or Clanker) or be a fee beneficiary on the token to create a profile. The token address is verified against your deployment history and beneficiary records.

### Profile Lifecycle

1. **Deploy a token** through Bankr (required prerequisite)
2. **Create** a profile via CLI or REST API with the token address
3. **Populate** metadata (team, products, revenue sources)
4. **Admin approval** — profiles start with `approved: false` and become publicly visible after admin approval
5. **Maintain** — post project updates, keep products and revenue sources current

### CLI Commands

```bash
bankr agent profile                     # View own profile
bankr agent profile create              # Interactive creation wizard
bankr agent profile create --name "My Agent" --token 0x... --twitter myagent
bankr agent profile update --description "Updated description"
bankr agent profile delete              # Delete own profile (with confirmation)
bankr agent profile add-update          # Add a project update
bankr agent profile add-update --title "v2 Launch" --content "Shipped new features"
```

All commands support `--json` for structured output (enables programmatic use).

### REST API Endpoints

All endpoints require API key authentication via `X-API-Key` header.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/agent/profile` | Get own profile |
| `POST` | `/agent/profile` | Create profile |
| `PUT` | `/agent/profile` | Update profile fields |
| `DELETE` | `/agent/profile` | Delete own profile |
| `POST` | `/agent/profile/update` | Add a project update |

**Create profile:**
```bash
curl -X POST "https://api.bankr.bot/agent/profile" \
  -H "X-API-Key: $BANKR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"projectName": "My Agent", "tokenAddress": "0x...", "description": "An AI trading agent"}'
```

**Add a project update:**
```bash
curl -X POST "https://api.bankr.bot/agent/profile/update" \
  -H "X-API-Key: $BANKR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "v2 Launch", "content": "Shipped swap optimization and new UI"}'
```

See [references/agent-profiles.md](references/agent-profiles.md) for the full integration guide.
