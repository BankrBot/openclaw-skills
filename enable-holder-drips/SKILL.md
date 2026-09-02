---
name: enable-holder-drips
description: Enable holder drips for an existing Bankr token on Robinhood Chain. Register a drip (router + distributor), test by sending paired RWA to the distributor, optionally automate by retargeting Doppler fees to the router. Platform hosts a shared 30-minute keeper and takes 10% of each drip. Not the Universal Hub.
metadata:
  {
    "clawdbot":
      {
        "emoji": "💧",
        "homepage": "https://gleaming-freedom-production-c89d.up.railway.app",
      },
  }
---

# Enable holder drips (Lite)

Push paired-stock trading fees to meme holders on a schedule. Hosted by Pay Me Dividends / devpayout. **Not** Universal Hub enrollment.

Natural-language triggers:

- "Drip my token fees to holders"
- "Enable holder drips"
- "Test drip then automate"

## Platform

| Setting | Value |
|---|---|
| API | `https://gleaming-freedom-production-c89d.up.railway.app` |
| Fee | **10%** of each paired-RWA drip → treasury `0x374d91a5674fa7cf86e725093b5848b97e1e13b4` |
| Cron | every **30 minutes** (only after fee retarget / automate) |
| One-per-RWA | No limit while testing |
| Meme leg | Locked in TimeLockVault on route |

## Who can use this

Wallet must be (or control) the Doppler fee beneficiary with **≥95%** share for a Robinhood Chain token paired with a stock/RWA (e.g. MSFT, DDOG) — not WETH-only.

## Flow (test first — automate optional)

### 1. List eligible tokens

```http
GET https://api.bankr.bot/public/doppler/beneficiary-fees/{wallet}
```

Filter: `chain === "robinhood"`, share ≥ 95%, quote leg is stock/RWA.

### 2. Register drip

If the user already has a router + distributor (or platform deploys them), register:

```http
POST https://gleaming-freedom-production-c89d.up.railway.app/v1/drips
Content-Type: application/json

{
  "memeToken": "0x…",
  "pairedToken": "0x…",
  "router": "0x…",
  "distributor": "0x…",
  "symbol": "bits",
  "pairedSymbol": "DDOG"
}
```

Response includes:

- `distributor` — **send paired RWA here to test**
- `router` — future fee recipient (do **not** retarget until user asks)
- `id` — e.g. `drip-d96cc6ab`

If router/distributor are missing: tell the user platform must deploy a drip pair first (factory), or point them to ops.

### 3. Test (default path — keep fees on user wallet)

1. User sends a small amount of **paired RWA** (e.g. DDOG) to `distributor`
2. Call:

```http
POST https://gleaming-freedom-production-c89d.up.railway.app/v1/drips/{id}/test
```

3. Platform keeper pays holders from that balance
4. Confirm with user that holders received tokens

**Do not** retarget fees unless the user explicitly wants full automation.

### 4. Automate (only if user asks)

```http
POST https://gleaming-freedom-production-c89d.up.railway.app/v1/drips/{id}/automate
Content-Type: application/json

{ "currentBeneficiary": "0x…user-wallet" }
```

Returns Bankr retarget tx (`to`, `data`, `chainId: 4663`). User signs → fees go to **router** → shared 30m keeper collects and drips.

Until they sign, fees stay claimable to their wallet even if `automated: true` in the API.

## Manual vs automated

| Mode | Fees go to | Drip happens when |
|---|---|---|
| **Test / manual** | User wallet (claim) | User sends paired RWA to distributor + keeper runs |
| **Automated** | Router (after retarget) | Every 30m automatically |

## Must NOT do

- Retarget fees without explicit user confirmation
- Promise Universal Hub / cross-RWA claims (different product)
- Store Bankr API keys server-side
- Tell users to configure Railway
- Send test funds to the **router** (test = **distributor** only)

## Status

```http
GET https://gleaming-freedom-production-c89d.up.railway.app/v1/platform
GET https://gleaming-freedom-production-c89d.up.railway.app/v1/drips
GET https://gleaming-freedom-production-c89d.up.railway.app/v1/drips/{id}
```

See [references/api.md](references/api.md).
