# Hot/cold wallet pattern for agent budgets

None of the four supported providers (Privy, Turnkey, Fireblocks, Bankr) natively enforce **aggregate** spend caps — they cap per-transaction values and allowlist destinations, but they do not track cumulative ETH/USDC spent over a day or week. This file describes the workable pattern: split the budget across two wallets, with the agent's wallet balance acting as the real aggregate ceiling.

## Why the agent's own daily-cap can't be the answer

A `dailyCapEth` field that the agent self-tracks is **agent honor-system**. A compromised agent or a prompt-injected agent will not respect it. To be a security control, the cap has to be enforced somewhere the agent does not control — either by the provider (which doesn't currently support cumulative caps) or by limiting the funds the agent has access to in the first place.

The wallet balance is that something. If the agent's wallet only holds one budget period's worth of ETH, the worst case for a fully compromised agent is one budget period of loss, not an open-ended drain.

## The pattern

Two wallets:

- **Cold (funding) wallet** — held by the user, on a hardware wallet or held cold. Holds the long-term budget. Never used for signing by the agent. Optionally has its own per-tx policy via the same provider, but the protection here is custody, not policy.
- **Hot (agent) wallet** — the wallet whose credentials are in the agent's env. Configured with a per-tx Privy/Turnkey/TAP policy. Balance is sized to roughly one budget period.

The user replenishes the hot wallet from the cold wallet on a cadence they control. The cadence is the aggregate cap — if the user tops up 0.5 ETH every Monday, the agent cannot spend more than 0.5 ETH per week regardless of what the agent thinks its `dailyCapEth` is.

Per-tx caps still matter — they limit single-transaction loss within the period. Aggregate caps are the wallet balance.

## Worked example

Goal: agent should be able to swap and buy NFTs for the user, with at most 0.1 ETH per single trade and at most about 0.5 ETH per week.

1. **Per-tx cap (provider layer):** apply a Privy policy with `value <= 100000000000000000` (0.1 ETH in wei) on the hot wallet. See `references/wallet-policies.md` for the template; apply it via `../../docs/policy-administration.md` (user-only).
2. **Aggregate cap (wallet float):** keep ~0.5 ETH on the hot wallet. Set a calendar reminder to replenish weekly from the cold wallet. The hot wallet's `address` is what `opensea wallet info` prints; send from the cold wallet to that address.
3. **Verify:** run `opensea wallet info`. The output should show `policyIds: ["pol_..."]` (per-tx cap is in place). The wallet balance you can verify on a block explorer or via your provider's dashboard — the CLI does not surface it.

If the agent attempts to spend 0.4 ETH on a single transaction, the per-tx Privy policy denies it before signing. If a compromised agent tries to drain the wallet via 5 × 0.1 ETH transactions in succession, it succeeds — and that's the bound. Five transactions of 0.1 ETH each is the period's budget, by construction.

## Sizing the float

Pick the float to be slightly above one budget period, not many periods. The whole point is that the float is the cap — making it 10× larger means the cap is 10× larger.

A reasonable default: 1.5× one period's expected spend. Enough that you don't have to top up mid-period for routine use; small enough that a worst-case loss is bounded.

## Provider-specific notes

- **Privy:** the hot wallet must have its own `policy_ids` and (recommended) `owner_id` so the agent's env credentials cannot raise the cap. See `references/wallet-setup.md` Privy section.
- **Turnkey:** scope the agent's API user to sign-only activities for the hot wallet's address; the cold wallet should belong to a different sub-org or be gated by a different policy.
- **Fireblocks:** put the cold wallet in a separate vault. The agent's API key (Signer role) only has signing access to the hot vault.
- **Bankr:** the hot wallet's API key should have `allowedRecipients` configured to the destinations the agent legitimately needs. The cold wallet is a separate Bankr account or a normal EOA the user controls.

## When a stateful approval webhook lands

If your provider adds a transaction-approval webhook (e.g., Privy's planned support for stateful policy callbacks), you can implement aggregate caps directly: the webhook reads recent on-chain transfers from the wallet, sums them against the cap, allows or denies. Until that exists, wallet float is the answer.
