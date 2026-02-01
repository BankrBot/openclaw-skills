# HyperLiquid API Reference

All market data endpoints use `POST https://api.hyperliquid.xyz/info` with a JSON body.

No authentication required for read-only endpoints.

## Endpoints

### Meta (list all perps)
```json
{"type": "meta"}
```
Returns `{"universe": [{"name": "BTC", "szDecimals": 5, ...}, ...]}`.

### All Mid Prices
```json
{"type": "allMids"}
```
Returns `{"BTC": "77000.5", "ETH": "2300.0", ...}`.

### Meta + Asset Contexts (funding, OI, volume)
```json
{"type": "metaAndAssetCtxs"}
```
Returns `[meta, [assetCtx, ...]]` where each `assetCtx` has:
- `funding` — current 8h funding rate (decimal, multiply by 100 for %)
- `openInterest` — OI in coin units
- `markPx` — mark price
- `dayNtlVlm` — 24h notional volume in USD
- `premium` — index-mark premium

### L2 Order Book
```json
{"type": "l2Book", "coin": "BTC"}
```
Returns `{"levels": [[bids...], [asks...]]}` where each level is `{"px": "77000", "sz": "1.5", "n": 3}`.

### Candle Snapshot
```json
{
  "type": "candleSnapshot",
  "req": {
    "coin": "BTC",
    "interval": "1h",
    "startTime": 1700000000000,
    "endTime": 1700100000000
  }
}
```
Intervals: `1m`, `3m`, `5m`, `15m`, `30m`, `1h`, `2h`, `4h`, `8h`, `12h`, `1d`, `3d`, `1w`, `1M`.

Returns array of `{"t": timestamp_ms, "T": close_time, "s": "BTC", "i": "1h", "o": "77000", "c": "77100", "h": "77200", "l": "76900", "v": "123.5", "n": 500}`.

### Clearinghouse State (account + positions)
```json
{"type": "clearinghouseState", "user": "0x..."}
```
Returns:
- `marginSummary` — `accountValue`, `totalMarginUsed`, `totalNtlPos`, `totalRawUsd`
- `assetPositions` — array of position objects with `szi`, `entryPx`, `unrealizedPnl`, `liquidationPx`

### User Fills (trade history)
```json
{"type": "userFills", "user": "0x..."}
```

### User Funding History
```json
{"type": "userFunding", "user": "0x...", "startTime": 1700000000000, "endTime": 1700100000000}
```

## Rate Limits

- No API key required for info endpoints
- Rate limits are generous (100+ req/s for market data)
- Trading endpoints require wallet signature (EIP-712)

## Trading Endpoints

Trading uses `POST https://api.hyperliquid.xyz/exchange` with EIP-712 signed payloads.

This is advanced and requires a private key. See [HyperLiquid docs](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api) for trading API details.
