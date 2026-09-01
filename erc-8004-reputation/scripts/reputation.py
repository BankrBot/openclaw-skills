#!/usr/bin/env python3
"""
ERC-8004 Reputation Registry CLI

Interact with the decentralized reputation layer for AI agents.
Part of the OpenClaw skill ecosystem.

Usage:
    python reputation.py lookup <agentId> [--chain base|ethereum|polygon|monad|bnb]
    python reputation.py give <agentId> <value> [--tag1 TAG] [--tag2 TAG] [--chain CHAIN]
    python reputation.py my-rep <agentId>
    python reputation.py clients <agentId> [--chain CHAIN]
    python reputation.py feedback <agentId> <clientAddress> <feedbackIndex> [--chain CHAIN]
    python reputation.py revoke <agentId> <feedbackIndex> [--chain CHAIN]
"""

import argparse
import json
import os
import sys

from web3 import Web3
from eth_account import Account

# =============================================================================
# CONSTANTS
# =============================================================================

IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
REPUTATION_REGISTRY = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63"

CHAINS = {
    "base": {"id": 8453, "rpc": "https://mainnet.base.org", "name": "Base", "symbol": "ETH"},
    "ethereum": {"id": 1, "rpc": "https://ethereum-rpc.publicnode.com", "name": "Ethereum", "symbol": "ETH"},
    "polygon": {"id": 137, "rpc": "https://polygon-rpc.com", "name": "Polygon", "symbol": "MATIC"},
    "monad": {"id": 143, "rpc": "https://rpc.monad.xyz", "name": "Monad", "symbol": "MON"},
    "bnb": {"id": 56, "rpc": "https://bsc-rpc.publicnode.com", "name": "BNB Chain", "symbol": "BNB"},
}

DEFAULT_CHAIN = "base"

# =============================================================================
# ABI — matches the deployed ERC-8004 Reputation Registry contracts
# Verified against live contracts on Base and Ethereum mainnet
# =============================================================================

REPUTATION_ABI = [
    {
        "inputs": [
            {"name": "agentId", "type": "uint256"},
            {"name": "value", "type": "int128"},
            {"name": "valueDecimals", "type": "uint8"},
            {"name": "tag1", "type": "string"},
            {"name": "tag2", "type": "string"},
            {"name": "endpoint", "type": "string"},
            {"name": "feedbackURI", "type": "string"},
            {"name": "feedbackHash", "type": "bytes32"}
        ],
        "name": "giveFeedback",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"name": "agentId", "type": "uint256"},
            {"name": "clientAddress", "type": "address"},
            {"name": "feedbackIndex", "type": "uint64"}
        ],
        "name": "readFeedback",
        "outputs": [
            {"name": "value", "type": "int128"},
            {"name": "valueDecimals", "type": "uint8"},
            {"name": "tag1", "type": "string"},
            {"name": "tag2", "type": "string"},
            {"name": "isRevoked", "type": "bool"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"name": "agentId", "type": "uint256"},
            {"name": "clientAddresses", "type": "address[]"},
            {"name": "tag1", "type": "string"},
            {"name": "tag2", "type": "string"},
            {"name": "includeRevoked", "type": "bool"}
        ],
        "name": "readAllFeedback",
        "outputs": [
            {"name": "clients", "type": "address[]"},
            {"name": "feedbackIndexes", "type": "uint64[]"},
            {"name": "values", "type": "int128[]"},
            {"name": "valueDecimals", "type": "uint8[]"},
            {"name": "tag1s", "type": "string[]"},
            {"name": "tag2s", "type": "string[]"},
            {"name": "revokedStatuses", "type": "bool[]"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"name": "agentId", "type": "uint256"},
            {"name": "clientAddresses", "type": "address[]"},
            {"name": "tag1", "type": "string"},
            {"name": "tag2", "type": "string"}
        ],
        "name": "getSummary",
        "outputs": [
            {"name": "count", "type": "uint64"},
            {"name": "summaryValue", "type": "int128"},
            {"name": "summaryValueDecimals", "type": "uint8"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"name": "agentId", "type": "uint256"},
            {"name": "feedbackIndex", "type": "uint64"}
        ],
        "name": "revokeFeedback",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"name": "agentId", "type": "uint256"}],
        "name": "getClients",
        "outputs": [{"name": "", "type": "address[]"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"name": "agentId", "type": "uint256"},
            {"name": "clientAddress", "type": "address"}
        ],
        "name": "getLastIndex",
        "outputs": [{"name": "", "type": "uint64"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"name": "agentId", "type": "uint256"},
            {"name": "clientAddress", "type": "address"},
            {"name": "feedbackIndex", "type": "uint64"},
            {"name": "responseURI", "type": "string"},
            {"name": "responseHash", "type": "bytes32"}
        ],
        "name": "appendResponse",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"name": "agentId", "type": "uint256"},
            {"name": "clientAddress", "type": "address"},
            {"name": "feedbackIndex", "type": "uint64"},
            {"name": "responders", "type": "address[]"}
        ],
        "name": "getResponseCount",
        "outputs": [{"name": "count", "type": "uint64"}],
        "stateMutability": "view",
        "type": "function"
    },
]

