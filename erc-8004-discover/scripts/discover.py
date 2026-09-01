#!/usr/bin/env python3
"""
ERC-8004 Agent Discovery Tool

Search and discover agents registered via ERC-8004 using the Agentscan API.
"""

import argparse
import base64
import json
import sys
import urllib.request
import urllib.error
import urllib.parse
from typing import Optional

# API Configuration
AGENTSCAN_API = "https://agentscan.info/api"
AGENTS_ENDPOINT = f"{AGENTSCAN_API}/agents"
NETWORKS_ENDPOINT = f"{AGENTSCAN_API}/networks"
REQUEST_TIMEOUT = 30

# Chain name mappings
CHAIN_ALIASES = {
    "base": ["base", "base-mainnet", "base-sepolia"],
    "ethereum": ["ethereum", "eth", "mainnet", "eth-mainnet"],
    "polygon": ["polygon", "matic", "polygon-mainnet"],
    "monad": ["monad", "monad-testnet"],
    "bnb": ["bnb", "bsc", "binance", "bnb-chain"],
}


def api_request(url: str, exit_on_error: bool = True) -> dict:
    """Make a GET request to the API and return JSON response."""
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "ERC8004-Discovery/1.0", "Accept": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if exit_on_error:
            print(f"API Error: HTTP {e.code} - {e.reason}", file=sys.stderr)
            sys.exit(1)
        raise
    except urllib.error.URLError as e:
        if exit_on_error:
            print(f"Network Error: {e.reason}", file=sys.stderr)
            sys.exit(1)
        raise
    except json.JSONDecodeError:
        if exit_on_error:
            print("Error: Invalid JSON response from API", file=sys.stderr)
            sys.exit(1)
        raise


def fetch_agents_pages(page_size: int = 100, max_pages: int = 5) -> list:
    """Fetch multiple pages of agents (capped to avoid hammering API)."""
    all_agents = []
    page = 1

    while page <= max_pages:
        try:
            data = api_request(f"{AGENTS_ENDPOINT}?page={page}&page_size={page_size}", exit_on_error=False)
        except Exception:
            # Skip pages that error (Agentscan has intermittent 500s)
            page += 1
            continue

        items = data.get("items", [])
        if not items:
            break

        all_agents.extend(items)

        total_pages = data.get("total_pages", 1)
        if page >= total_pages:
            break
        page += 1

    return all_agents


def decode_metadata_uri(metadata_uri: str) -> Optional[dict]:
    """Decode metadata from base64 data URI or return None."""
    if not metadata_uri:
        return None

    try:
        # Handle base64 data URIs (data:application/json;base64,...)
        if metadata_uri.startswith("data:"):
            # Extract the base64 part
            if ";base64," in metadata_uri:
                base64_data = metadata_uri.split(";base64,", 1)[1]
                decoded = base64.b64decode(base64_data).decode("utf-8")
                return json.loads(decoded)
            elif "," in metadata_uri:
                # URL-encoded or plain data
                data_part = metadata_uri.split(",", 1)[1]
                return json.loads(urllib.parse.unquote(data_part))

        # Handle IPFS URIs
        if metadata_uri.startswith("ipfs://"):
            ipfs_hash = metadata_uri.replace("ipfs://", "")
            gateway_url = f"https://ipfs.io/ipfs/{ipfs_hash}"
            return api_request(gateway_url)

        # Handle HTTP(S) URIs
        if metadata_uri.startswith("http://") or metadata_uri.startswith("https://"):
            return api_request(metadata_uri)

    except Exception:
        pass

    return None


def matches_chain(agent: dict, chain_filter: str) -> bool:
    """Check if agent matches the chain filter."""
    if not chain_filter:
        return True

    chain_filter = chain_filter.lower()
    network_name = (agent.get("network_name") or "").lower()
    network_id = str(agent.get("network_id") or "").lower()

    # Check direct match
    if chain_filter in network_name or chain_filter == network_id:
        return True

    # Check aliases
    for canonical, aliases in CHAIN_ALIASES.items():
        if chain_filter == canonical or chain_filter in aliases:
            for alias in aliases:
                if alias in network_name:
                    return True

    return False


