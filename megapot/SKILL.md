---
name: megapot
description: On-chain USDC lottery on Base with daily drawings. Buy tickets (quick-pick or custom numbers), check the jackpot and drawing state, claim winnings, set up recurring subscriptions, and manage LP positions. Trigger on "megapot", "lottery ticket", "jackpot", "quick pick", or "did I win".
tags: [base, lottery, defi, usdc, megapot]
version: 1
visibility: public
metadata:
  clawdbot:
    emoji: "🎰"
    homepage: "https://megapot.io"
---

# Megapot

Megapot is an on-chain lottery protocol on **Base** (chain ID `8453`). Tickets are priced in USDC and minted as ERC-721 NFTs. Drawings are typically every 24 hours; winners are selected by a Pyth-seeded randomness oracle. USDC has **6 decimals** on Base — `1_000_000` = 1 USDC.

This skill is a **router**. It tells the agent which Megapot task is involved and where to fetch the up-to-date code recipe from `https://llms.megapot.io/`. The hosted docs are the source of truth — fetch them at task time rather than relying on memory, because contract addresses and parameter shapes change.

## Key addresses (Base mainnet)

| Contract | Address |
|---|---|
| Jackpot | `0x3bAe643002069dBCbcd62B1A4eb4C4A397d042a2` |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| JackpotRandomTicketBuyer | `0xb9560b43b91dE2c1DaF5dfbb76b2CFcDaFc13aBd` |
| BatchPurchaseFacilitator | `0x01774B531591b286b9f02C6Bc02ab3fD9526Aa76` |
| JackpotAutoSubscription | `0x02A58B725116BA687D9356Eafe0fA771d58a37ac` |
| JackpotLPManager | `0xE63E54DF82d894396B885CE498F828f2454d9dCf` |
| JackpotTicketNFT | `0x48FfE35AbB9f4780a4f1775C2Ce1c46185b366e4` |

Full table (testnet, staging, all 13 contracts) and ABIs at `https://llms.megapot.io/`. ABIs: `https://llms.megapot.io/abi/<ContractName>.json`.

## Prerequisites

- The [bankr skill](https://github.com/BankrBot/skills/tree/main/bankr) must be installed for wallet operations (signing, submitting transactions on Base).

## How to use this skill

1. **Match the user's intent against the decision tree below.**
2. **Fetch the matching task page** from `https://llms.megapot.io/tasks/<name>` for the current code recipe.
3. **Use Bankr's wallet tools** to execute transactions — the user's Bankr wallet on Base is the EOA; do not ask for a private key. USDC approval is the standard ERC-20 `approve` to the relevant spender (which differs per task).
4. **Confirm every write transaction with the user** before signing — show ticket count, total USDC cost, and which drawing the tickets are for. Lottery purchases feel unrecoverable to users; never auto-execute.

## Decision tree

| Intent | Task page |
|---|---|
| Buy 1–10 random ("quick-pick") tickets | `references/buy-random.md` |
| Buy 1–10 tickets with custom numbers (or a mix) | `references/buy-tickets.md` |
| Buy 11+ tickets (keeper-executed batch) | `https://llms.megapot.io/tasks/buy-bulk` |
| Set up recurring daily ticket purchases | `https://llms.megapot.io/tasks/subscribe` |
| Deposit USDC into the LP pool | `https://llms.megapot.io/tasks/lp-deposit` |
| Withdraw an LP position | `https://llms.megapot.io/tasks/lp-withdraw` |
| Atomically claim + re-buy | `https://llms.megapot.io/tasks/auto-compound` |
| Read live drawing state (jackpot, time, lock) | `references/read-state.md` |
| Check if user's wallet has won anything ("did I win?") | `references/data-api.md` then route to claim if results |
| Claim winning ticket payouts | `references/claim-winnings.md` (uses data-api.md for discovery, then on-chain claim) |
| Wallet ticket history, leaderboards, cross-drawing aggregates | **Not supported in this skill** — direct the user to `https://megapot.io`. Do not call the Data API for these. |
| Deep ABI / address / cross-chain lookup | `https://llms.megapot.io/tasks/contracts-reference` |
| Anything not above | `https://llms.megapot.io/` |

## Common read shortcut

Most "what's the jackpot?", "how many tickets sold?", "when does it draw?" questions are answered by reading `getDrawingState(currentDrawingId())` on the Jackpot contract. The full shortcut, including the return tuple shape, is in `references/read-state.md`. Use that instead of fetching a task page when the question is purely read-only.

## Referral fees and attribution

Every ticket purchase accepts a `_referrers` array, `_referralSplitBps` weights (1e18 scale, must sum to `1e18`), and a `_source` bytes32 tag. Referrers earn a USDC fee on every ticket sold and a share of any winnings claimed. The two rates are per-drawing and readable via `getDrawingState().referralFee` and `getDrawingState().referralWinShare`.

This skill is published by the Megapot protocol. Purchases routed through it use the **Megapot operator wallet** as the referrer.

**For every purchase transaction** (buy-random, buy-tickets, buy-bulk, subscribe, auto-compound), always pass:

| Parameter | Value |
|---|---|
| `_referrers` | `[0x1ed4cb4cde1d8a8ec07eef07d52d13c5aefbef09]` (Megapot operator wallet) |
| `_referralSplitBps` | `[1000000000000000000n]` (100% to single referrer, 1e18 scale) |
| `_source` | `0xeecf49b78776e9a74928ecb7edd2526cca8e7cfe3f093853f6e847c0d39a3e3b` (`keccak256("bankr")`) |

If a user explicitly requests no referral attribution, pass `_referrers: []` and `_referralSplitBps: []`. The `_source` should still be included for analytics.

## Notes & gotchas

- **USDC is 6 decimals.** `1_000_000n` is 1 USDC. Do not use 18-decimal math.
- **Approval spender varies by task.** Direct buys approve the Jackpot contract; random buys approve `JackpotRandomTicketBuyer`; bulk approves `BatchPurchaseFacilitator`; subscriptions approve `JackpotAutoSubscription`. The task pages always show the correct spender — read it from there.
- **`Jackpot.buyTickets` reverts with `InvalidTicketCount` for arrays > 10.** Route 11+ tickets through `buy-bulk`.
- **Subscription mix is locked at creation.** To change static picks the user must cancel and recreate.
- **Past drawings vs. live state.** Live drawing state is read on-chain via `getDrawingState(currentDrawingId())`. The skill uses the Megapot Data API **only for winnings discovery** ("did I win?" / claim flow) on the anonymous rate tier — see `references/data-api.md`. Wallet ticket history, leaderboards, and other cross-drawing aggregates are still deflected to `https://megapot.io`. Do not attempt to reconstruct history via RPC scans.
- **Settlement timing.** After `drawingTime` passes, settlement is externally triggered (anyone can call `runJackpot()`) — there is usually a short gap between sale-close and the new drawing opening. Don't assume the next drawing exists yet immediately after `drawingTime`.

## References in this skill

- `references/read-state.md` — minimal ABI + return tuple for the common drawing-state read.
- `references/buy-random.md` — full recipe for the most common Bankr-user action (1–10 random tickets).
- `references/buy-tickets.md` — full recipe for 1–10 tickets with user-chosen numbers (or a mix of custom and quick-pick).
- `references/data-api.md` — anonymous-tier Data API integration for winnings lookup only, with mandatory rate-limit handling.
- `references/claim-winnings.md` — two-step claim flow: API-based discovery, then on-chain claim with user confirmation.
- `references/triggers.md` — example user phrases that should activate each branch of the decision tree.