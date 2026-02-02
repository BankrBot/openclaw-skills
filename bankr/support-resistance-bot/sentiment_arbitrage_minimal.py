#!/usr/bin/env python3

import sys
import json
import logging
from datetime import datetime
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Load config
def load_config():
    config_path = Path(__file__).parent / "config.json"
    with open(config_path) as f:
        return json.load(f)

def acquire_lock():
    """Acquire lock to prevent overlapping runs."""
    lock_file = Path(__file__).parent / "data" / "cycle.lock"
    lock_file.parent.mkdir(parents=True, exist_ok=True)
    
    if lock_file.exists():
        logger.warning("Lock file exists. Another process might be running.")
        return False
    
    lock_file.write_text(datetime.now().isoformat())
    return True

def release_lock():
    """Release lock file."""
    lock_file = Path(__file__).parent / "data" / "cycle.lock"
    if lock_file.exists():
        lock_file.unlink()
        logger.info("Lock released")

def main():
    # Always use context manager to ensure lock is released
    try:
        # Attempt to acquire lock
        if not acquire_lock():
            logger.error("Could not acquire lock")
            return
        
        # Load config 
        config = load_config()
        
        # Get enabled tokens
        enabled_tokens = [tc["symbol"] for tc in config["target_tokens"] if tc["enabled"]]
        
        # Log tokens
        logger.info(f"Enabled tokens: {enabled_tokens}")
        
        # Do more processing here...
        
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
    finally:
        # Always release lock
        release_lock()

if __name__ == "__main__":
    main()