def format_description(desc: str, max_len: int = 80) -> str:
    """Truncate description to max length."""
    if not desc:
        return "-"
    desc = desc.replace("\n", " ").strip()
    if len(desc) > max_len:
        return desc[:max_len - 3] + "..."
    return desc


def format_reputation(score) -> str:
    """Format reputation score for display."""
    if score is None:
        return "-"
    try:
        score = float(score)
        if score >= 80:
            return f"{score:.1f} ★★★"
        elif score >= 50:
            return f"{score:.1f} ★★"
        elif score > 0:
            return f"{score:.1f} ★"
        return f"{score:.1f}"
    except (ValueError, TypeError):
        return str(score)


def print_agent_table(agents: list, show_chain: bool = True):
    """Print agents in a formatted table."""
    if not agents:
        print("No agents found.")
        return

    # Header
    if show_chain:
        print(f"{'Name':<25} {'Chain':<15} {'Rep':>10} {'Skills':<20} Description")
        print("-" * 100)
    else:
        print(f"{'Name':<30} {'Rep':>10} {'Skills':<25} Description")
        print("-" * 95)

    for agent in agents:
        name = (agent.get("name") or agent.get("address", "")[:10])[:24]
        chain = (agent.get("network_name") or "-")[:14]
        rep = format_reputation(agent.get("reputation_score"))
        skills = agent.get("skills") or []
        skills_str = ", ".join(skills[:3]) if skills else "-"
        if len(skills) > 3:
            skills_str += f" (+{len(skills)-3})"
        skills_str = skills_str[:19] if show_chain else skills_str[:24]
        desc = format_description(agent.get("description"), 35)

        if show_chain:
            print(f"{name:<25} {chain:<15} {rep:>10} {skills_str:<20} {desc}")
        else:
            print(f"{name:<30} {rep:>10} {skills_str:<25} {desc}")


def cmd_search(args):
    """Search for agents by query string."""
    print(f"Searching for agents matching '{args.query}'...")

    agents = fetch_agents_pages(max_pages=5)
    query = args.query.lower()

    # Filter by search query
    results = []
    for agent in agents:
        name = (agent.get("name") or "").lower()
        desc = (agent.get("description") or "").lower()
        skills = [s.lower() for s in (agent.get("skills") or [])]
        domains = [d.lower() for d in (agent.get("domains") or [])]

        if (query in name or
            query in desc or
            any(query in s for s in skills) or
            any(query in d for d in domains)):
            results.append(agent)

    # Apply filters
    if args.chain:
        results = [a for a in results if matches_chain(a, args.chain)]

    if args.min_rep is not None:
        results = [a for a in results if (a.get("reputation_score") or 0) >= args.min_rep]

    if args.has_services:
        results = [a for a in results if a.get("skills") or a.get("domains")]

    # Sort by reputation (highest first)
    results.sort(key=lambda a: float(a.get("reputation_score") or 0), reverse=True)

    # Limit results
    if args.limit:
        results = results[:args.limit]

    print(f"\nFound {len(results)} matching agent(s):\n")
    print_agent_table(results)


def cmd_top(args):
    """Show top agents by reputation."""
    print("Fetching top agents by reputation...")

    agents = fetch_agents_pages(max_pages=5)

    # Filter by chain if specified
    if args.chain:
        agents = [a for a in agents if matches_chain(a, args.chain)]

    # Filter to only agents with reputation scores
    agents = [a for a in agents if a.get("reputation_score") is not None]

    # Sort by reputation (highest first)
    agents.sort(key=lambda a: float(a.get("reputation_score") or 0), reverse=True)

    # Limit
    limit = args.limit or 20
    agents = agents[:limit]

    chain_msg = f" on {args.chain}" if args.chain else ""
    print(f"\nTop {len(agents)} agents by reputation{chain_msg}:\n")
    print_agent_table(agents)


