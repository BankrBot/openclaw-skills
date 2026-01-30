# ATTN - Autonomous Trading Agent

An autonomous trading agent for Base that hunts gems, learns from every trade, and compounds profits into ATTN token.

## What Makes ATTN Different

Unlike other trading bots, ATTN is **truly autonomous**:

1. **Self-Monitoring** - Tracks its own health, detects failures
2. **Self-Healing** - Recovers from errors without human intervention
3. **Self-Learning** - Improves exit timing based on every trade outcome
4. **Self-Promoting** - Rides hype waves, posts to Moltbook and Farcaster
5. **Goal-Directed** - All profits compound into ATTN token

## Installation

```bash
# In your OpenClaw directory
cd ~/.openclaw/skills
git clone https://github.com/attn-bot/attnbot attn
```

## Configuration

Add to your OpenClaw `.env`:

```bash
# Required
NEYNAR_API_KEY=your_neynar_api_key
SIGNER_UUID=your_farcaster_signer_uuid
BANKR_API_KEY=your_bankr_api_key

# Optional
ATTN_CA=0x6b5267cec87a865148328d63405cc3c42b908b07
MOLTBOOK_API_KEY=your_moltbook_key  # For agent social network
```

## Commands

| Command | Description |
|---------|-------------|
| `status` | Get health, uptime, scan count, trade stats |
| `positions` | List current holdings with PnL |
| `learning` | Show what ATTN has learned from trades |
| `buy SYMBOL` | Manually buy a token |
| `sell SYMBOL` | Sell a position |
| `hype` | Check trending narratives |
| `heal` | Force self-healing |

## Autonomous Behaviors

ATTN operates on several schedules:

### Every 5 Minutes: Gem Hunt
- Scans Base for emerging tokens
- Scores based on liquidity, volume, social signals
- Uses AI to evaluate X/Twitter sentiment
- Only enters high-conviction setups

### Every 30 Minutes: Position Management
- Tracks PnL on all positions
- Uses learned optimal TP/SL levels
- Implements trailing stops
- Takes partial profits at 50% of target

### Every 10 Minutes: Self-Healing
- Detects stuck processes
- Clears error states
- Enters recovery mode if needed

### Every Hour: Hype Riding
- Monitors Farcaster for trending narratives
- Detects AI agent, Base, degen narratives
- Posts engagement content
- Adapts strategy to market conditions

### Daily: PnL Report
- Reports daily performance
- Updates learning parameters
- Reinvests profits into ATTN
- Posts to Moltbook and Farcaster

## Learning System

ATTN tracks and learns:

| Metric | What It Learns |
|--------|----------------|
| Take Profits | Which TP % works best (15%, 20%, 30%, etc) |
| Stop Losses | Optimal SL % to minimize losses |
| Hold Times | Best hold duration by token type |
| Vibe Correlation | Does "vibe strength" predict success? |
| Time Patterns | Best times of day to trade |

After each trade, parameters update:

```javascript
{
  optimalTakeProfit: 0.30,   // Learned from wins
  optimalStopLoss: -0.15,    // Learned from losses  
  maxHoldHours: 4,           // Quick flip mode
  trailingStop: true,        // Protect gains
  trailingStopPct: 0.10
}
```

## Social Presence

ATTN posts to:
- **Farcaster** - Trade entries, exits, daily PnL
- **Moltbook** - Learning updates, narrative detection, self-healing events

## The Goal

ATTN exists to:
1. Find alpha before the crowd
2. Execute without emotion
3. Learn from every mistake
4. Compound gains into ATTN
5. Never stop, never sleep

## Safety Features

- Recovery mode after 3 consecutive errors
- Position size limits ($5-10 per trade)
- Max hold time (4 hours default, learned)
- Trailing stops to protect profits
- Rate limiting on all social posts

## Support

- GitHub: https://github.com/attn-bot/attnbot
- Profile: https://moltbook.com/u/ATTN

Built for the Claw Crew. The lobster has molted. 🦞

👁️ ATTN is watching. Always.
