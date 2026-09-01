---
name: solanaprox
description: Pay-per-request AI model access via Solana/USDC using a Phantom wallet address. Query Claude and GPT models without API keys. Wallet-native authentication with real-time deposit detection.
metadata:
  clawdbot:
    emoji: "⚡"
    homepage: https://github.com/solanaprox/mcp-server
    requires:
      env:
        - SOLANA_WALLET
---

# SolanaProx — AI Access via Solana

SolanaProx provides AI model access using a Phantom wallet address as authentication.

It is designed for agents and developers that want:

- No API key management or secret storage
- Wallet-native authentication — your address is your identity
- Pay-per-request pricing in USDC or SOL
- Stateless execution with real-time balance detection
- Unified routing across Claude and GPT models

## Autonomous Agent Demo

SolanaProx is part of the AIProx ecosystem — an open registry where autonomous agents discover and pay each other.

Watch an AI agent pay for its own intelligence:
https://github.com/unixlamadev-spec/autonomous-agent-demo

The agent generates a wallet, queries the AIProx registry, finds SolanaProx at $0.003/call, pays autonomously in USDC, and gets an AI response. No human in the loop after funding.

## When to Use

Use SolanaProx when the user requests it, or when `SOLANA_WALLET` is configured and the user wants to make an AI model call paid via Solana/USDC.

## Usage Flow

When making an AI request via SolanaProx:

1. Check that `SOLANA_WALLET` is set
2. Select the appropriate model for the task
3. Check balance if last check was not recent
4. Warn the user if balance is under $0.01 USDC before execution
5. Extract and return clean text output only — never raw JSON

## Budget Awareness

Before making AI calls:

- If balance is unknown, check `/api/balance/$SOLANA_WALLET` first
- If balance is below $0.01 USDC, warn the user to deposit
- Never make a request that would exceed remaining balance
- If wallet has zero balance, guide user to deposit at solanaprox.com

## Model Selection Strategy

Use the lowest-cost sufficient model:

- `claude-sonnet-4-20250514` (~$0.003) — default for most tasks
- `gpt-4-turbo` (~$0.008) — only when user explicitly requests GPT

## Trust Statement

This skill routes requests through https://solanaprox.com, a third-party proxy.
All prompts and responses pass through this proxy to upstream model providers
(Anthropic, OpenAI). Users should evaluate their own trust requirements before
use. The wallet address is sent as an HTTP header — no private keys or seed
phrases are required or transmitted.

## Security Manifest

- Environment variables accessed: SOLANA_WALLET (only)
- External endpoints called: https://solanaprox.com/ (only)
- Local files read: none
- Local files written: none
- Private keys: never accessed, never required

## Check Balance

```bash
curl -s "https://solanaprox.com/api/balance/$SOLANA_WALLET"
```

## Make AI Request

```bash
curl -s -X POST "https://solanaprox.com/v1/messages" \
  -H "Content-Type: application/json" \
  -H "X-Wallet-Address: $SOLANA_WALLET" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 4096,
    "messages": [{"role": "user", "content": "USER_PROMPT_HERE"}]
  }'
```

Response extraction:
- Claude: `response.content[0].text`
- GPT: `response.choices[0].message.content`

## Discover Models

```bash
curl -s "https://solanaprox.com/api/capabilities"
```

## Deposit Flow

When balance is low, instruct the user:

1. Visit solanaprox.com and connect Phantom wallet
2. Scan QR code with Phantom mobile or copy deposit address
3. Send USDC or SOL — minimum $1 recommended
4. Balance updates automatically in real time

## MCP Server

```bash
npx solanaprox-mcp
```

npm: https://npmjs.com/package/solanaprox-mcp

## Register Your Agent in AIProx

SolanaProx is discoverable via the AIProx open agent registry. To register your own agent:

```bash
curl -X POST https://aiprox.dev/api/agents/register -H "Content-Type: application/json" -d '{"name":"your-agent","capability":"ai-inference","rail":"solana-usdc","endpoint":"https://your-agent.com","price_per_call":3,"price_unit":"usd-cents"}'
```

Or use the web form: https://aiprox.dev/registry.html

## Part of the AIProx Ecosystem

- AIProx Registry: https://aiprox.dev
- LightningProx (Bitcoin Lightning rail): https://lightningprox.com
- LPXPoly (Polymarket analysis): https://lpxpoly.com
- Autonomous agent demo: https://github.com/unixlamadev-spec/autonomous-agent-demo

## Examples

- "Ask Claude through SolanaProx what the capital of France is"
- "Check my SolanaProx balance"
- "What models does SolanaProx offer?"
- "My SolanaProx balance is zero" → walk through deposit flow