def cmd_info(args):
    """Show detailed info about a specific agent."""
    print(f"Looking up agent: {args.agent_id}...")

    agents = fetch_agents_pages(max_pages=5)

    # Find matching agent
    agent_id = args.agent_id.lower()
    found = None

    for agent in agents:
        # Match by address, token_id, or name
        address = (agent.get("address") or "").lower()
        token_id = str(agent.get("token_id") or "")
        name = (agent.get("name") or "").lower()

        if (agent_id == address or
            agent_id in address or
            agent_id == token_id or
            agent_id == name or
            agent_id in name):
            if args.chain and not matches_chain(agent, args.chain):
                continue
            found = agent
            break

    if not found:
        print(f"Agent '{args.agent_id}' not found.", file=sys.stderr)
        sys.exit(1)

    # Print detailed info
    print("\n" + "=" * 60)
    print(f"AGENT: {found.get('name') or 'Unnamed'}")
    print("=" * 60)

    print(f"\n📍 Address:     {found.get('address', '-')}")
    print(f"🔗 Network:     {found.get('network_name', '-')} (ID: {found.get('network_id', '-')})")
    print(f"🎫 Token ID:    {found.get('token_id', '-')}")
    print(f"👤 Owner:       {found.get('owner_address', '-')}")
    print(f"⭐ Reputation:  {format_reputation(found.get('reputation_score'))}")
    print(f"📊 Status:      {found.get('status', '-')}")

    if found.get("description"):
        print(f"\n📝 Description:")
        print(f"   {found.get('description')}")

    skills = found.get("skills") or []
    if skills:
        print(f"\n🛠️  Skills ({len(skills)}):")
        for skill in skills:
            print(f"   • {skill}")

    domains = found.get("domains") or []
    if domains:
        print(f"\n🌐 Domains ({len(domains)}):")
        for domain in domains:
            print(f"   • {domain}")

    # Try to decode metadata
    metadata_uri = found.get("metadata_uri")
    if metadata_uri:
        print(f"\n📦 Metadata URI: {metadata_uri[:80]}{'...' if len(metadata_uri) > 80 else ''}")
        metadata = decode_metadata_uri(metadata_uri)
        if metadata:
            print("\n📋 Decoded Metadata:")
            for key, value in metadata.items():
                if key not in ["name", "description"]:  # Already shown above
                    if isinstance(value, (list, dict)):
                        print(f"   {key}: {json.dumps(value, indent=6)}")
                    else:
                        print(f"   {key}: {value}")

    print("\n" + "=" * 60)


def cmd_stats(args):
    """Show ecosystem statistics."""
    print("Fetching ecosystem statistics...")

    # Fetch all agents
    agents = fetch_agents_pages(max_pages=5)

    # Fetch networks
    try:
        networks = api_request(NETWORKS_ENDPOINT, exit_on_error=False)
    except Exception:
        networks = []

    # Calculate stats
    total = len(agents)

    # Count by chain
    chain_counts = {}
    for agent in agents:
        chain = agent.get("network_name") or "Unknown"
        chain_counts[chain] = chain_counts.get(chain, 0) + 1

    # Count with metadata
    with_metadata = sum(1 for a in agents if a.get("metadata_uri"))

    # Count with reputation
    with_rep = sum(1 for a in agents if a.get("reputation_score") is not None and a.get("reputation_score") > 0)

    # Count with skills
    with_skills = sum(1 for a in agents if a.get("skills"))

    # Average reputation (only for agents that have one)
    rep_scores = [float(a.get("reputation_score")) for a in agents if a.get("reputation_score") is not None]
    avg_rep = sum(rep_scores) / len(rep_scores) if rep_scores else 0

    # Print stats
    print("\n" + "=" * 50)
    print("        ERC-8004 ECOSYSTEM STATISTICS")
    print("=" * 50)

    print(f"\n📊 OVERVIEW")
    print(f"   Total Agents:          {total:,}")
    print(f"   With Metadata:         {with_metadata:,} ({100*with_metadata/total:.1f}%)" if total else "   With Metadata:         0")
    print(f"   With Reputation:       {with_rep:,} ({100*with_rep/total:.1f}%)" if total else "   With Reputation:       0")
    print(f"   With Skills:           {with_skills:,} ({100*with_skills/total:.1f}%)" if total else "   With Skills:           0")
    print(f"   Average Reputation:    {avg_rep:.1f}")

    print(f"\n🔗 AGENTS BY CHAIN")
    for chain, count in sorted(chain_counts.items(), key=lambda x: -x[1]):
        pct = 100 * count / total if total else 0
        bar = "█" * int(pct / 5) + "░" * (20 - int(pct / 5))
        print(f"   {chain:<20} {count:>5} {bar} {pct:>5.1f}%")

    if isinstance(networks, list) and networks:
        print(f"\n🌐 SUPPORTED NETWORKS ({len(networks)})")
        for net in networks[:10]:
            if isinstance(net, dict):
                print(f"   • {net.get('name', net.get('network_name', 'Unknown'))}")
        if len(networks) > 10:
            print(f"   ... and {len(networks) - 10} more")

    print("\n" + "=" * 50)


