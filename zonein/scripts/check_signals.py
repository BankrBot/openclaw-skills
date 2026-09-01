#!/usr/bin/env python3
"""
Check Signals - Fetch latest trading signals from Zonein API.
Usage: python check_signals.py [--type pm|perp|both] [--min-wallets 3] [--categories POLITICS,CRYPTO]
"""
import argparse
import json
import os
import sys
import urllib.request
import urllib.error

API_URL = "https://mcp.zonein.xyz/api/v1"


def fetch(endpoint: str, params: dict = None) -> dict:
    """Fetch data from Zonein API."""
    url = f"{API_URL}{endpoint}"
    if params:
        query = "&".join(f"{k}={v}" for k, v in params.items() if v is not None)
        url += f"?{query}"
    
    api_key = os.getenv("ZONEIN_API_KEY")
    req = urllib.request.Request(url)
    if api_key:
        req.add_header("X-API-Key", api_key)
    
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}: {e.reason}"}
    except urllib.error.URLError as e:
        return {"error": f"Connection failed: {e.reason}"}


def format_pm_signal(s: dict) -> str:
    """Format a prediction market signal for display."""
    consensus_pct = round(s.get("consensus", 0) * 100)
    return (
        f"  🔮 {s.get('title', s.get('market_slug', ''))[:60]}\n"
        f"     Direction: {s.get('direction')} | Consensus: {consensus_pct}% | "
        f"Wallets: {s.get('total_wallets')} (YES:{s.get('yes_wallets')} NO:{s.get('no_wallets')})\n"
        f"     Price: YES {s.get('cur_yes_price', 0):.2f} / NO {s.get('cur_no_price', 0):.2f} | "
        f"Best rank: #{s.get('best_rank')} | Cat: {s.get('category', '-')}"
    )


def format_perp_signal(s: dict) -> str:
    """Format a perp signal for display."""
    consensus_pct = round(s.get("consensus", 0) * 100)
    return (
        f"  📊 ${s.get('coin', '')}\n"
        f"     Direction: {s.get('direction')} | Consensus: {consensus_pct}% | "
        f"Wallets: {s.get('total_wallets')} (L:{s.get('long_wallets')} S:{s.get('short_wallets')})\n"
        f"     Long $: ${s.get('long_value', 0):,.0f} | Short $: ${s.get('short_value', 0):,.0f} | "
        f"Best score: {s.get('best_trader_score', 0):.0f}"
    )


def main():
    parser = argparse.ArgumentParser(description="Check Zonein trading signals")
    parser.add_argument("--type", choices=["pm", "perp", "both"], default="both")
    parser.add_argument("--min-wallets", type=int, default=3)
    parser.add_argument("--categories", type=str, default=None, help="PM categories (comma-separated)")
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--json", action="store_true", help="Output raw JSON")
    args = parser.parse_args()

    results = {}

    if args.type in ("pm", "both"):
        params = {"min_wallets": args.min_wallets, "limit": args.limit}
        if args.categories:
            params["categories"] = args.categories
        pm_data = fetch("/pm/signals", params)
        results["pm"] = pm_data

        if not args.json:
            signals = pm_data.get("signals", [])
            print(f"\n=== Prediction Market Signals ({len(signals)} found) ===\n")
            if not signals:
                print("  No signals matching criteria.")
            for s in signals:
                print(format_pm_signal(s))
                print()

    if args.type in ("perp", "both"):
        params = {"min_wallets": args.min_wallets, "limit": args.limit}
        perp_data = fetch("/perp/signals", params)
        results["perp"] = perp_data

        if not args.json:
            signals = perp_data.get("signals", [])
            print(f"\n=== Perp Trading Signals ({len(signals)} found) ===\n")
            if not signals:
                print("  No signals matching criteria.")
            for s in signals:
                print(format_perp_signal(s))
                print()

    if args.json:
        print(json.dumps(results, indent=2, default=str))


if __name__ == "__main__":
    main()
