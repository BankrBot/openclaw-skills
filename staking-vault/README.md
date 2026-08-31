# StakingVault

Deploy a share-price-rebase ERC-4626 staking vault for **any ERC-20**. Stake `TOKEN`, receive `xTOKEN` shares. Reward distribution = `TOKEN.transfer(vault, amount)` — share price rebases automatically. No claim step, no reward debt, no per-holder gas.

Originally deployed as `StakedAxiom` (xAXIOM) on Base. See `SKILL.md` for the full skill spec and `references/SECURITY.md` for the audit.

## TL;DR

```bash
cp -r staking-vault ~/Github/my-token-staking
cd ~/Github/my-token-staking
bash scripts/init.sh
$EDITOR .env          # set STAKE_TOKEN, OWNER, VAULT_NAME, VAULT_SYMBOL, PRIVATE_KEY, RPC, scan key
bash scripts/deploy.sh base
```

## What you get

- **`src/StakingVault.sol`** — ERC-4626 vault, ~200 lines. Cooldown-gated withdrawals, JIT-resistant, inflation-attack hardened (`_decimalsOffset = 6`), `Ownable2Step`. Owner can adjust cooldown params (bounded) and rescue non-stake tokens. Cannot mint, burn, pause, upgrade, or rescue the stake token.
- **`script/Deploy.s.sol`** — `forge script` that reads `STAKE_TOKEN`, `OWNER`, `VAULT_NAME`, `VAULT_SYMBOL`, optional `COOLDOWN_PERIOD` / `WITHDRAW_WINDOW` from env. Verifies on the explorer when run with `--verify`.
- **`test/StakingVault.t.sol`** — 24 forge tests covering basic share math, pro-rata rewards, cooldown gating, JIT attack regression, transfer-during-cooldown blocking, inflation-attack mitigation, and ERC-4626 spec compliance (`maxRedeem`, `maxWithdraw`).
- **`scripts/init.sh`** — installs `OpenZeppelin/openzeppelin-contracts` + `forge-std`, builds, runs tests, copies `.env.example` → `.env`.
- **`scripts/deploy.sh`** — loads `.env` and runs the deploy script against `base` / `base_sepolia` / `mainnet`.
- **`references/SECURITY.md`** — 4 findings (1 critical, 1 medium, 1 low accepted, 1 informational) — all fixed and covered by regression tests.
- **`references/integration.md`** — reward-flow patterns (daily cron, streaming, governance), frontend display notes (convert shares → assets, render cooldown states), operational checklist.

## Requirements

- [Foundry](https://getfoundry.sh) (`forge --version`)
- An RPC for your target chain (Alchemy / QuickNode / public)
- A block-explorer API key for verification
- A deployer key with enough gas

## Cooldown defaults

- `cooldownPeriod = 3 days` — minimum lock between requesting unstake and being able to redeem.
- `withdrawWindow = 2 days` — once cooldown elapses, the redeem window stays open this long.

Tune per your reward cadence. Daily rewards → 3-day cooldown is sensible. Weekly rewards can tolerate longer.

Hard bounds in the contract: `cooldownPeriod ≤ 30 days`, `withdrawWindow ≥ 1 day`.

## Reference deployment

- Contract style: live as xAXIOM on Base.
- Frontend: <https://clawbots.org/stake>.
- Source (private): `~/Github/axiom-staking/`.
