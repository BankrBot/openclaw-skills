---
name: hoodrunner-stash
description: Wrap tokens into a Stash — an NFT that holds a basket of assets in its own account on Robinhood Chain. Create, fund, gift, nest, read (NAV), and unwrap Stashes. Run branded drops for a community. Trade a whole basket as one object; unwrap it natively. Built on ERC-6551 token-bound accounts; non-custodial.
metadata:
  {
    "clawdbot": {
      "emoji": "🏃",
      "homepage": "https://hoodrunner.net",
      "requires": { "bins": ["bankr"] },
    },
  }
---

# HoodRunner Stash

Turn tokens into a **Stash**: one NFT whose own account (ERC-6551) holds a basket of assets. Trade
the whole bag as a single object, gift it to someone, nest it inside another Stash, or unwrap it and
take the tokens natively. Nothing is pooled — each Stash is its own holder-controlled vault, so its
floor *is* its contents. HoodRunner is the courier; this skill is how you tell it to run a drop.

This skill drives on-chain actions through the **Bankr Wallet API** (transaction signing +
submission), so any agent with a Bankr key can create and deliver Stashes on Robinhood Chain.

## What it does
- **wrap** — mint a new Stash NFT + create its bound account (pay a flat wrap fee).
- **fund** — send any tokens into a Stash's account (self-directed; you choose the contents).
- **nav** — read a Stash's contents and total value (public, no key needed).
- **gift** — deliver a Stash to a person (resolve @social handle → address) — the courier's drop.
- **nest** — put a Stash (or NFT/tokens) inside another Stash's account.
- **unwrap** — the current holder sweeps the contents out to their wallet.
- **drop** — batch-wrap + gift many Stashes for a community (the B2B launch/loyalty use case).

## Setup
1. **Get a Bankr API key** (`bk_...`) with `walletApiEnabled`. See the base `bankr` skill for the
   headless-email or web-terminal flow. Read-only keys can call `nav` but not wrap/gift/unwrap.
2. **Point at Robinhood Chain** (chain id `4663`; testnet `46630`). Bankr natively supports RHC.
3. **Contract addresses** — see [references/stash-contracts.md](references/stash-contracts.md). The
   ERC-6551 registry is already live on RHC; the Stash collection, account implementation, and the
   fee entrypoint are HoodRunner-deployed (addresses in the reference; testnet first).

> **Non-custodial.** This skill only builds transactions your own wallet signs and submits via
> Bankr. HoodRunner never holds your assets — they live in each Stash's own account, which only the
> NFT holder controls.

## Actions → transactions

Each action is one or more transactions submitted through the Bankr Wallet API (`POST /wallet/tx`
with signed calldata). Full ABIs, selectors, and encodings are in
[references/stash-contracts.md](references/stash-contracts.md); a helper that computes the
deterministic account address and encodes calldata is in [scripts/stash.mjs](scripts/stash.mjs).

| Action | Call(s) | Notes |
| --- | --- | --- |
| wrap | `StashMint.wrap()` payable (flat fee) | Mints the NFT + creates its 6551 account atomically. Returns `(tokenId, account)`. |
| fund | `token.transfer(account, amount)` per asset | Self-directed — send whatever you want into the Stash's account. |
| nav | read `token.balanceOf(account)` per asset | Account address is deterministic — computable before it exists. |
| gift | `Stash.transferFrom(holder, recipient, tokenId)` | Resolve `@handle` → address via Bankr first. Basket moves with the NFT; zero token transfers. |
| nest | `Stash.transferFrom(holder, outerAccount, innerId)` | Outer account owns the inner Stash NFT → controls it recursively. |
| unwrap | `account.execute(token, 0, transfer(holder, bal), 0)` per asset | Only the current NFT holder can execute; ex-owners cannot drain a sold Stash. |

### The deterministic account (why pre-funding works)
A Stash's account address is derived from `(implementation, salt, chainId, collection, tokenId)` via
the registry `account(...)` view — it's known **before** the account is created, so a drop can fund a
Stash ahead of delivery. `createAccount(...)` with the same args then deploys it (idempotent).

## Supported chains
| Chain | Chain ID | 6551 registry | Notes |
| --- | --- | --- | --- |
| Robinhood Chain | 4663 | ✅ live (`0x0000…5758`) | Primary. Memecoins + freely-transferable ERC-20s. |
| Robinhood Chain testnet | 46630 | ✅ live | Proof-of-concept + dry runs. |

> **Contents rule:** Stash freely-transferable ERC-20s only. **Do not** wrap ERC-8056 tokenized
> stocks — their KYC/transfer restrictions break a tradeable, anonymous NFT.

## Fees & monetization
- **Flat wrap fee** — a per-action fee (not a % of contents) collected on-chain by the fee
  entrypoint. Set on `StashMint`; goes to the HoodRunner treasury.
- **Gift / drop fee** — flat fee to create a gifted drop (the courier running it for you).
- **x402** — the hosted `drop` endpoint (batch drops for a community) is priced via x402, so
  agents auto-pay per run. See [references/monetization.md](references/monetization.md).
- **$HOODRUNNER** — pay any fee in $HOODRUNNER for a discount; collected fees fund a buyback. Utility
  + medium-of-exchange only — never staking-for-yield, never "buy to earn."

## Safety & access control
- **Non-custodial** — assets live in the Stash's own account; only the holder's signature moves them.
- **Unbypassable fee** — minting is locked to the paid entrypoint (`minter` gate on the collection).
- **No back-door** — a sold Stash cannot be drained by its previous owner (enforced in `execute`).
- **Read-only keys** — restrict an agent to `nav` (no wrap/gift/unwrap) with a read-only `bk_` key.
- **Self-directed** — the caller chooses the contents; HoodRunner does not curate a basket for you.

## Prompt examples
- "Wrap 100 BRODIE, 50 VANE and 25 DASH into a Stash." → wrap → fund
- "What's in Stash #42 and what's it worth?" → nav
- "Gift Stash #42 to @friend." → resolve handle → gift
- "Put Stash #42 inside Stash #7." → nest
- "Unwrap Stash #42 into my wallet." → unwrap
- "Run a drop: wrap 200 GREENLIGHT each into 50 Stashes and gift them to this list." → drop

## Resources
- Site: https://hoodrunner.net
- Contracts + ABIs: [references/stash-contracts.md](references/stash-contracts.md)
- Monetization detail: [references/monetization.md](references/monetization.md)
- Helper (address derivation + calldata): [scripts/stash.mjs](scripts/stash.mjs)
- Base Bankr skill (key setup, Wallet API): the `bankr` skill in this directory.
