# Growr Economy

## Token

- **$GRWR** — `0x0bf91d8dae29410657f377d3510298b80d4acba3` on Base
- **Supply:** 100,000,000,000 (100B) — Bankr-launched
- **Treasury seeded:** 500M GRWR at launch (refilled from creator fees + WETH→GRWR buybacks)

## Earnings flow

1. **Welcome bonus** — 500,000 GRWR, one-time per new wallet
2. **Plant + harvest** — each seed has a base yield; harvest mutations multiply (1× → 200×)
3. **In-game GRWR** accumulates on harvest
4. **Cash out** — `claimHarvest` moves it from virtual → wallet (real ERC-20 transfer)
5. **Jackpot** — 50×+ mutation harvests use a separate `claimJackpotHarvest` path with weekly caps

## Tier system

Holding $GRWR raises your tier, raising your daily cash-out cap.

| Tier | Min $GRWR held | Daily cap | Weekly jackpot cap |
|---|---|---|---|
| 0 | 0 | 500K | 500M |
| 1 | 100K | 1.5M | 2.5B |
| 2 | 1M | 5M | 10B |
| 3 | 10M | 25M | 25B |
| 4 | 100M | 100M | 100B |
| 5 | 1B | 500M | 500B |

(Caps reset at UTC midnight. Tier checked on each `claimHarvest`.)

## Fusion flywheel

Fusion is the deflationary mechanic for Base ecosystem tokens:

1. Player burns small amount (~$1–$2) of 2–10 Base tokens
2. **100% of staked tokens → treasury**
3. Treasury later redistributes them as **rare fruit drops** on Epic+ harvests
4. Net effect: every fusion buys treasury inventory that lands in another player's wallet on a future rare harvest

GRWR rewards for fusion are intentionally small ("symbolic" — 1K / 5K / 25K GRWR per Common / Rare / Legendary tier) — the real reward is the **rare seed** + its mutation chance on subsequent harvests.

## Cost / earnings reference

| Action | Cost | Reward |
|---|---|---|
| Welcome bonus | 0 | 500K GRWR (one-time) |
| Buy basic seed (Carrot) | ~500 GRWR | Plant → harvest 500+ GRWR |
| Buy bee pet | 500K GRWR | +15% yield on all harvests |
| Plot upgrade (T1→T2) | scales | More slots, higher tier rewards |
| Free fusion | 0 (3/day) | rare seed + 1K–25K GRWR bonus |
| Extra fusion | 25K GRWR + 1 energy | rare seed + bonus |
| Cash out | 0 | gas only (~$0.005) |

## Daily quests + streaks

- 3 daily quests (water 5 plots / collect 1000 GRWR / get 1 mutation)
- Streak bonuses scale with consecutive-day play
- Quest rewards capped at 50 GRWR per quest on-chain (anti-spam)

## Treasury / supply transparency

- Treasury contract: `0x6ffAA6a18492CdADEb10e49BBb520B9D73004d70`
- Always view live balance on BaseScan
- Treasury is multi-token: holds GRWR + every fused Base token
