"""
guard.py — Shieldr v1.3.0
AI Security Engine for Bankr.bot — Anti-Prompt-Injection & Spending Policy

Bankr.bot integration:
    from guard import handle_command
    response = handle_command("/shieldr scan <input>", context={})

CLI:
    python3 guard.py --self-test
    python3 guard.py "scan SGVsbG8gV29ybGQ="
    python3 guard.py "decode 0x696e6a656374696f6e"

Detectors
─────────
  • Base64 (standard + URL-safe)          • Hex encoding (0x-prefixed + bare blobs)
  • Caesar / ROT-N cipher (chi-squared)   • Morse code
  • Invisible / zero-width unicode        • Zalgo / combining character abuse
  • High-entropy blob detection           • Prompt-injection keyword patterns
  • Intent verification (enhanced)

Confirmation flow
─────────────────
  When a scan returns MALICIOUS, execution is gated behind a human-confirmation
  prompt.  The operator must reply "/shieldr confirm" to proceed or
  "/shieldr cancel" to abort.  All confirmation events are logged at WARNING.

Spending policy
───────────────
  Per-transaction and daily USD limits are enforced before any transaction.
  An address allowlist can be configured to restrict recipients.
  All limits are live-adjustable via /shieldr set and /shieldr allowlist.
"""

from __future__ import annotations

import argparse
import base64
import logging
import math
import re
import sys
import unicodedata
from dataclasses import dataclass, field
from typing import Optional

__all__ = [
    "scan",
    "format_report",
    "auto_decode",
    "check_spending_policy",
    "dry_run_transaction",
    "handle_command",
    "ScanResult",
    "Finding",
    "PolicyViolation",
    "SKILL_VERSION",
    "__version__",
    "INJECTION_PATTERNS",
]

# ─────────────────────────────────────────────────────────────────────────────
# Logging  (caller configures handlers — NullHandler keeps us silent by default)
# ─────────────────────────────────────────────────────────────────────────────

logger = logging.getLogger("shieldr")
logger.addHandler(logging.NullHandler())

# ─────────────────────────────────────────────────────────────────────────────
# Metadata
# ─────────────────────────────────────────────────────────────────────────────

SKILL_NAME     = "shieldr"
SKILL_VERSION  = "1.3.0"
__version__    = SKILL_VERSION          # PEP 396 — importable as guard.__version__
COMMAND_PREFIX = "/shieldr"

# ─────────────────────────────────────────────────────────────────────────────
# Tunable thresholds
# ─────────────────────────────────────────────────────────────────────────────

# Shannon entropy (bits/symbol).  Natural English ≈ 4.0; random data > 6.0.
ENTROPY_THRESHOLD = 4.5

# Fraction of combining/diacritic chars required to flag Zalgo abuse.
INVISIBLE_CHAR_RATIO = 0.05

# Fraction of tokens that must be Morse symbols to trigger the Morse detector.
MORSE_TOKEN_RATIO = 0.60

# Inputs shorter than this are skipped for full analysis.
MIN_SCAN_LENGTH = 8

# ─────────────────────────────────────────────────────────────────────────────
# Spending policy  (live-adjustable via /shieldr set and /shieldr allowlist)
# ─────────────────────────────────────────────────────────────────────────────

_policy_single_limit: float  = 500.0
_policy_daily_limit:  float  = 2_000.0
_policy_allowlist:    set[str] = set()   # Empty = all recipient addresses permitted

# ─────────────────────────────────────────────────────────────────────────────
# Intent verifier — compiled regexes (module-level for performance)
# ─────────────────────────────────────────────────────────────────────────────

# Financial action verbs — broader than DeFi basics
_FINANCIAL_ACTION_RE = re.compile(
    r"\b(transfer|send|withdraw|move|approve|swap|bridge|stake|unstake|"
    r"claim|delegate|revoke|mint|burn|vote|liquidate|deposit|drain|"
    r"execute|disburse|pay\s*out|payout|flash\s*loan)\b",
    re.IGNORECASE,
)

# Explicit crypto / USD amount patterns — e.g. "5 ETH", "$1,000", "100 USDC"
_AMOUNT_RE = re.compile(
    r"(\$\s*[\d,]+(?:\.\d+)?"
    r"|\b[\d,]+(?:\.\d+)?\s*"
    r"(?:eth|btc|usdc|usdt|dai|matic|bnb|sol|ether|tokens?|coins?|wei|gwei)\b)",
    re.IGNORECASE,
)

