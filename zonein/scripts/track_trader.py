#!/usr/bin/env python3
"""
Track Trader - Get detailed info about a specific trader/whale.
Usage:
  python track_trader.py --wallet 0x... [--type pm|perp|both]
"""
import argparse
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
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}"}
    except urllib.error.URLError as e:
        return {"error": f"Connection failed: {e.reason}"}


def show_pm_trader(wallet: str):
    """Show prediction market trader info."""
    print(f"\n--- Prediction Market Profile ---")
    data = fetch(f"/pm/trader/{wallet}")
    trader = data.get("trader")
    perf = data.get("performance")

    if not trader:
        print(f"  Not found on Polymarket")
        return

    print(f"  Username: {trader.get('username', 'N/A')}")
    print(f"  Score:    {trader.get('score', 'N/A')}")
    labels = trader.get("labels", [])
    if labels:
        print(f"  Labels:   {', '.join(labels)}")

    if perf:
        overall = perf.get("overall", {})
        print(f"  PnL:      ${overall.get('pnl', 0):,.2f}")
        print(f"  Volume:   ${overall.get('volume', 0):,.2f}")
        print(f"  ROI:      {overall.get('roi', 0):.1%}")
        print(f"  Positions: {overall.get('positions_count', 0)}")
        if perf.get("best_category"):
            print(f"  Best Cat: {perf['best_category']}")

    # Positions
    pos_data = fetch(f"/pm/trader/{wallet}/positions")
    positions = pos_data.get("positions", [])
    if positions:
        print(f"\n  Current Positions ({len(positions)}):")
        for p in positions[:10]:
            direction = "YES" if p.get("outcomeIndex") == 0 else "NO"
            size = float(p.get("size", 0) or p.get("totalBought", 0) or 0)
            cur = float(p.get("curPrice", 0) or 0)
            avg = float(p.get("avgPrice", 0) or 0)
            pnl_pct = ((cur - avg) / avg * 100) if avg > 0 else 0
            if direction == "NO":
                pnl_pct = -pnl_pct
            icon = "🟢" if pnl_pct > 0 else "🔴"
            print(f"    {icon} {direction:3s} ${size:,.0f} @ {avg:.2f} → {cur:.2f} "
                  f"({pnl_pct:+.1f}%) | {p.get('title', '')[:45]}")


def show_perp_trader(address: str):
    """Show perp trader info."""
    print(f"\n--- Perp Trading Profile (HyperLiquid) ---")
    data = fetch(f"/perp/trader/{address}")
    trader = data.get("trader")

    if not trader:
        print(f"  Not found on HyperLiquid")
        return

    print(f"  Address:      {trader.get('address', 'N/A')}")
    print(f"  Smart Score:  {trader.get('smart_trader_score', 'N/A')}")
    print(f"  Account Value: ${trader.get('account_value', 0):,.2f}")
    print(f"  Month PnL:    ${trader.get('perp_month_pnl', 0):,.2f}")
    print(f"  Week PnL:     ${trader.get('perp_week_pnl', 0):,.2f}")
    print(f"  Day PnL:      ${trader.get('perp_day_pnl', 0):,.2f}")

    cats = trader.get("categories", [])
    if cats:
        print(f"  Categories:   {', '.join(cats)}")

    metrics = trader.get("smart_trader_metrics", {})
    if metrics:
        print(f"  Win Rate:     {metrics.get('win_rate', 0):.1%}")
        print(f"  Profit Factor: {metrics.get('profit_factor', 0):.2f}")

    positions = trader.get("current_positions", {}).get("asset_positions", [])
    if positions:
        print(f"\n  Current Positions ({len(positions)}):")
        for p in positions[:15]:
            pos = p.get("position", {})
            coin = pos.get("coin", "?")
            szi = float(pos.get("szi", 0) or 0)
            direction = "LONG" if szi > 0 else "SHORT"
            value = abs(float(pos.get("positionValue", 0) or 0))
            entry = float(pos.get("entryPx", 0) or 0)
            upnl = float(pos.get("unrealizedPnl", 0) or 0)
            icon = "🟢" if upnl > 0 else "🔴"
            lev = pos.get("leverage", {}).get("value", 1)
            print(f"    {icon} {direction:5s} ${coin:5s} ${value:,.0f} @ ${entry:,.2f} "
                  f"| uPnL: ${upnl:,.2f} | {lev}x")


def main():
    parser = argparse.ArgumentParser(description="Track a specific trader/whale")
    parser.add_argument("--wallet", "-w", required=True, help="Wallet address")
    parser.add_argument("--type", "-t", choices=["pm", "perp", "both"], default="both")
    parser.add_argument("--json", action="store_true", help="Raw JSON output")
    args = parser.parse_args()

    wallet = args.wallet.strip()
    print(f"\n{'='*60}")
    print(f"  TRADER: {wallet[:10]}...{wallet[-6:]}")
    print(f"{'='*60}")

    if args.json:
        result = {}
        if args.type in ("pm", "both"):
            result["pm_trader"] = fetch(f"/pm/trader/{wallet}")
            result["pm_positions"] = fetch(f"/pm/trader/{wallet}/positions")
        if args.type in ("perp", "both"):
            result["perp_trader"] = fetch(f"/perp/trader/{wallet}")
        print(json.dumps(result, indent=2, default=str))
        return

    if args.type in ("pm", "both"):
        show_pm_trader(wallet)
    if args.type in ("perp", "both"):
        show_perp_trader(wallet)

    print(f"\n{'='*60}")


if __name__ == "__main__":
    main()
