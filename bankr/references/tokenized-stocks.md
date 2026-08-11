# Tokenized Stocks Reference

Trade tokenized stocks and ETFs — real-world equities issued as on-chain tokens — with a plain prompt, the same way you trade any other asset on Bankr.

## Venues

Bankr supports tokenized stocks across five venues. When you ask for a stock by ticker, Bankr resolves the best venue automatically; name the chain or venue to force a specific one.

| Venue | What you get | Examples | Location verification |
|-------|--------------|----------|-----------------------|
| Robinhood Chain | Spot tokens issued by Robinhood (stocks + ETFs) | NVDA, AAPL, TSLA, SPY, QQQ | **Required** |
| Base — B20 equities | Spot equity tokens issued by Coinbase | NVDA, AAPL, GOOGL, META, COIN | **Required** |
| Solana | Spot tokens from third-party issuers (e.g. xStocks) | AAPLx, TSLAx | Not required |
| Base — third-party issuers | Spot tokens from other issuers | varies by listing | Not required |
| Avantis (Base) | Leveraged equity perpetuals (long/short) | NVDA, TSLA, HOOD, META | Not required |

Stock **perpetuals** (leveraged long/short exposure rather than spot ownership) are also available on Hyperliquid via HIP-3. See [leverage-trading.md](leverage-trading.md) and [hyperliquid.md](hyperliquid.md).

```
"buy $100 of NVDA on robinhood"
"buy $100 of NVDA on base"
"buy $50 of AAPLx on solana"
"long TSLA with 5x leverage on avantis"
"short HOOD on hyperliquid"
```

**Tickers collide across chains.** Twelve of the thirteen Base B20 tickers also exist on Robinhood Chain, so name the chain when you mean a specific one — a bare ticker leaves the choice to Bankr's venue resolution.

## Robinhood Chain (spot)

Robinhood Chain hosts 200 tokenized stocks and ETFs issued by Robinhood — large caps (NVDA, AAPL, MSFT, AMZN), ETFs (SPY, QQQ, SOXX), and pre-IPO names.

```
"buy $100 of NVDA on robinhood"
"swap $50 of ETH to SPY on robinhood"
"sell half my AAPL on robinhood"
"send $30 of AAPL to @friend on X"
```

Prices track the underlying equity. Trades settle on-chain against **USDG (Global Dollar)**, Robinhood Chain's native stablecoin — Bankr routes through it automatically, so you can fund a purchase from ETH, USDG, or any token on the chain in a single command.

Stock legs are routed differently from the chain's memecoin pools: tokenized stocks have no AMM pool of their own, so Bankr sends them to a venue that quotes them directly (with a tighter slippage tolerance), while ordinary Robinhood Chain pairs keep the thin-pool protection they've always had. This is automatic — the same prompt works for both.

Robinhood Chain supports the full set of advanced orders — **limit, stop (including trailing), DCA, and TWAP** — alongside spot swaps and transfers:

```
"every monday, analyze the tokenized stock market and put $100 into your strongest pick"
"DCA $50 into SPY every friday"
"buy NVDA on robinhood if it drops to $150"
"set a trailing stop on my TSLA on robinhood"
```

## Base B20 tokenized equities (spot)

Base hosts the **B20 tokenized equities** — Coinbase-issued equity tokens trading as ordinary ERC-20s on Base:

**AAPL, AMZN, COIN, CRCL, GOOGL, INTC, META, MSFT, MSTR, NVDA, SNDK, SPCX, TSLA**

```
"buy $100 of NVDA on base"
"swap $50 of USDC to GOOGL on base"
"sell half my META on base"
```

B20 is an ERC-20 extension: transfers and approvals behave normally, but the redemption ratio to the underlying share is an **on-chain multiplier** that moves on corporate actions (splits, dividends), and issuer policy can block transfers. Token price = the underlying equity's price × that multiplier, so Bankr prices these off the equity rather than off pool liquidity — a B20 is quotable before any Base liquidity exists. They are 8-decimal tokens (Robinhood stocks are 18-decimal), which matters if you're reading raw amounts from the API rather than the formatted figures.

**Base B20 trades are behind the same location verification as Robinhood stocks** — same site-visit verdict, same blocked-country list, same 30-day expiry, and the same fail-closed behaviour. Everything else on Base is ungated.

### Location verification

Issuer-tokenized stocks — Robinhood Chain and Base B20 alike — are **not available in the US, UK, sanctioned countries or regions, or any jurisdiction where they are prohibited by local law**. This is the only Bankr feature that requires location verification.

1. Log in to the [Bankr console](https://bankr.bot). Your location is verified automatically from your connection — there are no forms and nothing to upload.
2. Once verified, you can trade issuer-tokenized stocks from any platform — X, Telegram, the console, or the API.
3. Verification expires after 30 days. Logging in to the console again renews it.

If you attempt a stock trade before verifying (or after your verification lapses), the trade is blocked and Bankr asks you to log in to the console first. Only issuer-tokenized stock trades are gated — memecoins on Robinhood Chain, everything else on Base, bridging, and transfers work without verification. Over the Wallet API, a swap involving a gated tokenized stock without a passed location check returns `403` with instructions to verify.

## Solana and third-party issuers on Base (spot)

Tokenized stocks from third-party issuers — such as xStocks (AAPLx, TSLAx, and others) on Solana — trade like any other token on those chains. No location verification is required; standard swap, limit order, and DCA commands all work:

```
"buy $50 of AAPLx on solana"
"swap 1 SOL to TSLAx"
```

Liquidity for these tokens lives in regular AMM pools and varies by listing — Bankr quotes real executable prices, so thin markets surface in your quote. Verify you're trading the canonical issuer's token: ask Bankr for the token's details before trading if you're unsure.

## Leveraged stocks (perps)

For leveraged long/short exposure to equities — without owning the underlying token — Bankr integrates **Avantis** (perpetuals on Base) and **Hyperliquid**. Avantis lists equity pairs such as NVDA, TSLA, AAPL, AMZN, MSFT, META, COIN, and HOOD alongside its crypto, forex, and commodity markets.

```
"long TSLA with 5x leverage on avantis"
"short $50 of NVDA on avantis"
"close my HOOD position"
```

No location verification is required for perps. Equity perpetuals only trade during the underlying market's hours — orders placed while the market is closed will fail. See [leverage-trading.md](leverage-trading.md) for position management, take-profit/stop-loss, and margin details.

## Which venue should I use?

- **Own the asset on an EVM chain with the widest coverage** → Robinhood Chain, 200 names (verification required)
- **Own a large-cap on Base, alongside the rest of your Base portfolio** → B20 equities, 13 names (verification required)
- **Own the asset on Solana without verification** → xStocks
- **Leveraged or short exposure, no ownership** → Avantis (Base) or Hyperliquid perps

## Regional availability & risk

Robinhood Chain and Base B20 tokenized stocks are unavailable in the US, UK, and sanctioned countries and regions. Availability of third-party issuer tokens on Solana and Base is subject to the issuer's own terms. Nothing here is investment advice; tokenized equities carry issuer and market risks in addition to normal on-chain risks.
