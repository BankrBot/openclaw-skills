# hood.markets Bankr skill (v20)

Bankr-compatible agent skill for [hood.markets](https://hood.markets) on Robinhood Chain **4663**.

## Install

```text
install the hoodmarkets skill from https://github.com/BankrBot/skills/tree/main/hoodmarkets
```

## Platform fees (only two)

| Fee | Split |
|-----|--------|
| Swap trading fees | 5% platform / 95% pro-rata to Holder NFT share holders |
| Share marketplace (`buyShares`) | 5% of sale price / 95% to seller |

No fee on sends, batch airdrops (`airdropShares`), or list/cancel escrow (v0.11 factory). **5% only on `buyShares` sale price.**

## Contracts (V3 v0.11.0)

| Role | Address |
|------|---------|
| Factory | `0x9BDdC8ddf28f5629C989A36Eb5bb6C73cBA60Df5` |
| Vault | `0x856c6997A86752fB3E6A494AB93107B7A371A57f` |
| LP locker | `0x23a1c52F4E93B0283d12CC16c29Df119803E8745` |
| Fraction deployer | `0x40A19d561b3200A2C9E1014248FcEB724c450692` |
| Platform 5% | `0xbfD1be7a12A9FeF04D281C2D8D0D9EE15b576d98` |

`known-contracts.json` · legacy factories · V4 swap helper

## What agents can do

| Flow | Bankr `/wallet/submit`? |
|------|-------------------------|
| Deploy token | No — API deploy after auth (`AUTH-BOUNDARY.md`) |
| Buy/sell Simple (V3) | No — Uniswap link from token-info |
| Buy/sell Pro (V4) | Yes — prepare-buy/sell → TX-VALIDATION → submit chain 4663 |
| Claim swap fees | No — POST /api/agent/claim or claim-for-recipient |
| Holder NFT marketplace / airdrop | **No** — token page only (`HOLDER-NFTS.md`) |
| Community Launch create / status / refund | No JWT — public API (`COMMUNITY-LAUNCH.md`) |
| Community Launch deposit | Yes — prepare-deposit `nextStep` → native ETH submit → confirm |

**Chain 4663 required** — abort if Bankr wallet does not support Robinhood Chain (`CHAIN-4663.md`).

## Skill files

| File | Purpose |
|------|---------|
| `SKILL.md` | Main routing + workflows |
| `references/AGENT-API.md` | All API endpoints |
| `references/AUTH-BOUNDARY.md` | Deploy/claim auth + replay |
| `references/CHAIN-4663.md` | Mandatory chain support check |
| `references/HOLDER-NFTS.md` | Shares, fees — agent restrictions |
| `references/COMMUNITY-LAUNCH.md` | Petition create / back / refund / cancel |
| `references/CLAIM-BANKR.md` | Claim without Bankr submit |
| `references/TX-VALIDATION.md` | Selector allowlist before submit |
| `references/BANKR-SUBMIT.md` | No scanner bypass |
| `references/RESPONSE-SAFETY.md` | Trusted hint fields |
| `references/PROMPT-INJECTION.md` | Untrusted metadata |
| `references/IMAGE-RESOLUTION.md` | Deploy logo validation |
| `references/ONE-LINE-INTENTS.md` | User phrase → API mapping |
| `known-contracts.json` | Pinned addresses |
| `streaming-hints.json` | V3 vs Pro detection |

## Publish to BankrBot/skills

PR this folder to [BankrBot/skills](https://github.com/BankrBot/skills) → `hoodmarkets/`

## Human docs

- [hood.markets/sdk.md](https://hood.markets/sdk.md) — contracts + SDK + capabilities
- [hood.markets/agent.md](https://hood.markets/agent.md) — agent API summary
- [hood.markets/docs#community-launch](https://hood.markets/docs#community-launch) — Community Launch API
- [docs/HOODMARKETS_V3.md](https://github.com/anondevv69/hoodmarkets/blob/main/docs/HOODMARKETS_V3.md) — full V3 reference
