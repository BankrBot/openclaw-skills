"""
Twitter Anti-Muzzle Utilities
Prevent your X/Twitter bot from getting muzzled (write access revoked)

Usage:
    from anti_muzzle import AntiMuzzle

    # Initialize
    anti_muzzle = AntiMuzzle()

    # Before posting
    if anti_muzzle.can_reply(user_id, is_bot=False):
        await anti_muzzle.add_human_delay()
        result = api.post_tweet(text)
        anti_muzzle.record_reply(user_id)
"""

import asyncio
import random
import time
import logging
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)


class AntiMuzzle:
    """Anti-muzzling utilities for X/Twitter bots."""

    def __init__(
        self,
        max_replies_human: int = 5,
        max_replies_bot: int = 1,
        reply_window_hours: int = 1,
        vip_accounts: Optional[set[str]] = None,
    ):
        """
        Initialize anti-muzzle protection.

        Args:
            max_replies_human: Max replies per human user per window (default: 5)
            max_replies_bot: Max replies per bot account per window (default: 1)
            reply_window_hours: Time window for rate limiting (default: 1 hour)
            vip_accounts: Set of user IDs that bypass rate limits
        """
        self.max_replies_human = max_replies_human
        self.max_replies_bot = max_replies_bot
        self.reply_window = timedelta(hours=reply_window_hours)
        self.vip_accounts = vip_accounts or set()

        # Track recent replies per user
        self.user_replies: dict[str, list[datetime]] = defaultdict(list)

    def can_reply(self, user_id: str, is_bot: bool = False) -> bool:
        """
        Check if we can reply to this user without hitting rate limits.

        Args:
            user_id: Twitter user ID
            is_bot: Whether the user is a bot/AI agent

        Returns:
            True if we can reply, False if rate-limited
        """
        # VIP bypass
        if user_id in self.vip_accounts:
            return True

        now = datetime.utcnow()
        cutoff = now - self.reply_window

        # Clean old entries and count recent replies
        self.user_replies[user_id] = [
            t for t in self.user_replies[user_id] if t > cutoff
        ]
        recent_count = len(self.user_replies[user_id])

        # Check limit
        max_allowed = self.max_replies_bot if is_bot else self.max_replies_human
        can_reply = recent_count < max_allowed

        if not can_reply:
            logger.info(
                f"Rate limit: {user_id} ({'bot' if is_bot else 'human'}) "
                f"- {recent_count}/{max_allowed} in last {int(self.reply_window.total_seconds()) // 3600}h"
            )

        return can_reply

    def record_reply(self, user_id: str):
        """Record that we replied to this user."""
        self.user_replies[user_id].append(datetime.utcnow())

    async def add_human_delay(
        self, min_seconds: float = 3.0, max_seconds: float = 8.0
    ):
        """
        Add human-like delay before posting.

        Simulates "reading + thinking + typing" time.

        Args:
            min_seconds: Minimum delay in seconds
            max_seconds: Maximum delay in seconds
        """
        delay = random.uniform(min_seconds, max_seconds)
        logger.debug(f"Human-like delay: {delay:.2f}s")
        await asyncio.sleep(delay)

    async def add_chain_delay(
        self, min_seconds: float = 8.0, max_seconds: float = 15.0
    ):
        """
        Add delay between chained posts (multiple images/tweets).

        Longer delays to avoid rapid-fire posting patterns.

        Args:
            min_seconds: Minimum delay in seconds
            max_seconds: Maximum delay in seconds
        """
        delay = random.uniform(min_seconds, max_seconds)
        logger.debug(f"Chain post delay: {delay:.2f}s")
        await asyncio.sleep(delay)

    def add_vip(self, user_id: str):
        """Add user to VIP list (bypass rate limits)."""
        self.vip_accounts.add(user_id)
        logger.info(f"Added VIP: {user_id}")

    def remove_vip(self, user_id: str):
        """Remove user from VIP list."""
        self.vip_accounts.discard(user_id)
        logger.info(f"Removed VIP: {user_id}")


class MentionRateLimiter:
    """Rate-limit @mentions in outgoing reply text to avoid muzzling.

    Each @handle can only be mentioned once per cooldown period. When on
    cooldown, the @handle is replaced with the account's display name
    (or username without the @ if display name is unknown).

    Battle-tested on @solvrbot — this is the #1 defense against muzzling.
    """

    def __init__(
        self,
        cooldown_seconds: int = 3600,
        bot_handle: str = "@mybot",
    ):
        """
        Args:
            cooldown_seconds: How long before a handle can be @mentioned again (default: 1 hour)
            bot_handle: Your bot's handle (always stripped from replies)
        """
        self.cooldown_seconds = cooldown_seconds
        self.bot_handle = bot_handle.lower()
        self._cooldowns: dict[str, float] = {}  # handle_lower -> last_mentioned
        self._display_names: dict[str, str] = {}  # handle_lower -> display name

    def cache_display_name(self, username: str, display_name: str):
        """Cache a display name for a handle (populate from X API responses).

        Call this when processing mentions — X API includes user data with
        user_fields=["username", "name"].
        """
        self._display_names[f"@{username.lower()}"] = display_name

    def cache_from_api_users(self, users: list[dict]):
        """Bulk-cache display names from X API user includes.

        Args:
            users: List of user dicts with 'username' and 'name' keys
        """
        for user in users:
            username = user.get("username", "")
            name = user.get("name", username)
            if username:
                self._display_names[f"@{username.lower()}"] = name

    def process(self, text: str) -> str:
        """Rate-limit @mentions in outgoing text.

        Args:
            text: The reply text to process

        Returns:
            Text with rate-limited @mentions replaced by display names
        """
        if not text:
            return text

        import re
        now = time.time()

        def _replace(match: re.Match) -> str:
            handle = match.group(0)  # e.g. "@bankrbot"
            handle_lower = handle.lower()

            # Never tag ourselves
            if handle_lower == self.bot_handle:
                username = handle[1:]
                return self._display_names.get(handle_lower, username)

            last_used = self._cooldowns.get(handle_lower, 0)
            if now - last_used < self.cooldown_seconds:
                # On cooldown — use display name or just username without @
                username = handle[1:]
                replacement = self._display_names.get(handle_lower, username)
                logger.debug(f"Mention rate-limited: {handle} -> {replacement}")
                return replacement
            else:
                # Allow this mention and start cooldown
                self._cooldowns[handle_lower] = now
                logger.debug(f"Mention allowed: {handle} (cooldown started)")
                return handle

        return re.sub(r'@([A-Za-z0-9_]{1,15})\b', _replace, text)


