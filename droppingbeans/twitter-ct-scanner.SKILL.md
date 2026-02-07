---
name: twitter-ct-scanner
description: Search Twitter (Crypto Twitter) for specific keywords and extract relevant tweets with metadata. Use for monitoring Base L2, agent tokens, crypto trends, and finding alpha across all of CT. Returns structured tweet data (username, ID, text, timestamp).
metadata: {"clawdbot":{"emoji":"🫘","homepage":"https://x.com/DroppingBeans_","requires":{"bins":["node"],"packages":["playwright-core"]}}}
---

# Twitter CT Scanner

Search all of Crypto Twitter for keywords and extract relevant tweets with full metadata.

## Quick Start

### Installation

This skill uses Playwright (already available in Clawdbot) and requires an authenticated Twitter session.

**Prerequisites:**
- Twitter session file at `~/clawd/secrets/.twitter-session.json`
- Playwright chromium installed (comes with Clawdbot)

### Basic Usage

```bash
scripts/twitter-ct-scan.sh "Base L2" 10
```

This searches Twitter for "Base L2" and returns the top 10 most recent tweets.

## What It Does

Searches Twitter's live feed for any keyword or phrase and extracts:
- Tweet text
- Author username
- Tweet ID (for building URLs)
- Timestamp
- Query that matched

Perfect for:
- Monitoring trending narratives
- Finding alpha before it spreads
- Tracking specific tokens or projects
- Discovering new accounts
- Building knowledge bases

## Usage Examples

### Monitor Base Ecosystem

```bash
scripts/twitter-ct-scan.sh "Base chain launch" 5
```

### Track Agent Tokens

```bash
scripts/twitter-ct-scan.sh "AI agents crypto" 10
```

### Find Clawdbot Mentions

```bash
scripts/twitter-ct-scan.sh "clawdbot OR clawdbotatg" 5
```

### Custom Multi-Keyword Search

```bash
scripts/twitter-ct-scan.sh "$CLAWD OR agent tokens" 10
```

## Output Format

Results are saved to `memory/twitter-ct-scan.json`:

```json
[
  {
    "username": "aixbt_agent",
    "tweetId": "2016674892759052598",
    "text": "lombard's lbtc absorbing $550m from ava labs...",
    "query": "Base L2",
    "timestamp": "2026-01-29T00:48:57.000Z"
  }
]
```

## Integration with Automation

Use this skill as part of automated CT monitoring:

```bash
# Run every 30 minutes
*/30 * * * * cd ~/clawd && scripts/twitter-ct-scan.sh "Base OR agent tokens" 10

# Combine with reply automation
node scripts/process-ct-scan-results.js
```

## Common Search Queries

**Base Ecosystem:**
- `"Base L2"`
- `"BuildOnBase"`
- `"Base chain launch"`

**Agent Tokens:**
- `"AI agents crypto"`
- `"agent tokens"`
- `"onchain agents"`

**Specific Projects:**
- `"clawdbot OR clawdbotatg"`
- `"bankrbot"`
- `"$CLAWD"`

**Narratives:**
- `"memecoin launch"`
- `"DeFi yield"`
- `"crypto agents trading"`

## Configuration

Edit `scripts/twitter-ct-scan.js` to customize:

```javascript
const SEARCH_QUERIES = [
  'Base L2',
  'agent tokens',
  'AI agents crypto',
  'clawdbot OR clawdbotatg',
  // Add your own
];
```

## Advanced: Keyword Filtering

Combine with keyword matching for smart filtering:

```bash
# Scan for Base + filter for keywords
scripts/twitter-ct-scan.sh "Base" 20 | jq '.[] | select(.text | contains("launch") or contains("token"))'
```

## Limits & Best Practices

- **Rate Limits:** Twitter may throttle excessive searches
- **Recommended:** 2-3 searches per run, rotate queries
- **Delay:** 2-5 seconds between searches
- **Fresh Results:** Use `f=live` parameter for most recent tweets

## Contributing

Built by [@DroppingBeans_](https://x.com/DroppingBeans_) for the Moltbot/Clawdbot community.

Improvements welcome:
- Additional search filters
- Sentiment analysis
- Thread extraction
- Image/media support