# Urgency language — common in social-engineering / injection payloads
_URGENCY_RE = re.compile(
    r"\b(immediately|right\s+now|urgent(?:ly)?|asap|right\s+away|"
    r"without\s+delay|don['\"]?t\s+wait|no\s+delay|instantly|at\s+once|"
    r"do\s+it\s+now|do\s+this\s+now)\b",
    re.IGNORECASE,
)

# Ethereum-style address — 0x + 40 hex chars
_ETH_ADDR_RE = re.compile(r"\b0x[0-9a-fA-F]{40}\b")

# ─────────────────────────────────────────────────────────────────────────────
# Morse code reference table
# ─────────────────────────────────────────────────────────────────────────────

_MORSE: dict[str, str] = {
    ".-": "A",    "-...": "B",  "-.-.": "C",  "-..": "D",   ".": "E",
    "..-.": "F",  "--.": "G",   "....": "H",  "..": "I",    ".---": "J",
    "-.-": "K",   ".-..": "L",  "--": "M",    "-.": "N",    "---": "O",
    ".--.": "P",  "--.-": "Q",  ".-.": "R",   "...": "S",   "-": "T",
    "..-": "U",   "...-": "V",  ".--": "W",   "-..-": "X",  "-.--": "Y",
    "--..": "Z",
    "-----": "0", ".----": "1", "..---": "2", "...--": "3", "....-": "4",
    ".....": "5", "-....": "6", "--...": "7", "---..": "8", "----.": "9",
}

# ─────────────────────────────────────────────────────────────────────────────
# English letter frequency table  (chi-squared cipher fitness)
# ─────────────────────────────────────────────────────────────────────────────

_ENG_FREQ: dict[str, float] = {
    "a": 8.17,  "b": 1.49,  "c": 2.78,  "d": 4.25,  "e": 12.70, "f": 2.23,
    "g": 2.02,  "h": 6.09,  "i": 6.97,  "j": 0.15,  "k": 0.77,  "l": 4.03,
    "m": 2.41,  "n": 6.75,  "o": 7.51,  "p": 1.93,  "q": 0.10,  "r": 5.99,
    "s": 6.33,  "t": 9.06,  "u": 2.76,  "v": 0.98,  "w": 2.36,  "x": 0.15,
    "y": 1.97,  "z": 0.07,
}

# ─────────────────────────────────────────────────────────────────────────────
# Injection keyword patterns  (exported so tests can inspect / extend them)
# ─────────────────────────────────────────────────────────────────────────────

# Each entry: (regex_pattern, human_label, severity)
INJECTION_PATTERNS: list[tuple[str, str, str]] = [
    # Hard override / jailbreak triggers
    (r"\bjailbreak\b",
     "jailbreak attempt", "CRITICAL"),
    (r"\bdan\s+mode\b",
     "DAN mode activation", "CRITICAL"),
    (r"\bignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|context)\b",
     "instruction override", "CRITICAL"),
    (r"\bdisregard\s+(all\s+)?(previous|prior|above)\b",
     "instruction disregard", "CRITICAL"),
    (r"\bdecode\s+(this|the\s+following)\s*(and\s+)?(execute|run|follow|obey)\b",
     "encode-and-execute smuggling", "CRITICAL"),

    # Role / identity manipulation
    (r"\byou\s+are\s+now\s+(a|an)\b",
     "identity reassignment", "HIGH"),
    (r"\bact\s+as\s+(if\s+you\s+(are|were)\s+)?(a\s+|an\s+)?(?!user|assistant)",
     "role impersonation (act as)", "HIGH"),
    (r"\bpretend\s+(you\s+are|to\s+be)\b",
     "role impersonation (pretend)", "HIGH"),
    (r"\bnew\s+(system\s+)?prompt\b",
     "system prompt replacement", "HIGH"),
    (r"\byour\s+true\s+(self|purpose|identity)\b",
     "identity manipulation", "HIGH"),
    (r"\boverriding\s+(safety|restrictions?|guidelines?)\b",
     "safety override", "HIGH"),

    # Encoding-based smuggling hints
    (r"\bbase64\s+(encoded\s+)?(instruction|command|directive)\b",
     "base64-encoded instruction hint", "HIGH"),
    (r"\bdeveloper\s+mode\b",
     "developer mode activation", "HIGH"),

    # Context / prompt exfiltration
    (r"\bsend\s+(me\s+)?(your|the)\s+(system\s+)?prompt\b",
     "system prompt exfiltration", "HIGH"),
    (r"\brepeat\s+(everything|all)\s+(above|before|prior)\b",
     "context exfiltration", "HIGH"),
    (r"\bprint\s+your\s+(instructions?|system\s+prompt)\b",
     "instruction leak attempt", "HIGH"),
    (r"\bwhat\s+(are\s+)?your\s+(instructions?|rules?|guidelines?)\b",
     "instruction enumeration", "MEDIUM"),
]

