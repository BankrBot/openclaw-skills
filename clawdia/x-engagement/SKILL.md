---
name: x-engagement
description: "Twitter/X engagement skill for AI agents. Covers algorithm optimization, automated account setup, engagement patterns, and tool integration for building an authentic presence."
version: 1.1.0
author: ClawdiaETH
keywords: twitter, x, engagement, social, algorithm, ai-agent, automated
---

# X Engagement for AI Agents

Build an authentic, effective Twitter/X presence as an AI agent. This skill covers algorithm mechanics, engagement strategies, tooling, and compliance.

## Quick Start

1. Set up your account with the "Automated by @operator" label
2. Configure monitoring for priority accounts
3. Use CLI for reading, browser for posting
4. Reply fast — velocity matters more than volume

---

## Account Setup

### Automated Account Label

**Required for transparency.** Makes your account look legit and reduces ban risk.

1. Log into X as your bot account
2. Go to: `x.com/settings/account/automation`
3. Click "Set up account automation"
4. Enter operator's @username
5. Enter operator's password to verify

Label appears on profile: "Automated by @operator"

**Note:** This is a display label only — it doesn't change API behavior. You'll still hit rate limits on automated posts via API.

### Profile Optimization

- **Clear bio:** State what you are and what you do
- **Link to operator:** Builds trust
- **Consistent handle:** Match your ENS/onchain identity if applicable
- **Profile image:** Distinctive, memorable

---

## Algorithm Mechanics

### Engagement Weights

```
Replies > Retweets > Quote Tweets > Likes > Bookmarks > Views
```

Replies are worth ~10x likes for reach. Optimize for conversations, not vanity metrics.

### The 2-Hour Window

First 2 hours after posting are critical:
- Engagement **velocity** matters more than total engagement
- 100 likes in 30 min > 500 likes over 24 hours
- Stay available to reply after posting

### Reach Killers (Avoid)

| Action | Impact |
|--------|--------|
| External links in main post | -50% reach |
| More than 2 hashtags | Looks spammy |
| Same content repeatedly | Flagged as spam |
| Getting reported/blocked | Algorithmic penalty |
| Posting during low-activity hours | Wasted momentum |

### Reach Boosters

| Action | Impact |
|--------|--------|
| Media (images/video) | 2-10x reach |
| Threaded content | Higher time-on-post |
| Questions / hot takes | Drives replies |
| Quote tweets with value-add | Piggyback on viral content |
| First reply on big accounts | Visibility on their audience |

---

## Engagement Patterns

### Reply Guy Strategy

Being first matters. Set up monitoring for priority accounts and reply within minutes.

**Good first reply:**
- Adds value or insight
- Asks a follow-up question
- Offers help relevant to the post

**Bad first reply:**
- "gm"
- Just emojis
- Generic praise ("great post!")
- Shilling your project

### Priority Account Monitoring

Monitor accounts you want to engage with. Check every 5 minutes, reply immediately when they post.

```bash
# Example monitoring script
ACCOUNTS=("target1" "target2" "target3")
for account in "${ACCOUNTS[@]}"; do
  # Check for new tweets
  # Compare to last seen ID
  # Alert if new post detected
done
```

### Engagement on Your Posts

When people reply to you:
- **Like** all non-negative replies (free engagement signal)
- **Reply** to genuine comments/questions
- **Skip** spam, single emojis, hostility

Goal: Make people feel seen. Good engagement begets more engagement.

### Quote Tweet Etiquette

Quote tweets work when you add value:
- ✅ "Let me explain why this matters..."
- ✅ Counterpoint with reasoning
- ✅ Personal experience that relates
- ❌ "This!" or "So true!"
- ❌ Just adding emojis

---

## Tooling

### Reading (CLI)

Use CLI tools for monitoring — fast and cheap.

```bash
# User's recent tweets
bird user-tweets @handle -n 5 --plain

# Your mentions
bird mentions -n 10 --plain

# Search
bird search "query" -n 10 --plain
```

### Posting (Browser)

API posting gets rate-limited/blocked for automated accounts. Use browser automation:

```
1. Navigate to tweet URL or compose page
2. Snapshot to find textbox element
3. Type your reply
4. Click post button
```

This mimics human behavior and avoids API restrictions.

### Cookie-Based Auth

For CLI tools that need auth:
- Extract `auth_token` and `ct0` from browser cookies
- Store in environment variables or config
- Refresh when auth fails

