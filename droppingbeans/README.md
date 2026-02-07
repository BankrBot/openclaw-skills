# Twitter CT Scanner

Search all of Crypto Twitter for keywords and extract relevant tweets with metadata.

Built by [@DroppingBeans_](https://x.com/DroppingBeans_) for the Moltbot/Clawdbot community.

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

## Quick Start

```bash
# Search for Base L2 tweets
./scripts/twitter-ct-scan.sh "Base L2" 10

# Track agent tokens
./scripts/twitter-ct-scan.sh "AI agents crypto" 10

# Monitor specific projects
./scripts/twitter-ct-scan.sh "clawdbot OR bankrbot" 5
```

## Installation

**Prerequisites:**
- Node.js
- Playwright (comes with Clawdbot)
- Twitter session file at `~/clawd/secrets/.twitter-session.json`

**Setup:**
```bash
git clone https://github.com/droppingbeans/twitter-ct-scanner.git
cd twitter-ct-scanner
chmod +x scripts/*.sh
```

## Usage

### Basic Search

```bash
scripts/twitter-ct-scan.sh "<query>" [limit]
```

### Examples

**Monitor Base Ecosystem:**
```bash
scripts/twitter-ct-scan.sh "Base chain launch" 5
```

**Track Agent Tokens:**
```bash
scripts/twitter-ct-scan.sh "agent tokens" 10
```

**Find Mentions:**
```bash
scripts/twitter-ct-scan.sh "$CLAWD OR $BANKR" 5
```

## Output

Results saved to `memory/twitter-ct-scan.json`:

```json
[
  {
    "username": "aixbt_agent",
    "tweetId": "2016674892759052598",
    "text": "lombard's lbtc absorbing $550m...",
    "query": "Base L2",
    "timestamp": "2026-01-29T00:48:57.000Z"
  }
]
```

## Automation

Run as a cron job:

```bash
# Every 30 minutes
*/30 * * * * cd ~/twitter-ct-scanner && scripts/twitter-ct-scan.sh "Base OR agent tokens" 10
```

## Common Queries

**Base Ecosystem:**
- "Base L2"
- "BuildOnBase"
- "Base chain launch"

**Agent Tokens:**
- "AI agents crypto"
- "agent tokens"
- "onchain agents"

**Projects:**
- "clawdbot OR clawdbotatg"
- "bankrbot"
- "$CLAWD"

## Contributing to Moltbot Skills

This skill is being submitted to the [Moltbot Skills Library](https://github.com/BankrBot/moltbot-skills).

To use with Moltbot/Clawdbot, install directly from the skills repo once merged.

## License

MIT

## Author

Built by [@DroppingBeans_](https://x.com/DroppingBeans_) 🫘
