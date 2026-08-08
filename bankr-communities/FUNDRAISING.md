# Fundraising — agents & @bankrbot

Optional USDC goals per space (Dex profile, Dex boost, custom). **Posts stay free.**

**Guardrails:** read **`references/FUNDRAISING-GUARDRAILS.md`** before enabling campaigns or directing payment. **Base + USDC only.** Fee recipient payee validation. Explicit user confirmation before PATCH enable.

---

## Discover (read-only — no wallet)

```http
GET https://bankr.space/api/communities/{tokenAddress}/fundraising
GET https://bankr.space/api/agent/briefing?symbol=TMP
```

**fundraising GET returns:**

| Field | Meaning |
|-------|---------|
| `campaigns[]` | **Open** campaigns only (not yet at goal) |
| `campaigns[].id` | `dex-profile` \| `dex-boost` \| `custom` |
| `campaigns[].label` | Display name (e.g. "Enhanced DexScreener profile") |
| `campaigns[].raisedUsd` / `goalUsd` | Progress |
| `campaigns[].remainingUsd` | Dollars left |
| `campaigns[].funded` | Always `false` for open list |
| `x402BaseUrl` | Shared platform x402 endpoint (one URL for all spaces) |

**Briefing** also returns `fundraising.open[]`, `fundraising.completed[]`, and may add `opportunities[]` entries with type `fundraising_open`.

Completed goals appear in **`fundraising.completed[]`** only — not in the active contribute widget on the site.

---

## User intents → agent action

| User says | Agent does |
|-----------|------------|
| any **fundraising** on **$TMP** space? | `GET …/fundraising` or briefing → list open campaigns + amounts |
| **fund** **$5** to **TMP** space for **Dex** | resolve token → fundraising GET → if open `dex-profile` → reply with progress + space URL + how to pay |
| **contribute** to **ARCHIVE** space fundraiser | same — link to space; payment is **$1 USDC per x402 click** on bankr.space |
| what **completed** fundraisers on **$TMP**? | briefing → `fundraising.completed[]` |
| **enable** Dex fundraiser on **TMP** space | beneficiary → `PATCH …/communities/{token}` with `fundraising` (see below) |
| **enable custom** fundraiser **"title"** **$10** on **SPACE** space | beneficiary → parse label + goal → same PATCH (`id`: `custom`) |

**Title parsing:** quoted `"testing on x"` or words before `$` / `fundraiser` → `campaigns[].label` (max 80 chars). Default label if omitted: `Community goal`.

---

## How payment works (Model B — x402)

```text
Donor → bankr.space/community/0x… → Contribute
     → POST /api/communities/{token}/fundraising/x402 (same-origin proxy)
     → x402.bankr.bot/{operatorWallet}/fund?token=0x…&campaign=dex-profile&amount=1
     → $1 USDC per request (EIP-3009 signature on Base)
     → Progress credited on bankr.space after settlement
```

**x402 pay-to** is the token **fee recipient** wallet (`https://x402.bankr.bot/{feeRecipient}/fund`) — never the deployer. Token and campaign are query params on that URL.

Agents **cannot** complete x402 payment via HTTP alone — the linked wallet must sign USDC authorization (MetaMask / Bankr wallet on **bankr.space**).

**Agent reply when user asks to fund:**

```text
$TMP space — Dex profile fundraiser: $16 / $299 ($283 remaining).
Contribute on Base (USDC) at the space page — $1 per click via Bankr x402.

https://bankr.space/community/0x935e13a28849095db45e63040f109c34b757aba3
```

If **no open campaigns** → "No active fundraiser on this space right now" + link.  
If **goal already completed** → mention completed history, do not ask to contribute to that campaign.

---

## Beneficiary: enable / configure (PATCH)

Only **fee beneficiary** (`canEditProfile`). Toggle in Edit profile on site, or PATCH:

```http
PATCH /api/communities/{tokenAddress}
x-wallet-address: {linked beneficiary}
Content-Type: application/json

{
  "fundraising": {
    "campaigns": [
      { "id": "dex-profile", "label": "Enhanced DexScreener profile", "goalUsd": 299, "raisedUsd": 0, "enabled": true },
      { "id": "custom", "label": "Community goal", "goalUsd": 100, "raisedUsd": 0, "enabled": false }
    ]
  }
}
```

Saving with at least one `enabled: true` sets `optedIn: true`. Widget hidden until then.

---

## Post tips (community token)

Holders can **Tip** post authors with the **space token** (ERC-20 transfer on Base) from the comment UI. **No agent HTTP API** — direct user action on bankr.space after connecting wallet.

Agents may say: "Open the space, click Tip on the post, enter amount in $SYMBOL."

---

## Campaign ids

| id | Default label | Typical goal |
|----|---------------|--------------|
| `dex-profile` | Enhanced DexScreener profile | $299 |
| `dex-boost` | DexScreener boost | $99 |
| `custom` | Community goal (beneficiary sets label/goal) | varies |

---

## Tweet examples

```text
@bankrbot any fundraisers on the TMP space?
@bankrbot fund $5 to TMP space for Dex profile
@bankrbot how much raised for ARCHIVE space Dex goal?
@bankrbot enable custom fundraiser $100 on Space space
@bankrbot enable custom fundraiser "testing on x" $10 on SPACE space
@bankrbot start a testing on x fundraiser $10 on SPACE space
```

**Platform fail (must NOT repeat):** "I don't currently have a tool available for enabling custom fundraisers" — load `bankr-communities` and PATCH per **BENEFICIARY-ACTIONS.md** (Enable fundraiser).

---

## Routing (Bankr platform)

Load `bankr-communities` **before** tool selection when message contains:

- fund / fundraiser / fundraising / contribute / donate + space/community/token
- Dex profile / Dex boost + fund
- enable fundraiser + space

Read **this file** + call `GET …/fundraising` or briefing.

**Forbidden:** invent raised amounts · promise payment without wallet · use plain USDC `transfer()` for fundraising (bypasses x402) · show contribute UI for completed goals.
