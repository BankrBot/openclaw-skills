# Aerodrome Yield Finder Skill

This OpenClaw skill finds the highest yielding liquidity pools on Aerodrome Finance (Base) by querying the on-chain Sugar contract. It filters by TVL and sorts active pools by APR.

## Installation

```bash
cd aerodrome/yield-finder
npm install
```

## Quick Start

Find top 10 pools with >$10k TVL:

```bash
./scripts/query-pools.sh --min-tvl 10000 --limit 10
```

For full documentation, see [SKILL.md](SKILL.md).