class ContentVariation:
    """Utilities for varying response content to avoid repetitive patterns."""

    @staticmethod
    def vary_intro(base_text: str) -> str:
        """Add varied introduction to responses."""
        intros = [
            "Here's what I found:",
            "Check these out:",
            "Here you go:",
            "Found these:",
            "Take a look:",
            "",  # Sometimes no intro
        ]
        intro = random.choice(intros)
        return f"{intro}\n\n{base_text}" if intro else base_text

    @staticmethod
    def vary_list_format(items: list[dict]) -> str:
        """
        Format a list with varied structure.

        Args:
            items: List of dicts with 'symbol', 'price', 'change' keys

        Returns:
            Formatted string with randomized structure
        """
        formats = [
            lambda i: f"• {i['symbol']} - ${i['price']} ({i['change']})",
            lambda i: f"{i['symbol']}: ${i['price']} | {i['change']}",
            lambda i: f"${i['symbol']} {i['price']} {i['change']}",
            lambda i: f"{i['symbol']} {i['price']} · {i['change']}",
        ]

        formatter = random.choice(formats)
        return "\n".join(formatter(item) for item in items)

    @staticmethod
    def vary_emojis(base_emojis: list[str]) -> list[str]:
        """
        Return varied emoji selection.

        Args:
            base_emojis: List of possible emojis

        Returns:
            Random subset of emojis (0-2 emojis)
        """
        count = random.randint(0, min(2, len(base_emojis)))
        return random.sample(base_emojis, count) if count > 0 else []


def monitor_403_errors(func):
    """
    Decorator to monitor 403 Forbidden errors (early muzzling warning).

    Usage:
        @monitor_403_errors
        async def post_tweet(text):
            return await api.create_tweet(text)
    """
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except Exception as e:
            # Check for 403 Forbidden
            if "403" in str(e) or "Forbidden" in str(e):
                logger.error(f"403 Forbidden detected: {e}")

                # Check if potentially muzzled
                if "muzzled" in str(e).lower() or "write" in str(e).lower():
                    logger.critical(
                        "MUZZLING DETECTED! Check X developer portal immediately."
                    )

            raise

    return wrapper


# Example usage
if __name__ == "__main__":
    import asyncio

    async def example():
        # Initialize
        anti_muzzle = AntiMuzzle(
            max_replies_human=5,
            max_replies_bot=1,
            vip_accounts={"123456789"},  # VIP user IDs
        )

        user_id = "987654321"
        is_bot = False

        # Check if we can reply
        if anti_muzzle.can_reply(user_id, is_bot):
            print(f"✅ Can reply to {user_id}")

            # Add human-like delay
            print("Adding human-like delay...")
            await anti_muzzle.add_human_delay()

            # Simulate posting
            print("Posting tweet...")
            # await api.post_tweet(text)

            # Record the reply
            anti_muzzle.record_reply(user_id)
            print("Reply recorded")
        else:
            print(f"❌ Rate limited for {user_id}")

        # Content variation example
        items = [
            {"symbol": "BTC", "price": "45000", "change": "+5%"},
            {"symbol": "ETH", "price": "2500", "change": "+3%"},
        ]

        varied_content = ContentVariation.vary_list_format(items)
        print(f"\nVaried content:\n{varied_content}")

        # Mention rate limiter example
        mention_limiter = MentionRateLimiter(
            cooldown_seconds=3600,
            bot_handle="@mybot",
        )

        # Cache display names (from X API)
        mention_limiter.cache_display_name("bankrbot", "Bankr")
        mention_limiter.cache_display_name("virtuals_io", "Virtuals Protocol")

        # First mention — allowed
        text1 = mention_limiter.process("Check out @bankrbot for trading!")
        print(f"\nFirst mention: {text1}")
        # -> "Check out @bankrbot for trading!"

        # Second mention within cooldown — replaced with display name
        text2 = mention_limiter.process("Also try @bankrbot for swaps!")
        print(f"Second mention: {text2}")
        # -> "Also try Bankr for swaps!"

    asyncio.run(example())
