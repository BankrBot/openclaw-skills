#!/usr/bin/env python3
"""
Market Overview - Get a comprehensive snapshot of both PM and Perp markets.
Usage: python market_overview.py [--json]
"""
import json
import os
import sys
import urllib.request
import urllib.error

API_URL = "https://mcp.zonein.xyz/api/v1"


def fetch(endpoint: str) -> dict:
    url = f"{API_URL}{endpoint}"
    api_key = os.getenv("ZONEIN_API_KEY")
    req = urllib.request.Request(url)
    if api_key:
        req.add_header("X-API-Key", api_key)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        return {"error": str(e)}


def main():
    output_json = "--json" in sys.argv

    # Fetch all data
    pm_health = fetch("/pm/health")
    perp_health = fetch("/perp/health")
    pm_signals = fetch("/pm/signals?min_wallets=3&limit=5")
    perp_signals = fetch("/perp/signals?min_wallets=3&limit=5")
    perp_coins = fetch("/perp/coins")

    if output_json:
        print(json.dumps({
            "pm": {"stats": pm_health, "top_signals": pm_signals},
            "perp": {"stats": perp_health, "top_signals": perp_signals, "coins": perp_coins},
        }, indent=2, default=str))
        return

    # --- Prediction Market ---
    pm_stats = pm_health.get("data", {})
    print("\n" + "=" * 60)
    print("  ZONEIN MARKET OVERVIEW")
    print("=" * 60)

    print("\n--- Prediction Market (Polymarket) ---")
    print(f"  Total Users:    {pm_stats.get('total_users', '?')}")
    print(f"  Total Positions: {pm_stats.get('total_positions', '?')}")
    print(f"  Smart Bettors:  {pm_stats.get('smart_bettors', '?')}")

    pm_sigs = pm_signals.get("signals", [])
    if pm_sigs:
        print(f"\n  Top PM Signals ({len(pm_sigs)}):")
        for s in pm_sigs:
            c = round(s.get("consensus", 0) * 100)
            print(f"    {s.get('direction'):3s} {c}% ({s.get('total_wallets')}w) "
                  f"| {s.get('title', s.get('market_slug', ''))[:55]}")

    # --- Perp Trading ---
    perp_stats = perp_health.get("data", {})
    print("\n--- Perp Trading (HyperLiquid) ---")
    print(f"  Smart Money Wallets: {perp_stats.get('smart_money_wallets', '?')}")
    print(f"  With Positions:      {perp_stats.get('wallets_with_positions', '?')}")

    perp_sigs = perp_signals.get("signals", [])
    if perp_sigs:
        print(f"\n  Top Perp Signals ({len(perp_sigs)}):")
        for s in perp_sigs:
            c = round(s.get("consensus", 0) * 100)
            d = s.get("direction", "")
            icon = "🟢" if d == "LONG" else "🔴"
            print(f"    {icon} {d:5s} ${s.get('coin', ''):5s} {c}% "
                  f"({s.get('total_wallets')}w) | "
                  f"L:${s.get('long_value', 0):,.0f} S:${s.get('short_value', 0):,.0f}")

    # --- Coin Sentiment ---
    coins = perp_coins.get("coins", {})
    if coins:
        print(f"\n  Coin Sentiment (top 10 by wallet count):")
        sorted_coins = sorted(coins.items(), key=lambda x: x[1].get("wallet_count", 0), reverse=True)[:10]
        for coin, data in sorted_coins:
            lc = data.get("long_count", 0)
            sc = data.get("short_count", 0)
            total = lc + sc
            pct_long = round(lc / total * 100) if total > 0 else 50
            bar_len = 20
            long_bar = "█" * round(pct_long / 100 * bar_len)
            short_bar = "░" * (bar_len - len(long_bar))
            print(f"    {coin:5s} [{long_bar}{short_bar}] L:{lc} S:{sc} "
                  f"(${data.get('total_value', 0):,.0f})")

    print("\n" + "=" * 60)


if __name__ == "__main__":
    main()