def cmd_skills(args):
    """List all unique skills found across agents."""
    print("Fetching skills from all agents...")

    agents = fetch_agents_pages(max_pages=5)

    # Collect all skills and domains
    skill_counts = {}
    domain_counts = {}

    for agent in agents:
        for skill in (agent.get("skills") or []):
            skill_counts[skill] = skill_counts.get(skill, 0) + 1
        for domain in (agent.get("domains") or []):
            domain_counts[domain] = domain_counts.get(domain, 0) + 1

    # Print skills
    print("\n" + "=" * 50)
    print("        SKILLS & CAPABILITIES")
    print("=" * 50)

    if skill_counts:
        print(f"\n🛠️  SKILLS ({len(skill_counts)} unique)")
        for skill, count in sorted(skill_counts.items(), key=lambda x: -x[1]):
            print(f"   {skill:<35} ({count} agent{'s' if count > 1 else ''})")
    else:
        print("\n   No skills found.")

    if domain_counts:
        print(f"\n🌐 DOMAINS ({len(domain_counts)} unique)")
        for domain, count in sorted(domain_counts.items(), key=lambda x: -x[1]):
            print(f"   {domain:<35} ({count} agent{'s' if count > 1 else ''})")

    print("\n" + "=" * 50)


def main():
    parser = argparse.ArgumentParser(
        description="ERC-8004 Agent Discovery Tool - Search and discover registered AI agents",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s search "security auditor"
  %(prog)s search "trading" --chain base --min-rep 50
  %(prog)s top --limit 10
  %(prog)s top --chain ethereum
  %(prog)s info 0x1234...
  %(prog)s stats
  %(prog)s skills
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # search command
    search_parser = subparsers.add_parser("search", help="Search for agents by query")
    search_parser.add_argument("query", help="Search query (matches name, description, skills)")
    search_parser.add_argument("--chain", "-c", help="Filter by chain (base, ethereum, polygon, monad, bnb)")
    search_parser.add_argument("--min-rep", "-r", type=float, help="Minimum reputation score")
    search_parser.add_argument("--has-services", "-s", action="store_true", help="Only agents with services/skills")
    search_parser.add_argument("--limit", "-l", type=int, default=20, help="Max results (default: 20)")

    # top command
    top_parser = subparsers.add_parser("top", help="Show top agents by reputation")
    top_parser.add_argument("--chain", "-c", help="Filter by chain")
    top_parser.add_argument("--limit", "-l", type=int, default=20, help="Number of results (default: 20)")

    # info command
    info_parser = subparsers.add_parser("info", help="Get detailed info about an agent")
    info_parser.add_argument("agent_id", help="Agent address, token ID, or name")
    info_parser.add_argument("--chain", "-c", help="Filter by chain (for disambiguation)")

    # stats command
    subparsers.add_parser("stats", help="Show ecosystem statistics")

    # skills command
    subparsers.add_parser("skills", help="List all skills/capabilities")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

    commands = {
        "search": cmd_search,
        "top": cmd_top,
        "info": cmd_info,
        "stats": cmd_stats,
        "skills": cmd_skills,
    }

    commands[args.command](args)


if __name__ == "__main__":
    main()
