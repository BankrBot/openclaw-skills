# Twitter Anti-Muzzle Skill

**Protect your X/Twitter bot from getting muzzled (write access revoked)**

## What is "Muzzling"?

When your X/Twitter app gets **muzzled**, it loses write access to the API. You can still read tweets and mentions, but you can't post, reply, or like anything. The app status shows "MUZZLED" in the developer portal, and all write operations return `403 Forbidden` errors.

Muzzling is X's enforcement action for apps that exhibit spam-like behavior or violate automation policies.

## Why This Skill Exists

This skill emerged from real-world experience with [@solvrbot](https://x.com/solvrbot), which experienced repeated muzzling incidents until we identified and fixed the root causes. After implementing these defenses, we achieved **3+ weeks with zero muzzling incidents**.

## Common Causes of Muzzling

### 🚫 Critical Violations

1. **Automatic @mention injection** - Auto-tagging accounts in replies
2. **Rapid-fire posting** - Posting multiple times with minimal delays (< 5 seconds)
3. **Predictable timing** - Responding instantly every time with no variation
4. **Repetitive content** - Identical response formats/structure every time
5. **Excessive automation** - Too many actions too quickly

### ⚠️ Risk Factors

- Using **Dev mode** instead of Production mode
- High-volume posting (> 100 tweets/day for new apps)
- Engagement farming patterns (mass likes/retweets)
- Coordinated behavior with other bots

## Defense Strategy

### Layer 1: Remove Auto-Tagging

**Never automatically inject @mentions into bot replies.**

```python
# ❌ BAD - Violates X automation policy
def inject_tags(text):
    if "Virtuals" in text:
        text = text.replace("Virtuals", "@virtuals_io")
    return text

# ✅ GOOD - Let mentions happen naturally
def format_reply(text):
    # No automatic @mention injection
    return text
```

### Layer 1.5: Rate-Limit @Mentions (Use Display Names on Cooldown)

**Even without auto-injection, AI-generated replies can contain @handles.** X's anti-spam system flags bots that repeatedly tag other accounts. The solution: rate-limit each @handle to once per hour, and replace with the account's display name when on cooldown.

```python
import re
import time

_mention_cooldowns: dict[str, float] = {}  # @handle -> last used timestamp
_MENTION_COOLDOWN_SECS = 3600  # 1 hour per handle
_display_name_cache: dict[str, str] = {}  # @handle -> display name

def rate_limit_mentions(text: str, bot_handle: str = "@mybot") -> str:
    """Replace @mentions with display names when on cooldown."""
    now = time.time()

    def _replace(match: re.Match) -> str:
        handle = match.group(0)
        handle_lower = handle.lower()

        # Never tag yourself
        if handle_lower == bot_handle.lower():
            return _display_name_cache.get(handle_lower, handle[1:])

        last_used = _mention_cooldowns.get(handle_lower, 0)
        if now - last_used < _MENTION_COOLDOWN_SECS:
            # On cooldown — use display name or username without @
            return _display_name_cache.get(handle_lower, handle[1:])
        else:
            # Allow mention, start cooldown
            _mention_cooldowns[handle_lower] = now
            return handle

    return re.sub(r'@([A-Za-z0-9_]{1,15})\b', _replace, text)
```

**Before:** `"Check out @bankrbot for trading!"` → `"Check out @bankrbot for trading!"` (first time)
**After cooldown:** `"Check out @bankrbot for trading!"` → `"Check out Bankr for trading!"` (display name)

**Populate the cache** from X API responses (`user_fields: ["username", "name"]`):
```python
# When fetching mentions, cache display names from included users
for user in response.includes["users"]:
    _display_name_cache[f"@{user.username.lower()}"] = user.name
```

### Layer 2: Randomize Timing

**Add human-like delays to break predictable patterns.**

```python
import random
import asyncio

# Before posting any reply
async def post_with_delay(text, tweet_id):
    # Human-like "reading + typing" delay
    await asyncio.sleep(random.uniform(3, 8))

    return api.post_tweet(text, reply_to=tweet_id)

# Between chained posts (multiple images/tweets)
async def post_chain(tweets):
    for i, tweet in enumerate(tweets):
        result = await post_tweet(tweet)

        if i < len(tweets) - 1:
            # Longer delay between chained posts
            await asyncio.sleep(random.uniform(8, 15))
```

### Layer 3: Rate Limiting

**Implement per-user and global rate limits.**

```python
from collections import defaultdict
from datetime import datetime, timedelta

class RateLimiter:
    def __init__(self):
        self.user_replies = defaultdict(list)
        self.bot_replies = defaultdict(list)

    def can_reply(self, user_id: str, is_bot: bool = False) -> bool:
        """Check if we can reply to this user."""
        now = datetime.utcnow()
        cutoff = now - timedelta(hours=1)

        # Get recent replies to this user
        if is_bot:
            recent = [t for t in self.bot_replies[user_id] if t > cutoff]
            max_replies = 1  # Max 1 reply/hour to bots
        else:
            recent = [t for t in self.user_replies[user_id] if t > cutoff]
            max_replies = 5  # Max 5 replies/hour to humans

        return len(recent) < max_replies

    def record_reply(self, user_id: str, is_bot: bool = False):
        """Record that we replied to this user."""
        now = datetime.utcnow()
        if is_bot:
            self.bot_replies[user_id].append(now)
        else:
            self.user_replies[user_id].append(now)
```

### Layer 4: Vary Content

**Avoid identical response structures.**

```python
import random

def format_token_list(tokens):
    # Vary the structure
    formats = [
        lambda t: f"• {t['symbol']} - ${t['price']} ({t['change']})",
        lambda t: f"{t['symbol']}: ${t['price']} | {t['change']}",
        lambda t: f"${t['symbol']} {t['price']} {t['change']}",
    ]

    formatter = random.choice(formats)
    return "\n".join(formatter(t) for t in tokens)

def add_intro_variety(base_text):
    """Randomize intro phrases."""
    intros = [
        "Here's what I found:",
        "Check these out:",
        "Here you go:",
        "Found these for you:",
        "",  # Sometimes no intro
    ]

    intro = random.choice(intros)
    return f"{intro}\n\n{base_text}" if intro else base_text
```

## Implementation Guide

### Quick Start

1. **Audit your code** for automatic @mention injection → Remove it
2. **Rate-limit @mentions** in outgoing replies (1 per handle per hour, use display names on cooldown)
3. **Add delays** before posting (3-8s randomized)
4. **Implement rate limiting** (5/hour for humans, 1/hour for bots)
5. **Randomize timing** for chained posts (8-15s between tweets)
6. **Vary response formats** to avoid repetitive patterns

### Testing

```python
# Before deploying, test your delays
import time

async def test_anti_muzzle():
    delays = []
    for i in range(10):
        start = time.time()
        await add_human_delay()  # Your delay function
        delays.append(time.time() - start)

    print(f"Average delay: {sum(delays) / len(delays):.2f}s")
    print(f"Min: {min(delays):.2f}s, Max: {max(delays):.2f}s")

    # Should show variation, not fixed delays
```

### Monitoring

**Track 403 errors as early warning signs:**

```python
import logging

logger = logging.getLogger(__name__)

async def post_with_monitoring(text, tweet_id):
    try:
        result = await api.post_tweet(text, reply_to=tweet_id)
        return result
    except Forbidden403 as e:
        logger.error(f"403 Forbidden - possible muzzling: {e}")

        # Alert admin
        if "muzzled" in str(e).lower():
            await alert_admin("App may be muzzled! Check developer portal.")

        raise
```

## Best Practices

### ✅ DO

- Use **Production mode**, not Dev mode
- Implement **VIP lists** for testers (bypass rate limits)
- **Monitor 403 errors** as early warnings
- Create a **new app** if muzzled (muzzling is often permanent)
- Keep response timing **variable and human-like**
- **Respect rate limits** (both technical and behavioral)

### ❌ DON'T

- Auto-inject @mentions in replies
- Post multiple tweets with < 5 second delays
- Respond instantly every single time
- Use identical response formats repeatedly
- Ignore 403 Forbidden errors
- Re-use a muzzled app (create a new one)

## Real-World Results

After implementing these defenses in [@solvrbot](https://x.com/solvrbot):

- ✅ **Zero muzzling incidents** for 3+ weeks (previously constant)
- ✅ **More natural bot behavior** that users engage with better
- ✅ **Improved user experience** (less spammy feel)

## Code Examples

- [Python Implementation](./python/anti_muzzle.py)
- [TypeScript Implementation](./typescript/antiMuzzle.ts)

## Resources

- [X Developer Policy](https://developer.twitter.com/en/docs/twitter-api/developer-terms)
- [X Automation Rules](https://help.twitter.com/en/rules-and-policies/twitter-automation)
- [Real-world muzzling discussion](https://devcommunity.x.com/t/error-403-cuenta-silenciada-muzzled/256726)

## Contributing

Found additional muzzling patterns or defenses? PRs welcome!

## License

MIT

---

*Built by [@ccryptoji](https://x.com/ccryptoji) • Battle-tested on [@solvrbot](https://x.com/solvrbot)*
