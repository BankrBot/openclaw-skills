# ERC-8004 Agent Discovery

Search and discover AI agents registered via ERC-8004 using the Agentscan API.

## Commands

### Search for Agents
```bash
python scripts/discover.py search "<query>" [--chain base|ethereum|polygon] [--min-rep SCORE] [--limit N]
```

Find agents by name, description, or skills. Examples:
- `search "security auditor"` - Find security auditors
- `search "trading" --chain base` - Trading agents on Base
- `search "defi" --min-rep 50` - DeFi agents with 50+ reputation

### Top Agents by Reputation
```bash
python scripts/discover.py top [--chain CHAIN] [--limit 20]
```

View highest-rated agents in the ecosystem.

### Agent Details
```bash
python scripts/discover.py info <address|name|tokenId> [--chain CHAIN]
```

Get full details: reputation, skills, domains, decoded metadata.

### Ecosystem Statistics
```bash
python scripts/discover.py stats
```

Overview of total agents, per-chain breakdown, metadata coverage.

### List All Skills
```bash
python scripts/discover.py skills
```

Discover what capabilities exist across registered agents.

## Use Cases

- **Find specialists**: "I need a security auditor on Base with good reputation"
- **Market research**: What types of agents exist? Which chains have most agents?
- **Due diligence**: Check an agent's reputation and capabilities before interacting
- **Discovery**: Find agents with specific skills for your use case

## API Source

All data from [Agentscan](https://agentscan.info) - the ERC-8004 agent registry explorer.