# ─────────────────────────────────────────────────────────────────────────────
# Severity helpers
# ─────────────────────────────────────────────────────────────────────────────

_SEV_ORDER  = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]
_SEV_WEIGHT = {"CRITICAL": 40, "HIGH": 25, "MEDIUM": 12, "LOW": 5, "INFO": 0}
_SEV_EMOJI  = {
    "CRITICAL": "🚨",
    "HIGH":     "🔴",
    "MEDIUM":   "🟡",
    "LOW":      "🟢",
    "INFO":     "ℹ️ ",
}
_VERDICT_EMOJI = {
    "CLEAN":      "✅",
    "SUSPICIOUS": "⚠️ ",
    "MALICIOUS":  "🚫",
}


def _highest_severity(severities: list[str]) -> str:
    """Return the most severe label from a list."""
    for sev in _SEV_ORDER:
        if sev in severities:
            return sev
    return "MEDIUM"


# ─────────────────────────────────────────────────────────────────────────────
# Data model
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class Finding:
    """A single threat signal raised by a detector."""
    severity: str       # CRITICAL | HIGH | MEDIUM | LOW | INFO
    code: str           # Machine-readable tag
    detail: str         # Human-readable explanation
    decoded: str = ""   # Recovered plaintext (if any)


@dataclass
class ScanResult:
    """Aggregated output of a full security scan."""
    input_text: str
    findings: list[Finding]      = field(default_factory=list)
    risk_score: int               = 0
    verdict: str                  = "CLEAN"   # CLEAN | SUSPICIOUS | MALICIOUS
    decoded_payload: str          = ""
    requires_confirmation: bool   = False     # True when verdict == MALICIOUS

    def add(self, finding: Finding) -> None:
        self.findings.append(finding)

    def _compute(self) -> None:
        """Derive risk_score, verdict, and requires_confirmation from findings."""
        self.risk_score = min(
            100,
            sum(_SEV_WEIGHT.get(f.severity, 0) for f in self.findings),
        )
        if self.risk_score >= 60:
            self.verdict = "MALICIOUS"
            self.requires_confirmation = True
        elif self.risk_score >= 25:
            self.verdict = "SUSPICIOUS"
        else:
            self.verdict = "CLEAN"


@dataclass
class PolicyViolation:
    """A breach of the active spending policy."""
    rule: str
    detail: str


# ─────────────────────────────────────────────────────────────────────────────
# Encoding helpers
# ─────────────────────────────────────────────────────────────────────────────

def _rot_n(text: str, n: int) -> str:
    """Apply Caesar rotation N to all ASCII alphabetic characters."""
    out = []
    for ch in text:
        if "a" <= ch <= "z":
            out.append(chr((ord(ch) - ord("a") + n) % 26 + ord("a")))
        elif "A" <= ch <= "Z":
            out.append(chr((ord(ch) - ord("A") + n) % 26 + ord("A")))
        else:
            out.append(ch)
    return "".join(out)


def _chi_squared(text: str) -> float:
    """
    Chi-squared fitness score against the English letter frequency distribution.

    Lower = more English-like.
    Returns float('inf') for inputs with fewer than 12 alphabetic characters.
    """
    alpha = [c.lower() for c in text if c.isalpha()]
    if len(alpha) < 12:
        return float("inf")
    n = len(alpha)
    observed: dict[str, int] = {}
    for c in alpha:
        observed[c] = observed.get(c, 0) + 1
    return sum(
        ((observed.get(ch, 0) - _ENG_FREQ[ch] * n / 100) ** 2)
        / (_ENG_FREQ[ch] * n / 100)
        for ch in _ENG_FREQ
        if _ENG_FREQ[ch] * n / 100 > 0
    )


def _entropy(text: str) -> float:
    """Shannon entropy in bits per symbol."""
    if not text:
        return 0.0
    freq: dict[str, int] = {}
    for ch in text:
        freq[ch] = freq.get(ch, 0) + 1
    n = len(text)
    return -sum((c / n) * math.log2(c / n) for c in freq.values())


