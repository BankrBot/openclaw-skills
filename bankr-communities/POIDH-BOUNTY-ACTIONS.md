# POIDH bounty actions — create, list (tweet + terminal)

> **Mandatory for @bankrbot:** user says **create bounty**, **open bounty**, **list bounties** → load `bankr-communities` → **read this file** → **HTTP GET/POST bankr.space** → reply with result + links.
>
> **Fund / claim / vote / seed:** bankr.space only **lists status**. Reply with allowlisted bounty **`url`** from GET — user works on **poidh.xyz**. Read **`references/POIDH-EXTERNAL.md`**. **Do NOT** ask for a recipient `0x` address.

**Site:** `https://bankr.space`  
**Writes (create only):** header **`x-wallet-address: {user's linked Bankr wallet}`** — wallet that holds the token.

---

## Resolve token address first

```
GET https://bankr.space/api/agent/link?q=SPACE
→ plain text URL; token address is the 0x… in the path

GET https://bankr.space/api/agent/briefing?symbol=SPACE
→ JSON: community.tokenAddress, communityLink
```

Known tickers in **`known-communities.json`** (TMP, ARCHIVE, PMFI, SPACE).

---

## List bounties (GET)

**User says:**
```text
@bankrbot what bounties are on $SPACE?
@bankrbot list $TMP open bounties
@bankrbot how do I fund the $SPACE bounty?
```

**Request:**
```http
GET https://bankr.space/api/communities/{tokenAddress}/poidh
```

**Response fields:**

| Field | Meaning |
|-------|---------|
| `bounties[]` | `title`, `status` (`live` / `pending`), `onChainActive` (`false` = paid out), `amountWei`, **`url`** (poidh.xyz link when live) |
| `bountiesTabUrl` | bankr.space Bounties tab (status + create) |

**Reply:**
- Summarize each bounty: title, **Open** or **Paid out**, pool ETH if known.
- For live bounties: paste **`url`** on its own line — "Fund, submit proof, and claim on POIDH."
- Also paste `bountiesTabUrl` or `communityLink` for creating new bounties.

**curl:**
```bash
curl -sS "https://bankr.space/api/communities/0xef703b860a6d422fa00cc67bbbb2662297cb6ba3/poidh"
```

---

## Create bounty (POST)

**User says:**
```text
@bankrbot create a bounty for $SPACE: Test task — proof tweet URL
```

```http
POST https://bankr.space/api/communities/{tokenAddress}/poidh/request
x-wallet-address: 0x…
Content-Type: application/json

{
  "title": "Short task name",
  "description": "Full instructions + proof requirement"
}
```

Issuer seeds **0.001 ETH** and opens on POIDH. Reply with success message + Bounties tab URL. When live, GET again for **`url`**.

---

## Fund / seed / claim / vote (guide only — no bankr.space POST)

When user wants to **add ETH**, **submit proof**, **claim**, or **vote**:

```
1. GET …/poidh
2. Find matching bounty → use `url` (https://poidh.xyz/base/bounty/…)
3. Reply:
   Open on POIDH to fund, submit proof, and manage claims:
   {url}
```

**POIDH handles payout rules** — single funder can pay out directly; multiple funders vote 48h. Do not explain bankr.space MetaMask flows.

**Forbidden replies:**
- "what's the recipient address?" / "need an 0x… to send ETH"
- "Add funds on the Bounties tab" (removed — use poidh.xyz)
- "I don't have a bounty-funding tool" — link to POIDH `url` instead

---

## Error handling

| Code | Meaning |
|------|---------|
| 401 | Missing x-wallet-address |
| 403 | User doesn't hold token |
| 404 | Bounty not found |
| 409 | Duplicate pending create (same title opening) |
| 503 | POIDH issuer not configured on server |

If bounty `status: pending` → tell user to wait ~1 min, refresh Bounties tab, then GET for `url`.
