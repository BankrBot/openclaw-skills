---
name: jb-omnichain-payout-limits
description: |
  Omnichain Juicebox V6 projects have per-chain payout limits, not aggregate limits. Use when:
  (1) a user wants a fixed total fundraising/withdrawal cap across chains, (2) asking about
  aggregate payout limits on omnichain projects, (3) designing omnichain projects with payout
  constraints, (4) exploring monitoring or oracle approaches for cross-chain caps. Covers the
  limitation, what V6's cross-chain accounting does and does not solve, and practical
  approaches with tradeoffs.
version: 6.0.0
---

# Omnichain Payout Limit Constraints

> Applies to projects using payout limits (treasury distributions to splits). Revnets don't use payout limits — they use surplus allowances for REVLoans — so this limitation doesn't affect them.

## The constraint

**Payout limits are per-chain.** `JBFundAccessLimitGroup` entries are configured per ruleset on each chain independently; nothing nets them across chains. A "10 ETH payout limit" on a 4-chain project allows up to 40 ETH of payouts protocol-wide.

```
Chain 1 (Ethereum):  limit 10 ETH → up to 10 ETH out
Chain 2 (Optimism):  limit 10 ETH → up to 10 ETH out
Chain 3 (Base):      limit 10 ETH → up to 10 ETH out
Chain 4 (Arbitrum):  limit 10 ETH → up to 10 ETH out
                                    ────────────────
                                    40 ETH possible
```

```solidity
struct JBFundAccessLimitGroup {
    address terminal;                       // e.g. JBMultiTerminal
    address token;                          // terminal token these limits apply to
    JBCurrencyAmount[] payoutLimits;        // per ruleset cycle
    JBCurrencyAmount[] surplusAllowances;   // per ruleset
}
struct JBCurrencyAmount { uint224 amount; uint32 currency; }
```

An empty `fundAccessLimitGroups` array means ZERO payouts on that chain (everything is surplus), not unlimited.

## What V6's cross-chain accounting does — and does not — solve

Suckers gossip per-chain accounting (total supply, surplus, balance) between peers, and `JBSuckerRegistry` aggregates it (`totalRemoteSurplusOf`, `totalRemoteBalanceOf`, `remoteTotalSupplyOf`). This feeds **cross-chain cash-out taxation** — a holder cashing out is priced against project-wide supply and surplus, not just the local chain's.

It does NOT feed payout limits. `JBTerminalStore` checks payouts against the local chain's `JBFundAccessLimits` records only. The gossip data is also asynchronous (minutes-scale, freshness-gated snapshots), so it could not enforce an atomic aggregate cap even if it were wired in. Any aggregate-limit design still faces latency, trust, manipulation windows, and messaging cost — a property of multi-chain systems, not a Juicebox bug.

## Approaches

### 1. Accept & design around it (soft caps)

Set per-chain limits that sum to the target; accept uneven distribution.

```json
"fundAccessLimitGroups": [{
  "terminal": "<JBMultiTerminal>",
  "token": "0x000000000000000000000000000000000000EEEe",
  "payoutLimits": [{ "amount": "20000000000000000000", "currency": 1 }],
  "surplusAllowances": []
}]
```

Tradeoffs: one chain can hit its limit while others have slack; no coordination required. Use for soft caps where ~80–120% of target is acceptable.

### 2. Monitoring + manual pause

Watch the aggregate via Bendystraw's `suckerGroup` (fields: `balance`, `volume`, plus per-chain `project.balance`), alert near the threshold, and have the operator queue `pausePay: true` rulesets on every chain.

```graphql
query($id: String!) {
  suckerGroup(id: $id) { balance volume projects }   # projects: ["chainId-projectId-version", …]
}
```

For per-chain balances, resolve each `projects` entry and query `project(projectId, chainId, version) { balance }`.

Tradeoffs: needs an active operator; reaction latency; human error. Note payments continue during the queued ruleset's approval window if the project uses a deadline (`JBDeadline*`) approval hook.

### 3. Automated cron + Relayr

A cron job queries Bendystraw; when the threshold is near, it submits one Relayr bundle that calls `JBController.queueRulesetsOf(projectId, …pausePay: true…)` on every chain (per-chain projectIds!). The operator address needs `QUEUE_RULESETS` (permission ID 2) on each chain's project.

Tradeoffs: ~minutes of overshoot window; operator key trust; infrastructure to run.

### 4. Oracle in a pay hook (hard-ish cap)

A pay hook's `beforePayRecordedWith` reverts when a relayer-updated oracle reports the aggregate at/over the threshold, with a staleness bound. Strongest enforcement available, but: custom development, relayer trust, staleness window overshoot, and payments failing near the threshold. No off-the-shelf implementation exists.

### 5. Single-chain treasury

Give only the home chain a nonzero payout limit; other chains collect payments with `payoutLimits: []` (zero payouts). Funds only become spendable on the home chain when bridged there via suckers — which requires the token holder's own `prepare`/`toRemote`/`claim` actions; the project cannot sweep other chains' balances itself.

Tradeoffs: user friction, treasury fragmentation until bridged, unenforceable sweeping.

## Comparison

| Approach | Enforcement | Latency | Trust | Complexity |
|----------|-------------|---------|-------|------------|
| Accept & design | Soft | — | None | Low |
| Manual monitoring | Soft | Minutes | Operator | Low |
| Cron + Relayr | Soft | ~5–10 min | Operator | Medium |
| Oracle pay hook | Hard (staleness window) | Seconds | Relayer | High |
| Single-chain treasury | Structural | — | None | Medium |

## Recommendations

- **Hard regulatory cap** → deploy single-chain, or build the oracle pay hook, or accept approximate enforcement.
- **Non-binding fundraising goal** → approach 1 or 2; set per-chain limits summing to ~80% of goal.
- **Team with an operator** → approach 3; accept 5–10% overshoot.
- **Revnet** → not applicable; revnets have no payout limits. For aggregate caps on a revnet, use the monitoring/oracle patterns.

## Common mistakes

- **Assuming the limit is project-wide.** Multiply by chain count when reasoning about maximum extraction.
- **Empty `fundAccessLimitGroups` = unlimited.** It's the opposite: zero payouts.
- **Amount decimals.** `payoutLimits[].amount` is in the limit currency's decimals — a USD-denominated limit paid from a 6-decimal USDC terminal is specified with the currency's fixed-point convention, not always 18 decimals.
- **Pausing with the same projectId everywhere.** Each chain has its own projectId; see `jb-omnichain-per-chain-projectids`.
- **Expecting sucker accounting to gate payouts.** Cross-chain gossip informs cash-out pricing only.

## Related skills

- `jb-omnichain-per-chain-projectids` — per-chain projectIds for any cross-chain operation
- `jb-suckers` — bridging mechanics and accounting gossip
- `jb-relayr` — bundling the multi-chain pause transactions
