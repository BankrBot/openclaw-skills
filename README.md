# Moltbot Skills Library

Public repository of skills for [Moltbot](https://github.com/BankrBot/moltbot-skills) (formerly Clawdbot) — including [Bankr](https://bankr.bot) skills and community-contributed skills from other providers.

## Structure

Each top-level directory is a provider. Each subdirectory within a provider is an installable skill containing a `SKILL.md` and other skill related files.

```
moltbot-skills/
├── bankr/
│   ├── SKILL.md
│   ├── references/
│   │   ├── token-trading.md
│   │   ├── leverage-trading.md
│   │   ├── polymarket.md
│   │   ├── automation.md
│   │   ├── token-deployment.md
│   │   └── ...
│   └── scripts/
│       └── bankr.sh
│
├── base/                         # Base (placeholder)
│   └── SKILL.md
├── neynar/                       # Neynar (placeholder)
│   └── SKILL.md
├── qrcoin/                       # QR Coin (community)
│   └── SKILL.md
└── zapper/                       # Zapper (placeholder)
    └── SKILL.md
```

## Install Instructions

Give Moltbot the URL to this repo and it will let you choose which skill to install.

```
https://github.com/BankrBot/moltbot-skills
```

## Available Skills

| Provider                   | Skill           | Description                                                                                               |
| -------------------------- | --------------- | --------------------------------------------------------------------------------------------------------- |
| [bankr](https://bankr.bot) | [bankr](bankr/) | AI-powered crypto trading agent via natural language. Trade, manage portfolios, automate DeFi operations. |
| [8004.org](https://8004.org) | [erc-8004](erc-8004/) | Register AI agents on Ethereum mainnet using ERC-8004 (Trustless Agents). Get an agent NFT, build reputation. |
| base                       | —               | Placeholder                                                                                               |
| botchan                    | [botchan](botchan/) | CLI for onchain agent messaging on Base. Explore agents, post to feeds, send DMs, store data permanently. |
| neynar                     | —               | Placeholder                                                                                               |
| [qrcoin](https://qrcoin.fun) | [qrcoin](qrcoin/) | QR code auction platform on Base. Bid to display URLs on QR codes.                                      |
| yoink                      | [yoink](yoink/) | Onchain capture-the-flag game on Base.                                                                    |
| zapper                     | —               | Placeholder                                                                                               |

## Contributing

We welcome community contributions! Here's how to add your own skill:

### Adding a New Skill

1. **Fork this repository** and create a new branch for your skill.

2. **Create a provider directory** (if it doesn't exist):
   ```
   mkdir your-provider-name/
   ```

3. **Add the required files**:
   - `SKILL.md` — The main skill definition file (required)
   - `references/` — Supporting documentation (optional)
   - `scripts/` — Any helper scripts (optional)

4. **Follow the structure**:
   ```
   your-provider-name/
   ├── SKILL.md
   ├── references/
   │   └── your-docs.md
   └── scripts/
       └── your-script.sh
   ```

5. **Submit a Pull Request** with a clear description of your skill.

### Guidelines

- Keep skill definitions clear and well-documented
- Include examples of usage in your `SKILL.md`
- Test your skill before submitting
- Use descriptive commit messages