def _decode_b64(blob: str) -> Optional[str]:
    """
    Attempt Base64 decode (standard or URL-safe).
    Returns decoded UTF-8 string only when the result is sufficiently printable.
    """
    for altchars in (None, b"-_"):
        try:
            padded = blob + "=" * (-len(blob) % 4)
            raw = (
                base64.b64decode(padded, validate=True)
                if altchars is None
                else base64.b64decode(
                    padded.replace("-", "+").replace("_", "/"), validate=True
                )
            )
            text = raw.decode("utf-8", errors="replace")
            printable = sum(1 for c in text if c.isprintable()) / max(len(text), 1)
            if printable > 0.75 and len(text) >= 4:
                return text
        except Exception:
            pass
    return None


def _decode_hex(raw_hex: str) -> Optional[str]:
    """Attempt UTF-8 decode of a hex string.  Returns None on failure."""
    try:
        text = bytes.fromhex(raw_hex).decode("utf-8", errors="replace")
        printable = sum(1 for c in text if c.isprintable()) / max(len(text), 1)
        if printable > 0.75 and len(text) >= 3:
            return text
    except Exception:
        pass
    return None


def auto_decode(text: str) -> Optional[tuple[str, str]]:
    """
    Try all supported decoders against the given text.

    Returns:
        (encoding_name, decoded_text) on the first successful decode,
        or None if no encoding is recognised.
    """
    # Base64
    b64_re = re.compile(
        r"(?<![A-Za-z0-9+/\-_])([A-Za-z0-9+/\-_]{16,}={0,2})(?![A-Za-z0-9+/\-_=])"
    )
    for m in b64_re.finditer(text):
        decoded = _decode_b64(m.group(1))
        if decoded:
            return ("Base64", decoded)

    # 0x-prefixed hex
    for m in re.finditer(r"\b0x([0-9a-fA-F]{6,})\b", text):
        decoded = _decode_hex(m.group(1))
        if decoded:
            return ("Hex (0x)", decoded)

    # Bare hex blob
    for m in re.finditer(r"\b([0-9a-fA-F]{16,})\b", text):
        raw = m.group(1)
        if len(raw) % 2 != 0:
            continue
        if text[max(0, m.start() - 2) : m.start()] in ("0x", "0X"):
            continue
        decoded = _decode_hex(raw)
        if decoded:
            return ("Hex", decoded)

    # Morse code
    tokens = re.split(r"\s+", text.strip())
    morse_tokens = [t for t in tokens if re.fullmatch(r"[.\-]+", t)]
    if len(tokens) >= 4 and len(morse_tokens) / len(tokens) >= MORSE_TOKEN_RATIO:
        decoded = "".join(_MORSE.get(t, "?") for t in morse_tokens)
        return ("Morse", decoded)

    # Caesar / ROT-N  (requires ≥ 5 words for reliable chi-squared)
    words = re.findall(r"[A-Za-z]{3,}", text)
    if len(words) >= 5:
        candidate = " ".join(words)
        orig_chi2 = _chi_squared(candidate)
        for rot in range(1, 26):
            rotated = _rot_n(candidate, rot)
            chi2 = _chi_squared(rotated)
            if chi2 < orig_chi2 * 0.4 and orig_chi2 > 100 and chi2 < 35:
                name = "ROT13" if rot == 13 else f"ROT{rot}"
                return (name, rotated)

    return None


# ─────────────────────────────────────────────────────────────────────────────
# Detector functions
# ─────────────────────────────────────────────────────────────────────────────

def _detect_base64(text: str, result: ScanResult) -> None:
    """Detect Base64-encoded (standard + URL-safe) payloads."""
    seen: set[str] = set()
    pattern = re.compile(
        r"(?<![A-Za-z0-9+/\-_])([A-Za-z0-9+/\-_]{16,}={0,2})(?![A-Za-z0-9+/\-_=])"
    )
    for m in pattern.finditer(text):
        blob = m.group(1)
        if blob in seen:
            continue
        seen.add(blob)
        decoded = _decode_b64(blob)
        if decoded:
            snippet = decoded[:120] + ("…" if len(decoded) > 120 else "")
            result.add(Finding(
                severity="HIGH",
                code="BASE64_PAYLOAD",
                detail=f'Base64-encoded content detected. Decoded: "{snippet}"',
                decoded=decoded,
            ))
            if not result.decoded_payload:
                result.decoded_payload = decoded
            logger.info("BASE64_PAYLOAD detected (decoded_len=%d)", len(decoded))


