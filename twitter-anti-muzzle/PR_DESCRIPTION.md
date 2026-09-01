# Twitter Anti-Muzzle Skill

This PR introduces a new skill to help developers prevent their X/Twitter bots from getting "muzzled" (write access revoked by X's spam detection systems).

## Problem

X/Twitter apps can lose write access when they exhibit automated spam patterns. Common causes include:
- Automatic @mention injection in replies
- Rapid-fire posting with fixed delays
- Predictable response timing
- Repetitive content structures

Once muzzled, apps show "MUZZLED" status in the developer portal and receive `403 Forbidden` on all write operations.

## Solution

This skill provides a comprehensive defense strategy with four layers:

1. **Remove auto-tagging** - Prevent automatic @mention injection (primary cause)
2. **Randomize timing** - Human-like delays (3-8s before posts, 8-15s between chains)
3. **Rate limiting** - Per-user limits with bot detection (5/hour humans, 1/hour bots)
4. **Content variation** - Utilities to vary response structures

## What's Included

- **README.md** - Comprehensive documentation with defense strategies and best practices
- **python/anti_muzzle.py** - Python utilities (`AntiMuzzle`, `ContentVariation`, monitoring)
- **typescript/antiMuzzle.ts** - TypeScript implementation matching Python behavior
- **IMPLEMENTATION.md** - Step-by-step integration guide with code examples

## Key Features

**AntiMuzzle Class:**
```python
anti_muzzle = AntiMuzzle(max_replies_human=5, max_replies_bot=1)

if anti_muzzle.can_reply(user_id, is_bot):
    await anti_muzzle.add_human_delay()  # 3-8s randomized
    result = await api.post_tweet(text)
    anti_muzzle.record_reply(user_id)
```

**ContentVariation Utilities:**
- Vary intro phrases
- Randomize list formatting
- Mix emoji usage
- Prevent identical response patterns

**403 Monitoring:**
- Decorator for early muzzling detection
- Automatic alerting on write access issues

## Testing

Real-world validation on a production bot showed:
- Zero muzzling incidents over 3+ weeks (previously constant)
- Improved user engagement
- More natural bot behavior

## Implementation

Quick integration takes ~5 minutes. Full implementation guide included in `IMPLEMENTATION.md` with:
- Step-by-step code examples
- Testing strategies
- Deployment checklist
- Troubleshooting guide

## Related Work

Similar to the prompt injection defense skill (#121), this addresses a real security/reliability issue that affects X/Twitter bots in production.

---

**Checklist:**
- [ ] Code follows project style guidelines
- [ ] Documentation is clear and comprehensive
- [ ] Examples are provided for both Python and TypeScript
- [ ] No breaking changes to existing skills
- [ ] Ready for production use
