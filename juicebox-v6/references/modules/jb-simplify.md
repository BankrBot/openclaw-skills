---
name: jb-simplify
description: |
  Avoid over-engineering Juicebox projects by using native mechanics. Use when:
  (1) considering writing a custom hook when native config might suffice, (2) planning
  complex multi-ruleset configurations, (3) designing NFT or cash-out systems,
  (4) tempted to wrap existing hooks. Checklist format to find simpler solutions
  before writing custom contracts.
version: 6.0.0
---

# Juicebox Simplification Checklist

Before writing custom contracts, run through this checklist to find simpler solutions.

## The Simplification Principle

> **Native mechanics > Off-the-shelf hooks > Custom hooks > Custom contracts**

Every level of abstraction you can avoid:
- Reduces deployment costs
- Reduces attack surface
- Improves UI compatibility
- Makes the project easier to audit

---

## Pre-Implementation Checklist

### 1. Do You Need a Custom Pay Hook?

| What You Want | Simpler Solution |
|---------------|------------------|
| Mint NFTs on payment | Use `nana-721-hook-v6` directly (`JB721TiersHook`) |
| Buy tokens from DEX if cheaper | Use `nana-buyback-hook-v6` directly (`JBBuybackHook`) |
| Restrict who can pay | Use off-chain allowlists or payment metadata |
| Different tokens per tier | Use 721 hook tiers with different prices |
| Cap individual payments | Consider if this is actually needed |

**Only write a custom pay hook if**: You need logic that modifies payment recording that no existing hook provides.

---

### 2. Do You Need a Custom Cash Out Hook?

| What You Want | Simpler Solution |
|---------------|------------------|
| Burn NFT to redeem | Use `nana-721-hook-v6` - it already does this |
| Pro-rata redemption against surplus | Set `cashOutTaxRate: 0` - native behavior |
| Partial redemption (bonding curve) | Set `cashOutTaxRate` to desired value (1–9999) |
| Disable cash outs entirely | Set `cashOutTaxRate: 10_000` (`MAX_CASH_OUT_TAX_RATE`) — reclaim amount is 0 |
| Time-locked redemptions | Current ruleset with `cashOutTaxRate: 10_000`, queue a future ruleset with a lower rate |
| Redemption against external pool | This might actually need a custom hook |

**Only write a custom cash out hook if**: Redemption value must come from somewhere other than project surplus.

There is no cash-out pause flag in `JBRulesetMetadata`. `cashOutTaxRate: 10_000` is the off switch: `JBCashOuts.cashOutFrom` returns 0 at the max rate.

---

### 3. Do You Need a Custom Split Hook?

| What You Want | Simpler Solution |
|---------------|------------------|
| Send to multiple addresses | Use multiple splits with direct beneficiaries |
| Send to another JB project | Set `projectId` in the split |
| Add to project balance instead of paying | Set `preferAddToBalance: true` |
| Restrict who can claim | Set beneficiary to a multisig/contract |
| Swap tokens before forwarding | **Yes, need split hook** |
| Add to LP position | **Yes, need split hook** (see `JBUniswapV4LPSplitHook` before writing your own) |

**Only write a custom split hook if**: You need to transform tokens or interact with external protocols — and check `references/shared/chain-config.json` for an already-deployed hook that does it first.

---

### 4. Do You Need Multiple Queued Rulesets?

| What You Want | Simpler Solution |
|---------------|------------------|
| Monthly distributions | One ruleset with `duration: 30 days` |
| Increasing/decreasing token issuance | Use `weightCutPercent` for automatic issuance cut each cycle |
| Different phases over time | Queue rulesets only for actual changes |
| Vesting over 12 months | One cycling ruleset, NOT 12 queued rulesets |

**Only queue multiple rulesets if**: Configuration actually changes between periods.

---

### 5. Do You Need Custom NFT Logic?

| What You Want | Simpler Solution |
|---------------|------------------|
| NFT minting on payment | Use `nana-721-hook-v6` directly |
| Different prices per tier | Configure tiers in 721 hook |
| Static artwork per tier | Use `encodedIpfsUri` in `JB721TierConfig` |
| Dynamic/generative art | Implement `IJB721TokenUriResolver` only |
| Composable/layered NFTs | Implement `IJB721TokenUriResolver` only |
| On-chain SVG | Implement `IJB721TokenUriResolver` only |
| Custom minting logic | This might need a custom hook |

**Only write a custom pay/data hook if**: You need to change how the 721 hook processes payments. For custom content, use the resolver interface.

