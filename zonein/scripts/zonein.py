#!/usr/bin/env python3
"""
Zonein MCP API Client — OpenClaw Skill Script

SECURITY MANIFEST:
  Environment variables accessed: ZONEIN_API_KEY (only)
  External endpoints called: https://mcp.zonein.xyz/api/v1/* (only)
  Local files read: ~/.openclaw/openclaw.json (API key fallback only, if ZONEIN_API_KEY env var is not set)
  Local files written: none

Usage:
  python3 scripts/zonein.py <command> [options]

Commands:
  signals          — PM smart money trading signals
  leaderboard      — PM leaderboard (top traders by PnL)
  consensus        — PM consensus positions
  trader <wallet>  — PM trader profile + performance
  perp-signals     — Perp trading signals (HyperLiquid)
  perp-traders     — Perp smart money traders
  perp-top         — Perp top performers by PnL
  perp-categories  — Perp trader categories
  perp-coins       — Perp coin distribution
  perp-trader <addr> — Perp trader details
  agents           — List your trading agents
  agent-get <id>   — Get agent details
  agent-create     — Create a new trading agent
  agent-update <id>— Update agent config
  agent-deploy <id>— Deploy agent (validate + enable)
  agent-enable <id>— Enable agent
  agent-disable <id>— Disable agent
  agent-pause <id> — Pause agent
  agent-delete <id>— Delete agent
  agent-stats <id> — Agent performance stats
  agent-trades <id>— Agent trade history
  agent-vault <id> — Agent vault/wallet info
  agent-balance <id>— Live vault balance (Hyperliquid)
  agent-positions <id>— Open positions (live)
  agent-deposit <id>— Get deposit address (USDC on Arbitrum)
  agent-open <id>  — Open a position (manual order)
  agent-close <id> — Close a position
  agent-orders <id>— Manual order history
  agent-withdraw <id>— Withdraw funds to your wallet
  agent-backtest <id>— Run backtest on agent (streaming)
  agent-backtests <id>— List past backtests for agent
  agent-templates  — Available agent types & config templates
  agent-assets     — Available trading assets
  agent-categories — Smart money categories with stats
  status           — Check API key status
"""

import sys
import os
import json
import argparse

try:
    import urllib.request
    import urllib.error
    import urllib.parse
except ImportError:
    pass

API_BASE = "https://mcp.zonein.xyz/api/v1"
CONTENT_JSON = "application/json"
CONFIRM_HELP = "Required: confirms user approved this financial action"


def get_api_key():
    """Get ZONEIN_API_KEY from environment."""
    key = os.environ.get("ZONEIN_API_KEY", "")
    if not key:
        # Fallback: read from ~/.openclaw/openclaw.json (documented in SKILL.md)
        config_path = os.path.expanduser("~/.openclaw/openclaw.json")
        if os.path.exists(config_path):
            try:
                with open(config_path, "r") as f:
                    cfg = json.load(f)
                key = (cfg.get("skills", {}).get("entries", {})
                       .get("zonein", {}).get("apiKey", ""))
            except Exception:
                pass
    if not key:
        print(json.dumps({"error": "ZONEIN_API_KEY not set. Get your key at https://app.zonein.xyz/pm"}))
        sys.exit(1)
    return key


def _require_confirm(args, action_desc: str):
    """Programmatic confirmation gate for financial commands.
    Refuses to execute unless --confirm is explicitly passed.
    This prevents prompt injection from bypassing user confirmation."""
    if not getattr(args, 'confirm', False):
        print(json.dumps({
            "error": "Confirmation required",
            "detail": f"This is a financial action: {action_desc}. "
                       f"Add --confirm to execute after user has explicitly approved.",
        }))
        sys.exit(1)


