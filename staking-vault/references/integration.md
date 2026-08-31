# Integrating StakingVault into your reward flow

The whole point of this design is that **distribution is one transfer**. Compared to "claim a Masterchef-style pending balance" or "snapshot N holders then disperse to N addresses," this collapses to:

```solidity
stakeToken.transfer(address(vault), amount);
```

No `notifyReward()`. No reward debt. No per-user accounting. No iteration over holders. The share price rebases automatically because `totalAssets()` reads `stakeToken.balanceOf(vault)` directly.

## How rewards reach the vault

You have full flexibility. The contract doesn't care who sends, when, or how often. Three common shapes:

### 1. Daily cron (the AXIOM pattern)

A cron on your infra runs once a day:

1. Claims protocol fees from wherever they accrue (Clanker, your AMM, etc.).
2. Performs any pre-distribution accounting (burn, treasury split, etc.).
3. Calls `stakeToken.transfer(vaultAddress, distributionAmount)`.

This is what AXIOM does. The cron is just bash + viem. The cooldown's 3-day default assumes a daily cadence — if you distribute more or less often, tune accordingly. See the audit's #3 note about owner-extended cooldowns.

### 2. Continuous streaming (Sablier / Superfluid)

Configure a streaming contract to drip stakeToken into the vault at a constant rate. Stakers see share price climb every block. No daily lump. Cooldown logic still protects against JIT exposure across the stream.

### 3. Manual / governance

DAO votes a one-time reward → multisig transfers it to the vault. Simple, ad-hoc.

## What the vault does NOT do

- **No claim function.** Stakers see their position appreciate via `convertToAssets(shares)` automatically. They never call `claim()`.
- **No multi-reward.** This is a single-asset vault — only the stake token. If you want users to earn a *different* token in proportion to their stake, you need a separate mechanism (e.g. Masterchef rewards or a sibling vault).
- **No vesting / lock duration.** A user can deposit and withdraw any time the cooldown window permits. There's no "longer lock = bigger boost."
- **No transfer fee on shares.** Standard ERC-20 (with the cooldown sender-guard caveat).

If you need multi-reward or vesting, look at Stakr (`stakr/SKILL.md` in this repo) for an alternative protocol.

## Frontend integration notes

### Display the user's stake-token balance, not their share balance

The 6-decimal offset means a 100-token deposit shows up as `100e24` shares. Don't render that to users. Instead:

```solidity
uint256 userStakedAmount = vault.convertToAssets(vault.balanceOf(user));
```

### Show cooldown status with the spec-compliant getters

```solidity
(uint256 startedAt, uint256 readyAt, uint256 expiresAt) = vault.cooldownStatus(user);
```

States:
- `startedAt == 0` → no cooldown active. UI: "Start cooldown" button.
- `now < readyAt` → cooldown in progress. UI: countdown to `readyAt`.
- `readyAt ≤ now ≤ expiresAt` → withdraw window open. UI: "Withdraw" button.
- `now > expiresAt` → window expired. UI: "Restart cooldown" button.

Don't rely on `maxRedeem` to figure out the state — it's spec-compliant so it returns 0 outside the window, which is correct but doesn't tell the user *why*.

### TVL & APR

```solidity
uint256 tvl_in_stakeTokens = vault.totalAssets();
```

For APR, track the share price (`vault.convertToAssets(1e24)` for 18-decimal stake tokens) over time. The slope is your distribution rate per share.

## Operational checklist

- [ ] Deploy `StakingVault` with your token, name, symbol, owner, cooldown, window.
- [ ] Verify on the explorer (the deploy script does this automatically).
- [ ] Set up your reward-delivery cron / streamer / governance flow.
- [ ] Build a simple frontend with deposit / cooldown / withdraw / status.
- [ ] Test end-to-end on testnet with a fake reward delivery.
- [ ] Seed the vault with at least 1 wei before opening to users (mitigates the inflation attack edge case even though `_decimalsOffset = 6` already protects against realistic donations).
- [ ] If `OWNER` is an EOA, plan to migrate to a multisig once TVL > nominal.
- [ ] Monitor `totalAssets()` daily. If it diverges from your expected (snapshot + distributions − redemptions), audit immediately.

## Reference deployment

The first deployment of this pattern is **xAXIOM** on Base — see `~/Github/axiom-staking/` for the original. The skill in this repo is a generalized port of that contract.
