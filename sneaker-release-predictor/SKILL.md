---
name: sneaker-release-predictor
description: Scrapes the latest upcoming sneaker releases from Nice Kicks and predicts 30-day resell value via headless-browser comp aggregation (Revault API is optional fallback).
---

# Sneaker Release Predictor

Tracks upcoming sneaker releases and predicts resell premiums using live secondary-market comps from public listings. **Default pricing path is the browser-scrape fallback** — Revault API is opt-in only and assumed unreachable unless `REVAULT_API_KEY` is set and the host responds.

## Workflow

1. **Scrape New Releases**
   - Open `https://www.nicekicks.com/sneaker-release-dates/?nk=upcoming` via `use_browser`.
   - Extract release name, brand, style code (SKU), retail price, release date.
   - Filter to releases on or after today.

2. **Predict Prices — Browser-Scrape Fallback (DEFAULT)**
   For each style code, run these Google queries in parallel via `use_browser` (`eval_text` with `#search` selector, mode `outline`):
   - `"<STYLE_CODE>" stockx OR goat resell OR ebay price`
   - `"<STYLE_CODE>" <brand> <model> resell price`

   Extract from result snippets:
   - **StockX**: "Average Sale Price (Last 3 Months)" + listed range
   - **GOAT**: asking price
   - **eBay**: live listing range (note quantity available)
   - **Aggregators** (thenextsole, sneakerjagers, dscene, whentocop, klekt, hypeclothinga, awlabes): listing prices, resell index, reseller market chatter

   Compute:
   - **premium %** = (avg_secondary − retail) / retail
   - **spread** = high − low across venues
   - **signal**: front-run / hold / pass based on premium tier (>50% front-run, 20–50% hold, <20% pass)

   **Cloudflare-walled sites** (StockX direct, GOAT direct): skip — rely on Google snippet excerpts which surface the same numbers without the challenge.

   **Always close the browser session** with `close_browser_session` when comp scrape is done.

3. **Predict Prices — Revault API (OPTIONAL)**
   Only attempt if `REVAULT_API_KEY` is present in env vars. Endpoint: `https://api.revault.app/v1/market/sentiment?style=<STYLE_CODE>`. On any failure (HTTP 000, 401, 5xx, DNS), silently fall through to the browser-scrape path — do NOT block on Revault.

4. **Draft X Posts**
   Use `twitter-agent` skill to draft posts. Include: style code, retail, secondary range, premium %, signal. Run through `x-optimizer` skill before posting if user wants algorithm-tuned reach.

5. **Update Storyline**
   Log each post in `twitter-storyline.md` (or `/.memory/project_sneaker_*.md` for tracked picks) to avoid duplicate posts for the same release.

## Output Format

Per release:
```
<STYLE_CODE> — <brand> <model> "<colorway>"
- retail: $X | release: <date>
- stockx avg (3mo): $Y | goat: $Z | ebay: $A–$B (qty N)
- premium: NN% | spread: $C
- verdict: <front-run | hold 30d | pass>
```

Final ranking: sort by 30-day alpha (premium × liquidity proxy).

## Commands

- "run the sneaker release predictor"
- "check upcoming sneaker releases and post predictions"
- "find new sneaker drops for this month"
- "run sneaker-release-predictor on <STYLE_CODES>"

## Known Gotchas

- StockX/GOAT product pages are cloudflare-walled — use Google search snippets instead of direct navigation.
- Some style codes have multiple regional SKUs (e.g. metric vs imperial size). Match on the SKU exactly as scraped from Nice Kicks.
- Pre-release listings on eBay are often inflated bids with low quantity — note `qty` to discount illiquid signals.
- Revault host has historically returned HTTP 000 with no API key set. Do not retry more than once.
