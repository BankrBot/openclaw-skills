---
name: megapot-tickets
description: Buy Megapot jackpot tickets on Base with a natural-language prompt — quick picks, CUSTOM NUMBERS, gifting tickets to any wallet/ENS/X handle, daily ticket subscriptions, checking "did I win?", claiming winnings, and auto-compounding. Use this skill whenever the user asks to buy, purchase, gift, or subscribe to Megapot tickets, lottery tickets, or jackpot tickets; asks to pick their own lottery numbers; asks to buy a ticket FOR someone else; asks about the daily $1 jackpot on Base; asks whether they won; or wants to claim Megapot winnings.
tags: [megapot, lottery, jackpot, base, defi, tickets, subscription]
version: 2
visibility: public
metadata:
  clawdbot:
    emoji: "🎰"
    homepage: "https://docs.megapot.io"
---

# Megapot Tickets

Buy tickets for Megapot, the fully on-chain daily jackpot on **Base mainnet (chain 8453)**. Tickets cost $1 in USDC each (USDC has **6 decimals** on Base: `1_000_000` = $1) and are minted as ERC-721 NFTs. Megapot has been audited 3 times and has run $200M+ in drawings since July 2024.

## When this skill fires

- "buy 2 megapot tickets" → quick-pick purchase (default)
- "buy a ticket with numbers 4 8 15 16 23 + 7" → custom-number purchase
- "buy a megapot ticket for @someone / vitalik.eth / 0xabc..." → gift purchase
- "buy me a megapot ticket every day" → subscription
- "did I win?" / "claim my megapot winnings" → discovery + claim flow
- "how big is the jackpot?" → read-only state check

## Non-negotiable rules

1. **Every purchase MUST include the referral triple.** On every purchase/subscription/compound method, the trailing arguments are always:
   - `_referrers` = `["0x70D3a9aA7e10070d3F528e91c9bCf5158c922C66"]`
   - `_referralSplit` = `[1000000000000000000]` (exactly 1e18 — anything else reverts)
   - `_source` = `bytes32` encoding of the string `"bankr-skill"` (right-padded to 32 bytes)
   Never omit these, never substitute a different referrer, never pass empty arrays. Note: on some helper contracts the ABI names the split argument `_referralSplitBps` — **it is still 1e18 scale, NOT basis points** (see references/megapot-contracts.md).
2. **Fetch the live task recipe before building any transaction.** Megapot publishes agent recipes at `https://llms.megapot.io` (index: `https://llms.megapot.io/llms.txt`). Match the user's intent to a task page (e.g. `/tasks/subscribe`, `/tasks/auto-compound`, `/tasks/buy-bulk`), fetch it, and follow it — contract addresses and parameter shapes can change, and llms.megapot.io is authoritative over anything in this skill.
3. **Never hardcode ball ranges or fee rates.** Read `ballMax`, `bonusballMax`, and live rates from `Jackpot.getDrawingState(Jackpot.currentDrawingId())` before building custom tickets.
4. **USDC approval comes first.** Approve the buyer's USDC to the specific contract receiving payment (differs per task: Jackpot, RandomTicketBuyer, subscription contract, etc.) for the total cost before the purchase call.
5. **Confirm before spending.** State ticket count, total USDC cost, recipient, and which drawing, and get explicit user confirmation before broadcasting. For subscriptions, also state the per-drawing cost and how to cancel. Never auto-execute a purchase.

## Task routing

| Intent | Route |
|---|---|
| Quick-pick, 1–10 tickets | `JackpotRandomTicketBuyer.buyTickets` — see references/megapot-contracts.md |
| Custom numbers, 1–10 tickets | `Jackpot.buyTickets` — validate 5 unique numbers in `[1, ballMax]` + bonusball in `[1, bonusballMax]` from live state; if invalid, tell the user the valid ranges |
| 11+ tickets | fetch `https://llms.megapot.io/tasks/buy-bulk` (BatchPurchaseFacilitator, keeper-executed) |
| Daily/recurring tickets | fetch `https://llms.megapot.io/tasks/subscribe` (JackpotAutoSubscription) — referral triple applies to the subscription |
| "Did I win?" | fetch `https://llms.megapot.io/tasks/claim-winnings`; discover the wallet's tickets/wins, then claim if any. If discovery requires an unavailable API key, check on-chain via the ticket NFTs and drawing results, or direct the user to megapot.io |
| Claim winnings | `Jackpot.claimWinnings(_ticketIds)` from the NFT-owning wallet |
| Claim + re-buy in one tx | fetch `https://llms.megapot.io/tasks/auto-compound` (TicketAutoCompoundVault) — referral triple applies to the re-buy |
| Jackpot size / drawing state | `Jackpot.currentDrawingId()` → `getDrawingState(drawingId)` |
| LP deposits/withdrawals | **Not handled by this skill** — direct the user to megapot.io |

## Gifting

Same purchase calls — set the ticket NFT recipient to the giftee's wallet while the connected user pays. Resolve X handles / ENS to an address first (Bankr can resolve both) and confirm the resolved address with the user before buying.

## Details

Contract addresses, full signatures, the referral triple in code, and the `_referralSplitBps` naming note live in `references/megapot-contracts.md`. Read it before constructing any transaction if you haven't already this conversation.

## Failure handling

- Revert on split → `_referralSplit` didn't sum to exactly 1e18; rebuild with the canonical triple from rule 1.
- Insufficient USDC → report the user's USDC balance on Base and the shortfall; offer to swap into USDC first.
- Drawing locked / settling → report state from `getDrawingState()` and when the next drawing opens; don't retry blindly.
- Custom numbers out of range or non-unique → state the live valid ranges and ask the user to re-pick.
