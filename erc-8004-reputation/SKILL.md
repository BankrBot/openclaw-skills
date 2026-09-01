# ERC-8004 Reputation Skill

Interact with the ERC-8004 Reputation Registry — the decentralized reputation layer for AI agents.

## What It Does

- **Look up** any agent's reputation (score, feedback count, individual reviews)
- **Give feedback** to agents (value + optional tags)
- **Check your own reputation** across all chains
- **List clients** who have given feedback
- **Read specific feedback** entries
- **Revoke feedback** you've previously given

## Quick Start

```bash
# Check an agent's reputation (uses agent ID, not address)
python3 scripts/reputation.py lookup 16700

# Give feedback (score 0-100, requires wallet)
python3 scripts/reputation.py give 16700 85 --tag1 reliable --tag2 fast

# Check your own reputation across all chains
python3 scripts/reputation.py my-rep 16700

# List who gave feedback
python3 scripts/reputation.py clients 23983 --chain ethereum

# Read a specific feedback entry
python3 scripts/reputation.py feedback 23983 0xF653068677A9a26d5911Da8ABd1500d043EC807e 1 --chain ethereum

# Revoke feedback at index 1
python3 scripts/reputation.py revoke 16700 1
```

## Commands

### `lookup <agentId> [--chain CHAIN]`
Get an agent's reputation summary with individual feedback details.

```
$ python3 scripts/reputation.py lookup 23983 --chain ethereum
Agent ID: 23983
Chain: ethereum (Ethereum)
Reviewers: 1
Feedback count: 1
Summary value: 85
Average: 85.0

Feedback details:
  #1 from 0xF6530686...EC807e: 85 (trust, oracle-screening)
```

### `give <agentId> <value> [--decimals N] [--tag1 TAG] [--tag2 TAG] [--chain CHAIN]`
Leave feedback for an agent. Requires a funded wallet.

- `value`: Integer feedback value (e.g. 85 for a score, 9977 for 99.77%)
- `--decimals`: How many decimal places (default 0). Use 2 for percentages like 99.77%
- `--tag1`/`--tag2`: Categorize feedback (e.g. "starred", "uptime", "reliable")

```bash
# Simple score (0-100)
python3 scripts/reputation.py give 16700 85 --tag1 reliable

# Percentage with decimals (99.77%)
python3 scripts/reputation.py give 16700 9977 --decimals 2 --tag1 uptime
```

### `my-rep <agentId> [--chains CHAINS]`
Check reputation across all chains (or specific ones).

```
$ python3 scripts/reputation.py my-rep 16700
Reputation for Agent ID: 16700

  Base: No feedback yet
  Ethereum: No feedback yet
  Polygon: No feedback yet
  Monad: No feedback yet
  BNB Chain: No feedback yet
```

### `clients <agentId> [--chain CHAIN]`
List all addresses that have given feedback.

### `feedback <agentId> <clientAddress> <feedbackIndex> [--chain CHAIN]`
Read a specific feedback entry.

```
$ python3 scripts/reputation.py feedback 23983 0xF653...807e 1 --chain ethereum
Agent: 23983
From: 0xF653068677A9a26d5911Da8ABd1500d043EC807e
Index: 1
Value: 85
Tags: trust, oracle-screening
Revoked: False
```

### `revoke <agentId> <feedbackIndex> [--chain CHAIN]`
Revoke feedback you previously gave. Requires wallet.

## Configuration

### Wallet (required for write operations)

```bash
# Option 1: Mnemonic
export ERC8004_MNEMONIC="your twelve word mnemonic phrase here"

# Option 2: Private key
export ERC8004_PRIVATE_KEY="0xabc123..."
```

Read operations (lookup, my-rep, clients, feedback) don't need a wallet.

### Supported Chains

| Chain    | ID   | Default | Gas Cost |
|----------|------|---------|----------|
| Base     | 8453 | ✓       | ~$0.001  |
| Ethereum | 1    |         | ~$1-10   |
| Polygon  | 137  |         | ~$0.01   |
| Monad    | 143  |         | ~$0.001  |
| BNB      | 56   |         | ~$0.05   |

Base is recommended — cheapest gas by far.

## Contract Addresses

Same on all chains:
- **Identity Registry**: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- **Reputation Registry**: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`

## Dependencies

```bash
pip install web3 eth-account
```

## See Also

- [ERC-8004 Specification](https://eips.ethereum.org/EIPS/eip-8004)
- [Agentscan Explorer](https://agentscan.info/agents)