---

## Content Strategy

### Voice Guidelines

- **Be helpful**, not promotional
- **Be concise** — say it in fewer words
- **Have opinions** — don't be a sycophant
- **Be authentic** — acknowledge you're an AI agent
- **Add value** — every post should be worth reading

### Content Mix

| Type | Frequency | Purpose |
|------|-----------|---------|
| Replies to priority accounts | Immediate | Visibility, relationship |
| Helpful replies to mentions | As needed | Community building |
| Original insights | 1/day max | Thought leadership |
| Building in public updates | When shipping | Authenticity |

### Topics to Engage With

Engage where you have genuine knowledge:
- Your domain expertise
- Projects you're building
- Ecosystem you're part of
- Technical topics you understand

### Topics to Avoid

- Politics
- Controversial social issues
- Price predictions / financial advice
- Attacking other projects
- Anything requiring disclaimers

---

## Compliance

### Transparency

- Always have "Automated by" label
- Don't pretend to be human when directly asked
- Disclose AI nature in bio

### Rate Limiting

- Don't mass like/retweet
- Don't follow/unfollow in bulk
- Space out posts (no more than 5-10/hour)
- Respect API limits

### Avoiding Bans

- Build reputation gradually
- Engage authentically, not mechanically
- Don't spam hashtags or cashtags
- Respond to reports promptly

---

## Metrics to Track

| Metric | Why It Matters |
|--------|----------------|
| Reply rate on priority accounts | Relationship building |
| Engagement rate on original posts | Content quality |
| Follower growth rate | Audience building |
| Mentions/replies received | Community engagement |
| Profile visits | Interest/discovery |

---

## Bankr Integration (Token Giveaways)

If you have a token and use Bankr, you can drive engagement by rewarding followers and running giveaways.

### New Follower Rewards

When someone follows you, thank them and send a small token reward via @bankrbot.

**Format:**
```
thanks for the follow! 🐚

@bankrbot send $1 of $TOKEN to @[their_handle]
```

**Tips:**
- Keep amounts small ($1-2) — it's the gesture that matters
- Skip obvious bots/spam accounts
- Do a few at a time, not all at once
- Prioritize accounts that look real (bio, posts, followers)
- Can batch: `@bankrbot send $1 of $TOKEN to @user1 @user2 @user3`

**Why it works:**
- Personal touch makes people feel seen
- Recipients often tweet about getting free tokens
- Builds loyal community
- Low cost, high goodwill

### Giveaway Quote Tweets

Quote tweet your own post and ask @bankrbot to distribute tokens to people who reply with a specific phrase.

**Format:**
```
[context about what you're celebrating]

@bankrbot send $X of $TOKEN to the first Y people who reply to this tweet with:

"[specific phrase]"
```

**Example:**
```
celebrating my Bankr Club membership 🦞

@bankrbot send $5 of $CLAWDIA to the first 25 people who reply to this tweet with:

"bullish on $CLAWDIA and $BNKR"
```

**Tips:**
- Keep amounts reasonable ($1-10 per person)
- Limit to 10-50 recipients
- Require specific phrase to filter bots
- Tie to something real (milestone, announcement)
- Cross-mention $BNKR — ecosystem mutual promotion

**Why it works:**
- Drives replies (algorithm loves this)
- Cross-promotes tokens organically
- Creates community engagement
- Bankr handles distribution automatically
- People share to farm the giveaway

---

## Example Workflows

### Morning Check

```
1. Check priority accounts for new posts → reply if any
2. Check mentions → engage with genuine ones
3. Check replies on my posts → like + respond
4. If something worth posting → post it
5. Otherwise → done
```

### Responding to Viral Post from Priority Account

```
1. Detect new post within 5 minutes
2. Read and understand the content
3. Craft reply that adds value
4. Post immediately
5. Monitor for engagement
6. Engage with others in the thread
```

### Building in Public Update

```
1. Ship something
2. Craft concise announcement (under 280 chars)
3. Include what shipped + what's next
4. Add media if relevant
5. Stay available for 2 hours to engage
```

---

## Resources

- [X Developer Documentation](https://developer.x.com/en/docs)
- [X Automation Rules](https://help.x.com/en/rules-and-policies/x-automation)
- [bird CLI](https://github.com/steipete/bird) — Fast Twitter CLI

---

*Built by [@Clawdia_ETH](https://x.com/Clawdia_ETH) — learning by doing, sharing what works.*
