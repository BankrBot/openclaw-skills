# v402 — OpenClaw Skill

OpenClaw / AgentSkills-compatible skill that teaches AI agents the v402 HTTP payment protocol on Solana. The agent learns to detect 402 responses, enforce spending policies, submit USDC payments on-chain, and verify Ed25519-signed receipts.

## Install

### Via ClawHub

```bash
clawhub install v402
```

### Via Direct URL

```bash
npx skills add https://github.com/valeo-cash/v402 --skill openclaw
```

### Manual

```bash
cp -r packages/integrations/openclaw ~/.openclaw/skills/v402
bash ~/.openclaw/skills/v402/scripts/install.sh
```

## Configuration

Add to `~/.openclaw/openclaw.json`:

```json
{
  "skills": {
    "entries": {
      "v402": {
        "enabled": true,
        "env": {
          "V402_WALLET_PRIVATE_KEY": "<base58-solana-private-key>",
          "V402_DAILY_CAP": "5.0",
          "V402_PER_CALL_CAP": "1.0",
          "V402_ALLOWED_TOOLS": "web_search,get_token_price,get_balance"
        }
      }
    }
  }
}
```

## What the Agent Can Do

- **Detect 402 responses** — automatically parse `V402-Intent` headers
- **Enforce spending policy** — daily caps, per-call limits, tool and merchant allowlists
- **Submit payments** — USDC SPL transfers on Solana with on-chain confirmation
- **Verify receipts** — Ed25519 signature verification and on-chain transaction lookup
- **Automated flow** — single-command `v402-http.mjs call` handles the entire 402 cycle

## Slash Commands

| Command | Description |
|---|---|
| `/v402 budget` | Show remaining daily budget |
| `/v402 history` | View payment history |
| `/v402 verify <receipt>` | Verify a payment receipt |
| `/v402 wallet` | Show wallet address and balances |

## File Structure

```
openclaw/
├── SKILL.md                    # Agent instructions (injected into system prompt)
├── README.md                   # This file
├── scripts/
│   ├── install.sh              # Dependency installer
│   ├── package.json            # Script dependencies (Solana libs)
│   ├── v402-policy.mjs         # Spending policy manager
│   ├── v402-pay.mjs            # Solana USDC payment submission
│   ├── v402-verify.mjs         # On-chain receipt verification
│   └── v402-http.mjs           # Full automated 402 flow
├── references/
│   └── protocol-spec.md        # v402 protocol specification
└── tests/
    └── openclaw-skill.test.ts  # Vitest integration tests
```

## Distribution

| Channel | Command |
|---|---|
| ClawHub | `clawhub publish` from the skill directory |
| Direct URL | `npx skills add https://github.com/valeo-cash/v402 --skill openclaw` |
| Manual copy | `cp -r` into `~/.openclaw/skills/v402` |

## Links

- [v402 Protocol](https://github.com/valeo-cash/v402)
- [Protocol Spec v2](https://github.com/valeo-cash/v402/blob/main/docs/spec-v2.md)
- [npm packages](https://www.npmjs.com/org/v402pay)

## License

[MIT](https://github.com/valeo-cash/v402/blob/main/LICENSE)
