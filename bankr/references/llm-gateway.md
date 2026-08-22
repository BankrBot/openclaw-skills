# LLM Gateway Reference

The Bankr LLM Gateway is a unified API for Claude, Gemini, GPT, and other models. It provides multi-provider access, cost tracking, automatic failover, and SDK compatibility through a single endpoint.

**Base URL:** `https://llm.bankr.bot`

The gateway accepts both `https://llm.bankr.bot` and `https://llm.bankr.bot/v1` — it normalizes paths automatically. Works with both OpenAI and Anthropic API formats.

## Authentication

The gateway uses your **LLM key** for authentication. The key resolution order:

1. `BANKR_LLM_KEY` environment variable
2. `llmKey` in `~/.bankr/config.json`
3. Falls back to your Bankr API key (`BANKR_API_KEY` / `apiKey`)

Most users only need a single key for both the agent API and the LLM gateway. Set a separate LLM key only if your keys have different permissions or rate limits.

**Dashboard:** Manage usage, credits, and auto top-up at [bankr.bot/llm](https://bankr.bot/llm). Top up credits at [bankr.bot/llm?tab=credits](https://bankr.bot/llm?tab=credits). Generate and configure API keys at [bankr.bot/api-keys](https://bankr.bot/api-keys).

### Setting the LLM Key

**Via CLI:**
```bash
bankr login --llm-key YOUR_LLM_KEY            # during login
bankr config set llmKey YOUR_LLM_KEY           # after login
```

**Via environment variable:**
```bash
export BANKR_LLM_KEY=your_llm_key_here
```

**Verify:**
```bash
bankr config get llmKey
```

## Available Models

| Model | Provider | Best For |
|-------|----------|----------|
| `claude-fable-5` | Anthropic | Latest generation, agentic + multimodal (1M context, image input) |
| `claude-opus-5` | Anthropic | Latest Opus, most capable reasoning (1M context, image input) |
| `claude-opus-4.8` | Anthropic | Previous flagship Opus (1M context) |
| `claude-opus-4.7` | Anthropic | Advanced reasoning (1M context) |
| `claude-opus-4.6` | Anthropic | Advanced reasoning (1M context) |
| `claude-opus-4.5` | Anthropic | Complex reasoning (200K context) |
| `claude-sonnet-5` | Anthropic | Latest Sonnet, balanced speed and quality (1M context, image input) |
| `claude-sonnet-4.6` | Anthropic | Previous generation Sonnet (1M context) |
| `claude-sonnet-4.5` | Anthropic | Earlier Sonnet (1M context) |
| `claude-haiku-4.5` | Anthropic | Fast, cost-effective (200K context) |
| `gemini-3.7-flash` | Google | Latest Flash — the Bankr agent's default model (1M, image input) |
| `gemini-3.6-flash` | Google | Previous Flash, coding and agents (1M, image input) |
| `gemini-3.5-flash` | Google | Fast general-purpose (1M) |
| `gemini-3.5-flash-lite` | Google | Ultra-fast, lowest cost (1M) |
| `gemini-3.1-pro` | Google | Long context, reasoning (1M) |
| `gemini-3.1-flash-lite` | Google | Ultra-fast, lowest cost (1M) |
| `gemini-3-pro` | Google | Previous-gen Pro, long context (1M) |
| `gemini-3-flash` | Google | High throughput (1M) |
| `gemini-2.5-pro` | Google | Long context, multimodal |
| `gemini-2.5-flash` | Google | Speed, high throughput |
| `gemma-4-31b-it` | Google | Multimodal, cost-effective (262K) |
| `gemma-4-26b-a4b-it` | Google | MoE, cost-effective (262K) |
| `gpt-5.6-sol` | OpenAI | Latest flagship, most capable (1M context, image input) |
| `gpt-5.6-terra` | OpenAI | Latest balanced tier (1M context, image input) |
| `gpt-5.6-luna` | OpenAI | Latest fast/economical tier (1M context, image input) |
| `gpt-5.5` | OpenAI | Previous flagship (1M context, image input) |
| `gpt-5.4` | OpenAI | Advanced reasoning (1M context, image input) |
| `gpt-5.4-mini` | OpenAI | Fast, economical (400K context, image input) |
| `gpt-5.4-nano` | OpenAI | Ultra-fast, lowest cost (400K context, image input) |
| `gpt-5.2` | OpenAI | Advanced reasoning (400K context) |
| `gpt-5.2-codex` | OpenAI | Code generation (400K context) |
| `gpt-5-mini` | OpenAI | Previous gen, economical (400K) |
| `gpt-5-nano` | OpenAI | Previous gen, ultra-fast (400K) |
| `grok-4.20` | xAI | Deep reasoning, largest context (2M context) |
| `grok-4.5` | xAI | Latest, balanced multimodal (500K context, image input) |
| `grok-4.3` | xAI | Balanced performance (1M context) |
| `grok-4.1-fast` | xAI | Fast, economical, largest context (2M) |
| `deepseek-v4-pro` | DeepSeek | Long context reasoning (1M, 384K output) |
| `deepseek-v4-flash` | DeepSeek | High throughput, cost-effective (1M) |
| `deepseek-v3.2` | DeepSeek | Cost-effective (164K context) |
| `qwen3.7-max` | Alibaba | Latest flagship (1M) |
| `qwen3.7-plus` | Alibaba | Latest, long-context reasoning (1M) |
| `qwen3.7-flash` | Alibaba | Latest fast tier, economical (1M, image input) |
| `qwen3.6-flash` | Alibaba | Fast, economical (1M) |
| `qwen3.5-plus` | Alibaba | Long-context reasoning (1M) |
| `qwen3.5-flash` | Alibaba | Fast, economical (1M) |
| `qwen3-coder` | Alibaba | Code generation, debugging (262K) |
| `kimi-k3` | Moonshot AI | Latest flagship, long-context multimodal (1M context, image input) |
| `kimi-k2.7-code` | Moonshot AI | Code-focused long-context (262K) |
| `kimi-k2.6` | Moonshot AI | Long-context (262K) |
| `kimi-k2.5` | Moonshot AI | Long-context reasoning (262K) |
| `minimax-m3` | MiniMax | Flagship multimodal reasoning (512K context) |
| `minimax-m2.7` | MiniMax | Balanced performance (204.8K) |
| `minimax-m2.7-highspeed` | MiniMax | Faster variant, double throughput (204.8K) |
| `minimax-m2.5` | MiniMax | Cost-effective (204.8K) |
| `glm-5.2` | Z.ai | Latest, long-context reasoning (1M) |
| `glm-5.1` | Z.ai | Advanced reasoning (202K) |
| `glm-5` | Z.ai | General purpose reasoning (202K) |
| `glm-5-turbo` | Z.ai | Fast, cost-effective (202K) |

```bash
# Fetch live model list from the gateway
bankr llm models
```

The table above is a curated snapshot; the gateway adds and retires models over time. Run `bankr llm models` (or `GET /v1/models`) for the authoritative live list, current pricing, and per-model capability flags.

### Privacy Tiers (standard / zdr / private)

Every request is served at one of three nesting data-handling tiers. Each contains the guarantees of the one below it.

| Tier | What it guarantees | Coverage |
|------|--------------------|----------|
| `standard` (default) | Never routed to a provider that trains on your prompts. Providers may still **retain** them. Covers the routing hop only. | Every model |
| `zdr` | Only providers whose verdict for that model's slot allows **zero retention**. | Subset — `bankr llm models --zdr` |
| `private` | TEE (hardware enclave) compute, attestation verified per request. Zero-retention by construction. | Open-weight models only |

```bash
bankr llm models                  # full list; zdr- and private-capable models are flagged
bankr llm models --zdr            # only models with a zero-retention slot
bankr llm models --private        # only models that support TEE compute
```

**Every tier fails closed.** If no provider can serve your model at the tier you asked for, the request is rejected — never quietly downgraded to a weaker one.

#### Four ways to request a tier

**1. The `privacy` request field** — the documented form for anything that builds its own body. Works on `/v1/chat/completions`, `/v1/messages`, and `/v1/images/generations`:

```bash
curl -X POST "https://llm.bankr.bot/v1/chat/completions" \
  -H "Authorization: Bearer $BANKR_LLM_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "glm-5.2", "privacy": "zdr", "messages": [{"role": "user", "content": "Hello"}]}'
```

Accepted values: `"standard"`, `"zdr"`, `"private"`.

**2. A base-path prefix** — for tools that only let you set a base URL, an API key, and a model. The prefix sits in front of the whole API, so it serves both SDK conventions from one setting:

```bash
# OpenAI-compatible clients (base URL ends in /v1)
export OPENAI_BASE_URL=https://llm.bankr.bot/zdr/v1

# Anthropic-compatible clients (Claude Code, OpenClaw — they append /v1/messages)
export ANTHROPIC_BASE_URL=https://llm.bankr.bot/zdr
```

`/private` works the same way. Every request through that base URL is served at the tier with no per-request configuration.

**3. A model-ID suffix** — per model rather than per base URL:

```
glm-5.2:zdr
glm-5.2:private
```

Only a **trailing** tier token counts as the opt-in, so unrelated model IDs containing a colon are unaffected. Matching is case-insensitive (`:ZDR`, `:Private` both work). The suffix is stripped before model lookup — privacy is a routing constraint, not part of the model's identity.

**4. Account-wide** — turn ZDR on under **Settings** in the web terminal and every request from the account is served at that tier or stronger.

#### Rules that decide the effective tier

- **Account setting + request: combine, strongest wins.** A request can tighten past the account setting, but nothing in a request — and no choice of base URL — can drop below it.
- **A tier endpoint is authoritative.** A request naming a *different* tier than the `/zdr` or `/private` endpoint it was sent to is rejected, in either direction, so an integration pinned to a tier endpoint stays usable as an audit point. Sending no privacy option, or one that matches, is fine. To mix tiers, use the `privacy` field against the default endpoint.
- **`X-Privacy-Tier` response header** reports the tier the request was actually handled under. It's set as soon as the tier is known, so it describes the policy even on a request that then fails. (`private` additionally sets `X-Confidential-Verified` and the attested-identity headers.)

#### Privacy error responses

| Status | Code | Meaning |
|--------|------|---------|
| `422` | `zdr_unavailable` | No provider can serve that model with zero retention. Pick a model from `bankr llm models --zdr`. |
| `422` / `503` | — | A `:private` request where no confidential provider serves the model (422), or its attestation couldn't be verified (503). Never a silent downgrade. |
| `400` | `privacy_conflict` | The request named a different tier than the tier endpoint it was sent to. Remove the privacy option, or send it to the matching endpoint. |
| `400` | `invalid_privacy` | The `privacy` field (or a legacy `zdr`/`private` boolean flag) had an uninterpretable value. Rejected rather than ignored — the unset state is the weak one, so a typo like `"zdrr"` must not silently serve at standard tier. |

### Max Mode — Choose the Agent's Model

Max Mode replaces the Bankr agent's default model (`gemini-3.7-flash`) with any gateway model, billed per token from your **LLM credit balance**. It's the pay-per-use alternative to a Bankr Club subscription for unlimited terminal messages, and unlike Club checkout it works with external/connected wallets.

```bash
bankr agent "analyze my portfolio" --model claude-opus-5
bankr agent "what are the top memecoins today?" -m gemini-3.1-pro
bankr agent prompt "tell me more" --continue --model claude-sonnet-5
```

The selection is stored on your wallet and applies across every surface — CLI, web terminal, Farcaster, X, Telegram, XMTP, and automations. In the web terminal, toggle the **Max** button and pick a model from the picker; a usage badge under each response shows model, tokens, and cost.

**How credits are enforced:**

- Your **effective balance** (spendable credits minus usage already metered but not yet deducted) becomes the run's budget, and it is re-checked **before every LLM call** — alongside the existing step and wall-clock budgets. The turn ends honestly when the budget is reached rather than running up an unbounded bill.
- **Deduction is all-or-nothing.** A batch your balance can't fully cover leaves the credit untouched and the usage still owed, so the debt survives intact and a later top-up settles it — it is never written off.
- App-invoked and x402-gated runs count undeducted usage against the balance too, so a pending bill can't be spent twice.
- On the Agent API, non-Club Max Mode is capped at 100 requests/day.

Top up before enabling (`bankr llm credits add 25`), or Max Mode messages will fail.

### Per-Model Discounts

The gateway supports per-model discounts based on account tier. Bankr Club members and partner-provisioned wallets receive automatic discounts on eligible models — applied at billing time with no configuration needed. Check `bankr llm models` for current pricing and active promotions.

## Credits

> **New wallets start with $0 LLM credits.** Top up via CLI (`bankr llm credits add 25`) or at [bankr.bot/llm?tab=credits](https://bankr.bot/llm?tab=credits) before your first LLM call. Without credits, all gateway requests return HTTP 402.

Check your LLM gateway credit balance:

```bash
bankr llm credits
```

Top up credits from your wallet. Pay on any supported EVM chain — **Base, Polygon, Ethereum, Arbitrum, or BNB Chain** — and the CLI picks the chain holding the highest USD balance of your chosen token.

```bash
bankr llm credits add 25                   # Defaults to Base USDC
bankr llm credits add 25 --token USDC      # USDC on the chain with the largest balance
bankr llm credits add 25 --token USDT      # USDT (Polygon / Ethereum / Arbitrum / BNB)
bankr llm credits add 50 --token ETH       # Native ETH (Base / Ethereum / Arbitrum)
bankr llm credits add 50 --token 0x...     # By contract address
bankr llm credits add 25 -y                # Skip confirmation prompt
```

USDC and USDT are sent directly when they're an accepted stablecoin on the resolved chain. Any other token is auto-swapped to the chain's preferred stablecoin (USDC on most chains, USDT on BNB) with ≤5% slippage protection.

Configure automatic top-up so credits never run out (tokens are resolved across every supported chain — the worker tries them in priority order on their saved chains):

```bash
bankr llm credits auto                     # View current auto top-up config
bankr llm credits auto --enable --amount 25 --threshold 5 --tokens USDC,USDT
bankr llm credits auto --disable
```

When credits are exhausted, gateway requests will fail with HTTP 402.

### Expiring Credit Grants

Beyond purchased credits, your account may receive **time-limited grant credits** (for example promotional or developer grants). Your spendable balance is your permanent pool (purchases and regular top-ups) plus the remaining amount of any unexpired grants:

```
spendable = permanent pool + Σ (remaining of each grant where expiry > now)
spend order = expiring grants first (soonest-expiring), then the permanent pool
```

Expired grants drop off automatically — there is no manual cleanup. The Credits page and `/llm/usage` show a breakdown of your permanent pool vs. each grant and its expiry, and your credit history labels grant rows.

### Sending Credits to Another Bankr User

Purchased credit is transferable peer-to-peer. Ask the agent, or call the API directly:

```bash
bankr agent prompt "Send $20 of LLM credits to @alice"
bankr agent prompt "Transfer 5 dollars of my LLM credits to 0xRecipient"
```

```bash
curl -X POST "https://api.bankr.bot/llm/credits/transfer" \
  -H "X-API-Key: $BANKR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"recipientAddress":"0xRecipient","amountUsd":20,"transferId":"my-unique-id"}'
```

The key needs **LLM Gateway** access enabled, like the top-up endpoint.

The sender is debited and the recipient credited atomically — there is no pending state to reconcile.

| Rule | Detail |
|------|--------|
| **Recipient** | Must already be a Bankr user. The agent accepts an X (Twitter) username or a `0x` address; the API takes the resolved EVM address. ENS names are not supported on this path. |
| **Only purchased credit moves** | Grant credit (promotional, developer, partner) is **not** transferable — your sendable figure is the purchased slice of your pool, minus usage that's metered but not yet deducted. |
| **Minimum** | $1 per transfer. |
| **Rolling cap** | $500 gross sent per wallet per **trailing 24 hours** (shared with the same window the daily spend budget uses). Over it, the call returns `429`. |
| **Write scope** | Read-only API keys are refused (`403`). If the key has an `--allowed-recipients` allowlist, the recipient must be on it. |
| **Wallet controls apply** | A paused wallet can't send, and a wallet-level permitted-recipients list gates credit transfers exactly as it gates on-chain sends. |
| **Idempotency** | Pass your own `transferId`; a retry with the same value never double-sends. |

Failure codes are explicit rather than generic: `self-transfer` / `amount-too-small` (`400`), `insufficient-credit` (`402`), `wallet-paused` / `recipient-not-permitted` (`403`), `recipient-invalid` (`404`), `transfer-conflict` (`409`), `daily-cap-exceeded` / `daily-budget-exceeded` (`429`).

`GET /llm/usage` returns `transferableUsd` — the sendable figure, already clamped by the remaining 24h cap and by any daily spend budget — so a client can offer a "Max" the transfer endpoint won't then reject.

### Daily Spend Budget

You can cap what the gateway may spend on your behalf, independently of your balance. The cap is measured over a **trailing 24 hours**, not a calendar day — nothing resets at midnight; capacity returns as individual charges age out of the window.

```bash
# Read or set from the web console at bankr.bot/llm
GET  /llm/daily-budget      # { config: { limitUsd }, spentUsd }
POST /llm/daily-budget      # { "limitUsd": 25 }   — null clears the cap
```

- Over budget, spending requests are rejected with `402 Payment Required` and error `type: daily_budget_exceeded` — distinct from `insufficient_credits`, which means the balance itself ran out.
- **Only requests that spend are blocked.** Every read-only `GET` keeps working — `/v1/credits`, `/v1/usage`, `/v1/models` among them — so poll `exceeded` on `/v1/credits` to learn when you're unblocked, and `/v1/usage` for what consumed the budget. There is no reset time to schedule against.
- The same budget also ends Max Mode agent runs early, so a capped wallet sees it on the agent surface too.

### Agent Credit Top-Up

The AI agent can also top up credits directly in conversation:

```bash
bankr agent prompt "Top up my LLM credits with $25"
bankr agent prompt "Add $10 of LLM credits using my ETH"
```

1 credit = $1 USD. Multi-chain: pay with USDC or USDT directly on Base, Polygon, Ethereum, Arbitrum, or BNB Chain, or with any other ERC-20 (auto-swapped to the chain's preferred stablecoin — USDC on most chains, USDT on BNB). Maximum $1,000 per top-up.

> **LLM credits vs trading wallet:** These are completely separate balances on the same account and API key. Your trading wallet (ETH, SOL, USDC) is for on-chain transactions. LLM credits (USD) are for gateway API calls. Having crypto does NOT give you LLM credits.

## LLM Gateway Setup

If the user already has a Bankr account, they just need to configure the gateway. If not, they need to create one first.

### Have Bankr Account

1. Get an API key with **LLM Gateway** enabled:
   - **Have a key?** Enable LLM Gateway at [bankr.bot/api-keys](https://bankr.bot/api-keys)
   - **Need a key?** Generate via CLI: `bankr login email user@example.com` → `bankr login email user@example.com --code OTP --accept-terms --key-name "My Agent" --llm`
2. Run: `bankr llm setup openclaw --install`
3. Set default model in `~/.openclaw/openclaw.json`:
   ```json
   { "agents": { "defaults": { "model": { "primary": "bankr/claude-sonnet-4.6" } } } }
   ```
4. Verify credits: `bankr llm credits` (must show > $0 — top up via `bankr llm credits add 25` or at [bankr.bot/llm?tab=credits](https://bankr.bot/llm?tab=credits))
5. Restart OpenClaw or run: `openclaw gateway restart`

### Need Bankr Account

1. Send OTP: `bankr login email user@example.com`
2. Complete setup: `bankr login email user@example.com --code OTP --accept-terms --key-name "My Agent" --llm`
   - Can also create/configure keys at [bankr.bot/api-keys](https://bankr.bot/api-keys)
3. **Top up credits:** `bankr llm credits add 25` or at [bankr.bot/llm?tab=credits](https://bankr.bot/llm?tab=credits) — new wallets start with $0
4. Verify: `bankr llm credits` (must show > $0)
5. Run: `bankr llm setup openclaw --install`
6. Set default model in `~/.openclaw/openclaw.json` (see above)
7. Restart OpenClaw or run: `openclaw gateway restart`

> **Model names:** In OpenClaw, prefix with `bankr/` (e.g. `bankr/claude-sonnet-4.6`). In direct API calls, use bare IDs (e.g. `claude-sonnet-4.6`).

For the full 4-path setup guide (including users who don't have OpenClaw yet), see https://docs.bankr.bot/llm-gateway/openclaw

### Separate LLM and Agent API Keys

By default, one key is used for both. To use separate keys:

```bash
bankr config set llmKey YOUR_LLM_KEY           # after login
bankr login email user@example.com --llm-key YOUR_LLM_KEY  # during login
```

Key resolution: `BANKR_LLM_KEY` env var → `llmKey` in config → falls back to API key.

### Key Permissions

Manage at [bankr.bot/api-keys](https://bankr.bot/api-keys):

| Toggle | Controls |
|--------|----------|
| **LLM Gateway** | Access to `llm.bankr.bot` for model requests |
| **Agent API** | Access to wallet actions, prompts, and transactions |
| **Read Only** | Agent API only — restricts to read operations |

## Tool Integrations

### OpenClaw

Auto-install the Bankr provider into your OpenClaw config:

```bash
# Write config to ~/.openclaw/openclaw.json
bankr llm setup openclaw --install

# Preview the config without writing
bankr llm setup openclaw
```

This writes the following provider config (with your key and all available models):

```json
{
  "models": {
    "providers": {
      "bankr": {
        "baseUrl": "https://llm.bankr.bot",
        "apiKey": "your_key_here",
        "api": "openai-completions",
        "models": [
          { "id": "claude-opus-4.8", "name": "Claude Opus 4.8", "api": "anthropic-messages" },
          { "id": "claude-sonnet-4.6", "name": "Claude Sonnet 4.6", "api": "anthropic-messages" },
          { "id": "claude-haiku-4.5", "name": "Claude Haiku 4.5", "api": "anthropic-messages" },
          { "id": "gemini-3.5-flash", "name": "Gemini 3.5 Flash" },
          { "id": "gpt-5.5", "name": "GPT 5.5" },
          { "id": "deepseek-v4-pro", "name": "DeepSeek V4 Pro" }
        ]
      }
    }
  }
}
```

Claude models are automatically configured with `"api": "anthropic-messages"` per-model overrides while all other models use the default `"api": "openai-completions"`.

To use a Bankr model as your default in OpenClaw, add to `openclaw.json`:

```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "bankr/claude-sonnet-4.6"
      }
    }
  }
}
```

### Claude Code

Two ways to use Claude Code with the gateway:

**Option A: Launch directly (recommended)**

```bash
# Launch Claude Code through the gateway
bankr claude              # top-level alias
bankr llm claude          # equivalent, explicit form

# Pass any Claude Code flags through
bankr claude --model claude-sonnet-5
bankr claude --allowedTools Edit,Write,Bash
bankr claude --resume
```

All arguments after `claude` are forwarded to the `claude` binary. The CLI sets `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN` automatically from your config (using `llmKey` if set, otherwise `apiKey`).

`bankr claude` is a top-level alias for `bankr llm claude` (requires **@bankr/cli 0.3.18+**; `bankr llm claude` works on every version). Named commands win over the prompt fallthrough, so `bankr claude ...` launches Claude Code rather than sending "claude ..." to the agent — use `bankr agent "..."` when a prompt starts with a command name.

`-h` / `--help` on the launchers (`bankr claude`, `bankr llm claude`, `bankr llm opencode`) is forwarded to the spawned tool and prints *its* help, without requiring authentication. For the Bankr CLI's own help use `bankr --help` or `bankr llm --help`.

**1M-token context tier:** Claude Code exposes it as a `[1m]` model suffix (`claude-opus-5[1m]`). Through the gateway the suffix is **optional** — it is stripped before model lookup and the 1M window is enabled from the model's own context window, so `claude-opus-5` and `claude-opus-5[1m]` send an identical request. Omitting it is simplest. If you do pass it, **quote it**: in zsh (the macOS default) `[1m]` is a glob character class and the command aborts with `zsh: no matches found` before the CLI runs, while bash passes it through literally — so the same command can work on one machine and fail on another.

```bash
bankr claude --model claude-opus-5          # full 1M window, nothing to quote
bankr claude --model "claude-opus-5[1m]"    # explicit suffix — quotes required
```

Inside `~/.claude/settings.json` it's already a JSON string, so no extra escaping is needed: `{ "model": "claude-opus-5[1m]" }`.

**Option B: Set environment variables**

```bash
# Print the env vars to add to your shell profile
bankr llm setup claude
```

This outputs:
```bash
export ANTHROPIC_BASE_URL="https://llm.bankr.bot"
export ANTHROPIC_AUTH_TOKEN="your_key_here"
```

Add these to `~/.zshrc` or `~/.bashrc` so all Claude Code sessions use the gateway.

### OpenCode

```bash
# Launch OpenCode through the gateway (args forwarded to the tool)
bankr llm opencode

# Auto-install Bankr provider into ~/.config/opencode/opencode.json
bankr llm setup opencode --install

# Preview without writing
bankr llm setup opencode
```

### Cursor

```bash
# Get step-by-step setup instructions with your API key
bankr llm setup cursor
```

The setup adds your key as the OpenAI API Key, sets `https://llm.bankr.bot/v1` as the base URL override, and registers the available model IDs. When the base URL override is enabled, all model requests go through the gateway.

## Direct SDK Usage

The gateway is compatible with standard OpenAI and Anthropic SDKs — just override the base URL.

### curl (OpenAI format)

```bash
curl -X POST "https://llm.bankr.bot/v1/chat/completions" \
  -H "Authorization: Bearer $BANKR_LLM_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4.6",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### curl (Anthropic format)

```bash
curl -X POST "https://llm.bankr.bot/v1/messages" \
  -H "x-api-key: $BANKR_LLM_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4.6",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### OpenAI SDK (Python)

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://llm.bankr.bot/v1",
    api_key="your_bankr_key",
)

response = client.chat.completions.create(
    model="claude-sonnet-4.6",
    messages=[{"role": "user", "content": "Hello"}],
)
```

### OpenAI SDK (TypeScript)

```typescript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://llm.bankr.bot/v1",
  apiKey: "your_bankr_key",
});

const response = await client.chat.completions.create({
  model: "gemini-3-flash",
  messages: [{ role: "user", content: "Hello" }],
});
```

### Anthropic SDK (Python)

```python
from anthropic import Anthropic

client = Anthropic(
    base_url="https://llm.bankr.bot",
    api_key="your_bankr_key",
)

message = client.messages.create(
    model="claude-sonnet-4.6",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello"}],
)
```

## Image Generation

The gateway supports image generation through an OpenAI-native `POST /v1/images/generations` endpoint (model `gpt-image-2`). The request and response mirror OpenAI's images API, so the OpenAI SDK's `images.generate()` works against the gateway with just a base-URL swap:

```bash
curl -X POST "https://llm.bankr.bot/v1/images/generations" \
  -H "Authorization: Bearer $BANKR_LLM_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-image-2", "prompt": "a neon city skyline at dusk"}'
```

```python
from openai import OpenAI

client = OpenAI(base_url="https://llm.bankr.bot/v1", api_key="your_bankr_key")
img = client.images.generate(model="gpt-image-2", prompt="a neon city skyline at dusk")
```

Image-output models are billed from the same LLM credit balance as text models, priced per image (image-output usage is metered separately). Image-capable models advertise an `image` output modality and per-image pricing in `GET /v1/models` (`output_modalities`, `pricing.image_output`); run `bankr llm models` for the current list.

## Model Deprecation

The gateway supports model deprecation with automatic redirect to replacement models:

- **Soft-deprecated models** still work but return `X-Model-Deprecated: true` and `X-Model-Replacement: <new-model-id>` response headers. Migrate to the replacement model at your earliest convenience.
- **Hard-deprecated models** return HTTP 410 (Gone) with the replacement model in the `X-Model-Replacement` header. Update your model ID to continue.

Check `bankr llm models` for current model status and replacement mappings.

## Troubleshooting

### 401 Unauthorized
- Verify key is set: `bankr config get llmKey` or `echo $BANKR_LLM_KEY`
- Check for leading/trailing spaces
- Ensure the key hasn't expired

### 402 Payment Required
- Credits exhausted: `bankr llm credits` shows $0.00
- Top up via CLI: `bankr llm credits add 25` or at [bankr.bot/llm?tab=credits](https://bankr.bot/llm?tab=credits) — this is the most common error for new users
- Set up auto top-up to prevent this: `bankr llm credits auto --enable --amount 25 --threshold 5 --tokens USDC`
- New wallets start with $0 — you must add credits before first use
- LLM credits are separate from your trading wallet balance

### Model not found
- Use exact model IDs (e.g., `claude-sonnet-4.6`, not `claude-3-sonnet`)
- Check available models: `bankr llm models`

### Claude Code not found
- `bankr llm claude` requires Claude Code to be installed separately
- Install: https://docs.anthropic.com/en/docs/claude-code

### Slow responses
- Try `claude-haiku-4.5` or `gemini-3-flash` for faster responses
- The gateway has automatic failover — temporary slowness usually resolves itself

---

**Documentation**: https://docs.bankr.bot/llm-gateway/overview
