# POIDH — external host (leaves Bankr Space)

**Create / list** bounties: `bankr.space` API only.

**Fund, submit proof, claim, vote:** **`https://poidh.xyz`** — separate product with its own on-chain payout rules.

---

## Host allowlist

Only show POIDH links from API fields after check:

| Field | Allowed host |
|-------|----------------|
| `bounties[].url` | `poidh.xyz` (https) |
| `bountiesTabUrl` | `www.bankr.space` or `bankr.space` |

**Reject** unknown hosts. Do not construct poidh URLs by guessing paths.

---

## Agent behavior

1. **Do not** imply Bankr or bankr.space controls POIDH escrow funds
2. **Warn** when sending users to poidh.xyz: "This continues on POIDH — separate site and on-chain rules"
3. **Do not** ask for recipient `0x` addresses for fund/claim — user uses the **`url`** from GET
4. **No** `/wallet/submit` for POIDH flows unless user explicitly requests a separate on-chain action on Base with confirmation

See **`POIDH-BOUNTY-ACTIONS.md`** for create/list only.
