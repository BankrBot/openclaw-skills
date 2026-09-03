# API host — read before any HTTP call

## ONLY these hosts

| Role | URL |
|------|-----|
| **Agent API** | `https://api.hood.markets` |
| **Web / launch UI** | `https://hood.markets` |

Preflight: `GET https://api.hood.markets/health` → `{ "ok": true, "service": "hoodmarkets", "chainId": 4663 }`

## FORBIDDEN

- `https://hood.markets/api/...` for agent POST — frontend only
- Guessed paths that are not in `references/AGENT-API.md`

## URL allowlist (links shown to users)

| Type | Rule |
|------|------|
| Token page | `https://hood.markets/?token=0x…` |
| Launch | `https://hood.markets/` |
| Explorer | `https://robinhoodchain.blockscout.com/…` |
| DexScreener | `https://dexscreener.com/robinhood/0x…` |
| Uniswap | `https://app.uniswap.org/…chain=robinhood…` |
| Bankr submit | `https://api.bankr.bot/wallet/submit` only |

See `references/RESPONSE-SAFETY.md`.
