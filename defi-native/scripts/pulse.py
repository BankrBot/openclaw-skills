#!/usr/bin/env python3
"""defi-native pulse: pull fresh market state from public APIs (stdlib only).

Keyless by default (DefiLlama). Optional keys via environment variables:
  VAULTSFYI_API_KEY  -> enables vaults.fyi curated-vault data (portal.vaults.fyi)

Usage (one command per invocation):
  python3 pulse.py stablecoins             # USD-pegged float + top issuers
  python3 pulse.py protocol <slug>         # current TVL for a protocol, supply vs borrowed split
  python3 pulse.py yields <symbol>         # pools matching a symbol, with trailing windows and pool type
  python3 pulse.py yields <symbol> <proj>  # same, filtered to one project slug (e.g. morpho-blue)
  python3 pulse.py vaults                  # curated vaults via vaults.fyi (needs key; API may be pay-per-request)

Every output carries retrieved_at (UTC). On any fetch failure the script
prints a JSON error object naming the endpoint and exits nonzero: report
that failure; never substitute remembered numbers. Endpoints:
  https://defillama.com/docs/api  |  https://docs.vaults.fyi
"""
import json, os, ssl, sys, urllib.request, urllib.error
from datetime import datetime, timezone

def _ssl_context():
    # python.org installs on macOS ship without linked certificates until the
    # user runs "Install Certificates.command". Fall back to certifi if present.
    ctx = ssl.create_default_context()
    if ssl.get_default_verify_paths().cafile is None:
        try:
            import certifi
            ctx = ssl.create_default_context(cafile=certifi.where())
        except ImportError:
            pass
    return ctx

def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")

def get(url, headers=None):
    req = urllib.request.Request(url, headers=headers or {"User-Agent": "defi-native-skill"})
    with urllib.request.urlopen(req, timeout=30, context=_ssl_context()) as r:
        return json.loads(r.read().decode())

def fail(url, exc):
    msg = str(exc)
    hint = None
    if "CERTIFICATE_VERIFY_FAILED" in msg:
        hint = ("Python cannot find trust certificates. On macOS run "
                "'/Applications/Python 3.x/Install Certificates.command' or "
                "'pip install certifi'. Zero-setup fallback: fetch the same "
                "URL with curl.")
    print(json.dumps({"error": f"fetch failed: {msg}", "endpoint": url,
                      "hint": hint, "retrieved_at": now()}, indent=2))
    sys.exit(1)

def stablecoins():
    url = "https://stablecoins.llama.fi/stablecoins?includePrices=true"
    try:
        d = get(url)
    except Exception as e:
        fail(url, e)
    usd = [c for c in d.get("peggedAssets", [])
           if (c.get("circulating") or {}).get("peggedUSD")]
    usd.sort(key=lambda c: -c["circulating"]["peggedUSD"])
    total = sum(c["circulating"]["peggedUSD"] for c in usd)
    return {"retrieved_at": now(),
            "note": "USD-pegged assets only; non-USD pegs excluded",
            "total_usd_pegged_float_usd": round(total),
            "top10": [{"name": c.get("name"), "symbol": c.get("symbol"),
                       "circulating_usd": round(c["circulating"]["peggedUSD"]),
                       "price": c.get("price")} for c in usd[:10]]}

def protocol(slug):
    # /protocol/<slug> returns full history (multi-MB); /tvl/<slug> returns the
    # headline number DefiLlama shows, which excludes borrowed/staking/pool2.
    url_tvl = f"https://api.llama.fi/tvl/{slug}"
    url_full = f"https://api.llama.fi/protocol/{slug}"
    try:
        headline = get(url_tvl)
        d = get(url_full)
    except Exception as e:
        fail(url_tvl, e)
    chains, borrowed, other = {}, {}, {}
    for k, v in d.get("currentChainTvls", {}).items():
        if k.endswith("-borrowed") or k == "borrowed":
            borrowed[k] = round(v)
        elif k in ("staking", "pool2", "vesting", "offers", "treasury") or "-" in k:
            other[k] = round(v)
        else:
            chains[k] = round(v)
    return {"retrieved_at": now(), "name": d.get("name"), "slug": slug,
            "headline_tvl_usd": round(headline) if isinstance(headline, (int, float)) else headline,
            "note": "headline_tvl_usd is DefiLlama's displayed TVL. Do not sum "
                    "the sections below; borrowed amounts are debt, not deposits.",
            "supply_tvl_by_chain_usd": chains,
            "borrowed_usd": borrowed,
            "other_categories_usd": other}