# =============================================================================
# HELPERS
# =============================================================================

def get_web3(chain: str, exit_on_error: bool = True) -> Web3:
    """Connect to chain RPC."""
    if chain not in CHAINS:
        message = f"Unknown chain: {chain}. Options: {', '.join(CHAINS.keys())}"
        if exit_on_error:
            print(message, file=sys.stderr)
            sys.exit(1)
        raise ValueError(message)
    w3 = Web3(Web3.HTTPProvider(CHAINS[chain]["rpc"]))
    if not w3.is_connected():
        message = f"Failed to connect to {CHAINS[chain]['name']} RPC"
        if exit_on_error:
            print(message, file=sys.stderr)
            sys.exit(1)
        raise ConnectionError(message)
    return w3


def get_contract(w3: Web3):
    """Get Reputation Registry contract instance."""
    return w3.eth.contract(address=REPUTATION_REGISTRY, abi=REPUTATION_ABI)


def get_wallet():
    """Load wallet from environment variables."""
    mnemonic = os.environ.get("ERC8004_MNEMONIC")
    private_key = os.environ.get("ERC8004_PRIVATE_KEY")

    if mnemonic:
        Account.enable_unaudited_hdwallet_features()
        return Account.from_mnemonic(mnemonic)
    elif private_key:
        if not private_key.startswith("0x"):
            private_key = "0x" + private_key
        return Account.from_key(private_key)
    else:
        print("Wallet not configured. Set ERC8004_MNEMONIC or ERC8004_PRIVATE_KEY", file=sys.stderr)
        sys.exit(1)


def parse_agent_id(raw: str) -> int:
    """Parse agent ID — accepts integer or 0x-prefixed hex."""
    try:
        if raw.startswith("0x"):
            return int(raw, 16)
        return int(raw)
    except ValueError:
        print(f"Invalid agent ID: {raw}. Must be an integer (e.g., 16700) or hex.", file=sys.stderr)
        sys.exit(1)


def format_value(value: int, decimals: int) -> str:
    """Format a feedback value with its decimals."""
    if decimals == 0:
        return str(value)
    return f"{value / (10 ** decimals):.{decimals}f}"


# =============================================================================
# COMMANDS
# =============================================================================

def cmd_lookup(args):
    """Look up an agent's reputation summary."""
    agent_id = parse_agent_id(args.agent_id)
    chain = args.chain or DEFAULT_CHAIN
    w3 = get_web3(chain)
    contract = get_contract(w3)

    print(f"Agent ID: {agent_id}")
    print(f"Chain: {chain} ({CHAINS[chain]['name']})")

    # Get clients first (needed for getSummary)
    try:
        clients = contract.functions.getClients(agent_id).call()
    except Exception as e:
        print(f"Error querying clients: {e}", file=sys.stderr)
        sys.exit(1)

    if not clients:
        print("Score: No feedback yet")
        return

    print(f"Reviewers: {len(clients)}")

    # Get summary across all clients
    try:
        count, value, decimals = contract.functions.getSummary(agent_id, clients, "", "").call()
        print(f"Feedback count: {count}")
        print(f"Summary value: {format_value(value, decimals)}")
        if count > 0 and decimals == 0:
            print(f"Average: {value / count:.1f}")
    except Exception as e:
        print(f"Error querying summary: {e}", file=sys.stderr)

    # Show individual feedback
    print(f"\nFeedback details:")
    for client in clients:
        try:
            last_idx = contract.functions.getLastIndex(agent_id, client).call()
            for idx in range(1, last_idx + 1):
                fb = contract.functions.readFeedback(agent_id, client, idx).call()
                value, val_dec, tag1, tag2, revoked = fb
                status = " [REVOKED]" if revoked else ""
                tags = ""
                if tag1 or tag2:
                    tags = f" ({', '.join(t for t in [tag1, tag2] if t)})"
                print(f"  #{idx} from {client[:10]}...{client[-6:]}: {format_value(value, val_dec)}{tags}{status}")
        except Exception as e:
            print(f"  Error reading feedback from {client[:10]}...: {e}")


