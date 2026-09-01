---
name: Skill: sneaker-ecom-analyst
description: Professional e-commerce insight reports for sneaker releases with 30-day price predictions, social sentiment scoring, and investment theses.
---

# Skill: sneaker-ecom-analyst
> Professional e-commerce insight reports for sneaker releases with 30-day price predictions, social sentiment scoring, and investment theses.

## Workflow

1. **Scrape Upcoming Releases**
   - **Terminal Environment**: Scrape `https://www.nicekicks.com/sneaker-release-dates/?nk=upcoming` using `use_browser`.
   - **X/Twitter Environment**: Use `http.fetch` to query a public sneaker API or search snippets for release data. If browser-based scraping is required, notify the user that the full report must be initiated from the Bankr Terminal.
   - Extract: Name, Brand, SKU (Style Code), Retail Price, Release Date.

2. **Market Comp Aggregation**
   - **Terminal Environment**: Query Google snippets for StockX, GOAT, and eBay pricing using `use_browser`.
   - **X/Twitter Environment**: Use `http.fetch` to query public market data endpoints or search APIs. Avoid `use_browser` on X.
   - Calculate current secondary market premium %.

3. **Social Sentiment & Volume Analysis**
   - Search X (site:x.com) and Farcaster (site:warpcast.com) for the SKU.
   - Count recent mentions and analyze sentiment (Bullish/Bearish/Neutral).
   - Assign a "Hype Score" (1-10) based on mention density vs. typical collab volume.

4. **Professional Ecom Report Generation**
   - **30-Day Prediction**: Projected price based on premium trend + hype score.
   - **Thesis**: Detailed "Why" (e.g., "Jacquemus crossover appeal," "Metallic silver trend," "Regional scarcity").
   - **Recommendation**: 
     - **Front-run**: High premium (>50%) + High Hype (>8).
     - **Hold**: Moderate premium (20-50%) + Growing sentiment.
     - **Pass**: Low premium (<20%) or fading hype.

5. **Bridge to X**
   - Format the final output as a "Professional Ecom Insight Report."
   - Use the `twitter-agent` skill to post the report or a summary thread to X.

## Usage
"Run sneaker-ecom-analyst for the upcoming Nike Cryoshot drops"
"Generate an ecom report for SKU IM0702-001"

## Note on Environment
This skill is optimized for both the Bankr Terminal (bankr.bot/terminal) and X/Twitter. 
- **On X**: The skill prioritizes `http.fetch` and search APIs for data gathering. It will NOT attempt to use `use_browser` or any browser-based scraping tools, as these are restricted to the Bankr Terminal.
- **In Terminal**: Full browser-based scraping is available for deep market analysis.
- If a request on X requires data that can only be obtained via browser scraping, the agent will provide a summary based on available API data and include a link to the Bankr Terminal for the full deep-dive report.
