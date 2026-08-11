---
name: jb-omnichain-tier-quantity-per-chain
description: |
  Omnichain Juicebox V6 721 tier quantities are PER-CHAIN, not total. Use when: (1) a user sets a
  limited quantity for physical goods (signed books, merch) on an omnichain project, (2) "limited
  to 10" actually means 40 total (10 per chain × 4 chains), (3) a user has true limited inventory
  but the tier deploys to all chains. Solution: deploy the limited tier to ONE chain only, or
  divide the quantity across chains. initialSupply is per-chain, not global.
version: 6.0.0
---

# Omnichain 721 Tier Quantities Are Per-Chain

## Problem

When a 721 project is deployed omnichain (e.g. `JBOmnichainDeployer.launchProjectFor` with a 721 config, executed on every chain), each chain deploys its own `JB721TiersHook` with its own tier storage. A tier's `initialSupply` applies independently on every chain:

- "Limited to 10" on a 4-chain deploy = 10 on Ethereum + 10 on Optimism + 10 on Base + 10 on Arbitrum
- **Actual total: 40 possible mints**, not 10.

Nothing nets tier supply across chains — mints on one chain never decrement another chain's `remainingSupply`.

## Contract facts

```solidity
struct JB721TierConfig {
    uint104 price;
    uint32 initialSupply;   // PER-CHAIN cap on mints from this tier
    // … votingUnits, reserveFrequency, reserveBeneficiary, encodedIpfsUri,
    //   category, discountPercent, flags, splitPercent, splits
}
```

- `initialSupply` is `uint32`, but the store enforces `initialSupply <= 999_999_999` (one billion minus one — token IDs are `tierId * 1_000_000_000 + tokenNumber`). "Unlimited" convention is `999999999`, NOT `4294967295` (uint32 max reverts `JB721TiersHookStore_InvalidQuantity`).
- `initialSupply == 0` reverts (`JB721TiersHookStore_ZeroInitialSupply`).
- Reserve mints (`reserveFrequency`) also count against the per-chain supply, per chain.

## Trigger conditions

- User creates a 721 tier project with a limited quantity on multiple chains.
- User has physical goods with true limited inventory ("only 10 signed copies", "edition of 25").
- The tier config shows the same `initialSupply` in every chain's configuration.

## Solution

**When the user selects a limited quantity on a multi-chain deploy, ALWAYS ask:**

> "Your project deploys to N chains. Should this tier be:
> - limited to X per chain (X × N total), or
> - truly limited to X total (host it on one chain)?"

**For physical goods with true limited inventory:**

- **Option 1 — one chain only (recommended).** Include the tier only in the host chain's tier list; omit it from every other chain's config. Buyers on other chains mint on the host chain (each chain's hook is independent, so omission is just a per-chain config difference).
- **Option 2 — divide the quantity.** 10 items across 4 chains → `initialSupply: 3` per chain (12 slots for 10 items). Creates uneven distribution and race dynamics; the user must track fulfillment manually. Adding supply later is possible (`adjustTiers` adds new tiers), but removing unsold slots on other chains requires operator action per chain.

**For digital exclusivity (no physical fulfillment):** per-chain limits can be intentional — "first 10 on each chain" creates per-chain collector sets. State the real total and let the user decide.

## Example

Wrong — "only 10 signed copies", deployed to 4 chains:

```json
{ "initialSupply": 10 }   // in every chain's tier config → 40 mintable
```

Correct — single-chain hosting:

```json
// Ethereum config: tier present with { "initialSupply": 10 }
// Optimism / Base / Arbitrum configs: tier omitted entirely
```

Correct — divided:

```json
{ "initialSupply": 3 }    // per chain × 4 chains = 12 slots for 10 items; track fulfillment manually
```

## Verification

- For true limited inventory: the tier appears in exactly ONE chain's config, OR the per-chain `initialSupply` values sum to (approximately) the real total.
- The user has confirmed the actual protocol-wide total.

## Common mistakes

- **Treating `initialSupply` as a global cap.** It's per chain, per hook.
- **Using `4294967295` for "unlimited".** The store caps at `999_999_999`; uint32 max reverts. Use `999999999`.
- **Setting `initialSupply: 0` to exclude a tier from a chain.** Zero reverts — omit the tier from that chain's config instead.
- **Forgetting cash-outs are per-chain too.** Each chain's hook redeems against its own chain's balances and supplies.

## Related skills

- `jb-omnichain-per-chain-projectids` — per-chain projectIds for tier adjustments after deploy
- `jb-relayr` — per-chain deploy transactions with per-chain tier configs