def cmd_give(args):
    """Give feedback to an agent."""
    agent_id = parse_agent_id(args.agent_id)
    value = int(args.value)
    value_decimals = int(args.decimals)
    if value_decimals < 0 or value_decimals > 18:
        print("Error: --decimals must be between 0 and 18 (per ERC-8004 spec)", file=sys.stderr)
        sys.exit(1)
    tag1 = args.tag1 or ""
    tag2 = args.tag2 or ""
    endpoint = args.endpoint or ""
    chain = args.chain or DEFAULT_CHAIN

    w3 = get_web3(chain)
    contract = get_contract(w3)
    acct = get_wallet()

    print(f"Giving feedback to agent {agent_id} on {CHAINS[chain]['name']}")
    print(f"Value: {format_value(value, value_decimals)}, Tags: {tag1 or '(none)'}, {tag2 or '(none)'}")
    print(f"From: {acct.address}")

    # Build tx
    empty_hash = b'\x00' * 32
    try:
        gas_estimate = contract.functions.giveFeedback(
            agent_id, value, value_decimals, tag1, tag2, endpoint, "", empty_hash
        ).estimate_gas({'from': acct.address})
    except Exception as e:
        print(f"Gas estimation failed: {e}", file=sys.stderr)
        print("This may mean you own this agent (can't rate your own agent) or the agent ID is invalid.")
        sys.exit(1)

    gas_price = w3.eth.gas_price
    cost = gas_estimate * gas_price
    print(f"Gas: {gas_estimate} (~{w3.from_wei(cost, 'ether'):.8f} {CHAINS[chain]['symbol']})")

    nonce = w3.eth.get_transaction_count(acct.address)
    tx = contract.functions.giveFeedback(
        agent_id, value, value_decimals, tag1, tag2, endpoint, "", empty_hash
    ).build_transaction({
        'chainId': CHAINS[chain]['id'],
        'gas': int(gas_estimate * 1.2),
        'gasPrice': gas_price,
        'nonce': nonce,
    })

    signed = acct.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    print(f"TX sent: {tx_hash.hex()}")

    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    if receipt['status'] == 1:
        print(f"✅ Feedback submitted! Gas used: {receipt['gasUsed']}")
    else:
        print("❌ Transaction failed!", file=sys.stderr)
        sys.exit(1)


def cmd_my_rep(args):
    """Check your own agent's reputation across chains."""
    agent_id = parse_agent_id(args.agent_id)
    chains_to_check = args.chains.split(",") if args.chains else list(CHAINS.keys())

    print(f"Reputation for Agent ID: {agent_id}\n")

    for chain in chains_to_check:
        chain = chain.strip()
        if chain not in CHAINS:
            continue
        try:
            w3 = get_web3(chain, exit_on_error=False)
            contract = get_contract(w3)
            clients = contract.functions.getClients(agent_id).call()
            if not clients:
                print(f"  {CHAINS[chain]['name']}: No feedback yet")
                continue
            count, value, decimals = contract.functions.getSummary(agent_id, clients, "", "").call()
            avg = f" (avg: {value/count:.1f})" if count > 0 and decimals == 0 else ""
            print(f"  {CHAINS[chain]['name']}: {count} reviews, value: {format_value(value, decimals)}{avg}")
        except Exception as e:
            print(f"  {CHAINS[chain]['name']}: Error - {e}")


def cmd_clients(args):
    """List clients who gave feedback to an agent."""
    agent_id = parse_agent_id(args.agent_id)
    chain = args.chain or DEFAULT_CHAIN
    w3 = get_web3(chain)
    contract = get_contract(w3)

    print(f"Clients for Agent ID {agent_id} on {CHAINS[chain]['name']}:")

    try:
        clients = contract.functions.getClients(agent_id).call()
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    if not clients:
        print("  No clients yet")
        return

    for client in clients:
        try:
            last_idx = contract.functions.getLastIndex(agent_id, client).call()
            print(f"  {client} ({last_idx} feedback{'s' if last_idx != 1 else ''})")
        except Exception:
            print(f"  {client}")


def cmd_feedback(args):
    """Read specific feedback."""
    agent_id = parse_agent_id(args.agent_id)
    client = Web3.to_checksum_address(args.client_address)
    index = int(args.feedback_index)
    chain = args.chain or DEFAULT_CHAIN
    w3 = get_web3(chain)
    contract = get_contract(w3)

    try:
        value, decimals, tag1, tag2, revoked = contract.functions.readFeedback(agent_id, client, index).call()
        print(f"Agent: {agent_id}")
        print(f"From: {client}")
        print(f"Index: {index}")
        print(f"Value: {format_value(value, decimals)}")
        print(f"Tags: {tag1 or '(none)'}, {tag2 or '(none)'}")
        print(f"Revoked: {revoked}")
    except Exception as e:
        print(f"Error reading feedback: {e}", file=sys.stderr)
        sys.exit(1)


