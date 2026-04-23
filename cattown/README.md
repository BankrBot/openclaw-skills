# Cat Town — Bankr Skill

Interact with **Cat Town**, a Farcaster-native game world on Base, from Bankr.

## What it does

Gives an agent everything it needs to:

- **Stake KIBBLE** into the RevenueShare contract and earn a share of weekly fishing + gacha revenue.
- **Read a user's position** — staked amount, pending rewards, pool share, unlock state, time left until withdraw.
- **Exit correctly** — `unlock()` → 14-day wait → `unstake()`, with the right user-facing messaging (share drop to 0%, opportunity cost, `relock()` escape hatch).
- **Read Cat Town's live world state** — season, time of day, weather, weekend flag — via the GameData contract.
- **Answer "what can I catch in this weather?"** — combine world state with the public item-truth catalog to surface weather / season / time-of-day exclusive fishing drops.
- **Read the boutique's daily 3-item rotation** with KIBBLE prices converted to USD via the Kibble Price Oracle.
- **Query the staking leaderboard and weekly revenue-deposit history** via public unauthenticated endpoints on `api.cat.town`.

## Install

```
install the cattown skill from https://github.com/cattownbase/cattown-bankr-skills/tree/main/cattown
```

## Layout

```
cattown/
├── SKILL.md              entry — triggers, flows, routing
├── README.md             this file
├── docs.md               comprehensive protocol overview (AI-readable)
└── references/
    ├── staking/          RevenueShare contract + api.cat.town staking endpoints
    ├── world/            GameData contract + weekly calendar
    ├── fishing/          fishing drops (item truth API + world-state filter)
    └── boutique/         daily boutique rotation + KIBBLE price oracle
```

New surfaces (fish raffle, fishing competition, gacha, item drops, etc.) will slot in as sibling `references/<feature>/` subdirectories without touching existing docs.

## Links

- Game: https://cat.town
- Staking UI (Wealth & Whiskers Bank): https://cat.town/bank
- Public docs: https://docs.cat.town
- Chain: Base mainnet (8453)

## License

MIT