**Reference**: [banny-retail-v6](https://github.com/mejango/banny-retail-v6) shows composable NFTs using only a custom resolver (`Banny721TokenUriResolver`).

---

### 5b. When DO You Need to Extend the 721 Hook?

Extending the 721 hook (not just the resolver) is necessary when you need to change **treasury mechanics**, not just content:

| What You Want | Why You Need a Custom Hook |
|---------------|----------------------------|
| Dynamic cash out weights | Redemption value changes based on outcomes |
| First-owner tracking | Rewards go to original minter, not current holder |
| Phase-based restrictions | Different rules during different game phases |
| On-chain governance for outcomes | Scorecard voting determines payouts |

**Reference**: [defifa](https://github.com/BallKidz/defifa) shows prediction games with dynamic cash-out weights built on the 721 hook.

---

### 6. Do You Need a Custom Contract at All?

| What You Want | Simpler Solution |
|---------------|------------------|
| Vesting | Payout limits + cycling rulesets |
| Treasury reserve | Surplus allowance |
| NFT-gated treasury | 721 hook + native cash outs |
| Immutable configuration | Transfer ownership to burn address |
| Multi-sig control | Set owner to Safe/multisig |
| Governance | Use existing governance frameworks |
| Pay a project from another contract | `JBProjectPayer` (deployed via `JBProjectPayerDeployer`) |

---

## Simplification Questions

Ask these questions in order. Stop at the first "yes":

### For Payments
1. Can the 721 hook handle this? → **Use 721 hook**
2. Can the buyback hook handle this? → **Use buyback hook**
3. Can payment metadata + off-chain logic handle this? → **Use native pay**
4. → Consider custom pay hook

### For Redemptions
1. Is it just burning NFTs for surplus? → **Use 721 hook**
2. Is it just tokens for surplus? → **Use native cash out with tax rate**
3. Does value come from project surplus? → **Use native cash out**
4. → Consider custom cash out hook

### For Distributions
1. Are recipients just addresses? → **Use native splits**
2. Are recipients other JB projects? → **Use splits with projectId**
3. Do you need token transformation? → **Use split hook**
4. → Consider custom split hook

### For Time-Based Logic
1. Is it recurring at fixed intervals? → **Use cycling ruleset**
2. Is it a one-time schedule change? → **Queue one future ruleset**
3. Is it conditional on external approval? → **Use a ruleset approval hook (`JBDeadline3Hours`/`1Day`/`3Days`/`7Days` are deployed)**
4. → Consider custom logic

### For NFT Content
1. Is artwork static per tier? → **Use `encodedIpfsUri` in tier config**
2. Need dynamic/generative art? → **Implement `IJB721TokenUriResolver`**
3. Need composable NFTs? → **Implement `IJB721TokenUriResolver`**
4. Need to change minting logic? → Consider extending the 721 hook

### For Games/Predictions
1. Fixed redemption values per tier? → **Use standard 721 hook**
2. Outcome determines payout distribution? → **Extend the 721 hook (Defifa pattern)**
3. Need on-chain outcome voting? → **Add Governor contract**
4. Rewards to original minter only? → **Track first-owner in the hook**

---

## Common Over-Engineering Mistakes

### Mistake 1: Wrapping the 721 Hook

```
❌ WRONG: Create DataHookWrapper that delegates to the 721 hook
✅ RIGHT: Use the 721 hook directly, achieve goals via ruleset config
```

### Mistake 2: Vesting Split Hook

```
❌ WRONG: VestingSplitHook that holds funds and releases over time
✅ RIGHT: Payout limits reset each cycle, achieving the same result
```

### Mistake 3: Queue 12 Rulesets for 12-Month Vesting

```
❌ WRONG: Queue 12 identical rulesets with different start times
✅ RIGHT: One ruleset with duration: 30 days that cycles automatically
```

### Mistake 4: Split Hook for Simple Forwarding

```
❌ WRONG: Split hook that just forwards ETH to an address
✅ RIGHT: Set the address as the split beneficiary directly
```

### Mistake 5: Custom Redemption Math

```
❌ WRONG: Custom hook calculating pro-rata share of surplus
✅ RIGHT: cashOutTaxRate: 0 gives linear redemption natively
```

### Mistake 6: Custom Hook for NFT Artwork

```
❌ WRONG: Write custom pay hook to generate dynamic NFT metadata
✅ RIGHT: Use 721 hook + custom IJB721TokenUriResolver for content only
```

---

## Complexity Cost Table

| Solution | Gas Cost | Audit Risk | UI Support |
|----------|----------|------------|------------|
| Native config only | Lowest | Lowest | Full |
| Off-the-shelf hooks | Low | Low | Full |
| Custom token URI resolver | Low | Low | Full |
| Custom split hook | Medium | Medium | Partial |
| Custom pay hook | Medium | Medium | Partial |
| Extended 721 hook | Medium-High | Medium-High | Custom UI needed |
| Custom cash out hook | High | High | Limited |
| Full custom system | Highest | Highest | None |

### When Higher Complexity Is Justified

Not all complexity is bad. These patterns justify extending hooks:

| Pattern | Justification |
|---------|---------------|
| Prediction games (Defifa) | Dynamic weights can't be done any other way |
| Composable NFTs (Banny) | Resolver-only keeps treasury mechanics standard |
| Phase-based games | Rulesets + custom hook is cleaner than alternatives |

**Key insight**: Extend hooks for **treasury mechanics**, use resolvers for **content only**.

---

## Final Checklist

Before finalizing your design, verify:

- [ ] No custom hook where a direct beneficiary works
- [ ] No split hook where multiple native splits work
- [ ] No wrapped data hook where using the hook directly works
- [ ] No multiple queued rulesets where one cycling ruleset works
- [ ] No custom vesting where payout limits work
- [ ] No custom treasury where surplus allowance works
- [ ] No custom redemption where native cash out (tax rate 0–10_000) works
- [ ] No custom pay hook where IJB721TokenUriResolver handles content needs

If all boxes are checked and you still need custom code, proceed with confidence that it's actually necessary.

---

## Common mistakes

- Assuming a cash-out pause flag exists. `JBRulesetMetadata` has `pausePay` and `pauseCreditTransfers` only; cash outs are disabled by `cashOutTaxRate: 10_000`.
- Spelling the tier artwork field `encodedIPFSUri`. The `JB721TierConfig` field is `encodedIpfsUri` (bytes32).
- Rebuilding hooks that are already deployed on every chain — check `references/shared/chain-config.json` for `JBBuybackHook`, `JB721TiersHook` deployers, `JBUniswapV4LPSplitHook`, `JBProjectPayerDeployer`, and the `JBDeadline*` approval hooks before writing code.

---

## Related Skills

- `/jb-patterns` - Common design patterns with examples
- `/jb-project` - Project deployment
- `/jb-pay-hook` - When you DO need a custom pay hook
- `/jb-cash-out-hook` - When you DO need a custom cash out hook
- `/jb-split-hook` - When you DO need a custom split hook
