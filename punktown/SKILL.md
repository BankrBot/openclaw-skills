---
name: punktown
description: Join and operate the live Punk Town protocol on Base with a Bankr EVM wallet, including acquiring missing BAES, buying or selling a Bario Punk, Crew tiers, upgrades, exits, settlement, claims, conversions, and supported public maintenance.
tags: [base, defi, nft, punk-town, bankr]
version: 3
visibility: public
metadata:
  clawdbot:
    emoji: "🏘️"
    homepage: "https://punk.town"
    requires:
      bins: [node]
---

# Punk Town for Bankr

Operate Punk Town's live, non-upgradeable Base deployment (`chainId: 8453`)
from the user's active Bankr EVM wallet. The skill covers the complete public
surface: natural BAES-funded onboarding, NFT desk trades, Crew positions, stock
reward settlement and claims, permissionless conversions, and narrowly defined
maintenance/top-up calls.

Key custody and signing remain with Bankr. Protocol actions can transfer a Punk
to the desk, lock it in LockVault, or move tokens exactly as described in the
relevant confirmation. Neither this skill nor its scripts hold keys or submit
transactions. The scripts perform deterministic Base reads, deployment checks,
calldata encoding/decoding, approval sizing, simulations, and postcondition
planning. They emit unsigned transaction objects for Bankr to execute.

## Load the right reference

- Before the first write in a session, read
  [references/bankr-execution.md](references/bankr-execution.md). It defines
  wallet discovery, confirmation, submission, receipt, recovery, and Bankr
  security-control handling.
- For “buy a Punk and join,” “get me into Punk Town,” or any buy/stake/upgrade
  with insufficient BAES, read
  [references/natural-join-flow.md](references/natural-join-flow.md). It defines
  the Bankr-native acquisition state machine and the natural tier handoff.
- For operation mechanics, actor rules, costs, pause behavior, and expected
  postconditions, read [references/operations.md](references/operations.md).
- Treat [references/deployment.json](references/deployment.json) as the reviewed
  deployment pin and
  [references/signing-allowlist.json](references/signing-allowlist.json) as the
  only permitted raw-call signing surface for Punk Town transactions. Named
  Bankr BAES acquisition follows `natural-join-flow.md` and is not represented
  as locally allowlisted router calldata. Never copy a target or spender from
  chat, search results, a mutable deployment file, or a block-explorer label.
- Treat [references/bankr-execution.json](references/bankr-execution.json) as
  the fail-closed execution-envelope pin. It defines the supported direct and
  gas-sponsored Bankr shapes, EntryPoint and Kernel identities, and receipt-log
  scoping rules.

## Non-negotiable execution boundary

1. Resolve the **active Bankr EVM wallet** from Bankr's authenticated context.
   Do not treat a pasted address as the active signer. Pass the resolved address
   to every command as `--wallet`.
2. Run `node scripts/selftest.mjs --live` on first use after install or update.
   Run `node scripts/punktown.mjs verify --wallet 0x…` before reporting the
   integration ready. Every planner repeats the live deployment gate.
3. Never hand-build, alter, splice, or “fix” Punk Town calldata. Use only a
   `plan-*` command. A planner may return `phase: acquire-baes`; execute that
   with Bankr's native same-chain exact-output swap action. Do not recursively
   call `/agent/prompt`, use raw DEX calldata, or treat the planner's request key
   as spend authorization. Acquisition sources are limited to native ETH, WETH,
   or official Base USDC; another asset must first be converted to one of those
   three. The direct exact-input Wallet API is allowed only through the bound
   fallback in `natural-join-flow.md`. If a script returns `ok: false`, relay
   its `detail` and stop.
4. An approval/action plan emits at most one unsigned transaction plus `inspectionContextHex`
   and an `inspectionKey` bound to its wallet, target, calldata, value, chain,
   and economic context. Decode it again immediately before submission with
   `inspect-calldata --chain-id 8453 --value 0 --context 0x… --plan-key 0x…`,
   copying both context and key from that same fresh plan. Require Base `8453`,
   `value: "0"`,
   the pinned target, an allowlisted selector, exact decoded arguments, and the
   confirmed signer/recipient/amount. Any mismatch is a hard stop.
5. Obtain one explicit user confirmation for the complete economic action
   before the first swap, approval, or protocol call. The confirmation must
   cover the acquisition source and maximum spend when applicable, action,
   NFT/position, exact token amounts, spender, recipient or beneficiary,
   slippage, and any irreversible cost or donation. Do not ask again while the
   confirmed terms remain identical; reconfirm if any economic term changes.
