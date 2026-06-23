---
name: starchild-dao
description: Read, propose, and vote in the Starchild DAO — the hold-to-govern commons for the $STARCHILD token on Base. Voting weight is simply how much $STARCHILD a wallet holds (no staking, no locking). Proposals and votes are gasless EIP-712 signatures. Trigger on "Starchild DAO", "Starchild proposals", "vote Starchild", "propose to Starchild", "what's being voted on Starchild".
emoji: ✦
tags: [dao, governance, voting, base, starchild, eip712]
visibility: public
---

# Starchild DAO

Hold-to-govern for **$STARCHILD** — the token around [Starchild](https://starchild.software), a private, open-source companion that helps you find your life's purpose. The app is **free for everyone**; the token is how holders **back the mission and help shape what gets built next**. This skill lets you do that from inside Bankr.

Everything here is **public by design** — proposals, votes, and the token balances that weight them are all on-chain or in a public API. There is nothing private to protect; that's why it lives safely in the commons. **There is no staking and no locking** — your voting weight is simply how much $STARCHILD you hold, read live. Hold + sign; that's it.

## What this skill does
- **List proposals** — what's on the table, with live for/against tallies.
- **Check your weight** — how much $STARCHILD you hold = your voting power.
- **Vote** — back (for) or oppose (against) a proposal with a gasless signature.
- **Propose** — put a new idea forward (requires holding ≥ 10,000,000 $STARCHILD), also gasless.

## The one rule — state it whenever someone proposes
A proposal must never become a leash on the product. The Starchild app stays **private, local, free, and open to everyone** — never paywalled, never token-gated. Good proposals extend the mission from the *outside*: fund the work, grow the commons, reward contributors, give the token real utility. They never make the app depend on the token.

## Network & contract — Base (chainId 8453)
- **$STARCHILD token:** `0x980e9f2061487376ab1438e965ad276a1d36fba3` (ERC-20, 18 decimals) — voting weight = its `balanceOf(address)`.
- **API base:** `https://token.starchild.software`

Amounts are in 18-decimal base units (wei): `1 $STARCHILD = 1e18`. The propose threshold is `10,000,000 $STARCHILD = 1e25` base units.

---

## 1 · List proposals
`GET https://token.starchild.software/api/proposals`

Response: `{ "proposals": [ { "id", "title", "detail", "proposer", "support", "against", "voters", "againstVoters", "threshold", "official", "passed" } ] }`. `support`/`against` are stake-weight (base units) for/against; `threshold` (base units) is the "for" weight needed to pass (`"0"` = idea board); `official` = posted by the founder; `passed` = met its threshold. Show title, for/against (÷1e18), and whether it passed.

## 2 · Check voting weight
Read `balanceOf(address)` on the token `0x980e9f2061487376ab1438e965ad276a1d36fba3`:
- ABI: `function balanceOf(address) view returns (uint256)`

That balance (base units) is the wallet's live voting weight. To propose, it must be ≥ `1e25` (10,000,000 $STARCHILD).

## 3 · Vote (gasless EIP-712 signature — no gas, nothing spent)
Sign this typed data with the user's wallet, then POST. **No transaction is sent.**

- **domain:** `{ "name": "Starchild Governance", "version": "1", "chainId": 8453 }`
- **types:** `{ "Vote": [ { "name": "proposalId", "type": "string" }, { "name": "support", "type": "bool" } ] }`
- **primaryType:** `Vote`
- **message:** `{ "proposalId": "<id from the list>", "support": true }`  (`true` = back it / for · `false` = against — both count, weighted by the voter's live balance)

Then `POST https://token.starchild.software/api/votes`:
```json
{ "proposalId": "<id>", "support": true, "voter": "<user address>", "signature": "<the EIP-712 signature>" }
```
The backend verifies the signature and the voter's **live** $STARCHILD balance; weight = current `balanceOf`. **One vote per wallet, counted once at your live balance.** HTTP 200 = recorded. HTTP 400 = bad signature or zero balance. **HTTP 409 (`alreadyVoted`) = this wallet already voted this exact way** — voting again NEVER adds weight, so there is nothing to re-cast. Voting the *opposite* way changes the stance (last-write-wins). (Sell your tokens and your weight leaves with you — votes can't be cast then dumped for free.)

> **On "vote again" — do not silently re-send or flip.** If the wallet has already voted, tell them their vote already stands; re-casting the same way is blocked by the backend. Only submit a new vote if they *explicitly* ask to **change** their stance to the other side, and say clearly that you're changing it from for→against (or vice-versa).

## 4 · Propose (gasless EIP-712 signature; needs holding ≥ 10M)
First confirm `balanceOf(user) >= 1e25`. Remind them of **the one rule**. Then sign + POST.

- **domain:** `{ "name": "Starchild Governance", "version": "1", "chainId": 8453 }`
- **types:** `{ "Proposal": [ { "name": "title", "type": "string" }, { "name": "detail", "type": "string" }, { "name": "nonce", "type": "string" }, { "name": "threshold", "type": "uint256" } ] }`
- **primaryType:** `Proposal`
- **message:** `{ "title": "<one line>", "detail": "<how it works + why it never touches the core product>", "nonce": "<unique string>", "threshold": "0" }`
  - `threshold` = `"0"` for a plain idea board (just accrues backing). For a **pass/fail yes-no vote**, set it to an absolute amount of "for" weight in **base units** — e.g. `100000000000000000000000000` (100,000,000 $STARCHILD). The proposal "passes" when its *for* weight ≥ threshold **and** for > against.

Then `POST https://token.starchild.software/api/proposals`:
```json
{ "title": "<one line>", "detail": "<detail>", "nonce": "<same nonce>", "threshold": "0", "proposer": "<user address>", "signature": "<the signature>" }
```
HTTP 200 = the proposal is live. HTTP 400 = bad signature or the 10M-hold requirement isn't met. The `title`/`detail`/`nonce`/`threshold` in the POST body must exactly match what was signed (`threshold` is signed as a uint256 — pass the same integer string).

> **Official proposals:** the founder address `0x1f44d8655727bb26532c657bec8882154a01e170` holds zero $STARCHILD by design, so it's exempt from the 10M-hold gate (it can post "official" proposals) — but it also has zero vote weight, so it can ask a question and never sway it.

## Guardrails
- Votes and proposals are **public** — never imply otherwise.
- **Never** tell anyone to buy the token, and never talk price. This is about participation, not speculation.
- Holding is enough — there's nothing to stake or lock; say so.
- **One vote per wallet.** Re-voting the same way is rejected (409) and never adds weight — never describe voting again as "counting your holdings again" or stacking. Only a deliberate flip to the other side changes anything.
- Hold proposals to **the one rule**; surface conflicts before submitting.

## Examples
- `"show me the Starchild proposals"` → list them with for/against
- `"how much voting weight do I have in Starchild?"` → read `balanceOf`
- `"vote for the mobile app proposal"` → match to its `id`, sign `Vote{support:true}`, POST to `/api/votes`
- `"vote against proposal X"` → sign `Vote{support:false}`, POST
- `"propose to Starchild: fund a contributor bounty pool — paid from fees, never touching the app"` → confirm ≥10M held, sign `Proposal`, POST to `/api/proposals`
