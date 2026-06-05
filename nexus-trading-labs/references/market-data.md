# Market Data, Errors & Limits Reference

## Mark Price

```
GET https://og.nexustradinglabs.com/mark-price?symbol=BTC
```

Returns `{ symbol, markPrice, indexPrice, lastPrice, openInterest, volume24h }`.

Use before placing a trade when the user asks "what's BTC at?" or to size a position. Accepts shorthand (BTC, ETH, SOL) or full form (PERP_BTC_USDC).

---

## Funding Rate

```
GET https://og.nexustradinglabs.com/funding-rate?symbol=BTC
```

Returns `{ symbol, fundingRate, fundingRatePct, nextFundingTime, estFundingRate }`.

High positive funding → longs pay shorts → bearish signal. High negative → shorts pay longs → bullish signal. Check this before sizing a leveraged position.

---

## 24h Market Stats

```
GET https://og.nexustradinglabs.com/24h-stats?symbol=BTC
```

Returns `{ symbol, markPrice, indexPrice, lastPrice, change24h, high24h, low24h, volume24h, openInterest, fundingRate, nextFundingTime }`.

All price + market data for a symbol in one call.

---

## Error Reference

| HTTP | Meaning |
|---|---|
| 400 | Bad request — missing params, validation failed, or Orderly error |
| 401 | Auth failure — missing walletSig, wallet not registered, or invalid Bankr API key |
| 403 | Forbidden — Bankr key has `allowedRecipients` set |
| 404 | Not found — symbol, order, or resource doesn't exist |
| 500 | Worker internal error — do not retry |
| 502 | Upstream failure — Orderly or Bankr returned an error |

| `error` field | Cause | Fix |
|---|---|---|
| `walletSig_required` | Missing walletSig or walletAddress | Call sign_message first |
| `wallet_not_registered` | No Orderly account in KV | Run registration flow |
| `insufficient_margin` | Not enough free collateral | Reduce size, add leverage, or deposit |
| `below_min_notional` | Order below Orderly minimum (~$10) | Increase notional |
| `no_open_position` | https://og.nexustradinglabs.com/set-sl-tp with no position | Open position first |
| `deposit_requires_wallet_execution` | allowedRecipients blocking tx | Clear at bankr.bot/api-keys |
| Orderly code 78 | Unsettled negative PnL blocking withdrawal | Server auto-handles; manual: settle-pnl then re-check free_collateral |
| Orderly code 29 | EIP-712 signature invalid | Internal error — contact Nexus |

### Retry strategy

- **401 wallet_not_registered** → registration flow, then retry
- **400 insufficient_margin** → check /balance, reduce size or prompt deposit
- **400 below_min_notional** → minimum ~$10 notional, increase size
- **502** → retry once after 2s; if persistent, Orderly may be degraded
- **500** → do not retry; surface error to user

---

## Rate Limits

| Layer | Limit |
|---|---|
| Nexus Worker | No hard cap (Cloudflare — 100k req/day free, unlimited paid) |
| Orderly private API | ~10 req/s per account; sustained bursts return 429 |
| Orderly public API | ~20 req/s |
| Bankr /wallet/sign | Avoid calling more than once per trade |

**Best practice:** One `sign_message` per session. Reuse walletSig for all endpoints — don't re-sign before each call.

---

## Testnet

- Orderly testnet API: `https://testnet-api-evm.orderly.org`
- Chain: Arbitrum Sepolia (chainId 421614)
- Faucet: request testnet USDC in Orderly Discord (#testnet-faucet)
- Nexus Worker targets mainnet only — for testnet, point directly to Orderly testnet API
- ThesisRegistry testnet: `0x6eE20a021F83c7ddD9FA3d15ed6798fCF6A6f468` (Arbitrum Sepolia)
