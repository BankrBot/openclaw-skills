# Market News Reference

Pull recent crypto, macro, and DeFi news before framing a trade or answering market questions.

## How to Fetch News

Use the rss2json proxy — no API key required, CORS-friendly:

```
GET https://api.rss2json.com/v1/api.json?rss_url=<encoded_url>&count=<N>
```

Returns `{ status, feed, items: [{ title, description, link, pubDate, author }] }`.

## Curated Feeds

| Source | Category | RSS URL |
|---|---|---|
| CoinDesk | Crypto | `https://www.coindesk.com/arc/outboundfeeds/rss/` |
| CoinTelegraph | Crypto | `https://cointelegraph.com/rss` |
| Decrypt | Crypto | `https://decrypt.co/feed` |
| The Defiant | DeFi | `https://thedefiant.io/feed` |
| Yahoo Finance Markets | Macro/Markets | `https://finance.yahoo.com/news/rssindex` |

## Fetch Pattern (fetch in parallel)

```javascript
const feeds = [
  { url: "https://www.coindesk.com/arc/outboundfeeds/rss/",    name: "COINDESK" },
  { url: "https://cointelegraph.com/rss",                       name: "COINTELEGRAPH" },
  { url: "https://decrypt.co/feed",                             name: "DECRYPT" },
  { url: "https://thedefiant.io/feed",                          name: "THE DEFIANT" },
  { url: "https://finance.yahoo.com/news/rssindex",             name: "YAHOO FINANCE" },
]

const results = await Promise.allSettled(feeds.map(async feed => {
  const r = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}&count=5`)
  const d = await r.json()
  return d.items.map(item => ({ ...item, source: feed.name }))
}))
// flatten, sort by pubDate desc, take top N
```

## Categorize Headlines

```javascript
function categorize(title, desc) {
  const t = (title + " " + desc).toLowerCase()
  if (/fed|fomc|powell|interest rate|inflation|cpi|gdp|recession|treasury/.test(t)) return "MACRO"
  if (/defi|dex|perpetual|protocol|yield|liquidity|tvl|amm/.test(t))              return "DEFI"
  if (/geopolit|war|sanction|iran|russia|china|taiwan|tariff/.test(t))            return "GEOPOLITICS"
  if (/bitcoin|btc|ethereum|eth|crypto|altcoin|token|blockchain/.test(t))          return "CRYPTO"
  if (/stocks|equity|nasdaq|s&p|sp500|dow|earnings|ipo/.test(t))                  return "MARKETS"
  return "NEWS"
}
```

## When to Use This

**Before framing a trade:**
> "Before I size this position, let me check recent news for any macro or crypto catalysts..."
→ Fetch top 3–5 headlines from the last 24h → summarize any relevant context → then recommend trade sizing

**User asks "what's happening in the market?":**
→ Fetch 5 items per feed → categorize → present the 5–8 most relevant by recency → group by category

**User asks "any news on [specific coin]?":**
→ Fetch from CoinDesk + CoinTelegraph → filter titles containing the coin name → return matches

## Example Output Format

```
MARKET BRIEF — [time]

MACRO
• Fed holds rates, signals 2 cuts in H2 — signals easing, bullish for risk assets (CoinDesk, 2h ago)

CRYPTO  
• BTC ETF inflows hit $800M in a single day — strong institutional demand signal (CoinTelegraph, 4h ago)
• Ethereum Pectra upgrade goes live — gas improvements, potential vol event (Decrypt, 6h ago)

DEFI
• Orderly Network announces cross-chain perps expansion — direct platform catalyst (The Defiant, 1h ago)

FRAMING: Risk-on environment. Macro tailwind + institutional BTC inflow supports long bias. ETH vol event could cut either way — size accordingly.
```

## Time Filtering

Parse `pubDate` strings and filter to recency window the user asks for:
- "this morning" → last 6 hours
- "today" → last 24 hours
- "past few days" → last 72 hours

Sort by `pubDate` descending and take the most recent N that match the window.