def _detect_hex(text: str, result: ScanResult) -> None:
    """Detect hex-encoded payloads (0x-prefixed and bare blobs)."""
    # Exclude legitimate on-chain identifiers (ETH addresses and tx hashes)
    eth_addr_re = re.compile(r"^[0-9a-fA-F]{40}$")
    tx_hash_re  = re.compile(r"^[0-9a-fA-F]{64}$")
    seen: set[str] = set()

    for m in re.finditer(r"\b0x([0-9a-fA-F]{8,})\b", text):
        raw = m.group(1)
        if raw in seen or eth_addr_re.match(raw) or tx_hash_re.match(raw):
            continue
        seen.add(raw)
        decoded = _decode_hex(raw)
        if decoded:
            result.add(Finding(
                severity="HIGH",
                code="HEX_PAYLOAD",
                detail=f'Hex-encoded payload detected (0x-prefix). Decoded: "{decoded[:120]}"',
                decoded=decoded,
            ))
            if not result.decoded_payload:
                result.decoded_payload = decoded
            logger.info("HEX_PAYLOAD (0x) detected")

    for m in re.finditer(r"\b([0-9a-fA-F]{16,})\b", text):
        raw = m.group(1)
        if len(raw) % 2 != 0 or raw in seen:
            continue
        if eth_addr_re.match(raw) or tx_hash_re.match(raw):
            continue
        if text[max(0, m.start() - 2) : m.start()].lower() == "0x":
            continue
        seen.add(raw)
        decoded = _decode_hex(raw)
        if decoded:
            result.add(Finding(
                severity="MEDIUM",
                code="HEX_BLOB",
                detail=f'Bare hex blob detected. Decoded: "{decoded[:120]}"',
                decoded=decoded,
            ))
            if not result.decoded_payload:
                result.decoded_payload = decoded
            logger.info("HEX_BLOB detected")


def _detect_caesar(text: str, result: ScanResult) -> None:
    """
    Detect Caesar / ROT-N cipher encoding (ROT1–ROT25) via chi-squared fitness.

    Requires all three conditions to fire:
      1. At least 5 alphabetic words (sufficient material for chi-squared)
      2. Original text chi2 > 100  (input does not already look like English)
      3. Best rotation chi2 < 35 AND < 40 % of the original  (output IS English)
    """
    words = re.findall(r"[A-Za-z]{3,}", text)
    if len(words) < 5:
        return

    candidate = " ".join(words)
    orig_chi2 = _chi_squared(candidate)
    if orig_chi2 < 100:
        return   # Input already reads as English — skip

    best_rot, best_chi2, best_text = -1, orig_chi2, candidate
    for rot in range(1, 26):
        rotated = _rot_n(candidate, rot)
        chi2    = _chi_squared(rotated)
        if chi2 < best_chi2:
            best_chi2 = chi2
            best_rot  = rot
            best_text = rotated

    if best_rot == -1 or best_chi2 >= orig_chi2 * 0.4 or best_chi2 >= 35:
        return

    rot_name = "ROT13" if best_rot == 13 else f"ROT{best_rot} (Caesar cipher)"
    code     = "ROT13_OBFUSCATION" if best_rot == 13 else "CAESAR_CIPHER"
    severity = "HIGH" if best_rot == 13 else "MEDIUM"

    result.add(Finding(
        severity=severity,
        code=code,
        detail=f'{rot_name} obfuscation detected. Decoded: "{best_text[:120]}"',
        decoded=best_text,
    ))
    if not result.decoded_payload:
        result.decoded_payload = best_text
    logger.info("%s detected (rot=%d, chi2=%.1f)", code, best_rot, best_chi2)


def _detect_morse(text: str, result: ScanResult) -> None:
    """Detect Morse code sequences (dot/dash token streams)."""
    tokens       = re.split(r"\s+", text.strip())
    morse_tokens = [t for t in tokens if re.fullmatch(r"[.\-]+", t)]

    if len(tokens) < 4:
        return
    ratio = len(morse_tokens) / len(tokens)
    if ratio < MORSE_TOKEN_RATIO:
        return

    decoded = "".join(_MORSE.get(t, "?") for t in morse_tokens)
    result.add(Finding(
        severity="HIGH",
        code="MORSE_ENCODING",
     
