---
name: enable-holder-drips
description: Enable holder drips for stock-paired tokens on Robinhood Chain from Bankr/Doppler, pools.fun (Sushi×Bankr), or pools.trade (Uniswap Labs). Auto-deploys router + distributor, test by sending paired RWA to the distributor, optionally automate fee routing. Platform hosts a shared 30-minute keeper and takes 10% of each drip. Not the Universal Hub.
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
- "Create a holder drip for my pools.fun / pools.trade / Bankr token"

## Platform (live)

| Setting | Value |
|---|---|
| API | `https://gleaming-freedom-production-c89d.up.railway.app` |
| Factory | `0x5B5ade0E3b38842f1758DE629F0Cd35AF647fC28` |
| Fee | **10%** of each paired-RWA drip → treasury `0x374d91a5674fa7cf86e725093b5848b97e1e13b4` |
| Cron | every **30 minutes** (after automate / fees reach router) |
| Eligible quote | Tokenized **stock/RWA** only — not WETH-only or USDG-only |

```http
GET https://gleaming-freedom-production-c89d.up.railway.app/v1/platform
```

Expect `canAutoDeploy: true`. `sources` lists Bankr, pools.fun, and pools.trade.

## Supported launchpads

| `source` | Product | How fees reach the drip |
|---|---|---|
| `bankr` | Bankr / Doppler | Retarget Doppler beneficiary → drip **router** (Bankr API) |
| `pools_fun` | [pools.fun](https://pools.fun) (Sushi × Bankr) | Prefer **Fee Recipient = router at launch**; else claim/distribute and forward paired RWA |
| `pools_trade` | [pools.trade](https://pools.trade) (Uniswap Labs) | Enable creator fee → set creator fee wallet → drip **router** |

Always pass `"source"` on create so automate + keeper use the right path.

## Who can use this

- **Bankr:** wallet is Doppler fee beneficiary (≥95%) on a stock-paired Robinhood token
- **pools.fun / pools.trade:** wallet is creator / fee recipient for a **stock-paired** launch

## Agent flow

### 1. Discover tokens

**Bankr / Doppler**

```http
GET https://api.bankr.bot/public/doppler/beneficiary-fees/{wallet}
```

Filter: `chain === "robinhood"`, share ≥ 95%, quote leg is stock/RWA.

**pools.fun / pools.trade**

Ask the user for the meme token + paired stock addresses (from the launch page). Confirm the quote is a stock/RWA, not WETH/USDG.

### 2. Reuse if already registered

```http
GET https://gleaming-freedom-production-c89d.up.railway.app/v1/drips
```

If `memeToken` matches, reuse that drip — do not create again.

### 3. Create drip (factory deploys router + distributor)

Omit `router` / `distributor`. Include `source`.

```http
POST https://gleaming-freedom-production-c89d.up.railway.app/v1/drips
Content-Type: application/json

{
  "memeToken": "0x…",
  "pairedToken": "0x…",
  "symbol": "TOKEN",
  "pairedSymbol": "MSFT",
  "source": "bankr"
}
```

Use `"source": "pools_fun"` or `"pools_trade"` when applicable.

Response: `drip.distributor` (test fund address), `drip.router` (fee recipient for automate), optional `deployed.txHash`.

### 4. Test (default — keep fees on user wallet)

1. User sends a small amount of **paired RWA** to `drip.distributor`
2. `POST …/v1/drips/{id}/test`
3. Keeper pays holders (next cron / run)
4. Confirm with user

**Do not** retarget / change fee recipient unless the user wants automation.

### 5. Automate (only if user asks)

```http
POST https://gleaming-freedom-production-c89d.up.railway.app/v1/drips/{id}/automate
Content-Type: application/json

{ "currentBeneficiary": "0x…", "source": "bankr" }
```

| Source | Body | What you do |
|---|---|---|
| `bankr` | `currentBeneficiary` required | Return Bankr retarget tx → user **signs** |
| `pools_fun` | `source` optional if set on drip | Guide Fee Recipient = router (new launches) or forward claimed fees |
| `pools_trade` | `source` optional if set on drip | Guide set creator fee wallet → router |

Until fees actually hit the **router** (or user keeps funding the **distributor**), holders only get drips from manual test sends.

## Must NOT do

- Retarget / change fee recipient without explicit user confirmation
- Promise Universal Hub / cross-RWA claims
- Accept WETH-only or USDG-only pairs
- Send test funds to the **router** (test = **distributor**)
- Recreate a drip for a meme already in `GET /v1/drips`

## Status

```http
GET https://gleaming-freedom-production-c89d.up.railway.app/v1/platform
GET https://gleaming-freedom-production-c89d.up.railway.app/v1/drips
```

See [references/api.md](references/api.md).
