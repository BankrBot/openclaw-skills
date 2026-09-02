---
name: enable-holder-drips
description: Enable holder drips for an existing Bankr token on Robinhood Chain. Auto-deploys router + distributor via factory, test by sending paired RWA to the distributor, optionally automate by retargeting Doppler fees to the router. Platform hosts a shared 30-minute keeper and takes 10% of each drip. Not the Universal Hub.
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
- "Create a holder drip for my token"

## Platform (live)

| Setting | Value |
|---|---|
| API | `https://gleaming-freedom-production-c89d.up.railway.app` |
| Factory | `0x5B5ade0E3b38842f1758DE629F0Cd35AF647fC28` |
| Fee | **10%** of each paired-RWA drip → treasury `0x374d91a5674fa7cf86e725093b5848b97e1e13b4` |
| Cron | every **30 minutes** (only after fee retarget / automate) |
| One-per-RWA | No limit while testing |
| Meme leg | Locked in TimeLockVault on route |

Before creating, confirm factory is up:

```http
GET https://gleaming-freedom-production-c89d.up.railway.app/v1/platform
```

Expect `canAutoDeploy: true` and a non-null `factory`. If false, tell the user the platform cannot auto-deploy yet.

## Who can use this

Wallet must be (or control) the Doppler fee beneficiary with **≥95%** share for a Robinhood Chain token paired with a stock/RWA (e.g. MSFT, DDOG) — not WETH-only.

## Agent flow (test first — automate optional)

### 1. List eligible tokens

```http
GET https://api.bankr.bot/public/doppler/beneficiary-fees/{wallet}
```

Filter: `chain === "robinhood"`, share ≥ 95%, quote leg is stock/RWA.

Show the user the list and let them pick one meme + paired addresses.

### 2. Reuse existing drip if already registered

```http
GET https://gleaming-freedom-production-c89d.up.railway.app/v1/drips
```

If an item already matches the chosen `memeToken`, **do not** create again — use that `id` / `distributor` / `router` and go to test (step 4).

### 3. Create drip (default — factory deploys router + distributor)

**Omit** `router` and `distributor`. The API calls onchain `createDrip(meme, paired)` and returns new addresses.

```http
POST https://gleaming-freedom-production-c89d.up.railway.app/v1/drips
Content-Type: application/json

{
  "memeToken": "0x…",
  "pairedToken": "0x…",
  "symbol": "TOKEN",
  "pairedSymbol": "DDOG"
}
```

Success response includes:

- `drip.id` — e.g. `drip-d96cc6ab`
- `drip.distributor` — **send paired RWA here to test**
- `drip.router` — future fee recipient (do **not** retarget until user asks)
- `deployed` — `{ txHash, factory, … }` when factory created the pair

Only pass `router` + `distributor` if the user already has contracts and wants to register those instead.

### 4. Test (default path — keep fees on user wallet)

1. Tell the user to send a **small** amount of **paired RWA** (e.g. DDOG) to `drip.distributor` — not the router
2. After they confirm the send:

```http
POST https://gleaming-freedom-production-c89d.up.railway.app/v1/drips/{id}/test
```

3. Platform keeper pays holders from that balance (may take until the next cron / keeper run)
4. Confirm with the user that holders received tokens

**Do not** retarget fees unless the user explicitly wants full automation.

### 5. Automate (only if user asks)

```http
POST https://gleaming-freedom-production-c89d.up.railway.app/v1/drips/{id}/automate
Content-Type: application/json

{ "currentBeneficiary": "0x…user-wallet" }
```

Returns Bankr retarget tx (`to`, `data`, `chainId: 4663`). Have the user **sign** it → fees go to **router** → shared 30m keeper collects and drips.

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
- Call create again for a meme that already has a drip in `GET /v1/drips`

## Status

```http
GET https://gleaming-freedom-production-c89d.up.railway.app/v1/platform
GET https://gleaming-freedom-production-c89d.up.railway.app/v1/drips
GET https://gleaming-freedom-production-c89d.up.railway.app/v1/drips/{id}
```

See [references/api.md](references/api.md).
