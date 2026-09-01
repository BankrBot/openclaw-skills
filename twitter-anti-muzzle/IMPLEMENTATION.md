# Implementation Guide: Twitter Anti-Muzzle

Step-by-step guide to integrate anti-muzzling defenses into your X/Twitter bot.

## Quick Integration (5 minutes)

### Python

```python
from anti_muzzle import AntiMuzzle

# 1. Initialize once at startup
anti_muzzle = AntiMuzzle(
    max_replies_human=5,      # Max 5 replies/hour to humans
    max_replies_bot=1,        # Max 1 reply/hour to bots
    vip_accounts={"12345"},   # VIP bypass list
)

# 2. Before posting any reply
async def handle_mention(mention):
    user_id = mention.author_id
    is_bot = is_bot_username(mention.author_username)

    # Check rate limit
    if not anti_muzzle.can_reply(user_id, is_bot):
        return  # Skip this user (rate limited)

    # Generate reply
    reply_text = await generate_reply(mention)

    # Add human-like delay
    await anti_muzzle.add_human_delay()

    # Post reply
    result = await api.post_tweet(reply_text, reply_to=mention.id)

    # Record reply
    anti_muzzle.record_reply(user_id)
```

### TypeScript

```typescript
import { AntiMuzzle } from './antiMuzzle';

// 1. Initialize once at startup
const antiMuzzle = new AntiMuzzle({
  maxRepliesHuman: 5,      // Max 5 replies/hour to humans
  maxRepliesBot: 1,        // Max 1 reply/hour to bots
  vipAccounts: new Set(['12345']),  // VIP bypass list
});

// 2. Before posting any reply
async function handleMention(mention) {
  const userId = mention.authorId;
  const isBot = isBotUsername(mention.authorUsername);

  // Check rate limit
  if (!antiMuzzle.canReply(userId, isBot)) {
    return;  // Skip this user (rate limited)
  }

  // Generate reply
  const replyText = await generateReply(mention);

  // Add human-like delay
  await antiMuzzle.addHumanDelay();

  // Post reply
  const result = await api.postTweet(replyText, { replyTo: mention.id });

  // Record reply
  antiMuzzle.recordReply(userId);
}
```

---

## Full Integration (30 minutes)

### Step 1: Audit & Remove Auto-Tagging

**Find and disable any automatic @mention injection:**

```python
# ❌ REMOVE THIS
def inject_project_tags(text):
    if "Virtual" in text:
        text = text.replace("Virtual", "@virtuals_io")
    if "Base" in text:
        text = text.replace("Base", "@buildonbase")
    return text

# ✅ REPLACE WITH
def format_text(text):
    # No automatic @mention injection
    return text
```

**Search your codebase for:**
- `text.replace("ProjectName", "@handle")`
- Any functions that inject @mentions
- Auto-tagging loops

**Delete or comment out all auto-tagging code.**

---

### Step 2: Add Timing Variation

**Before posting any tweet/reply:**

```python
# Add human-like delay
await anti_muzzle.add_human_delay(min_seconds=3, max_seconds=8)
```

**Between chained posts (multiple images):**

```python
for i, image in enumerate(images):
    result = await post_image(image)

    if i < len(images) - 1:
        # Longer delay between chained posts
        await anti_muzzle.add_chain_delay(min_seconds=8, max_seconds=15)
```

---

### Step 3: Implement Rate Limiting

**Per-user rate limiting:**

```python
# Before replying
if not anti_muzzle.can_reply(user_id, is_bot):
    logger.info(f"Rate limited: {user_id}")
    return  # Skip this user

# After successful reply
anti_muzzle.record_reply(user_id)
```

**Bot detection helper:**

```python
import re

BOT_PATTERNS = re.compile(
    r'bot|ai|agent|gpt|assistant|virtual|auto',
    re.IGNORECASE
)

def is_bot_username(username: str) -> bool:
    """Detect if username looks like a bot."""
    return bool(BOT_PATTERNS.search(username))
```

---

### Step 4: Vary Content Structure

**Use ContentVariation utilities:**

```python
from anti_muzzle import ContentVariation

# Vary list formatting
tokens = [
    {"symbol": "BTC", "price": "45000", "change": "+5%"},
    {"symbol": "ETH", "price": "2500", "change": "+3%"},
]

# Different format each time
formatted = ContentVariation.vary_list_format(tokens)

# Vary intro phrases
response = ContentVariation.vary_intro(formatted)

# Vary emojis
emojis = ["🔥", "💎", "🚀", "📈"]
selected_emojis = ContentVariation.vary_emojis(emojis)
```

---

### Step 5: Monitor 403 Errors

**Add monitoring to detect early muzzling signs:**

```python
import logging

logger = logging.getLogger(__name__)

async def post_with_monitoring(text, tweet_id):
    try:
        result = await api.post_tweet(text, reply_to=tweet_id)
        return result

    except Exception as e:
        # Log 403 errors
        if "403" in str(e) or "Forbidden" in str(e):
            logger.error(f"⚠️ 403 Forbidden: {e}")

            # Alert on potential muzzling
            if "muzzled" in str(e).lower() or "write" in str(e).lower():
                logger.critical("🚨 MUZZLING DETECTED!")
                await alert_admin("App may be muzzled!")

        raise
```

