#!/usr/bin/env python3
"""
Sentiment Arbitrage v2.5 — USD-Based, Batched, Limit-Order Only
================================================================
Fully automated trading based on social sentiment divergence from price action.

v2.5 Features:
- Batched prompts (max 3 per cycle): wallet sync, sentiment, TA
- USD-only position tracking (never token amounts)
- Limit orders only (no market buys)
- Smart re-entries after sells
- BNKR $50 minimum reserve enforced
- ROBUST PARSING: Handles malformed AI responses gracefully

Author: CardShark 🦈
"""

import os
import sys
import json
import time
import logging
import requests
import re
import statistics
from datetime import datetime, timedelta
from pathlib import Path
from dataclasses import dataclass, asdict, field
from typing import Optional, Dict, List, Any, Tuple

# ============================================================================
# CONFIGURATION
# ============================================================================

SCRIPT_DIR = Path(__file__).parent
CONFIG_PATH = SCRIPT_DIR / "config.json"
DATA_DIR = SCRIPT_DIR / "data"
LOG_DIR = SCRIPT_DIR / "logs"

# Ensure directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
LOG_DIR.mkdir(parents=True, exist_ok=True)

# Load config
with open(CONFIG_PATH) as f:
    CONFIG = json.load(f)

# API Key - load from environment variable for security
BANKR_API_KEY = os.environ.get("BANKRBOT_API_KEY", "")
if not BANKR_API_KEY:
    raise ValueError("BANKRBOT_API_KEY environment variable not set. Get your key at https://bankr.bot")
BANKR_URL = CONFIG["api"]["bankr_url"]

# ============================================================================
# LOGGING SETUP
# ============================================================================

log_file = LOG_DIR / f"sentiment_{datetime.now().strftime('%Y%m%d')}.log"
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ============================================================================
# ERROR COLLECTION FOR TELEGRAM REPORTING
# ============================================================================

cycle_errors: List[str] = []

def clear_errors():
    """Clear error list at start of cycle."""
    global cycle_errors
    cycle_errors = []

def add_error(msg: str):
    """Add error to collection for Telegram reporting."""
    global cycle_errors
    cycle_errors.append(msg)
    logger.error(msg)

def get_errors_html() -> str:
    """Format errors for Telegram HTML message."""
    if not cycle_errors:
        return ""
    return "\n⚠️ <b>ERRORS:</b>\n" + "\n".join([f"• {e}" for e in cycle_errors[:5]])

# ============================================================================
# SAFE PARSING HELPERS
# ============================================================================

def safe_float(value: Any, default: float = 0.0) -> float:
    """
    Safely convert a value to float, returning default on any error.
    Handles strings like '.', empty strings, None, etc.
    """
    if value is None:
        return default
    try:
        # Handle string cleaning
        if isinstance(value, str):
            value = value.strip().replace(',', '').replace('$', '')
            if value == '' or value == '.':
                return default
        return float(value)
    except (ValueError, TypeError):
        return default

