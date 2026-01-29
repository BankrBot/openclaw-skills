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
| [pool.fans](https://pool.fans) | [composable-revenue](composable-revenue/) | ComposAIble revenue management for Clanker tokens on Base. Tokenize fees, create time-wrappers, burn/LP/rewards strategies. |
| base                       | —               | Placeholder                                                                                               |
| neynar                     | —               | Placeholder                                                                                               |
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
