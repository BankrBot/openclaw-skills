---
name: paymedividends-join-holder-sink
description: Join the Pay Me Dividends holder sink for existing Bankr tokens on Robinhood Chain. List fee-beneficiary tokens, create a Project Router, retarget Doppler fees to holders pro-rata, verify onchain, and queue Hub enrollment. New launches use app.paymedividends.xyz instead.
metadata:
  {
    "clawdbot":
      {
        "emoji": "💸",
        "homepage": "https://app.paymedividends.xyz",
      },
  }
---

# Join the Pay Me Dividends holder sink

Route an **existing** Bankr token's trading fees to holders pro-rata via a Project Router and the shared RWA Hub.

Natural-language triggers:

- "Join the Pay Me Dividends holder sink"
- "Route my token fees to holders pro-rata"
- "I want my Bankr token in the shared RWA rewards pool"

**New token launches** are not this skill — send users to [app.paymedividends.xyz](https://app.paymedividends.xyz) (router + Bankr deploy with API key in browser).

## Who can use this

Only the wallet that is the **current Doppler fee beneficiary** for the token (≥95% share). Bankr resolves the user's wallet from their session/API key — never offer sink setup for tokens where they are not the beneficiary.

## Flow

1. Resolve wallet `W` from Bankr auth
2. `GET https://api.bankr.bot/public/doppler/beneficiary-fees/W`
3. Filter: `chain === "robinhood"`, share ≥ 95%, paired with an RWA/stock quote (not WETH-only)
4. User picks a token
5. On Robinhood Chain (4663):
   - Create router: `ProjectRouterFactory.createPrelaunchRouter(hub, …)`
   - Retarget fees: `POST https://api.bankr.bot/public/doppler/build-transfer-beneficiary` → sign `updateBeneficiary`
   - Verify: `getShares(poolId, router) >= 0.95e18`
6. `POST https://paymedividends-production.up.railway.app/v1/enrollment-requests` (or site wizard)
7. Governance Safe calls `enrollMemberRouter` → 7-day delay → `activateMemberRouter`

Deep link (existing token): `https://app.paymedividends.xyz/#test-lab?token=0x…`

## Platform constants (Robinhood mainnet)

| Contract | Address |
|---|---|
| ProjectRouterFactory | `0x4AD615B99e2B6E8e2C322c657Ac8f81F1806A3a7` |
| UniversalRewardsHub | `0x6844D0814E904722777A48Ae2CF7C4b8F78a19e5` |
| Fee manager | `0x4e3468951D49f2EEa976eD0D6e75fFCb44a9a544` |
| RPC | `https://rpc.mainnet.chain.robinhood.com` |

## APIs

See [references/api.md](references/api.md) for request/response details.

Proxy (optional): `GET /v1/bankr/beneficiary-fees/:wallet` on Pay Me Dividends API filters Robinhood stock-paired tokens.

## Must NOT do

- Router setup for non-beneficiary wallets
- Hub enrollment onchain (governance Safe only)
- Store user Bankr API keys server-side for the launch wizard

## Product rules

- Holder pro-rata only — no creator-fee wallet at launch
- Fee recipient = Project Router (holder sink)
- Shared Hub is governance-gated per RWA ecosystem pool