def extract_json_block(text: str) -> Optional[Dict]:
    """
    Extract JSON block from text. Looks for ```json ... ``` or { ... }.
    Returns parsed dict or None.
    """
    if not text:
        return None
    
    # Try ```json ... ``` format
    json_match = re.search(r'```json\s*(.*?)\s*```', text, re.DOTALL | re.IGNORECASE)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass
    
    # Try ``` ... ``` format (without json label)
    json_match = re.search(r'```\s*(\{.*\})\s*```', text, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass
    
    # Try raw JSON object
    json_match = re.search(r'(\{.*\})', text, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass
    
    return None

# ============================================================================
# DATA CLASSES (USD-BASED)
# ============================================================================

@dataclass
class Position:
    """USD-based position tracking."""
    token: str
    usdc_value: float           # Current USD value
    entry_price: float          # Entry price for P&L calc
    entry_time: str             # ISO timestamp
    stop_loss_price: float = 0  # Stop-loss trigger price
    take_profit_price: float = 0  # Take-profit trigger price

@dataclass
class SentimentResult:
    """Batch sentiment result for a token."""
    token: str
    score: float                # -100 to +100
    direction: str              # bullish, bearish, neutral
    change_vs_1h: float         # % change vs 1h trailing avg
    change_vs_4h: float         # % change vs 4h trailing avg

@dataclass
class TAResult:
    """Batch TA result for a token."""
    token: str
    current_price: float
    support_levels: List[float]
    resistance_levels: List[float]
    rsi: float
    trend: str                  # up, down, sideways
    outlook: str                # bullish, bearish, neutral
    raw_response: str           # Full TA response for logging

@dataclass
class LimitOrder:
    """Pending limit order."""
    order_id: str
    token: str
    side: str                   # buy, sell
    price: float
    usd_amount: float
    created_at: str
    status: str = "pending"     # pending, filled, cancelled

# ============================================================================
# BANKR API FUNCTIONS WITH RETRY LOGIC
# ============================================================================

def bankr_submit_prompt(prompt: str) -> Optional[str]:
    """Submit prompt to Bankr API and return job ID."""
    url = f"{BANKR_URL}/agent/prompt"
    headers = {
        "Authorization": f"Bearer {BANKR_API_KEY}",
        "Content-Type": "application/json"
    }
    
    for attempt in range(CONFIG["api"]["retry_attempts"]):
        try:
            response = requests.post(
                url, 
                headers=headers, 
                json={"prompt": prompt}, 
                timeout=30
            )
            
            try:
                data = response.json()
            except:
                data = {}
            
            if data.get("success") and data.get("jobId"):
                logger.info(f"Submitted prompt, jobId: {data['jobId']}")
                return data["jobId"]
            elif data.get("error"):
                logger.warning(f"Bankr API error: {data.get('error')}")
                
        except Exception as e:
            logger.warning(f"Bankr API request error (attempt {attempt+1}): {e}")
        
        if attempt < CONFIG["api"]["retry_attempts"] - 1:
            time.sleep(CONFIG["api"]["retry_delay_seconds"])
    
    return None

def bankr_poll_job(job_id: str) -> Optional[Dict]:
    """Poll Bankr job until completion."""
    url = f"{BANKR_URL}/agent/job/{job_id}"
    headers = {
        "Authorization": f"Bearer {BANKR_API_KEY}",
        "Content-Type": "application/json"
    }
    
    # INCREASED: Use batch_max_poll_attempts from config (now 240) for longer wait
    max_attempts = CONFIG["api"].get("batch_max_poll_attempts", 240)
    poll_interval = CONFIG["api"].get("poll_interval_seconds", 5)
    
    logger.info(f"Polling job {job_id} (max {max_attempts} attempts, {poll_interval}s interval)...")
    
    for attempt in range(max_attempts):
        try:
            response = requests.get(url, headers=headers, timeout=30)
            
            try:
                data = response.json()
            except:
                time.sleep(CONFIG["api"]["poll_interval_seconds"])
                continue
            
            status = data.get("status", "unknown")
            
            if status == "completed":
                logger.info(f"Job {job_id} completed after {attempt} attempts")
                return data
            elif status == "failed":
                logger.error(f"Job {job_id} failed: {data.get('error')}")
                return None
            else:
                # Log progress every 20 attempts so we know it's still polling
                if attempt % 20 == 0 and attempt > 0:
                    logger.info(f"Still polling job {job_id}... (attempt {attempt}/{max_attempts})")
                time.sleep(poll_interval)
                
        except requests.RequestException as e:
            logger.warning(f"Poll error: {e}")
            time.sleep(CONFIG["api"]["poll_interval_seconds"])
    
    logger.error(f"Job {job_id} timed out after {max_attempts} attempts ({max_attempts * poll_interval}s total wait)")
    return None

def bankr_query(prompt: str) -> Optional[str]:
    """
    Submit prompt and wait for response — PATIENT VERSION.
    
    DESIGN: One submission, long patience, no retries.
    - Submits job once
    - Polls for up to 10 minutes (600s) 
    - Accepts ANY response (no length checks)
    - Total: 1 API call per query
    
    This reduces Bankr calls from 4-6 per cycle to exactly 3.
    """
    job_id = bankr_submit_prompt(prompt)
    if not job_id:
        add_error("bankr_query: Failed to submit prompt")
        return None
    
    # Poll with EXTREME patience — up to 10 minutes
    result = bankr_poll_job_long(job_id)
    
    if result and result.get("status") == "completed":
        response = result.get("response", "")
        # ACCEPT ANY RESPONSE — no length checks, no retries
        # Bankr knows best how long the response should be
        return response
    else:
        add_error(f"bankr_query: Job {job_id} did not complete")
        return None

def bankr_poll_job_long(job_id: str) -> Optional[Dict]:
    """
    Poll Bankr job with EXTREME patience — up to 10 minutes.
    Logs progress every minute so you know it's alive.
    """
    url = f"{BANKR_URL}/agent/job/{job_id}"
    headers = {
        "Authorization": f"Bearer {BANKR_API_KEY}",
        "Content-Type": "application/json"
    }
    
    # ULTRA MINIMAL POLLING: 60s intervals, 15 attempts max = 15 minutes wait, 15 requests max
    max_attempts = CONFIG["api"].get("batch_max_poll_attempts", 15)
    poll_interval = CONFIG["api"].get("batch_poll_interval_seconds", 60)
    
    logger.info(f"⏳ POLLING: Job {job_id} (max {max_attempts} attempts, {poll_interval}s interval, {max_attempts * poll_interval//60}m max wait)...")
    
    for attempt in range(max_attempts):
        try:
            response = requests.get(url, headers=headers, timeout=60)
            
            try:
                data = response.json()
            except:
                time.sleep(poll_interval)
                continue
            
            status = data.get("status", "unknown")
            
            if status == "completed":
                logger.info(f"✅ Job {job_id} completed after {attempt + 1} attempts (~{(attempt + 1) * poll_interval//60}m)")
                return data
            elif status == "failed":
                logger.error(f"❌ Job {job_id} failed: {data.get('error')}")
                return None
            else:
                # Log every 2 minutes
                if attempt % 2 == 0 and attempt > 0:
                    minutes = (attempt * poll_interval) // 60
                    logger.info(f"⏳ Waiting for job {job_id}... ({minutes}m elapsed)")
                time.sleep(poll_interval)
                
        except requests.RequestException as e:
            logger.warning(f"Poll error: {e}")
            time.sleep(poll_interval)
    
    logger.error(f"⏰ Job {job_id} timed out after {max_attempts} attempts ({max_attempts * poll_interval//60}m)")
    return None

# ============================================================================
# BATCH PROMPT #1: WALLET SYNC (USD VALUES)
# ============================================================================

def batch_get_wallet_balances() -> Dict[str, float]:
    """
    BATCH PROMPT 1: Get all balances in one query.
    Returns dict: {"USDC": X, "BNKR": Y, "DEGEN": Z, "DRB": W}
    All values in USD.
    """
    prompt = """What are my current holdings on Base in USD value?
Please provide the USD value for each:
1. USDC balance
2. BNKR holdings (USD value)
3. DEGEN holdings (USD value)
4. DRB holdings (USD value)

Format each as: TOKEN: $X.XX"""
    
    logger.info("📊 BATCH #1: Fetching all wallet balances (USD)...")
    response = bankr_query(prompt)
    
    if not response:
        add_error("Failed to get wallet balances")
        return {}
    
    logger.info(f"Wallet response: {response[:500]}")
    
    # Parse response
    balances = {"USDC": 0, "BNKR": 0, "DEGEN": 0, "DRB": 0}
    
    for token in balances.keys():
        # Look for patterns like "BNKR: $50.00" or "BNKR holdings: $50" or "$50 BNKR"
        patterns = [
            rf'{token}[:\s]+\$?([\d,]+\.?\d*)',
            rf'\$?([\d,]+\.?\d*)\s*(?:USD\s+)?{token}',
            rf'{token}[^$]*\$?([\d,]+\.?\d*)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, response, re.IGNORECASE)
            if match:
                try:
                    value = float(match.group(1).replace(',', ''))
                    balances[token] = value
                    break
                except ValueError:
                    continue
        
        # Check for zero/no balance
        if balances[token] == 0:
            if re.search(rf'0\s*{token}|no\s+{token}|{token}[:\s]+\$?0', response, re.IGNORECASE):
                balances[token] = 0
    
    logger.info(f"💰 Balances: USDC=${balances['USDC']:.2f}, BNKR=${balances['BNKR']:.2f}, DEGEN=${balances['DEGEN']:.2f}, DRB=${balances['DRB']:.2f}")
    return balances

# ============================================================================
# BATCH PROMPT #2: SENTIMENT ANALYSIS (ROBUST)
# ============================================================================

def batch_get_sentiment() -> Dict[str, SentimentResult]:
    """
    BATCH PROMPT 2: Get sentiment for all tokens in one query.
    Returns dict of SentimentResult by token.
    IMPROVED: More robust parsing with safe_float.
    """
    prompt = """Analyze current social sentiment for these Base tokens:
1. BNKR (Bankr)
2. DEGEN
3. DRB

For each token, provide:
- Sentiment score (-100 to +100)
- Direction (bullish/bearish/neutral)
- Change vs 1h average (%)
- Change vs 4h average (%)

Format:
BNKR: score=X, direction=Y, 1h_change=Z%, 4h_change=W%
DEGEN: score=X, direction=Y, 1h_change=Z%, 4h_change=W%
DRB: score=X, direction=Y, 1h_change=Z%, 4h_change=W%"""
    
    logger.info("📊 BATCH #2: Fetching sentiment for all tokens...")
    response = bankr_query(prompt)
    
    if not response:
        add_error("Failed to get batch sentiment")
        return {}
    
    logger.info(f"Sentiment response: {response[:800]}")
    
    # Parse response
    results = {}
    
    for token in ["BNKR", "DEGEN", "DRB"]:
        result = SentimentResult(
            token=token,
            score=0,
            direction="neutral",
            change_vs_1h=0,
            change_vs_4h=0
        )
        
        # Find token section - improved regex to handle multiline
        token_pattern = rf'{token}[:\s]+([^\n]+(?:\n[^\n]+)?)'
        token_section = re.search(token_pattern, response, re.IGNORECASE)
        
        if token_section:
            section = token_section.group(1)
            
            # Extract score with safe_float
            score_match = re.search(r'score[=:\s]+([+-]?\d+(?:\.\d+)?)', section, re.IGNORECASE)
            result.score = safe_float(score_match.group(1) if score_match else None, 0.0)
            
            # Extract direction
            if "bullish" in section.lower():
                result.direction = "bullish"
                if result.score == 0:
                    result.score = 50
            elif "bearish" in section.lower():
                result.direction = "bearish"
                if result.score == 0:
                    result.score = -50
            
            # Extract % changes with safe_float
            changes = re.findall(r'([+-]?\d+(?:\.\d+)?)\s*%', section)
            if len(changes) >= 1:
                result.change_vs_1h = safe_float(changes[0], 0.0)
            if len(changes) >= 2:
                result.change_vs_4h = safe_float(changes[1], 0.0)
        
        results[token] = result
        logger.info(f"  {token}: score={result.score}, direction={result.direction}, 1h={result.change_vs_1h}%, 4h={result.change_vs_4h}%")
    
    return results

# ============================================================================
# BATCH PROMPT #3: TECHNICAL ANALYSIS (ROBUST WITH JSON)
# ============================================================================

def batch_get_ta() -> Dict[str, TAResult]:
    """
    BATCH PROMPT 3: Get technical analysis for all tokens in one query.
    Returns dict of TAResult by token.
    
    IMPROVED: 
    - Forces JSON format in prompt
    - Tries JSON extraction first, falls back to regex
    - Uses safe_float for all numeric parsing
    - Logs raw response on any parsing issues
    """
    prompt = """Technical analysis for these Base tokens:
1. BNKR
2. DEGEN
3. DRB

IMPORTANT: First provide a JSON block exactly in this format:
```json
{
  "BNKR": {
    "current_price": 0.000357,
    "support_levels": [0.00035, 0.00028],
    "resistance_levels": [0.00046, 0.00058],
    "rsi": 55,
    "trend": "bullish pullback"
  },
  "DEGEN": {
    "current_price": 0.045,
    "support_levels": [0.042, 0.038],
    "resistance_levels": [0.048, 0.052],
    "rsi": 48,
    "trend": "sideways"
  },
  "DRB": {
    "current_price": 0.000012,
    "support_levels": [0.000011, 0.000009],
    "resistance_levels": [0.000014, 0.000018],
    "rsi": 62,
    "trend": "uptrend"
  }
}
```

Then provide your free-form analysis below the JSON block.

For each token, include:
- Current price (numeric)
- Key support levels (up to 3 numbers)
- Key resistance levels (up to 3 numbers)
- RSI (0-100)
- Trend description (up/down/sideways/bullish pullback/etc)
- Short-term outlook (bullish/bearish/neutral)"""
    
    logger.info("📊 BATCH #3: Fetching TA for all tokens...")
    response = bankr_query(prompt)
    
    if not response:
        add_error("Failed to get batch TA")
        return {}
    
    # Log full TA response for debugging
    logger.info(f"📈 FULL TA RESPONSE:\n{response}")
    
    # Try to extract JSON block first
    json_data = extract_json_block(response)
    
    # Parse response for each token
    results = {}
    
    for token in ["BNKR", "DEGEN", "DRB"]:
        result = TAResult(
            token=token,
            current_price=0.0,
            support_levels=[],
            resistance_levels=[],
            rsi=50.0,
            trend="sideways",
            outlook="neutral",
            raw_response=response
        )
        
        parsing_issues = []
        
        # Try JSON data first if available
        if json_data and token in json_data:
            token_data = json_data[token]
            
            # Extract from JSON with safe_float
            result.current_price = safe_float(token_data.get("current_price"), 0.0)
            result.rsi = safe_float(token_data.get("rsi"), 50.0)
            result.trend = token_data.get("trend", "sideways")
            
            # Handle lists safely
            supports = token_data.get("support_levels", [])
            if isinstance(supports, list):
                result.support_levels = [safe_float(s, 0.0) for s in supports[:3] if s]
            
            resists = token_data.get("resistance_levels", [])
            if isinstance(resists, list):
                result.resistance_levels = [safe_float(r, 0.0) for r in resists[:3] if r]
            
            # Extract outlook from trend if present
            trend_lower = result.trend.lower()
            if "bullish" in trend_lower or "up" in trend_lower:
                result.outlook = "bullish"
            elif "bearish" in trend_lower or "down" in trend_lower:
                result.outlook = "bearish"
        
        else:
            # FALLBACK: Regex parsing if JSON not available
            # Find token section (between this token and next, or end)
            next_tokens = [t for t in ["BNKR", "DEGEN", "DRB"] if t != token]
            token_pattern = rf'{token}[:\s\n]+(.+?)(?=(?:{"|".join(next_tokens)})[:\s\n]|$)'
            token_section = re.search(token_pattern, response, re.IGNORECASE | re.DOTALL)
            
            if token_section:
                section = token_section.group(1)
                
                # Extract current price - try multiple patterns
                price_patterns = [
                    r'(?:price|current)[\s:]+\$?([\d.]+)',
                    r'"current_price":\s*([\d.]+)',
                    r'\$([\d.]+)',
                ]
                for pattern in price_patterns:
                    price_match = re.search(pattern, section, re.IGNORECASE)
                    if price_match:
                        result.current_price = safe_float(price_match.group(1), 0.0)
                        if result.current_price == 0:
                            parsing_issues.append("price extraction failed")
                        break
                
                # Extract support levels - robust pattern matching
                support_patterns = [
                    r'support[s]?[\s:]+([^\n]+)',
                    r'"support_levels":\s*\[([^\]]+)\]',
                ]
                for pattern in support_patterns:
                    support_match = re.search(pattern, section, re.IGNORECASE)
                    if support_match:
                        supports_text = support_match.group(1)
                        # Extract all numbers
                        supports = re.findall(r'\$?([\d.]+)', supports_text)
                        result.support_levels = [safe_float(s, 0.0) for s in supports[:3] if s and s != '.']
                        break
                
                # Extract resistance levels
                resist_patterns = [
                    r'resistance[s]?[\s:]+([^\n]+)',
                    r'"resistance_levels":\s*\[([^\]]+)\]',
                ]
                for pattern in resist_patterns:
                    resist_match = re.search(pattern, section, re.IGNORECASE)
                    if resist_match:
                        resists_text = resist_match.group(1)
                        resists = re.findall(r'\$?([\d.]+)', resists_text)
                        result.resistance_levels = [safe_float(r, 0.0) for r in resists[:3] if r and r != '.']
                        break
                
                # Extract RSI
                rsi_match = re.search(r'RSI[\s:]+(\d+(?:\.\d+)?)', section, re.IGNORECASE)
                if rsi_match:
                    result.rsi = safe_float(rsi_match.group(1), 50.0)
                else:
                    # Try JSON format
                    rsi_match = re.search(r'"rsi":\s*(\d+(?:\.\d+)?)', section, re.IGNORECASE)
                    if rsi_match:
                        result.rsi = safe_float(rsi_match.group(1), 50.0)
                
                # Extract trend
                if re.search(r'trend[\s:]+up|uptrend|trending up|bullish', section, re.IGNORECASE):
                    result.trend = "up"
                    result.outlook = "bullish"
                elif re.search(r'trend[\s:]+down|downtrend|trending down|bearish', section, re.IGNORECASE):
                    result.trend = "down"
                    result.outlook = "bearish"
                
                # Override outlook if explicitly stated
                if "bullish" in section.lower():
                    result.outlook = "bullish"
                elif "bearish" in section.lower():
                    result.outlook = "bearish"
            else:
                parsing_issues.append(f"Could not find section for {token}")
        
        # Log any parsing issues with raw response
        if parsing_issues or result.current_price == 0:
            add_error(f"TA parsing issues for {token}: {', '.join(parsing_issues) if parsing_issues else 'price=0'}")
            logger.warning(f"Raw TA section for {token}:\n{response[:2000]}")
        
        results[token] = result
        logger.info(f"  {token}: price=${result.current_price}, supports={result.support_levels}, RSI={result.rsi}, trend={result.trend}")
    
    return results

# ============================================================================
# POSITION MANAGEMENT (USD-BASED)
# ============================================================================

def load_positions() -> Dict[str, Position]:
    """Load current positions from file (handles old schema migration)."""
    positions_file = DATA_DIR / "positions.json"
    
    if positions_file.exists():
        with open(positions_file) as f:
            data = json.load(f)
            
            positions = {}
            for k, v in data.items():
                # Handle old schema migration (remove 'amount', 'stop_loss', 'take_profit' if present)
                cleaned = {
                    "token": v.get("token", k),
                    "usdc_value": v.get("usdc_value", 0),
                    "entry_price": v.get("entry_price", 0),
                    "entry_time": v.get("entry_time", datetime.now().isoformat()),
                    "stop_loss_price": v.get("stop_loss_price", v.get("stop_loss", 0)),
                    "take_profit_price": v.get("take_profit_price", v.get("take_profit", 0))
                }
                positions[k] = Position(**cleaned)
            return positions
    return {}

def save_positions(positions: Dict[str, Position]):
    """Save positions to file."""
    positions_file = DATA_DIR / "positions.json"
    
    with open(positions_file, 'w') as f:
        json.dump({k: asdict(v) for k, v in positions.items()}, f, indent=2)

def sync_positions_with_wallet(balances: Dict[str, float]) -> Dict[str, Position]:
    """
    Sync tracked positions with actual wallet USD values.
    Removes phantom positions, updates real ones.
    """
    positions = load_positions()
    
    logger.info("🔄 Syncing positions with wallet...")
    
    for token in ["BNKR", "DEGEN", "DRB"]:
        actual_value = balances.get(token, 0)
        tracked = positions.get(token)
        
        if actual_value == 0 or actual_value < 1:  # Less than $1 = no position
            if token in positions:
                logger.info(f"🗑️ Removing {token} — wallet shows ${actual_value:.2f}")
                del positions[token]
        elif tracked:
            # Update existing position
            old_value = tracked.usdc_value
            tracked.usdc_value = actual_value
            positions[token] = tracked
            if abs(old_value - actual_value) > 1:
                logger.info(f"🔄 Updated {token}: ${old_value:.2f} → ${actual_value:.2f}")
        else:
            # New position from wallet
            logger.info(f"➕ New position {token}: ${actual_value:.2f}")
            positions[token] = Position(
                token=token,
                usdc_value=actual_value,
                entry_price=0,  # Unknown
                entry_time=datetime.now().isoformat()
            )
    
    save_positions(positions)
    return positions

# ============================================================================
# LIMIT ORDER MANAGEMENT
# ============================================================================

def load_pending_orders() -> List[LimitOrder]:
    """Load pending limit orders."""
    orders_file = DATA_DIR / "pending_orders.json"
    
    if orders_file.exists():
        with open(orders_file) as f:
            data = json.load(f)
            return [LimitOrder(**o) for o in data]
    return []

def save_pending_orders(orders: List[LimitOrder]):
    """Save pending orders."""
    orders_file = DATA_DIR / "pending_orders.json"
    
    with open(orders_file, 'w') as f:
        json.dump([asdict(o) for o in orders], f, indent=2)

def cancel_old_orders(token: str = None):
    """Cancel unfilled orders (optionally for specific token)."""
    orders = load_pending_orders()
    
    if not orders:
        return
    
    cancelled = []
    remaining = []
    
    for order in orders:
        if order.status == "pending" and (token is None or order.token == token):
            # Cancel via Bankr
            prompt = f"Cancel limit order for {order.token} at ${order.price:.6f}"
            logger.info(f"🚫 Cancelling order: {prompt}")
            bankr_query(prompt)
            order.status = "cancelled"
            cancelled.append(order)
        else:
            remaining.append(order)
    
    if cancelled:
        logger.info(f"🚫 Cancelled {len(cancelled)} orders")
    
    save_pending_orders(remaining)

# ============================================================================
# TRADING: LIMIT ORDER BUY (STAGGERED)
# ============================================================================

def execute_staggered_buy(token: str, allocation_usd: float, ta: TAResult) -> bool:
    """
    Place 3 staggered LIMIT BUY orders at TA SUPPORT LEVELS.
    Uses actual support levels from technical analysis (buy low).
    
    - 40% at support level 1 (closest to current price)
    - 30% at support level 2 (deeper support)
    - 30% at support level 3 (deepest support, if available)
    """
    logger.info(f"🎯 STAGGERED BUY for {token}: ${allocation_usd:.2f} total")
    
    if allocation_usd < 10:
        logger.warning(f"Allocation too small (${allocation_usd:.2f}), skipping")
        return False
    
    # Get support levels from TA - USE ACTUAL BANKR TA LEVELS
    if ta and ta.support_levels and len(ta.support_levels) >= 1:
        supports = ta.support_levels[:3]  # Take up to 3 supports
        # Pad with -5%/-10% if not enough supports
        current = ta.current_price if ta.current_price > 0 else supports[0] * 1.05
        while len(supports) < 3 and current > 0:
            supports.append(current * (0.95 - 0.05 * (len(supports) - 1)))
    else:
        # Fallback: use current price with -3%/-6% if no TA supports
        current_price = ta.current_price if ta and ta.current_price > 0 else 0
        if current_price <= 0:
            add_error(f"Cannot place buy for {token}: no price or supports available")
            return False
        supports = [current_price * 0.97, current_price * 0.94, current_price * 0.91]
    
    # Build order levels from supports (buy at support = buy low)
    levels = [
        (0.40, supports[0], f"support-1 ${supports[0]:.8f}"),
        (0.30, supports[1] if len(supports) > 1 else supports[0] * 0.97, f"support-2 ${supports[1]:.8f}" if len(supports) > 1 else "support-2"),
        (0.30, supports[2] if len(supports) > 2 else supports[0] * 0.94, f"support-3 ${supports[2]:.8f}" if len(supports) > 2 else "support-3")
    ]
    
    orders_placed = []
    
    for pct, price, label in levels:
        order_usd = allocation_usd * pct
        
        prompt = f"Place limit buy order for ${order_usd:.2f} of {token} on Base at ${price:.8f}"
        logger.info(f"  📥 Order {label}: ${order_usd:.2f} at ${price:.8f}")
        
        if CONFIG["trading"]["dry_run"]:
            logger.info(f"  [DRY RUN] Would place: {prompt}")
            order_id = f"dry_{token}_{label}_{int(time.time())}"
        else:
            response = bankr_query(prompt)
            if response and ("success" in response.lower() or "placed" in response.lower() or "order" in response.lower()):
                logger.info(f"  ✅ Order placed at {label}")
                order_id = f"{token}_{label}_{int(time.time())}"
            else:
                add_error(f"Order failed at {label}: {response[:200]}")
                continue
        
        orders_placed.append(LimitOrder(
            order_id=order_id,
            token=token,
            side="buy",
            price=price,
            usd_amount=order_usd,
            created_at=datetime.now().isoformat(),
            status="pending"
        ))
    
    # Save pending orders
    pending = load_pending_orders()
    pending.extend(orders_placed)
    save_pending_orders(pending)
    
    # Build support levels display
    supports_display = []
    for i, (pct, price, label) in enumerate(levels):
        order_usd = allocation_usd * pct
        supports_display.append(f"📥 {int(pct*100)}% (${order_usd:.2f}) at ${price:.8f} ({label})")
    
    # Notification showing ACTUAL TA SUPPORT LEVELS
    msg = f"""🎯 <b>STAGGERED BUY at SUPPORT — {token}</b>

Total Allocation: ${allocation_usd:.2f}
Orders Placed: {len(orders_placed)}

{chr(10).join(supports_display)}

Strategy: Buy low at Bankr's TA support levels! 🦈"""
    send_telegram(msg)
    
    return len(orders_placed) > 0

# ============================================================================
# TRADING: MARKET SELL + RE-ENTRY ORDERS
# ============================================================================

def execute_sell_with_reentry(token: str, position: Position, ta: TAResult, reason: str) -> bool:
    """
    1. Place STAGGERED LIMIT SELL orders at RESISTANCE LEVELS (sell high)
    2. When filled, place 3 staggered limit buy re-entries at SUPPORT LEVELS (buy low)
    
    Uses actual TA resistance/support levels from Bankr analysis.
    """
    sell_value = position.usdc_value
    
    # BNKR minimum reserve check
    min_reserve = CONFIG.get("minimum_reserves", {}).get(token, {}).get("min_usd_value", 0)
    
    if min_reserve > 0:
        if sell_value <= min_reserve:
            logger.warning(f"🚫 SELL BLOCKED: ${sell_value:.2f} <= ${min_reserve:.2f} minimum")
            msg = f"""🚫 <b>SELL BLOCKED — Minimum Reserve</b>

Token: {token}
Value: ${sell_value:.2f}
Minimum: ${min_reserve:.2f}

Keeping position for subscription payment."""
            send_telegram(msg)
            return False
        
        sell_value = sell_value - min_reserve
        logger.info(f"💎 Partial sell: ${sell_value:.2f} (keeping ${min_reserve:.2f})")
    
    if sell_value < 5:
        logger.warning(f"Sell amount too small (${sell_value:.2f})")
        return False
    
    # Get resistance levels from TA - SELL AT RESISTANCE (sell high)
    if ta and ta.resistance_levels and len(ta.resistance_levels) >= 1:
        resistances = ta.resistance_levels[:3]  # Take up to 3 resistance levels
        # Pad with +5%/+10% if not enough resistances
        current = ta.current_price if ta.current_price > 0 else resistances[0] * 0.95
        while len(resistances) < 3 and current > 0:
            resistances.append(current * (1.05 + 0.05 * (len(resistances) - 1)))
    else:
        # Fallback: use current price with +3%/+6% if no TA resistances
        current_price = ta.current_price if ta and ta.current_price > 0 else 0
        if current_price <= 0:
            add_error(f"Cannot place sell for {token}: no price or resistances available")
            return False
        resistances = [current_price * 1.03, current_price * 1.06, current_price * 1.09]
    
    # Place STAGGERED LIMIT SELL orders at resistance levels
    logger.info(f"🎯 STAGGERED SELL for {token}: ${sell_value:.2f} total at resistances: {resistances}")
    
    # Split sell value across 3 orders
    sell_levels = [
        (0.40, resistances[0], f"resistance-1 ${resistances[0]:.8f}"),
        (0.30, resistances[1] if len(resistances) > 1 else resistances[0] * 1.03, f"resistance-2 ${resistances[1]:.8f}" if len(resistances) > 1 else "resistance-2"),
        (0.30, resistances[2] if len(resistances) > 2 else resistances[0] * 1.06, f"resistance-3 ${resistances[2]:.8f}" if len(resistances) > 2 else "resistance-3")
    ]
    
    sell_orders_placed = []
    
    for pct, price, label in sell_levels:
        order_value = sell_value * pct
        
        prompt = f"Place limit sell order for ${order_value:.2f} worth of {token} on Base at ${price:.8f}"
        logger.info(f"  📤 Sell order {label}: ${order_value:.2f} at ${price:.8f}")
        
        if CONFIG["trading"]["dry_run"]:
            logger.info(f"  [DRY RUN] Would place: {prompt}")
            order_id = f"dry_sell_{token}_{int(time.time())}"
        else:
            response = bankr_query(prompt)
            if response and ("success" in response.lower() or "placed" in response.lower() or "order" in response.lower()):
                logger.info(f"  ✅ Sell order placed at {label}")
                order_id = f"sell_{token}_{int(time.time())}"
            else:
                add_error(f"Sell order failed at {label}: {response[:200]}")
                continue
        
        sell_orders_placed.append(LimitOrder(
            order_id=order_id,
            token=token,
            side="sell",
            price=price,
            usd_amount=order_value,
            created_at=datetime.now().isoformat(),
            status="pending"
        ))
    
    # Save pending sell orders
    pending = load_pending_orders()
    pending.extend(sell_orders_placed)
    save_pending_orders(pending)
    
    # Note: We don't update position yet — wait for orders to fill
    # In a real implementation, you'd check fills and update accordingly
    
    # Log the sell intent
    save_trade({
        "timestamp": datetime.now().isoformat(),
        "token": token,
        "action": "SELL_ORDERS_PLACED",
        "value_sell_planned_usd": sell_value,
        "value_kept_usd": min_reserve,
        "reason": reason,
        "resistance_levels": resistances[:3]
    })
    
    # Now place re-entry limit orders with 50% of proceeds
    reentry_amount = sell_value * 0.50
    
    if reentry_amount < 10:
        logger.info(f"Re-entry amount too small (${reentry_amount:.2f}), skipping")
        msg = f"""🦈 <b>SOLD {token}</b>

Sold: ${sell_value:.2f}
Kept: ${min_reserve:.2f}
Reason: {reason}

Re-entry skipped (amount too small)."""
        send_telegram(msg)
        return True
    
    # Get support levels for re-entry
    if ta and ta.support_levels:
        # Use TA support levels
        supports = ta.support_levels[:3]
        # Pad with -5%/-10%/-15% if not enough
        current = ta.current_price if ta.current_price > 0 else position.entry_price
        while len(supports) < 3 and current > 0:
            supports.append(current * (0.95 - 0.05 * len(supports)))
    else:
        # Default: -5%, -10%, -15% below current
        current = ta.current_price if ta and ta.current_price > 0 else position.entry_price
        supports = [current * 0.95, current * 0.90, current * 0.85]
    
    logger.info(f"🎯 RE-ENTRY: ${reentry_amount:.2f} at supports: {supports}")
    
    # Place re-entry orders (equal splits)
    order_size = reentry_amount / 3
    orders_placed = []
    
    for i, support in enumerate(supports):
        prompt = f"Place limit buy order for ${order_size:.2f} of {token} on Base at ${support:.8f}"
        logger.info(f"  📥 Re-entry {i+1}: ${order_size:.2f} at ${support:.8f}")
        
        if CONFIG["trading"]["dry_run"]:
            logger.info(f"  [DRY RUN] Would place: {prompt}")
            order_id = f"dry_reentry_{token}_{i}_{int(time.time())}"
        else:
            response = bankr_query(prompt)
            if response and ("success" in response.lower() or "placed" in response.lower()):
                logger.info(f"  ✅ Re-entry order {i+1} placed")
                order_id = f"reentry_{token}_{i}_{int(time.time())}"
            else:
                add_error(f"Re-entry order {i+1} failed: {response[:200]}")
                continue
        
        orders_placed.append(LimitOrder(
            order_id=order_id,
            token=token,
            side="buy",
            price=support,
            usd_amount=order_size,
            created_at=datetime.now().isoformat(),
            status="pending"
        ))
    
    # Save pending orders
    pending = load_pending_orders()
    pending.extend(orders_placed)
    save_pending_orders(pending)
    
    # Notification with both SELL (resistance) and RE-ENTRY (support) levels
    msg = f"""🦈 <b>STAGGERED SELL + RE-ENTRY — {token}</b>

📤 <b>SELL ORDERS at RESISTANCE ({len(sell_orders_placed)}):</b>
{chr(10).join([f"  • 40% at ${resistances[0]:.8f}"])}
{chr(10).join([f"  • 30% at ${resistances[1]:.8f}" if len(resistances) > 1 else ""])}
{chr(10).join([f"  • 30% at ${resistances[2]:.8f}" if len(resistances) > 2 else ""])}

🎯 <b>RE-ENTRY at SUPPORT ({len(orders_placed)}):</b>
{chr(10).join([f"  • ${order_size:.2f} at ${s:.8f}" for s in supports])}

💎 <b>Kept:</b> ${min_reserve:.2f}
📝 <b>Reason:</b> {reason}

Strategy: Sell high at resistance, buy low at support! 🦈"""
    send_telegram(msg)
    
    return True

# ============================================================================
# SIGNAL GENERATION (WITH SAFEGUARDS)
# ============================================================================

def generate_signal(
    token: str,
    sentiment: SentimentResult,
    ta: TAResult,
    position: Optional[Position]
) -> Tuple[str, str]:
    """
    Generate trading signal based on sentiment and TA.
    IMPROVED: Added safeguards for missing ta.current_price.
    Returns: (action, reason)
    """
    risk = CONFIG["risk_controls"]
    thresholds = CONFIG["sentiment_thresholds"]
    
    # Safeguard: if ta.current_price is 0 or missing, we can't calculate P&L
    # Treat as no position and skip stop-loss/take-profit checks
    price_available = ta.current_price > 0
    
    # Check stop-loss if we have a position and price is available
    if position and position.entry_price > 0 and price_available:
        price_change_pct = ((ta.current_price - position.entry_price) / position.entry_price) * 100
        
        # Stop-loss check
        if price_change_pct <= -risk["stop_loss_percent"]:
            return ("SELL", f"STOP-LOSS triggered at {price_change_pct:.1f}%")
        
        # Take-profit check
        if price_change_pct >= risk["take_profit_percent"]:
            return ("SELL", f"TAKE-PROFIT at {price_change_pct:.1f}%")
    elif position and position.entry_price > 0 and not price_available:
        # Log warning but don't crash
        logger.warning(f"Cannot check stop-loss for {token}: current_price unavailable")
    
    # Check for sentiment spike (BUY signal)
    sentiment_spike = abs(sentiment.change_vs_1h) >= thresholds["buy_spike_percent"]
    
    if sentiment_spike and sentiment.direction == "bullish":
        # Price hasn't moved much = opportunity
        # Safeguard: only buy if we have a valid price
        if price_available and position is None:
            return ("BUY", f"Sentiment spike +{sentiment.change_vs_1h:.1f}% (bullish)")
        elif not price_available and position is None:
            logger.warning(f"Skipping BUY for {token}: current_price unavailable")
    
    # Check for sentiment crash (SELL signal)
    if sentiment_spike and sentiment.direction == "bearish" and position:
        return ("SELL", f"Sentiment crash {sentiment.change_vs_1h:.1f}% (bearish)")
    
    return ("HOLD", "No signal")

# ============================================================================
# NOTIFICATIONS
# ============================================================================

def send_telegram(message: str):
    """Send notification via CardShark Trading Bot."""
    try:
        logger.info(f"📱 NOTIFICATION: {message}")
        
        # Write to file for pickup
        notif_file = SCRIPT_DIR / "notification.txt"
        with open(notif_file, 'w') as f:
            f.write(message)
        
        # Send via CardShark Trading Bot HTTP API
        import requests
        bot_token = "8551806643:AAE_3OLWZY9jH4vMLe8I_ZYg7oW4-cFGRoY"
        chat_id = "6166335177"
        
        # Parse HTML tags for Telegram
        msg = message.replace("<b>", "**").replace("</b>", "**")
        
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": msg,
            "parse_mode": "Markdown"
        }
        
        response = requests.post(url, json=payload, timeout=30)
        if response.status_code == 200:
            logger.info("✅ Telegram notification sent via bot")
        else:
            logger.error(f"Bot send failed: {response.status_code} {response.text}")
    except Exception as e:
        logger.error(f"Notification error: {e}")

# ============================================================================
# TRADE LOG
# ============================================================================

def load_trade_log() -> List[Dict]:
    """Load trade log."""
    log_file = DATA_DIR / "trades.json"
    if log_file.exists():
        with open(log_file) as f:
            return json.load(f)
    return []

def save_trade(trade: Dict):
    """Append trade to log."""
    trades = load_trade_log()
    trades.append(trade)
    
    log_file = DATA_DIR / "trades.json"
    with open(log_file, 'w') as f:
        json.dump(trades, f, indent=2)

# ============================================================================
# MAIN CYCLE (WITH ERROR HANDLING)
# ============================================================================

def run_cycle() -> Tuple[Dict[str, int], int]:
    """
    Run one cycle with max 3 batched prompts:
    1. Wallet sync (all balances)
    2. Batch sentiment
    3. Batch TA
    
    IMPROVED: Collects errors and always returns valid data even on partial failures.
    """
    global cycle_errors
    clear_errors()
    
    logger.info("=" * 60)
    logger.info("🦈 SENTIMENT ARBITRAGE v2.5 — CYCLE START")
    logger.info("=" * 60)
    
    actions = {"BUY": 0, "SELL": 0, "HOLD": 0}
    tokens_analyzed = 0
    
    # Cancel any old unfilled orders
    try:
        cancel_old_orders()
    except Exception as e:
        add_error(f"cancel_old_orders failed: {e}")
    
    # BATCH #1: Get all wallet balances
    balances = batch_get_wallet_balances()
    if not balances:
        add_error("Failed to get wallet balances, using empty balances")
        balances = {"USDC": 0, "BNKR": 0, "DEGEN": 0, "DRB": 0}
    
    usdc_balance = balances.get("USDC", 0)
    logger.info(f"💰 USDC Available: ${usdc_balance:.2f}")
    
    # Sync positions with wallet
    try:
        positions = sync_positions_with_wallet(balances)
    except Exception as e:
        add_error(f"sync_positions failed: {e}")
        positions = {}
    
    # Check daily trade limit
    try:
        trades_today = [t for t in load_trade_log() 
                       if datetime.fromisoformat(t["timestamp"]).date() == datetime.now().date()]
        
        if len(trades_today) >= CONFIG["risk_controls"]["max_daily_trades"]:
            add_error(f"Daily trade limit reached ({len(trades_today)})")
            return actions, 0
    except Exception as e:
        add_error(f"trade limit check failed: {e}")
    
    # BATCH #2: Get sentiment for all tokens
    sentiment_results = batch_get_sentiment()
    if not sentiment_results:
        add_error("Failed to get sentiment, using neutral defaults")
        sentiment_results = {
            t: SentimentResult(token=t, score=0, direction="neutral", change_vs_1h=0, change_vs_4h=0)
            for t in ["BNKR", "DEGEN", "DRB"]
        }
    
    # BATCH #3: Get TA for all tokens
    ta_results = batch_get_ta()
    if not ta_results:
        add_error("Failed to get TA, using empty defaults")
        ta_results = {
            t: TAResult(token=t, current_price=0, support_levels=[], resistance_levels=[], 
                       rsi=50, trend="sideways", outlook="neutral", raw_response="")
            for t in ["BNKR", "DEGEN", "DRB"]
        }
    
    # Process each token
    for token in ["BNKR", "DEGEN", "DRB"]:
        logger.info(f"\n--- Processing {token} ---")
        tokens_analyzed += 1
        
        sentiment = sentiment_results.get(token)
        ta = ta_results.get(token)
        position = positions.get(token)
        
        if not sentiment or not ta:
            add_error(f"Missing data for {token}")
            continue
        
        # Generate signal
        try:
            action, reason = generate_signal(token, sentiment, ta, position)
            logger.info(f"{token}: {action} — {reason}")
        except Exception as e:
            add_error(f"generate_signal failed for {token}: {e}")
            action, reason = "HOLD", "Error in signal generation"
        
        if action == "BUY":
            actions["BUY"] += 1
            
            # Calculate allocation (8% of free USDC)
            risk = CONFIG["risk_controls"]
            allocation = usdc_balance * (risk["max_position_percent"] / 100)
            
            if allocation >= 10 and ta.current_price > 0:
                try:
                    execute_staggered_buy(token, allocation, ta)  # PASS FULL TA OBJECT
                except Exception as e:
                    add_error(f"execute_staggered_buy failed for {token}: {e}")
            elif ta.current_price <= 0:
                add_error(f"Skipping BUY for {token}: invalid current_price")
        
        elif action == "SELL":
            actions["SELL"] += 1
            
            if position:
                try:
                    execute_sell_with_reentry(token, position, ta, reason)
                except Exception as e:
                    add_error(f"execute_sell_with_reentry failed for {token}: {e}")
        
        else:
            actions["HOLD"] += 1
        
        time.sleep(1)  # Small delay between tokens
    
    logger.info("\n" + "=" * 60)
    logger.info("🦈 CYCLE COMPLETE")
    logger.info(f"📊 Summary: BUY={actions['BUY']}, SELL={actions['SELL']}, HOLD={actions['HOLD']}")
    if cycle_errors:
        logger.info(f"⚠️ Errors: {len(cycle_errors)}")
    logger.info("=" * 60)
    
    return actions, tokens_analyzed

def main():
    """Main entry point with error handling."""
    global cycle_errors
    clear_errors()
    
    start_time = time.time()
    
    logger.info("🦈 Sentiment Arbitrage v2.5 — USD-Based, Batched, Limit-Only")
    logger.info(f"Config: {CONFIG_PATH}")
    logger.info(f"Dry Run: {CONFIG['trading']['dry_run']}")
    logger.info(f"Tokens: BNKR, DEGEN, DRB")
    
    # Run cycle with try/except to catch crashes
    actions = {"BUY": 0, "SELL": 0, "HOLD": 0}
    tokens_analyzed = 0
    
    try:
        actions, tokens_analyzed = run_cycle()
    except Exception as e:
        add_error(f"CRASH in run_cycle: {e}")
        logger.exception("Fatal error in run_cycle")
    
    # Calculate duration
    duration = time.time() - start_time
    
    logger.info(f"⏱️ Duration: {duration:.1f}s")
    
    # Send summary with errors included
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    errors_html = get_errors_html()
    
    msg = f"""🦈 <b>Sentiment Arbitrage v2.5 Complete</b>

⏰ {timestamp}
📊 Tokens: {tokens_analyzed}
🎯 BUY={actions['BUY']}, SELL={actions['SELL']}, HOLD={actions['HOLD']}
⏱️ Duration: {duration:.1f}s
📝 Prompts: 3 (batched){errors_html}"""
    
    send_telegram(msg)

if __name__ == "__main__":
    main()
