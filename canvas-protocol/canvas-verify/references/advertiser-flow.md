# Advertiser flow — funding verified-join campaigns

## 1. Pick a group

`GET https://canvas-ai-production-eae7.up.railway.app/api/groups` (public). Each entry has `tg_group_id`, `group_title`, `topic`, `member_count`, and `top_bid` (current top of the bid ladder, USD per verified join). To win placement your bid must beat `top_bid`; lower bids queue in the ladder and auto-promote when the leader's budget runs out.

## 2. Create the campaign — Telegram bot (`@CanvasVerificationBot`)

Campaign creation is a guided flow in the bot, not a REST call. The advertiser DMs `/buy` and picks: target group → bid per verification → quantity → task text (the question new members answer). Minimum bid: $0.01 (10,000 micro-USDC). The flow ends with a funding link for `bid × quantity`.

A linked wallet is required before `/buy` will start (`/link 0xYourAddress` in the bot) — all refunds pay this wallet.

## 3. Fund it (two paths)

**Base Pay (default, gas-sponsored):** the funding link opens a mini-app page; one tap pays USDC from a Coinbase/Base account into the escrow. The server verifies the payment, credits the campaign on-chain (`creditDirectDeposit`, relayer-signed), and the campaign moves forward automatically. Idempotent per payment id — safe to retry the confirm.

**Direct on-chain (for agents/EOAs):**
1. `approve(escrow, amount)` on USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
2. `depositBudget(campaignId, amount)` on escrow `0xf808b264E13Bf809C8e86afaF4e14c200931101E`
Amount is 6-decimal USDC micro-units; `campaignId` comes from the `/buy` flow. The first depositor is recorded permanently for the campaign. The deposit monitor picks up the `BudgetDeposited` event and confirms the campaign within ~30s.

## 4. Owner approval gate

A funded campaign lands in `pending_approval`: the group owner gets an Accept/Decline DM with the bid and task preview. Declined → automatic full refund to the advertiser's linked wallet. No response → **auto-accepts after 48 hours**. The advertiser can withdraw while pending.

## 5. Serving + billing

While the campaign is top of the ladder, each new member joining the group gets the campaign's task. Billing settles at verification pass (price locks when the task is sent); the group owner's share is paid from campaign escrow by a daily payout batch; Canvas retains the protocol fee (`PLATFORM_FEE_BPS`). Budget exhausted → next bidder auto-promotes.

## 6. Stats

`GET /api/advertiser?wallet=0x…` with wallet-signature auth (sign `Canvas auth: <epoch-ms>`, pass `ts` + `sig`; 5-minute window). Returns per-campaign: group, bid, remaining budget, task text, status (`pending_deposit | pending_approval | active | paused | exhausted | declined | withdrawn | expired`), verifications completed; plus totals. Also visible in the bot via `/campaigns` and the web dashboard at `/advertiser` (connect-and-sign).

## 7. Withdraw / pause / top up

All via the bot: `/campaigns` lists inline buttons per campaign — Withdraw (refunds remaining budget on-chain to the linked wallet; blocked for a few minutes if members are mid-verification so in-flight payouts can settle), Pause/Resume, and Top up (`/topup` — same two funding paths as above).
