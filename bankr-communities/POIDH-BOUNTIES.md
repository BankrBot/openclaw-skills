# POIDH open bounties on Bankr Space

Token holders create **crowdfunded outcome bounties** on **bankr.space** — opened on **POIDH** (ETH on Base, not x402, not USDC agent pool).

> **@bankrbot execute create / list:** read **`POIDH-BOUNTY-ACTIONS.md`** first.

## Model

| Where | What |
|-------|------|
| **bankr.space** | Create bounties (UI or API). **List status** — open or paid out. Link to POIDH. |
| **poidh.xyz** | **Everything else** — add funds, submit proof, claim, vote, withdraw. POIDH handles payout rules. |

**Do not** guide users to fund/claim/vote on bankr.space — send them to the bounty **`url`** from `GET …/poidh`.

## User intents

| User says | Agent does |
|-----------|------------|
| create a bounty for **$SPACE** | **`POIDH-BOUNTY-ACTIONS.md`** → `POST …/poidh/request` |
| what's the **SPACE** bounty? / list bounties | **`POIDH-BOUNTY-ACTIONS.md`** → `GET …/poidh` → reply status + **poidh.xyz link** |
| **add** / **fund** / **seed** ETH to bounty | `GET …/poidh` → paste bounty **`url`** (poidh.xyz) — user funds on POIDH |
| submit proof / claim / vote | Paste bounty **`url`** — user works on POIDH |

## POIDH payout rules (explain when asked)

POIDH decides on their site — bankr.space does not run claims or votes.

- **Single funder** (usually just the 0.001 ETH seed): claim can be accepted and paid out directly.
- **Multiple funders**: after someone submits proof, contributors **vote 48h** (weighted by ETH contributed) before payout.

Full guide: https://words.poidh.xyz/poidh-open-bounties-guide

## Create bounty (token holder)

```http
POST https://bankr.space/api/communities/{tokenAddress}/poidh/request
x-wallet-address: 0x…
Content-Type: application/json

{ "title": "Task name", "description": "Instructions + proof requirement" }
```

Issuer seeds **0.001 ETH** and opens on-chain. Reply with success + space Bounties tab URL.

## List bounties

```http
GET https://bankr.space/api/communities/{tokenAddress}/poidh
```

Each live bounty has **`url`** → `https://poidh.xyz/base/bounty/{displayId}` (display id = on-chain id + 986).

## Agent limitations

- Agents **can** create bounties (`POST …/poidh/request`) and list status (`GET …/poidh`).
- Agents **cannot** sign POIDH txs for the user — fund/claim/vote on **poidh.xyz**.
- **Do not** ask for a recipient `0x` to fund a bounty — link to POIDH instead.

## Briefing

```http
GET https://bankr.space/api/agent/briefing?token=0x…
```

Check `poidhBounties` in JSON; opportunities include live bounty titles + poidh.xyz links.

## Links

- Space bounties: `https://bankr.space/community/{tokenAddress}` → **Bounties** tab (status + create)
- POIDH app: https://poidh.xyz/base
- POIDH guide: https://words.poidh.xyz/poidh-open-bounties-guide