def yields_for(symbol, project=None):
    url = "https://yields.llama.fi/pools"
    try:
        d = get(url)
    except Exception as e:
        fail(url, e)
    sym = symbol.upper()
    pools = [p for p in d.get("data", []) if sym in p.get("symbol", "").upper()]
    if project:
        pools = [p for p in pools if p.get("project") == project]
    pools.sort(key=lambda p: -(p.get("tvlUsd") or 0))
    out = []
    for p in pools[:15]:
        multi = "-" in p.get("symbol", "") or p.get("exposure") == "multi"
        out.append({"project": p.get("project"), "chain": p.get("chain"),
                    "symbol": p.get("symbol"),
                    "pool_type": "lp_pair" if multi else "single_asset",
                    "tvl_usd": round(p.get("tvlUsd") or 0),
                    "apy": p.get("apy"), "apyBase": p.get("apyBase"),
                    "apyReward": p.get("apyReward"),
                    "apyBase7d": p.get("apyBase7d"),
                    "apyMean30d": p.get("apyMean30d"),
                    "ilRisk": p.get("ilRisk"), "exposure": p.get("exposure"),
                    "stablecoin": p.get("stablecoin")})
    return {"retrieved_at": now(), "symbol": symbol, "project_filter": project,
            "matched_pools": len(pools),
            "note": "Field names are DefiLlama's own. apyBase means yield not "
                    "paid in a separate reward token: an UPPER BOUND on the "
                    "organic share (in-kind subsidies still land in apyBase); "
                    "apyReward is a lower bound on the incentive share. "
                    "lp_pair APYs carry impermanent loss and are not comparable "
                    "to lending rates. Prefer apyMean30d over spot apy.",
            "pools": out}

def vaults():
    key = os.environ.get("VAULTSFYI_API_KEY")
    if key and os.environ.get("VAULTSFYI_ALLOW_SPEND") != "1":
        print(json.dumps({"error": "spend consent required",
                          "hint": "vaults.fyi is metered (credits per call). A key is not "
                                  "consent to spend: confirm with the user, then set "
                                  "VAULTSFYI_ALLOW_SPEND=1 to enable this command.",
                          "retrieved_at": now()}, indent=2))
        sys.exit(1)
    if not key:
        print(json.dumps({"error": "VAULTSFYI_API_KEY not set",
                          "hint": "Keys at portal.vaults.fyi. Credits-based pay-as-you-go; "
                                  "a fresh key has no usable free allowance "
                                  "(verified Aug 2026). Top up or use the "
                                  "keyless DefiLlama commands instead.",
                          "retrieved_at": now()}, indent=2))
        sys.exit(1)
    url = "https://api.vaults.fyi/v2/detailed-vaults"
    try:
        d = get(url, headers={"x-api-key": key, "User-Agent": "defi-native-skill"})
    except Exception as e:
        fail(url, e)
    items = d.get("data", d) if isinstance(d, dict) else d
    if isinstance(items, list):
        head, total = items[:10], len(items)
    else:
        head, total = items, None
    return {"retrieved_at": now(), "total_items": total, "first_10": head,
            "note": "see docs.vaults.fyi for composition/holders endpoints"}

if __name__ == "__main__":
    args = sys.argv[1:]
    cmd = args[0] if args else "help"
    if cmd == "stablecoins":
        print(json.dumps(stablecoins(), indent=2))
    elif cmd == "protocol" and len(args) > 1:
        print(json.dumps(protocol(args[1]), indent=2))
    elif cmd == "yields" and len(args) > 1:
        print(json.dumps(yields_for(args[1], args[2] if len(args) > 2 else None), indent=2))
    elif cmd == "vaults":
        print(json.dumps(vaults(), indent=2))
    else:
        print(__doc__)
        sys.exit(0 if cmd in ("help", "-h", "--help") else 1)