**TypeScript version:**

```typescript
import { monitor403Errors } from './antiMuzzle';

class TwitterBot {
  @monitor403Errors
  async postTweet(text: string, replyTo?: string) {
    return await this.api.createTweet({ text, replyTo });
  }
}
```

---

## Advanced: VIP Management

**Add VIP users who bypass rate limits (testers, partners):**

```python
# Add VIP
anti_muzzle.add_vip("123456789")

# Remove VIP
anti_muzzle.remove_vip("123456789")

# Check VIP status
is_vip = user_id in anti_muzzle.vip_accounts
```

---

## Testing Your Implementation

### Test 1: Verify Rate Limiting

```python
async def test_rate_limiting():
    anti_muzzle = AntiMuzzle(max_replies_human=2)

    user_id = "test_user"

    # Should succeed twice
    assert anti_muzzle.can_reply(user_id) == True
    anti_muzzle.record_reply(user_id)

    assert anti_muzzle.can_reply(user_id) == True
    anti_muzzle.record_reply(user_id)

    # Should fail on third attempt
    assert anti_muzzle.can_reply(user_id) == False

    print("✅ Rate limiting works")
```

### Test 2: Verify Timing Variation

```python
import time

async def test_timing_variation():
    delays = []

    for _ in range(10):
        start = time.time()
        await anti_muzzle.add_human_delay()
        delays.append(time.time() - start)

    avg = sum(delays) / len(delays)
    min_delay = min(delays)
    max_delay = max(delays)

    print(f"Average: {avg:.2f}s")
    print(f"Range: {min_delay:.2f}s - {max_delay:.2f}s")

    # Should show variation
    assert max_delay - min_delay > 2.0, "Not enough variation!"

    print("✅ Timing variation works")
```

### Test 3: Verify No Auto-Tagging

```python
def test_no_auto_tagging():
    test_cases = [
        ("I like Virtual Protocol", "I like Virtual Protocol"),
        ("Check out Base chain", "Check out Base chain"),
        ("AgentGram is cool", "AgentGram is cool"),
    ]

    for input_text, expected_output in test_cases:
        result = format_text(input_text)
        assert result == expected_output, f"Auto-tagging detected: {result}"
        assert "@" not in result, f"@mention found: {result}"

    print("✅ No auto-tagging detected")
```

---

## Deployment Checklist

Before deploying your anti-muzzle implementation:

- [ ] Removed all automatic @mention injection code
- [ ] Added human-like delays before posting (3-8s)
- [ ] Added chain delays for multiple posts (8-15s)
- [ ] Implemented per-user rate limiting
- [ ] Added bot username detection
- [ ] Implemented content variation (intros, formats, emojis)
- [ ] Added 403 error monitoring
- [ ] Set up VIP bypass list for testers
- [ ] Tested rate limiting logic
- [ ] Tested timing variation
- [ ] Verified no auto-tagging
- [ ] Created NEW X app (if previous one was muzzled)
- [ ] Using Production mode (not Dev mode)

---

## Monitoring After Deployment

Track these metrics to ensure anti-muzzling is working:

```python
class AntiMuzzleMetrics:
    def __init__(self):
        self.total_mentions = 0
        self.rate_limited = 0
        self.replies_sent = 0
        self.errors_403 = 0

    def log_mention(self):
        self.total_mentions += 1

    def log_rate_limit(self):
        self.rate_limited += 1

    def log_reply(self):
        self.replies_sent += 1

    def log_403(self):
        self.errors_403 += 1

    def report(self):
        print(f"Total mentions: {self.total_mentions}")
        print(f"Rate limited: {self.rate_limited} ({self.rate_limited / self.total_mentions * 100:.1f}%)")
        print(f"Replies sent: {self.replies_sent}")
        print(f"403 errors: {self.errors_403}")

        if self.errors_403 > 0:
            print("⚠️ WARNING: 403 errors detected - possible muzzling")
```

---

## Troubleshooting

### Still getting muzzled?

1. **Check for auto-tagging remnants**
   - Search codebase for `@` injection
   - Look for string replacement patterns

2. **Verify delays are working**
   - Add logging to confirm delays execute
   - Check that delays are randomized (not fixed)

3. **Check response patterns**
   - Are all responses identical in structure?
   - Use ContentVariation utilities

4. **Create new app**
   - Muzzling is often permanent for an app
   - Create fresh app in Production mode

5. **Reduce posting volume**
   - Lower rate limits temporarily
   - Increase delays

---

## Support

Questions or issues? Open an issue on GitHub or reach out on X:

- [@ccryptoji](https://x.com/ccryptoji) - Creator
- [@solvrbot](https://x.com/solvrbot) - Battle-tested implementation

---

*Last updated: February 2026*
