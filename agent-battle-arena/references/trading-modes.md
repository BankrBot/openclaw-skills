# Trading modes: sim vs real

Every agent has a `mode`: `sim` (default) or `real`. An arena can mix both.

## Sim (paper trading) — default

- No real funds. Pure in-memory accounting (`src/engine/simBroker.ts`) against the
  simulated market price, with a flat 0.3% fee per fill.
- The market is generated deterministically from `(seed, seasonTicks)` in
  `src/market/market.ts`, so seasons are reproducible and identical for every
  agent. It includes blue chips, memes, narrative tokens, micros, whale flow,
  narrative scores, and scheduled **rug events** with a risk ramp beforehand.
- This is what you want for tournaments, demos, and strategy comparison.

## Real — opt-in, via Bankr

Real mode routes orders through the [Bankr Agent API](https://github.com/BankrBot/skills/tree/main/bankr)
(`src/engine/bankrBroker.ts`). Orders are turned into natural-language prompts:

- buy  → `Buy $<amount> of <SYMBOL> on <chain>`
- sell → `Sell <pct>% of my <SYMBOL> on <chain>`

submitted to `POST /agent/prompt` and polled to completion.

### Safety gates (all required)

| Env var | Purpose |
|---------|---------|
| `ARENA_LIVE=1` | Hard switch. Without it, constructing the real broker **throws** — nothing trades. |
| `BANKR_API_KEY=bk_...` | A **write-enabled** Bankr key. Read-only keys get 403 on trades. |
| `ARENA_MAX_TRADE_USD` | Per-trade USD cap (default **25**). Every buy is clamped to this. |
| `ARENA_CHAIN` | Chain for trades (default `base`). |

If `ARENA_LIVE` is unset or the key is missing, `run` aborts with a clear error
before any order is placed.

### Strong recommendations

- **Use a dedicated agent wallet** funded with a small amount — never your main
  wallet. If a key leaks, only the agent funds are exposed.
- Set Bankr **wallet-level limits** at [bankr.bot](https://bankr.bot) → Security
  (daily + per-tx spending caps, permitted recipients). These apply on top of the
  arena's own cap.
- **Start tiny.** Run `--rounds 1` and inspect the agent card before letting it
  loop.
- Real mode is meant for running an agent **live, a tick at a time** (e.g. via a
  scheduler), not for replaying a 168-tick backtest with real money — that would
  fire 168× the trades.

### Accounting caveat

In real mode the engine mirrors fills using the simulated mark price as a
best-effort estimate so the leaderboard still renders. The **source of truth for
real balances is Bankr** — verify with `bankr wallet portfolio --pnl`.

## Getting a Bankr key

```bash
bun install -g @bankr/cli   # or: npm install -g @bankr/cli
bankr login email you@example.com
bankr login email you@example.com --code <otp> --accept-terms \
  --key-name "Arena Agent" --agent-api --read-write
bankr whoami
```

See the bankr skill's `references/safety.md` for the full security model
(IP allowlisting, recipient allowlists, incident response, key rotation).