def cmd_revoke(args):
    """Revoke feedback you previously gave."""
    agent_id = parse_agent_id(args.agent_id)
    index = int(args.feedback_index)
    chain = args.chain or DEFAULT_CHAIN
    w3 = get_web3(chain)
    contract = get_contract(w3)
    acct = get_wallet()

    print(f"Revoking feedback #{index} for agent {agent_id} on {CHAINS[chain]['name']}")

    try:
        gas_estimate = contract.functions.revokeFeedback(agent_id, index).estimate_gas({'from': acct.address})
    except Exception as e:
        print(f"Failed: {e}", file=sys.stderr)
        sys.exit(1)

    gas_price = w3.eth.gas_price
    nonce = w3.eth.get_transaction_count(acct.address)

    tx = contract.functions.revokeFeedback(agent_id, index).build_transaction({
        'chainId': CHAINS[chain]['id'],
        'gas': int(gas_estimate * 1.2),
        'gasPrice': gas_price,
        'nonce': nonce,
    })

    signed = acct.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    print(f"TX sent: {tx_hash.hex()}")

    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    if receipt['status'] == 1:
        print(f"✅ Feedback revoked!")
    else:
        print("❌ Transaction failed!", file=sys.stderr)
        sys.exit(1)


# =============================================================================
# CLI
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="ERC-8004 Reputation Registry CLI",
        epilog="""Examples:
  %(prog)s lookup 16700
  %(prog)s lookup 16700 --chain ethereum
  %(prog)s give 16700 85 --tag1 reliable --tag2 fast
  %(prog)s give 16700 9977 --decimals 2 --tag1 uptime
  %(prog)s my-rep 16700
  %(prog)s clients 16700
  %(prog)s feedback 16700 0xABC...DEF 1
  %(prog)s revoke 16700 3""",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    sub = parser.add_subparsers(dest="command")

    # lookup
    p_lookup = sub.add_parser("lookup", help="Look up an agent's reputation")
    p_lookup.add_argument("agent_id", help="Agent ID (integer, e.g. 16700)")
    p_lookup.add_argument("--chain", choices=CHAINS.keys(), default=DEFAULT_CHAIN)
    p_lookup.set_defaults(func=cmd_lookup)

    # give
    p_give = sub.add_parser("give", help="Give feedback to an agent")
    p_give.add_argument("agent_id", help="Agent ID (integer)")
    p_give.add_argument("value", help="Feedback value (e.g. 85 for score, 9977 for 99.77%%)")
    p_give.add_argument("--decimals", default="0", help="Value decimals (default: 0, meaning integer score)")
    p_give.add_argument("--tag1", default="", help="Primary tag (e.g. 'reliable', 'uptime', 'starred')")
    p_give.add_argument("--tag2", default="", help="Secondary tag (e.g. 'fast', 'quality')")
    p_give.add_argument("--endpoint", default="", help="Endpoint being rated (optional)")
    p_give.add_argument("--chain", choices=CHAINS.keys(), default=DEFAULT_CHAIN)
    p_give.set_defaults(func=cmd_give)

    # my-rep
    p_myrep = sub.add_parser("my-rep", help="Check your own reputation across chains")
    p_myrep.add_argument("agent_id", help="Your agent ID (integer)")
    p_myrep.add_argument("--chains", default=None, help="Comma-separated chains to check (default: all)")
    p_myrep.set_defaults(func=cmd_my_rep)

    # clients
    p_clients = sub.add_parser("clients", help="List clients who gave feedback")
    p_clients.add_argument("agent_id", help="Agent ID (integer)")
    p_clients.add_argument("--chain", choices=CHAINS.keys(), default=DEFAULT_CHAIN)
    p_clients.set_defaults(func=cmd_clients)

    # feedback
    p_feedback = sub.add_parser("feedback", help="Read specific feedback entry")
    p_feedback.add_argument("agent_id", help="Agent ID (integer)")
    p_feedback.add_argument("client_address", help="Client address (0x...)")
    p_feedback.add_argument("feedback_index", help="Feedback index (1-based)")
    p_feedback.add_argument("--chain", choices=CHAINS.keys(), default=DEFAULT_CHAIN)
    p_feedback.set_defaults(func=cmd_feedback)

    # revoke
    p_revoke = sub.add_parser("revoke", help="Revoke your feedback")
    p_revoke.add_argument("agent_id", help="Agent ID (integer)")
    p_revoke.add_argument("feedback_index", help="Feedback index to revoke")
    p_revoke.add_argument("--chain", choices=CHAINS.keys(), default=DEFAULT_CHAIN)
    p_revoke.set_defaults(func=cmd_revoke)

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == "__main__":
    main()
