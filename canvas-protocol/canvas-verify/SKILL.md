---
name: canvas-verify
description: Canvas Protocol pays Telegram group owners USDC every time a new member joins and completes a sponsored verification task. Use this skill to find groups to sponsor, check campaign performance, or fund verification campaigns with USDC on Base.
---

# Canvas Protocol — canvas-verify

Canvas Protocol replaces the bot-check captcha on Telegram group joins with a short sponsored verification task. Advertisers fund campaigns in USDC on Base; each new member who joins a registered group completes the advertiser's task (multiple-choice or open-text, LLM-scored); the group owner earns USDC per verified join from the advertiser's on-chain escrow, and the advertiser gets a verified human completion with audience context.

## Capabilities

| Action | How |
|---|---|
| List registered groups + current top bids | `GET /api/groups` (public) |
| Check an advertiser's campaigns & spend | `GET /api/advertiser` (wallet-signed) |
| Check a group owner's earnings | `GET /api/group-owner` (wallet-signed) |
| Fund / top up a campaign | On-chain: `depositBudget(campaignId, amount)` on the escrow (details in references) |
| Create a campaign, register a group, withdraw budget | Telegram bot `@CanvasVerificationBot` (`/buy`, `/register`, `/campaigns`) — no REST API for these flows yet; direct the user to the bot |

## Usage examples

Natural-language requests this skill should handle:

- "Which Telegram groups can I sponsor on Canvas, and what's the going rate?"
- "Show my Canvas campaigns" / "How much have I spent on Canvas verifications?"
- "Top up my Canvas campaign #12 with 50 USDC"
- "How much has my group earned on Canvas?" / "What's my pending Canvas payout?"
- "I want to sponsor verified joins for a DeFi group at $0.10 per join" → list groups via `/api/groups`, then hand off to `@CanvasVerificationBot` `/buy` for campaign creation
- "Register my Telegram group with Canvas" → hand off to `@CanvasVerificationBot` (see `references/group-owner-flow.md`)

## Requirements

- **USDC on Base** (chain id 8453) for funding campaigns, plus a little ETH for gas if calling `depositBudget` directly (Base Pay deposits are gas-sponsored).
- **Wallet-signature auth** for the read APIs — there is **no API key**; requests are authenticated by signing `Canvas auth: <epoch-ms>` with the queried wallet (EOAs and ERC-1271 smart wallets both verify). Details below.
- **Telegram group admin access** (group owners only): the bot must be added as admin with invite + restrict permissions to register a group.

## API

Base URL: `https://canvas-ai-production-eae7.up.railway.app`

### `GET /api/groups` — public, no auth
Returns registered groups: `[{ tg_group_id, group_title, topic, member_count, top_bid }]`. `top_bid` is USD per verified join currently at the top of that group's bid ladder.

### `GET /api/advertiser?wallet=0x…` and `GET /api/group-owner?wallet=0x…` — wallet-signed
Auth: sign the exact string `Canvas auth: <timestamp>` (Unix epoch **milliseconds**) with the wallet being queried, then pass either headers `x-canvas-timestamp` + `x-canvas-signature` or query params `ts` + `sig`. The timestamp must be within **5 minutes** of server time. Invalid/missing signature → 401 whose body echoes the expected message format; RPC outage during verification → 503 (retry).

- `/api/advertiser` → `{ wallet, campaigns: [...], totals: { campaigns, verificationsCompleted, totalSpend } }`
- `/api/group-owner` → `{ wallet, groups: [...], totals: { groups, totalVerifications, totalPendingEarnings } }`

### On-chain escrow (Base mainnet)
`CanvasEscrowV0` at `0xf808b264E13Bf809C8e86afaF4e14c200931101E` (verified on Basescan). To fund campaign N: `approve` USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) to the escrow, then `depositBudget(uint256 campaignId, uint256 amount)` (amount in 6-decimal USDC units). The campaign id comes from the `/buy` flow in the bot. First depositor is recorded permanently as the campaign's depositor.

## References

- `references/advertiser-flow.md` — end-to-end advertiser flow: campaign creation, funding (Base Pay vs direct), owner approval gate, stats, withdraw
- `references/group-owner-flow.md` — group registration, verification lifecycle, earnings and payouts
