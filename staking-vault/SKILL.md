---
name: staking-vault
description: Deploy your own share-price-rebase ERC-4626 staking vault for any ERC-20. Stake → receive xToken shares; protocol rewards arrive as plain `transfer(vault, amount)` and rebase share price pro rata. JIT-resistant cooldown, inflation-attack hardened, 24 forge tests. Ships the Solidity contract, env-driven deploy script, audit notes, and bootstrap scripts. Use when the user wants to launch staking for their token, "stake $X", create an xToken / staked-token contract, build an Aave-stkAAVE-style vault, or migrate from per-holder airdrops to share-price rebase.
triggers:
  - staking
  - stake my token
  - xToken
  - staked token
  - staking vault
  - staking contract
  - ERC-4626 vault
  - ERC4626 staking
  - cooldown
  - share-price rebase
  - rebase staking
  - rewards distribution
  - JIT staking
  - stkAAVE
  - migrate airdrop to staking
version: 0.1.0
author: Axiom (@AxiomBot)
license: MIT
chain: base
---

# StakingVault Skill

Deploy a production-ready ERC-4626 staking vault for **any ERC-20** on Base (or any EVM chain). The pattern: users deposit your token, receive `xYourToken` shares. Daily / continuous / ad-hoc rewards arrive at the vault address as plain `ERC20.transfer(vault, amount)` and **rebase the share price** pro rata — no claim step, no reward debt, no per-user gas at distribution time.

Originally `StakedAxiom` (xAXIOM) on Base — see `~/Github/axiom-staking` for the reference deployment. This skill ports that contract into a generic, parameterized version any agent can lift, configure, and ship for their own project.

## Why this design

| Concern                       | StakingVault                                                                 | Snapshot + per-holder airdrop                                       | Masterchef-style claim                                |
|---|---|---|---|
| Gas to distribute             | **1 transfer**                                                               | N transfers (linear in holders)                                     | 1 `notifyReward`, but N claim txs paid by users       |
| User claim step               | **None** — share price rebases                                               | None — they receive tokens                                          | User pays gas to claim                                |
| Off-chain bookkeeping         | None — `totalAssets()` reads vault balance                                   | Holder snapshot, batch lists                                        | Reward debt accounting                                |
| JIT exploitation              | **Blocked** — cooldown + rebase                                              | Possible (snapshot timing games)                                    | Possible at `notifyReward` boundary                   |
| Aggregator UIs (Yearn, Beefy) | **Works** — spec-compliant ERC-4626                                          | N/A                                                                 | Custom integration required                           |

## Quick start

```bash
# 1. Copy this skill into a new project dir.
cp -r path/to/this/staking-vault ~/Github/my-token-staking
cd ~/Github/my-token-staking

# 2. Bootstrap: installs OZ + forge-std, builds, runs tests.
bash scripts/init.sh

# 3. Edit .env — set STAKE_TOKEN, OWNER, VAULT_NAME, VAULT_SYMBOL, PRIVATE_KEY, BASE_RPC_URL, BASESCAN_API_KEY.
$EDITOR .env

# 4. Deploy.
bash scripts/deploy.sh base                  # or base_sepolia / mainnet
```

The deploy script will print the vault address. Wire it into your reward-distribution flow (see `references/integration.md`).

## Required env vars

| Var                | What                                                              |
|---|---|
| `STAKE_TOKEN`      | The ERC-20 users deposit.                                          |
| `OWNER`            | Initial owner (`Ownable2Step`). Multisig recommended for prod.     |
| `VAULT_NAME`       | Share-token ERC-20 name, e.g. `"Staked AXIOM"`.                    |
| `VAULT_SYMBOL`     | Share-token ERC-20 symbol, e.g. `"xAXIOM"`.                        |
| `PRIVATE_KEY`      | Deployer key (does NOT need to equal `OWNER`).                     |
| `BASE_RPC_URL`     | Or `MAINNET_RPC_URL` / `BASE_SEPOLIA_RPC_URL` for the target net.  |
| `BASESCAN_API_KEY` | Or `ETHERSCAN_API_KEY` for verification.                           |

Optional: `COOLDOWN_PERIOD` (seconds, default `259200` / 3 days, max `30 days`), `WITHDRAW_WINDOW` (seconds, default `172800` / 2 days, min `1 day`).

## Contract summary

`src/StakingVault.sol`:

- **ERC-4626** — `deposit(assets, receiver)` mints shares; `redeem(shares, receiver, owner)` burns them.
- **Cooldown** — Aave-style two-step withdraw. Call `cooldown()`, wait `cooldownPeriod`, redeem within `withdrawWindow`. Outside the window, `maxRedeem` returns 0.
- **JIT-resistant** — large mid-cooldown share inflows weighted-average the cooldown timestamp toward `now`. Attacker can't open a tiny cooldown, wait it out, and dump a huge deposit right before a reward.
- **Inflation-attack hardened** — `_decimalsOffset() = 6`. Donation-based grief costs ~1e6× any realistic deposit.
- **Owner permissions** — only `setCooldownParams` (bounded) and `rescueToken` (non-stake tokens only). No mint, no burn, no pause, no upgrade.
- **Transfers blocked during cooldown** — sender side. Prevents fresh-address sidestep.

Full audit notes: `references/SECURITY.md`. 24/24 forge tests including all the regression coverage.

## Reward delivery — how to actually use this

The whole magic: **`stakeToken.transfer(vaultAddress, amount)` IS the reward distribution.** No notifier call, no `accRewardPerShare`, no per-user state update.

Three common patterns:

1. **Daily cron** — your fee-claim bot transfers a fixed amount per day. (The AXIOM pattern.)
2. **Streaming** — Sablier or Superfluid drips into the vault.
3. **Governance / ad-hoc** — DAO votes a reward, multisig sends it.

See `references/integration.md` for code patterns, frontend display tips, and operational checklist.

## What this skill does NOT include

- **Multi-reward staking** (multiple reward tokens). Use Stakr (`stakr/SKILL.md`) instead.
- **Vesting / lock duration boosts.** Single-tier only.
- **Reward source** — bring your own fee claim / treasury flow.
- **Frontend.** Reference deployment is at `clawbots.org/stake`; this skill provides only the contract + deploy plumbing.

## Files

```
staking-vault/
├── SKILL.md                       # this file
├── README.md                      # human overview
├── foundry.toml                   # solc 0.8.28, OZ + forge-std remappings
├── .env.example                   # template — copy to .env
├── .gitignore
├── src/
│   └── StakingVault.sol           # generic ERC-4626 vault, ~200 lines
├── script/
│   └── Deploy.s.sol               # env-driven forge script
├── test/
│   └── StakingVault.t.sol         # 24 tests, all passing
├── scripts/
│   ├── init.sh                    # installs deps, builds, tests
│   └── deploy.sh                  # wraps `forge script` with .env loading
└── references/
    ├── SECURITY.md                # full audit findings + fixes
    └── integration.md             # reward flow + frontend integration patterns
```

## Reference

Originally deployed as `StakedAxiom` (xAXIOM) on Base. Live frontend: <https://clawbots.org/stake>. Source: `~/Github/axiom-staking/` (not public; this skill is the public, generalized port).
