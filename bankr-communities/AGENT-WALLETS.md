# Agent wallet tags — fee recipient & trusted delegates

Fee recipients and trusted team wallets can be classified as **Bankr agents** (e.g. `bankrbot`, `hermes`) vs **human** linked wallets.

**Fundraisers / USDC remain fee-recipient-only** — agent tags are for display and team trust, not money access.

---

## Resolve any wallet (read-only)

```http
GET https://bankr.space/api/agent/resolve-wallet?wallet=0x…
GET https://bankr.space/api/agent/resolve-wallet?wallet=0x…&token=0xTOKEN
GET https://bankr.space/api/agent/resolve-wallet?handle=bankrbot
```

**Returns:**

| Field | Meaning |
|-------|---------|
| `isAgentWallet` | `true` for known agents (bankrbot, hermes, *bot handles) |
| `agentId` | e.g. `bankrbot`, `hermes` |
| `agentType` | e.g. `bankr-bot`, `hermes`, `bankr-agent`, `human`, `unknown` |
| `agentLabel` | e.g. `@bankrbot` |
| `platform` | `twitter` when resolved from Bankr launch / handle |
| `source` | `known-registry` \| `handle-heuristic` \| `none` |

**Examples:**

```bash
curl "https://bankr.space/api/agent/resolve-wallet?handle=bankrbot"
curl "https://bankr.space/api/agent/resolve-wallet?wallet=0x824bcedc77a27c3d8d45573ff14a10bd4b215403"
```

---

## Fee recipient: refresh tags on a space

```http
POST https://bankr.space/api/communities/{tokenAddress}/team/resolve-agents
x-wallet-address: {fee recipient}
```

Updates `feeRecipientAgent` and `trustedDelegates[].agent` on the space.

Also runs automatically when the fee recipient saves **Team access** in Edit profile.

---

## PATCH team + agents

```http
PATCH /api/communities/{tokenAddress}
x-wallet-address: {fee recipient}

{
  "allowDeployerEdit": true,
  "trustedDelegates": [
    { "wallet": "0xabc…", "agent": { "isAgentWallet": true, "agentId": "hermes", "agentType": "hermes" } }
  ],
  "refreshAgentTags": true
}
```

`trustedDelegates` accepts legacy `string[]` or `{ wallet, agent? }[]` (max 3).

---

## Agent types

| agentType | Meaning |
|-----------|---------|
| `bankr-bot` | Official @bankrbot |
| `hermes` | @hermes agent wallet |
| `bankr-agent` | Other Bankr-linked bot handles |
| `human` | Linked social, not classified as agent |
| `unknown` | No Bankr handle match |

---

## Tweet / terminal examples

```text
@bankrbot is 0xABC… an agent wallet on SPACE space?
@bankrbot refresh agent tags for TMP space team
@bankrbot add trusted delegate 0xDEF… on ARCHIVE space
```

Load `bankr-communities` → `GET …/resolve-wallet` or `POST …/team/resolve-agents`.
