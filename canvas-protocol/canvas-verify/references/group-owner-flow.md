# Group owner flow — registering a group and earning from verified joins

## 1. Register

1. Add `@CanvasVerificationBot` to the Telegram group as **admin** with at least: invite users via link, restrict members, delete messages.
2. Run `/register` in the group. The rest of the flow moves to DM: set a payout wallet (`/wallet 0xAddress`, Base address) and optionally group rules (one per line; shown to new members post-verification) and a custom verification question.
3. The group chat gets one public confirmation line; the bot DMs the owner a **portal invite link** to share — joins through it are interceptable even in groups where open joining wouldn't be.

## 2. What happens to new members

Join intercepted → member muted → task DM'd (advertiser's task when a funded campaign is active; the group's own question otherwise) → LLM-scored (advertiser-funded tasks) → pass → rules-agreement gate ("I agree" button) → unmuted/admitted. Fail/timeout → removed, 24h cooldown, one attempt per group per 12h. All recovery paths are automated (sweeps re-drive stranded states); scoring outages never penalize the member.

## 3. Earnings

Per verified join under an active campaign, the owner earns the campaign's locked bid minus the Canvas protocol fee. Payouts accrue at verification pass and are released **in a daily batch** from the campaign's on-chain escrow directly to the group's payout wallet (USDC on Base). No claiming needed.

Check earnings:
- Bot: `/menu` → My Stats (weekly verifications, pending earnings, current top bid)
- API: `GET /api/group-owner?wallet=0x…` with wallet-signature auth (sign `Canvas auth: <epoch-ms>`; `ts` + `sig`; 5-min window) → per-group verification counts + `totalPendingEarnings`
- Dashboard: `/group-owner` (connect-and-sign)

## 4. Advertiser control

When an advertiser funds a campaign targeting the group, the owner gets an Accept/Decline DM (bid + task preview). Decline refunds the advertiser automatically; no response auto-accepts after 48 hours. Once a bidder is accepted, ladder auto-promotion (next bidder when budget runs out) does not re-prompt.

## 5. Managing

`/menu` in DM: My Stats · Portal Link · Edit Rules · Update Wallet · Help, with a group picker for owners of multiple groups. Wallet updates are per-group. `/invite` regenerates the portal link.

## Notes for agents

- Registration and management are Telegram-native — an agent's job is to route the owner to the bot with the right command, then use `/api/group-owner` for anything read-only.
- The payout wallet can be any Base address, including a smart wallet; earnings arrive as plain USDC transfers from the escrow contract (`0xf808b264E13Bf809C8e86afaF4e14c200931101E`).