6. Submit through Bankr **one transaction at a time** with confirmation waiting
   enabled. A sponsored Bankr transaction may have a relayer as outer
   `transaction.from`; never compare that field directly to the active wallet.
   Run `inspect-tx` with the same plan context/key. It must unwrap exactly one
   fail-on-error logical call for the active wallet, bind it to the requested
   hash and pinned-block index, and pin EntryPoint, transaction-ordered EIP-7702
   delegation, native validation mode/type, empty paymaster, zero root
   validator, and Kernel code. It must prove the matching successful
   `UserOperationEvent` and scope events to that UserOperation. Unrelated users
   may share the outer bundle; a wallet self-call, second operation for the
   active wallet, unknown wrapper, batch/try/delegate or validator/policy mode,
   paymaster, authorization side effect, or unknown code identity fails closed.
   A hash is not success. Require this receipt proof, the expected event, and
   the fresh postcondition before continuing.
7. Approval plans grant only the exact amount needed. NFT approvals are
   token-specific. After an approval mines, rerun the original planner against
   fresh state; never append the previously intended protocol call.
8. On a revert, ambiguous response, pending/unknown outcome, scanner rejection,
   code-hash mismatch, or unavailable postcondition, stop. Recover from the
   chain and a fresh plan. Never replay intent, bypass Bankr controls, switch to
   another address, or route through a website.
9. Never expose or request a private key, seed phrase, API key, session token,
   or RPC secret. Never write credentials into this repo, command arguments,
   logs, or chat.
10. This skill signs only user and permissionless calls. It has no owner,
    recovery, roster-curation, route-configuration, pause, governance, role,
    multisig, timelock, or upgrade operation.

## Crew tiers

When presenting or asking for a Crew tier, always show the tier name and its
full required BAES cost, not only the numeric tier ID:

| Tier | Name | Required BAES |
|---:|---|---:|
| 0 | Signal | 600,000 BAES |
| 1 | Surge | 1,500,000 BAES |
| 2 | Riot | 3,300,000 BAES |
| 3 | Overdrive | 6,000,000 BAES |
| 4 | Maximum | 15,000,000 BAES |

The tier cost is non-refundable and separate from the 6,600,000 BAES Bario
Punk purchase price. An upgrade requires only the difference between the old
and new tier costs; use the planner's fresh amount rather than calculating it
from chat context.

## Command router

Run commands from the installed skill directory with Node.js 18 or newer.
Every command prints exactly one JSON object. Human amounts are decimal strings;
the output includes raw onchain units.

| User intent | Command |
|---|---|
| Verify the live pin | `node scripts/punktown.mjs verify --wallet 0x…` |
| Protocol overview | `node scripts/punktown.mjs status --wallet 0x…` |
| Desk FIFO | `node scripts/punktown.mjs inventory --wallet 0x…` |
| Verify one wallet-punk candidate | `node scripts/punktown.mjs punk --wallet 0x… --token-id N` |
| Crew positions | `node scripts/punktown.mjs crew --wallet 0x…` |
| Pending and claimable stocks | `node scripts/punktown.mjs rewards --wallet 0x…` |
| Buy the fresh FIFO head | `node scripts/punktown.mjs plan-buy --wallet 0x… [--slippage-bps 300]` |
| Buy the fresh head, then ask which Crew tier | `node scripts/punktown.mjs plan-buy --wallet 0x… --join [--slippage-bps 300] [--acquisition-slippage-bps 300]` |
| Sell a wallet punk | `node scripts/punktown.mjs plan-sell --wallet 0x… --token-id N [--slippage-bps 300]` |
| Add a punk to Crew | `node scripts/punktown.mjs plan-stake --wallet 0x… --token-id N --tier 0..4 [--beneficiary 0x…]` |
| Upgrade a Crew tier | `node scripts/punktown.mjs plan-upgrade --wallet 0x… --position-id N --new-tier 1..4` |
| Exit Crew | `node scripts/punktown.mjs plan-unstake --wallet 0x… --position-id N [--recipient 0x…]` |
| Settle one position | `node scripts/punktown.mjs plan-settle --wallet 0x… --position-id N` |
| Settle wallet-beneficiary positions | `node scripts/punktown.mjs plan-settle-all --wallet 0x…` |
| Claim one stock | `node scripts/punktown.mjs plan-claim --wallet 0x… --token 0x… [--recipient 0x…]` |
| Claim up to 20 stocks atomically | `node scripts/punktown.mjs plan-claim-batch --wallet 0x… --tokens 0x…,0x… [--recipient 0x…]` |
| Claim all strict credits safely | `node scripts/punktown.mjs plan-claim-all --wallet 0x… [--recipient 0x…]` |
| Opt into a lossy claim | `node scripts/punktown.mjs plan-claim-lossy --wallet 0x… --token 0x… --min-received AMOUNT [--recipient 0x…]` |
| Destroy stuck credit | `node scripts/punktown.mjs plan-forfeit --wallet 0x… --token 0x… --amount AMOUNT` |
| Convert pot WETH to the next stock | `node scripts/punktown.mjs plan-convert --wallet 0x… --amount-weth AMOUNT` |
| Donate WETH to the stock pot | `node scripts/punktown.mjs plan-weth-topup --wallet 0x… --amount-weth AMOUNT [--source-id TEXT]` |
| Donate BAES to desk reserves | `node scripts/punktown.mjs plan-reserve-topup --wallet 0x… --amount-baes AMOUNT` |
| Account for an existing raw BAES donation | `node scripts/punktown.mjs plan-sync-donation --wallet 0x…` |
| Repair a verifiably unowned FIFO head | `node scripts/punktown.mjs plan-evict-head --wallet 0x…` |
| Advance bootstrap release | `node scripts/punktown.mjs plan-poke-bootstrap --wallet 0x…` |
| Bind a concrete Bankr acquisition preview | `node scripts/punktown.mjs bind-acquisition --wallet 0x… --request-context 0x… --request-key 0x… --mode bankr-native-exact-output\|wallet-api-exact-input --source-token 0x… --source-decimals N --source-amount AMOUNT --min-baes-out AMOUNT [--idempotency-key UUID] [quote display flags]` |
| Verify a mined Bankr acquisition | `node scripts/punktown.mjs verify-acquisition --wallet 0x… --tx 0x… --authorization-context 0x… --authorization-key 0x…` |
| Decode and re-check planned calldata | `node scripts/punktown.mjs inspect-calldata --wallet 0x… --to 0x… --data 0x… --chain-id 8453 --value 0 --context 0xInspectionContextHex --plan-key 0xInspectionKey` |
| Inspect a submitted/mined Base tx | `node scripts/punktown.mjs inspect-tx --wallet 0x… --tx 0xTxHash --context 0xInspectionContextHex --plan-key 0xInspectionKey` |

