---
name: cryoshot-volatility-monitor
description: Checks Nike Cryoshot floor prices daily and posts volatility alerts to X.
---

# Cryoshot Volatility Monitor

This skill monitors the Nike Cryoshot collection for price volatility and posts alerts to X via the `twitter-agent` skill.

## Workflow

1. **Fetch Current Floors**
   - For each SKU (IO0619-100, IM0702-001, IM0589-001, IM0703-700), use the `sneaker-release-predictor` logic to find the current secondary market floor price.
   - Use `use_browser` to search Google for `"<SKU>" stockx OR goat OR ebay price` and extract the lowest reliable asking price from snippets.

2. **Compare with Previous 24h**
   - Read `project_cryoshot_tracking.md` to get the "Baseline Floor" for each SKU.
   - Calculate the percentage change: `((current - baseline) / baseline) * 100`.

3. **Post Volatility Alert**
   - If `abs(change) > 10%`:
     - Load `twitter-agent` skill.
     - Draft a 'Volatility Alert' post.
     - Include: SKU, percentage move (up/down), current floor, and a brief sentiment update (e.g., "Bullish momentum building" or "Market cooling off").
     - Post to X.

4. **Update Memory**
   - Update `project_cryoshot_tracking.md` with the new current floors as the new baseline for the next 24 hours.
   - Log the alert in `twitter-storyline.md`.