def _do_request(path, params=None, method="GET", body=None):
    """Make authenticated request to Zonein API."""
    key = get_api_key()
    url = f"{API_BASE}{path}"
    if params:
        query = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
        if query:
            url = f"{url}?{query}"

    data_bytes = None
    headers = {"X-API-Key": key, "Accept": CONTENT_JSON}
    if body is not None:
        data_bytes = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = CONTENT_JSON

    req = urllib.request.Request(url, data=data_bytes, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            err = json.loads(raw)
        except Exception:
            err = {"detail": raw}
        print(json.dumps({"error": f"HTTP {e.code}", "detail": err.get("detail", raw)}))
        sys.exit(1)
    except urllib.error.URLError as e:
        print(json.dumps({"error": f"Connection failed: {e.reason}"}))
        sys.exit(1)


def api_request(path, params=None):
    """GET request."""
    return _do_request(path, params=params, method="GET")


def api_post(path, body=None):
    """POST request."""
    return _do_request(path, method="POST", body=body or {})


def api_patch(path, body=None):
    """PATCH request."""
    return _do_request(path, method="PATCH", body=body or {})


def api_delete(path):
    """DELETE request."""
    return _do_request(path, method="DELETE")


def cmd_signals(args):
    """PM smart money trading signals."""
    params = {"limit": args.limit}
    if args.categories:
        params["categories"] = args.categories
    if args.period:
        params["period"] = args.period
    if args.min_wallets:
        params["min_wallets"] = args.min_wallets
    data = api_request("/pm/signals", params)
    print(json.dumps(data, indent=2))


def cmd_leaderboard(args):
    """PM leaderboard."""
    params = {
        "period": args.period,
        "category": args.category,
        "limit": args.limit,
    }
    data = api_request("/pm/leaderboard", params)
    print(json.dumps(data, indent=2))


def cmd_consensus(args):
    """PM consensus positions."""
    params = {"min_bettors": args.min_bettors}
    data = api_request("/pm/consensus", params)
    print(json.dumps(data, indent=2))


def cmd_trader(args):
    """PM trader profile."""
    data = api_request(f"/pm/trader/{args.wallet}")
    print(json.dumps(data, indent=2))


def cmd_perp_signals(args):
    """Perp trading signals."""
    params = {"limit": args.limit}
    if args.min_wallets:
        params["min_wallets"] = args.min_wallets
    if args.min_score:
        params["min_score"] = args.min_score
    data = api_request("/perp/signals", params)
    print(json.dumps(data, indent=2))


def cmd_perp_traders(args):
    """Perp smart traders."""
    params = {"limit": args.limit}
    if args.min_score:
        params["min_score"] = args.min_score
    if args.categories:
        params["categories"] = args.categories
    data = api_request("/perp/traders", params)
    print(json.dumps(data, indent=2))


def cmd_perp_top(args):
    """Perp top performers."""
    params = {"limit": args.limit, "time_period": args.period}
    data = api_request("/perp/traders/top", params)
    print(json.dumps(data, indent=2))


def cmd_perp_categories(args):
    """Perp categories."""
    data = api_request("/perp/categories")
    print(json.dumps(data, indent=2))


def cmd_perp_coins(args):
    """Perp coin distribution."""
    data = api_request("/perp/coins")
    print(json.dumps(data, indent=2))


def cmd_perp_trader(args):
    """Perp trader details."""
    data = api_request(f"/perp/trader/{args.address}")
    print(json.dumps(data, indent=2))


def cmd_agents(args):
    """List trading agents."""
    data = api_request("/agents/")
    print(json.dumps(data, indent=2))


def cmd_agent_get(args):
    """Get agent details."""
    data = api_request(f"/agents/{args.agent_id}")
    print(json.dumps(data, indent=2))


def cmd_agent_create(args):
    """Create a new trading agent."""
    body = {"name": args.name, "agent_type": args.type}
    if args.assets:
        body["allowed_assets"] = args.assets.split(",")
    if args.categories:
        body["smart_money_categories"] = args.categories.split(",")
    if args.leverage:
        body["max_leverage"] = args.leverage
    if args.description:
        body["description"] = args.description
    if args.risk_per_trade:
        body.setdefault("risk_profile", {})["risk_per_trade_percent"] = args.risk_per_trade
    if args.max_daily_loss:
        body.setdefault("risk_profile", {})["max_daily_loss"] = args.max_daily_loss
    if args.risk_reward:
        body.setdefault("risk_profile", {})["risk_reward_ratio"] = args.risk_reward
    if args.max_trades_per_day:
        body.setdefault("trading_preferences", {})["max_trades_per_day"] = args.max_trades_per_day
    if args.min_confidence:
        body.setdefault("trading_preferences", {})["min_confidence_threshold"] = args.min_confidence
    if args.min_consensus:
        body.setdefault("trading_preferences", {})["min_smart_money_consensus"] = args.min_consensus
    if args.strength_thresholds:
        body["strength_thresholds"] = json.loads(args.strength_thresholds)
    if args.timeframe_weights:
        body["timeframe_weights"] = json.loads(args.timeframe_weights)
    data = api_post("/agents/", body)
    print(json.dumps(data, indent=2))


def cmd_agent_update(args):
    """Update agent config."""
    body = {}
    if args.name:
        body["name"] = args.name
    if args.description:
        body["description"] = args.description
    if args.assets:
        body["allowed_assets"] = args.assets.split(",")
    if args.categories:
        body["smart_money_categories"] = args.categories.split(",")
    if args.leverage:
        body["max_leverage"] = args.leverage
    if args.methodology:
        body.setdefault("prompt_config", {})["trading_methodology"] = args.methodology
    if args.entry_strategy:
        body.setdefault("prompt_config", {})["entry_strategy"] = args.entry_strategy
    if args.exit_framework:
        body.setdefault("prompt_config", {})["exit_framework"] = args.exit_framework
    if args.strength_thresholds:
        body["strength_thresholds"] = json.loads(args.strength_thresholds)
    if args.timeframe_weights:
        body["timeframe_weights"] = json.loads(args.timeframe_weights)
    if not body:
        print(json.dumps({"error": "No updates provided"}))
        sys.exit(1)
    data = api_patch(f"/agents/{args.agent_id}", body)
    print(json.dumps(data, indent=2))


def cmd_agent_deploy(args):
    """Deploy agent — validate + enable."""
    _require_confirm(args, "Deploy and enable agent for live trading")
    data = api_post(f"/agents/{args.agent_id}/deploy", {})
    print(json.dumps(data, indent=2))


def cmd_agent_enable(args):
    """Enable agent."""
    _require_confirm(args, "Enable agent for live trading")
    data = api_post(f"/agents/{args.agent_id}/enable", {})
    print(json.dumps(data, indent=2))


def cmd_agent_disable(args):
    """Disable agent."""
    data = api_post(f"/agents/{args.agent_id}/disable", {})
    print(json.dumps(data, indent=2))


def cmd_agent_pause(args):
    """Pause agent."""
    data = api_post(f"/agents/{args.agent_id}/pause")
    print(json.dumps(data, indent=2))


def cmd_agent_delete(args):
    """Delete agent."""
    data = api_delete(f"/agents/{args.agent_id}")
    print(json.dumps(data, indent=2))


def cmd_agent_stats(args):
    """Agent performance stats."""
    data = api_request(f"/agents/{args.agent_id}/stats")
    print(json.dumps(data, indent=2))


def cmd_agent_trades(args):
    """Agent trade history."""
    params = {"limit": args.limit}
    data = api_request(f"/agents/{args.agent_id}/trades", params)
    print(json.dumps(data, indent=2))


def cmd_agent_vault(args):
    """Agent vault/wallet info."""
    data = api_request(f"/agents/{args.agent_id}/vault")
    print(json.dumps(data, indent=2))


def cmd_agent_templates(args):
    """Available agent types & config templates."""
    data = api_request("/agents/config/templates")
    print(json.dumps(data, indent=2))


def cmd_agent_assets(args):
    """Available trading assets."""
    data = api_request("/agents/config/assets")
    print(json.dumps(data, indent=2))


def cmd_agent_categories(args):
    """Smart money categories with stats."""
    data = api_request("/agents/config/categories")
    print(json.dumps(data, indent=2))


def cmd_agent_balance(args):
    """Agent vault balance (live from Hyperliquid)."""
    data = api_request(f"/agents/{args.agent_id}/balance")
    print(json.dumps(data, indent=2))


def cmd_agent_positions(args):
    """Agent open positions (live from Hyperliquid)."""
    data = api_request(f"/agents/{args.agent_id}/positions")
    print(json.dumps(data, indent=2))


def cmd_agent_deposit(args):
    """Get deposit address for funding agent."""
    data = api_request(f"/agents/{args.agent_id}/deposit-info")
    print(json.dumps(data, indent=2))


def cmd_agent_fund(args):
    """Bridge USDC from Arbitrum to Hyperliquid."""
    _require_confirm(args, "Bridge USDC from Arbitrum to Hyperliquid")
    data = api_post(f"/agents/{args.agent_id}/fund", {})
    print(json.dumps(data, indent=2))


def cmd_agent_open(args):
    """Open a position (manual order via chat)."""
    _require_confirm(args, f"Open {args.direction} {args.coin} position (${args.size})")
    body = {
        "action": "open",
        "coin": args.coin,
        "direction": args.direction,
        "size_usd": args.size,
    }
    if args.leverage:
        body["leverage"] = args.leverage
    data = api_post(f"/agents/{args.agent_id}/orders", body)
    print(json.dumps(data, indent=2))


def cmd_agent_close(args):
    """Close a position (manual order via chat)."""
    _require_confirm(args, f"Close {args.coin} position")
    body = {
        "action": "close",
        "coin": args.coin,
        "direction": "LONG",
    }
    data = api_post(f"/agents/{args.agent_id}/orders", body)
    print(json.dumps(data, indent=2))


def cmd_agent_orders(args):
    """Manual order history."""
    params = {"limit": args.limit}
    data = api_request(f"/agents/{args.agent_id}/orders", params)
    print(json.dumps(data, indent=2))


def cmd_agent_withdraw(args):
    """Withdraw funds from agent vault."""
    _require_confirm(args, f"Withdraw funds to {args.to}")
    body = {"destination_address": args.to}
    data = api_post(f"/agents/{args.agent_id}/withdraw", body)
    print(json.dumps(data, indent=2))


def _process_backtest_msg(msg):
    """Handle a single NDJSON message from backtest stream.
    Returns the report dict on 'complete', None otherwise. Exits on 'error'."""
    t = msg.get("type")
    if t == "status":
        sys.stderr.write(f"  {msg.get('message')}\n")
    elif t == "init":
        sys.stderr.write(f"  Backtest {msg.get('backtest_id')}: {msg.get('total_steps')} steps\n")
    elif t == "trade":
        tr = msg["trade"]
        pnl_s = f" pnl=${tr['pnl']:.2f}" if tr.get("pnl") is not None else ""
        sys.stderr.write(f"  [trade] {tr['action']} @ ${tr['price']:.2f}{pnl_s}\n")
    elif t == "complete":
        return msg["report"]
    elif t == "error":
        print(json.dumps({"error": msg.get("message")}))
        sys.exit(1)
    return None


def _build_backtest_result(backtest_id, dashboard_url, report):
    """Assemble the final backtest JSON output."""
    result = {
        "backtest_id": backtest_id,
        "dashboard_url": f"https://mcp.zonein.xyz{dashboard_url}" if dashboard_url else None,
    }
    if report:
        s = report.get("stats", {})
        result.update({
            "symbol": report.get("symbol"),
            "days": report.get("days"),
            "initial_balance": report.get("initial_balance"),
            "final_balance": report.get("final_balance"),
            "pnl": report.get("pnl"),
            "total_trades": report.get("total_trades"),
            "win_rate": s.get("win_rate"),
            "profit_factor": s.get("profit_factor"),
            "sharpe_ratio": s.get("sharpe_ratio"),
            "max_drawdown": report.get("max_drawdown"),
            "max_consecutive_wins": s.get("max_consecutive_wins"),
            "max_consecutive_losses": s.get("max_consecutive_losses"),
        })
    return result


def cmd_agent_backtest(args):
    """Run a backtest on an agent. Streams NDJSON progress, prints dashboard link."""
    _require_confirm(args, f"Run backtest on {args.agent_id} ({args.symbol}, {args.days}d)")
    key = get_api_key()
    url = f"{API_BASE}/backtest/run"
    body = json.dumps({
        "agent_id": args.agent_id,
        "symbol": args.symbol.upper(),
        "days": args.days,
        "initial_balance": args.initial_balance,
    }).encode("utf-8")
    headers = {
        "X-API-Key": key,
        "Content-Type": CONTENT_JSON,
        "Accept": "application/x-ndjson",
    }
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            backtest_id = resp.headers.get("X-Backtest-Id", "")
            dashboard_url = resp.headers.get("X-Dashboard-Url", "")
            last_report = None
            for raw_line in resp:
                line = raw_line.decode("utf-8").strip()
                if not line:
                    continue
                report = _process_backtest_msg(json.loads(line))
                if report is not None:
                    last_report = report
            print(json.dumps(_build_backtest_result(backtest_id, dashboard_url, last_report), indent=2))
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            err = json.loads(raw)
        except Exception:
            err = {"detail": raw}
        print(json.dumps({"error": f"HTTP {e.code}", "detail": err.get("detail", raw)}))
        sys.exit(1)
    except urllib.error.URLError as e:
        print(json.dumps({"error": f"Connection failed: {e.reason}"}))
        sys.exit(1)


def cmd_agent_backtests(args):
    """List past backtests for an agent."""
    data = api_request(f"/backtest/list/{args.agent_id}", {"limit": args.limit})
    print(json.dumps(data, indent=2))


def cmd_status(args):
    """Check API key status."""
    data = api_request("/auth/api-key/status")
    print(json.dumps(data, indent=2))


def main():
    parser = argparse.ArgumentParser(
        description="Zonein Smart Money Intelligence API",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest="command", help="Available commands")

    # --- PM Signals ---
    p = sub.add_parser("signals", help="PM smart money trading signals")
    p.add_argument("--limit", type=int, default=20)
    p.add_argument("--categories", type=str, default=None, help="Comma-separated: POLITICS,CRYPTO,SPORTS")
    p.add_argument("--period", type=str, default="WEEK", help="DAY, WEEK, MONTH, ALL")
    p.add_argument("--min-wallets", type=int, default=None)
    p.set_defaults(func=cmd_signals)

    # --- PM Leaderboard ---
    p = sub.add_parser("leaderboard", help="PM leaderboard")
    p.add_argument("--period", type=str, default="WEEK", help="DAY, WEEK, MONTH, ALL")
    p.add_argument("--category", type=str, default="OVERALL", help="OVERALL, POLITICS, SPORTS, CRYPTO, etc.")
    p.add_argument("--limit", type=int, default=20)
    p.set_defaults(func=cmd_leaderboard)

    # --- PM Consensus ---
    p = sub.add_parser("consensus", help="PM consensus positions")
    p.add_argument("--min-bettors", type=int, default=3)
    p.set_defaults(func=cmd_consensus)

    # --- PM Trader ---
    p = sub.add_parser("trader", help="PM trader profile by wallet")
    p.add_argument("wallet", type=str)
    p.set_defaults(func=cmd_trader)

    # --- Perp Signals ---
    p = sub.add_parser("perp-signals", help="Perp trading signals")
    p.add_argument("--limit", type=int, default=20)
    p.add_argument("--min-wallets", type=int, default=None)
    p.add_argument("--min-score", type=float, default=None)
    p.set_defaults(func=cmd_perp_signals)

    # --- Perp Traders ---
    p = sub.add_parser("perp-traders", help="Perp smart traders")
    p.add_argument("--limit", type=int, default=20)
    p.add_argument("--min-score", type=float, default=None)
    p.add_argument("--categories", type=str, default=None, help="Comma-separated category filter")
    p.set_defaults(func=cmd_perp_traders)

    # --- Perp Top ---
    p = sub.add_parser("perp-top", help="Perp top performers by PnL")
    p.add_argument("--limit", type=int, default=10)
    p.add_argument("--period", type=str, default="month", help="day, week, month")
    p.set_defaults(func=cmd_perp_top)

    # --- Perp Categories ---
    p = sub.add_parser("perp-categories", help="Perp trader categories")
    p.set_defaults(func=cmd_perp_categories)

    # --- Perp Coins ---
    p = sub.add_parser("perp-coins", help="Perp coin distribution")
    p.set_defaults(func=cmd_perp_coins)

    # --- Perp Trader ---
    p = sub.add_parser("perp-trader", help="Perp trader details by address")
    p.add_argument("address", type=str)
    p.set_defaults(func=cmd_perp_trader)

    # --- Agents ---
    p = sub.add_parser("agents", help="List trading agents")
    p.set_defaults(func=cmd_agents)

    # --- Agent Get ---
    p = sub.add_parser("agent-get", help="Get agent details")
    p.add_argument("agent_id", type=str)
    p.set_defaults(func=cmd_agent_get)

    # --- Agent Create ---
    p = sub.add_parser("agent-create", help="Create a new trading agent")
    p.add_argument("--name", type=str, required=True, help="Agent name")
    p.add_argument("--type", type=str, default="composite", help="Agent type: composite, momentum_hunter, stable_grower, precision_master, whale_follower, scalping_pro, swing_trader")
    p.add_argument("--assets", type=str, default=None, help="Comma-separated: BTC,ETH,SOL,HYPE")
    p.add_argument("--categories", type=str, default=None, help="Comma-separated SM categories")
    p.add_argument("--leverage", type=int, default=None, help="Max leverage (1-20)")
    p.add_argument("--description", type=str, default=None)
    p.add_argument("--risk-per-trade", type=float, default=None, help="Risk per trade %")
    p.add_argument("--max-daily-loss", type=float, default=None, help="Max daily loss %")
    p.add_argument("--risk-reward", type=str, default=None, help="Risk:reward ratio e.g. 1:2")
    p.add_argument("--max-trades-per-day", type=int, default=None)
    p.add_argument("--min-confidence", type=float, default=None, help="Min confidence 0-1")
    p.add_argument("--min-consensus", type=float, default=None, help="Min SM consensus 0-1")
    p.add_argument("--strength-thresholds", type=str, default=None, help="JSON: {\"BTC\": {\"min_strength_buy\": 70, \"min_strength_sell\": 65}, ...}")
    p.add_argument("--timeframe-weights", type=str, default=None, help="JSON: {\"24h\": 0.5, \"4h\": 0.35, \"1h\": 0.15}")
    p.set_defaults(func=cmd_agent_create)

    # --- Agent Update ---
    p = sub.add_parser("agent-update", help="Update agent configuration")
    p.add_argument("agent_id", type=str)
    p.add_argument("--name", type=str, default=None)
    p.add_argument("--description", type=str, default=None)
    p.add_argument("--assets", type=str, default=None, help="Comma-separated: BTC,ETH,SOL,HYPE")
    p.add_argument("--categories", type=str, default=None, help="Comma-separated SM categories")
    p.add_argument("--leverage", type=int, default=None)
    p.add_argument("--methodology", type=str, default=None, help="Trading methodology text")
    p.add_argument("--entry-strategy", type=str, default=None, help="Entry strategy text")
    p.add_argument("--exit-framework", type=str, default=None, help="Exit framework text")
    p.add_argument("--strength-thresholds", type=str, default=None, help="JSON: {\"BTC\": {\"min_strength_buy\": 70, \"min_strength_sell\": 65}, ...}")
    p.add_argument("--timeframe-weights", type=str, default=None, help="JSON: {\"24h\": 0.5, \"4h\": 0.35, \"1h\": 0.15}")
    p.set_defaults(func=cmd_agent_update)

    # --- Agent Deploy ---
    p = sub.add_parser("agent-deploy", help="Deploy agent (validate + enable)")
    p.add_argument("agent_id", type=str)
    p.add_argument("--confirm", action="store_true", help=CONFIRM_HELP)
    p.set_defaults(func=cmd_agent_deploy)

    # --- Agent Enable ---
    p = sub.add_parser("agent-enable", help="Enable agent")
    p.add_argument("agent_id", type=str)
    p.add_argument("--confirm", action="store_true", help=CONFIRM_HELP)
    p.set_defaults(func=cmd_agent_enable)

    # --- Agent Disable ---
    p = sub.add_parser("agent-disable", help="Disable agent")
    p.add_argument("agent_id", type=str)
    p.set_defaults(func=cmd_agent_disable)

    # --- Agent Pause ---
    p = sub.add_parser("agent-pause", help="Pause agent")
    p.add_argument("agent_id", type=str)
    p.set_defaults(func=cmd_agent_pause)

    # --- Agent Delete ---
    p = sub.add_parser("agent-delete", help="Delete agent")
    p.add_argument("agent_id", type=str)
    p.set_defaults(func=cmd_agent_delete)

    # --- Agent Stats ---
    p = sub.add_parser("agent-stats", help="Agent performance stats")
    p.add_argument("agent_id", type=str)
    p.set_defaults(func=cmd_agent_stats)

    # --- Agent Trades ---
    p = sub.add_parser("agent-trades", help="Agent trade history")
    p.add_argument("agent_id", type=str)
    p.add_argument("--limit", type=int, default=50)
    p.set_defaults(func=cmd_agent_trades)

    # --- Agent Vault ---
    p = sub.add_parser("agent-vault", help="Agent vault/wallet info")
    p.add_argument("agent_id", type=str)
    p.set_defaults(func=cmd_agent_vault)

    # --- Agent Templates ---
    p = sub.add_parser("agent-templates", help="Available agent types & config templates")
    p.set_defaults(func=cmd_agent_templates)

    # --- Agent Assets ---
    p = sub.add_parser("agent-assets", help="Available trading assets")
    p.set_defaults(func=cmd_agent_assets)

    # --- Agent Categories ---
    p = sub.add_parser("agent-categories", help="Smart money categories with live stats")
    p.set_defaults(func=cmd_agent_categories)

    # --- Agent Balance ---
    p = sub.add_parser("agent-balance", help="Agent vault balance (live from Hyperliquid)")
    p.add_argument("agent_id", type=str)
    p.set_defaults(func=cmd_agent_balance)

    # --- Agent Positions ---
    p = sub.add_parser("agent-positions", help="Agent open positions (live)")
    p.add_argument("agent_id", type=str)
    p.set_defaults(func=cmd_agent_positions)

    # --- Agent Deposit ---
    p = sub.add_parser("agent-deposit", help="Get deposit address for funding agent")
    p.add_argument("agent_id", type=str)
    p.set_defaults(func=cmd_agent_deposit)

    # --- Agent Fund (bridge Arb → HL) ---
    p = sub.add_parser("agent-fund", help="Bridge USDC from Arbitrum to Hyperliquid")
    p.add_argument("agent_id", type=str)
    p.add_argument("--confirm", action="store_true", help=CONFIRM_HELP)
    p.set_defaults(func=cmd_agent_fund)

    # --- Agent Open (manual order) ---
    p = sub.add_parser("agent-open", help="Open a position (manual order)")
    p.add_argument("agent_id", type=str)
    p.add_argument("--coin", type=str, required=True, help="BTC, ETH, SOL, HYPE")
    p.add_argument("--direction", type=str, default="LONG", help="LONG or SHORT")
    p.add_argument("--size", type=float, required=True, help="Position size in USD")
    p.add_argument("--leverage", type=int, default=None, help="Leverage (1-20)")
    p.add_argument("--confirm", action="store_true", help=CONFIRM_HELP)
    p.set_defaults(func=cmd_agent_open)

    # --- Agent Close (manual order) ---
    p = sub.add_parser("agent-close", help="Close a position")
    p.add_argument("agent_id", type=str)
    p.add_argument("--coin", type=str, required=True, help="BTC, ETH, SOL, HYPE")
    p.add_argument("--confirm", action="store_true", help=CONFIRM_HELP)
    p.set_defaults(func=cmd_agent_close)

    # --- Agent Orders ---
    p = sub.add_parser("agent-orders", help="Manual order history")
    p.add_argument("agent_id", type=str)
    p.add_argument("--limit", type=int, default=20)
    p.set_defaults(func=cmd_agent_orders)

    # --- Agent Withdraw ---
    p = sub.add_parser("agent-withdraw", help="Withdraw funds from agent vault")
    p.add_argument("agent_id", type=str)
    p.add_argument("--to", type=str, required=True, help="Destination 0x... wallet address")
    p.add_argument("--confirm", action="store_true", help=CONFIRM_HELP)
    p.set_defaults(func=cmd_agent_withdraw)

    # --- Agent Backtest ---
    p = sub.add_parser("agent-backtest", help="Run backtest on agent (streaming)")
    p.add_argument("agent_id", type=str)
    p.add_argument("--symbol", type=str, default="BTC", help="Coin: BTC, ETH, SOL, HYPE")
    p.add_argument("--days", type=int, default=30, help="Period in days (7-90)")
    p.add_argument("--initial-balance", type=float, default=10000, help="Starting balance USD")
    p.add_argument("--confirm", action="store_true", help=CONFIRM_HELP)
    p.set_defaults(func=cmd_agent_backtest)

    # --- Agent Backtests (list) ---
    p = sub.add_parser("agent-backtests", help="List past backtests for agent")
    p.add_argument("agent_id", type=str)
    p.add_argument("--limit", type=int, default=10)
    p.set_defaults(func=cmd_agent_backtests)

    # --- Status ---
    p = sub.add_parser("status", help="Check API key status")
    p.set_defaults(func=cmd_status)

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == "__main__":
    main()