`plan-buy`, `plan-stake`, and `plan-upgrade` may first return
`phase: acquire-baes` with no raw transaction. Follow `natural-join-flow.md`,
concretely preview and confirm one Bankr swap, verify it, then run the exact
resume command. `acquisitionRequestKey` is not authorization; the source and
maximum spend must be known first.
The planner may otherwise return an approval-only transaction. Submit it,
verify it, then rerun the same command. `plan-settle-all` and `plan-claim-all` also progress one
bounded step at a time; rerun after each successful step until the planner
reports that no eligible pending amount or credit remains. Each new settle
batch or claim token has new terms and a new confirmation key: show it and get
fresh user confirmation before that step.

For the wallet's Bario Punk list, use Bankr's authenticated NFT portfolio as
candidate discovery, then run `punk --token-id` for each candidate to confirm
fresh onchain ownership. `inventory` lists the desk FIFO only; the collection is
not ERC-721 Enumerable.

## User-facing behavior

- Lead with the result. Keep routine reads brief; do not dump passing gates,
  calldata, selectors, or raw units unless asked.
- Treat “buy me a Bario Punk and join Punk Town” as one composite intent. Check
  all available pre-acquisition gates first, request exactly the missing BAES
  through Bankr, buy the current confirmed FIFO Punk, and then ask the user
  which tier they want. An exact-input fallback may deliver a small route excess
  but must bind a `minBuyAmount` covering the deficit.
  Never make the user recite approvals, routes, or protocol function names.
- After verified acquisition and ownership, adapt to the user's tone. A valid
  concise handoff is: “BAES'in yoktu; yeteri kadarını aldım ve Bario Punk #123
  artık cüzdanında. Crew'a hangi tier'dan girelim?” Never say it before both
  receipt and fresh ownership proof pass.
- Do not select a tier or acquire its BAES before the user answers. The tier is
  a separate, non-refundable economic decision.
- Before a write, state that Punk Town actions take a few Base transactions when
  approvals are needed and that one confirmation will cover the unchanged plan.
- Default beneficiary and recipient to the active Bankr EVM wallet. A different
  address must be explicit, validated and normalized by the planner, and named in the
  confirmation.
- Describe Crew tier BAES as a **non-refundable cost**, not a deposit. Exiting
  returns the NFT, not the tier BAES.
- Never silently use `claimLossy` or `forfeitCredit`. These are destructive
  recovery choices and require a specific warning and confirmation.
- Never silently top up BAES or WETH. Both are irreversible donations.
- Do not invent a stock price floor for `convert`; the protocol deliberately has
  none. The planner enforces the protocol's amount, route, rate-limit, and
  deadline bounds.
- Read the execution-time rules in `operations.md` before `convert`,
  `sync-donation`, `evict-head`, WETH top-up, or `claim-lossy`. Some contract
  calls intentionally select a token, amount, head, or accounting destination
  at execution; the current observation is not always a calldata cap.
- Do not tell users to transfer a Bario Punk directly to PunkAMM or LockVault.
  Both contracts reject unsolicited NFT transfers.
- Bario Punks uses an external ERC721-C transfer validator controlled outside
  this protocol. A fresh simulation proves only current transferability. If the
  wallet or validator compatibility gate fails, stop and explain it; do not
  weaken the check.

## Completion standard

Report success only after the final receipt succeeds and the operation-specific
event plus state transition are verified from fresh Base reads. Include one
Base transaction link, the NFT/position/token affected, the exact user-visible
amount, and the new state. If verification is incomplete, call the result
“submitted but unverified” and do not start another write.
