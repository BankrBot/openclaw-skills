# Holder NFTs (simple / V3 launches)

Every **simple** (`launchMode: "simple"`) token gets an embedded **1,000-share** ERC-1155 vault (10% of token supply).

## Platform fees — only two

| Fee | Split |
|-----|--------|
| **Swap / trading fees** | **5%** hood.markets platform · **95%** pro-rata to share holders — embedded in `HoodMarketsV3LpLocker`; paid via `claimTradingFees()` |
| **Share listings (`buyShares`)** | **5%** of sale price to platform · **95%** to seller |

**Nothing else is taxed** — no fee on wallet sends, batch airdrops, mint/burn, listing escrow (`listShares` / `cancelListing`), or buyer-reward mints. **`buyShares`** marketplace settlement is the only taxed share move (5% of sale price).

> **Legacy v0.8–v0.10 factories** incorrectly skimmed shares on wallet sends (and v0.10 on airdrops). New launches must use **v0.11+** factory for the policy above.

## Airdrop (one transaction)

- **`airdropShares(recipients[], amounts[])`** — many wallets in **one** transaction (v0.10+ fraction bytecode).
- v0.11 delivers **full amounts** — no platform skim.
- hood.markets token page uses batch when supported; legacy per-wallet `safeTransferFrom` only on older bytecode without `airdropShares`.

## At launch

| Default | Behavior |
|---------|----------|
| **Fee recipient** | Receives all **1,000** shares |
| **Buyer rewards** | **Post-launch opt-in** — `fundBuyerRewardPool` on token page (v0.9+). Not on hood.markets launch form. API deploy may still accept `buyerRewardShareCount` (legacy). |
| **Web “Someone else”** | Fee recipient must be a **`0x…` wallet address** — not `@handle` or profile URL |

## Trading & LP

- Launch LP is **locked** — users **buy/sell the token** on Uniswap, not “fund LP” on hood.markets
- Hold shares to earn the **95%** swap-fee slice pro-rata

## Claim fees (agents)

`POST /api/agent/claim` or `POST /api/agent/claim-for-recipient`:

- API calls **`claimTradingFees()`** on the fraction (v0.7+) — locker 5%/95% split, then pro-rata to holders
- Legacy v0.6: `HoodMarketsV3.claimRewards(token)` (fee wallet only)

No Bankr `/wallet/submit` for claims.

## Factory versions (Robinhood mainnet)

| Version | Factory | Notes |
|---------|---------|--------|
| **v0.11.0** (current) | `0x9BDdC8ddf28f5629C989A36Eb5bb6C73cBA60Df5` | Two fees only: swap + marketplace sales |
| v0.10.0 | `0xf65536Eb3354Ad7e77E1b0d0F7bEBFa1C88885C9` | Legacy: skimmed sends/airdrops; has `airdropShares` |
| v0.9.0 | `0x3a94FD3422F50ed6cC08e547c6C697E4bb3e76c8` | + buyer reward fund/cancel post-launch |
| v0.8.0 | `0xC2A604fF131dDE9201838007A129ea28b85d00e8` | Legacy: 5% on sends + sales |
| v0.7.0 | `0x45A3820A9A563e78A4cF7F355F7Be10fA6B706B3` | Marketplace, no share platform fees |
| v0.6.0 | `0x7E2905ddF3Dca96117A9e9d50F2924C1E7FE7Be1` | Fee wallet claim only |

## Agent guidance

- Only two platform fees: **swap trading fees (5%/95%)** and **share sale price (5%/95%)**
- Do not promise “fund the LP” — direct users to buy the token or buy shares on listings

## Agent restrictions (CRITICAL)

Holder NFT / share actions are **on-chain on the hood.markets token page only**. Bankr agents **must NOT**:

| Action | On-chain call | Agent may? |
|--------|---------------|------------|
| Claim trading fees | `claimTradingFees()` via API | **Yes** — `POST /api/agent/claim` or `claim-for-recipient` only |
| Batch airdrop | `airdropShares` | **No** — token page + user wallet |
| List / buy shares | `listShares`, `buyShares`, `cancelListing` | **No** |
| Buyer rewards | `fundBuyerRewardPool`, `cancelBuyerRewardPool` | **No** |
| Transfer shares | ERC-1155 `safeTransferFrom` | **No** |

**Do not** call `prepare-buy`/`prepare-sell`, Bankr `/wallet/submit`, or invent calldata for these flows.

If a user asks to airdrop shares, list shares, or fund buyer rewards → direct them to **https://hood.markets/?token=0x…** and their connected wallet. No agent API exists for these actions today.

See `references/PROMPT-INJECTION.md`.
