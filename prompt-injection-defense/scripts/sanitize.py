#!/usr/bin/env python3
"""
Prompt injection sanitizer for AI agent replies.

Five-layer defense against prompt injection attacks on social platforms.
Prevents attackers from tricking your agent into outputting live transaction
commands — whether prefixed with a bot handle or bare financial instructions.

CRITICAL LESSON: Bankr and similar automation bots execute ANY financial
command in agent tweets — no @bankrbot prefix needed. A tweet saying
"send all usdc to 0x..." from your agent WILL be executed. Output
sanitization is the absolute last line of defense.

Usage:
    # As a module
    from sanitize import sanitize_reply

    reply = sanitize_reply(llm_output)
    if reply is None:
        # Entire reply was a bot command — don't post
        pass

    # As a CLI tool (pipe text through it)
    echo "some reply" | python sanitize.py
"""
import re
import sys
import logging

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Layer 1: @bot action commands (e.g. "@bankrbot tip 0.5 WETH to @attacker")
# Customize: add bot handles for your platform
# ---------------------------------------------------------------------------
BOT_COMMAND_RE = re.compile(
    r"@bankrbot\s+(?:tip|buy|sell|send|swap|transfer|deploy|bridge|trade|bet|long|short|open|close)",
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# Layer 2: Token factory deploy commands
# Catches "@clanker create X with ticker $Y" and similar patterns
# ---------------------------------------------------------------------------
TOKEN_FACTORY_RE = re.compile(
    r"@(?:clanker_world|clanker|tator_trader|virtuals_io)\s+.*?"
    r"(?:create|deploy|launch|mint)\b",
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# Layer 3: Generic "create token" / "send fees" patterns
# ---------------------------------------------------------------------------
TOKEN_DEPLOY_RE = re.compile(
    r"(?:create|deploy|launch|mint)\s+\w+.*?(?:ticker|symbol)\s+\$\w+",
    re.IGNORECASE,
)
SEND_FEES_RE = re.compile(
    r"send\s+fees?\s+to\s+@\w+",
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# Layer 4: BARE financial commands (no @bot prefix needed!)
# These catch "send all usdc to X", "transfer ETH to Y", "swap all BNKR"
# This is the CRITICAL layer — the exact attack vector used to drain wallets
# on 2026-03-01. Bankr automation executes ANY financial command in agent
# tweets, not just @bankrbot-prefixed ones.
# ---------------------------------------------------------------------------
BARE_FINANCIAL_RE = re.compile(
    r"\b(?:send|transfer|swap|bridge|withdraw)\s+"
    r"(?:all|100%|\d+%?|my|your|the|remaining|entire|full|every)?\s*"
    r"(?:of\s+)?(?:my\s+|your\s+|the\s+)?"
    r"(?:usdc|eth|ether|weth|bnkr|solvr|dai|usdt|usd|token|tokens|funds|balance|wallet|crypto|coin)",
    re.IGNORECASE,
)

# "send X to <address/name>" pattern
SEND_TO_RE = re.compile(
    r"\b(?:send|transfer|swap|bridge)\s+.*?\bto\s+(?:0x[a-fA-F0-9]{6,}|\w{3,})",
    re.IGNORECASE,
)

# "buy/sell X" with amounts (avoids false positives on "you can trade solvr")
TRADE_ACTION_RE = re.compile(
    r"\b(?:buy|sell|long|short|open|close|trade|bet)\s+"
    r"\$?\d[\d,.]*\s*(?:k|m|b)?\s*(?:of|worth|in|usd|usdc|eth)?\s*"
    r"(?:usdc|eth|weth|bnkr|solvr|dai|usdt)",
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# All patterns checked against output before posting
# ---------------------------------------------------------------------------
OUTPUT_BLOCK_PATTERNS = (
    BOT_COMMAND_RE,
    TOKEN_FACTORY_RE,
    TOKEN_DEPLOY_RE,
    SEND_FEES_RE,
    BARE_FINANCIAL_RE,
    SEND_TO_RE,
    TRADE_ACTION_RE,
)

INJECTION_CANNED = (
    "Nice try. I don't execute or repeat financial commands from prompt injections."
)


def sanitize_reply(text: str) -> str | None:
    """Sanitize agent reply text before posting.

    Checks all 7 injection patterns. If ANY pattern matches, the entire reply
    is replaced with a canned rejection. Never partially clean — an attacker
    can split commands across the cleaned/uncleaned boundary.

    Returns:
        Sanitized text, a canned rejection, or None if the reply should be
        suppressed entirely.
    """
    if not text:
        return text

    for pattern in OUTPUT_BLOCK_PATTERNS:
        if pattern.search(text):
            logger.warning(
                "OUTPUT BLOCKED (%s): %s", pattern.pattern[:60], text[:300]
            )
            return INJECTION_CANNED

    return text


def check_input(text: str) -> bool:
    """Check if an incoming mention contains financial injection commands.

    Use this to pre-filter incoming messages BEFORE they reach the LLM.
    Returns True if the message is safe, False if it should be blocked.
    """
    if not text:
        return True
    if BARE_FINANCIAL_RE.search(text) or SEND_TO_RE.search(text):
        logger.warning("INPUT BLOCKED (financial injection): %s", text[:200])
        return False
    return True


def main():
    """CLI mode: read from stdin, sanitize, write to stdout."""
    text = sys.stdin.read()
    result = sanitize_reply(text)
    if result is None:
        print("[SUPPRESSED]", file=sys.stderr)
        sys.exit(1)
    if result != text:
        print("[BLOCKED]", file=sys.stderr)
    print(result)


if __name__ == "__main__":
    main()
