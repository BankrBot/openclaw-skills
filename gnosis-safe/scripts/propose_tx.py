#!/usr/bin/env python3
"""
propose_tx.py — Propose a Gnosis Safe transaction

Steps:
  1. Fetch current nonce from Safe Transaction Service
  2. Compute EIP-712 safeTxHash
  3. Call approveHash(bytes32) on-chain via `bankr agent`
  4. POST proposal + contract signature to Safe Transaction Service

Usage:
  python3 propose_tx.py \
    --safe    0xYourSafeAddress \
    --to      0xRecipientAddress \
    --value   0.01 \
    --chain   8453 \
    [--signer 0xYourSignerAddress]  # auto-detected via 'bankr whoami' if omitted
    [--data   0xabcdef]             # optional calldata

Requirements:
  pip install eth-utils requests
  bankr must be installed and authenticated (`bankr whoami` must return your address).
  The Safe contract address must be in your Bankr trusted recipients list.
"""

import argparse
import json
import subprocess
import sys

try:
    import requests
except ImportError:
    print("ERROR: 'requests' not installed. Run: pip install requests", file=sys.stderr)
    sys.exit(1)

try:
    from eth_utils import keccak, to_checksum_address
except ImportError:
    print("ERROR: 'eth_utils' not installed. Run: pip install eth-utils", file=sys.stderr)
    sys.exit(1)


# ---------------------------------------------------------------------------
# Chain configuration
# ---------------------------------------------------------------------------

CHAIN_CONFIG = {
    1:    {"name": "ethereum", "tx_service": "https://safe-transaction-mainnet.safe.global"},
    137:  {"name": "polygon",  "tx_service": "https://safe-transaction-polygon.safe.global"},
    8453: {"name": "base",     "tx_service": "https://safe-transaction-base.safe.global"},
}

CHAIN_NAME_MAP = {
    "ethereum": 1,
    "mainnet":  1,
    "polygon":  137,
    "base":     8453,
}


def resolve_chain_id(chain_arg):
    """Accept chain ID (int) or name string, return int chain_id and tx_service URL."""
    try:
        chain_id = int(chain_arg)
    except ValueError:
        chain_id = CHAIN_NAME_MAP.get(chain_arg.lower())
        if chain_id is None:
            print(f"ERROR: Unknown chain '{chain_arg}'. Use 1, 137, 8453, or ethereum/polygon/base.", file=sys.stderr)
            sys.exit(1)
    if chain_id not in CHAIN_CONFIG:
        print(f"ERROR: Unsupported chain_id {chain_id}. Supported: {list(CHAIN_CONFIG.keys())}", file=sys.stderr)
        sys.exit(1)
    return chain_id, CHAIN_CONFIG[chain_id]["tx_service"]


# ---------------------------------------------------------------------------
# EIP-712 hash computation
# ---------------------------------------------------------------------------

def compute_safe_tx_hash(safe_address: str, to: str, value_wei: int, nonce: int,
                          chain_id: int, data: bytes = b"") -> str:
    """
    Compute the EIP-712 safeTxHash for a Gnosis Safe transaction.

    Parameters default to zero for: operation, safeTxGas, baseGas, gasPrice,
    gasToken (zero address), refundReceiver (zero address).
    """
    # Domain separator
    DOMAIN_SEPARATOR_TYPEHASH = keccak(b"EIP712Domain(uint256 chainId,address verifyingContract)")
    safe_addr_bytes = bytes.fromhex(safe_address[2:].lower().zfill(64))
    domain_data = DOMAIN_SEPARATOR_TYPEHASH + chain_id.to_bytes(32, "big") + safe_addr_bytes
    domain_separator = keccak(domain_data)

    # SafeTx struct hash
    SAFE_TX_TYPEHASH = keccak(
        b"SafeTx(address to,uint256 value,bytes data,uint8 operation,"
        b"uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,"
        b"address gasToken,address refundReceiver,uint256 nonce)"
    )

    to_bytes    = bytes.fromhex(to[2:].lower().zfill(64))
    value_bytes = value_wei.to_bytes(32, "big")
    data_hash   = keccak(data)
    zeros       = bytes(32)

    safe_tx_data = (
        SAFE_TX_TYPEHASH
        + to_bytes          # to
        + value_bytes       # value
        + data_hash         # keccak256(data)
        + zeros             # operation (uint8, padded)
        + zeros             # safeTxGas
        + zeros             # baseGas
        + zeros             # gasPrice
        + zeros             # gasToken (zero address)
        + zeros             # refundReceiver (zero address)
        + nonce.to_bytes(32, "big")  # nonce
    )
    safe_tx_hash_inner = keccak(safe_tx_data)

    final_hash = keccak(b"\x19\x01" + domain_separator + safe_tx_hash_inner)
    return "0x" + final_hash.hex()


# ---------------------------------------------------------------------------
# Contract signature encoding
# ---------------------------------------------------------------------------

def build_contract_signature(signer_address: str) -> str:
    """
    Build a Safe 'contract signature' (v=1) for an address that approved on-chain.

    Format: r=address_padded_32bytes | s=zeros_32bytes | v=0x01
    Safe will verify approvedHashes[signer][txHash] == 1 on-chain.
    """
    r = signer_address[2:].lower().zfill(64)  # address as bytes32
    s = "0" * 64                               # 32 zero bytes
    v = "01"                                   # contract signature type
    return "0x" + r + s + v


# ---------------------------------------------------------------------------
# Safe Transaction Service helpers
# ---------------------------------------------------------------------------

def get_safe_nonce(tx_service: str, safe_address: str) -> int:
    """Fetch current Safe nonce from the Transaction Service."""
    url = f"{tx_service}/api/v1/safes/{safe_address}/"
    resp = requests.get(url, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    return data["nonce"]


def validate_address(addr: str, label: str) -> str:
    """Validate that addr is a 42-char hex Ethereum address and return checksummed form."""
    if not addr or not addr.startswith("0x") or len(addr) != 42:
        print(f"ERROR: Invalid {label} address: '{addr}' (must be 0x + 40 hex chars)", file=sys.stderr)
        sys.exit(1)
    try:
        return to_checksum_address(addr)
    except Exception as exc:
        print(f"ERROR: Invalid {label} address: '{addr}': {exc}", file=sys.stderr)
        sys.exit(1)


def get_signer_address(signer_override: str = None) -> str:
    """Resolve the signer's Ethereum address.

    Priority:
      1. signer_override (from --signer CLI arg)
      2. `bankr whoami --json` → parse 'address' field
      3. `bankr whoami` → scan output for a 0x... address line
    """
    if signer_override:
        return validate_address(signer_override, "--signer")

    # Try bankr whoami --json
    try:
        result = subprocess.run(
            ["bankr", "whoami", "--json"],
            capture_output=True, text=True, check=True, timeout=10
        )
        data = json.loads(result.stdout.strip())
        # Handle various possible JSON shapes
        address = (
            data.get("address")
            or (data.get("wallet") or {}).get("address")
        )
        if address and address.startswith("0x") and len(address) == 42:
            return to_checksum_address(address)
    except (subprocess.CalledProcessError, json.JSONDecodeError, KeyError, subprocess.TimeoutExpired):
        pass

    # Fall back to plain bankr whoami — scan for an address line
    try:
        result = subprocess.run(
            ["bankr", "whoami"],
            capture_output=True, text=True, check=True, timeout=10
        )
        for line in result.stdout.splitlines():
            stripped = line.strip().rstrip(",;")
            if stripped.startswith("0x") and len(stripped) == 42:
                return to_checksum_address(stripped)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        pass

    print("ERROR: Could not determine signer address from 'bankr whoami'.", file=sys.stderr)
    print("  Pass --signer 0xYourAddress to specify it explicitly.", file=sys.stderr)
    sys.exit(1)


def approve_hash_on_chain(safe_address: str, safe_tx_hash: str) -> str:
    """Call approveHash(bytes32) on the Safe contract via `bankr agent`.

    Encodes the calldata as: selector 0xd4d9bdcd + hash padded to 32 bytes.
    Uses natural-language Bankr agent to submit the raw transaction.
    """
    hash_no_prefix = safe_tx_hash[2:].lower().zfill(64)
    calldata = f"0xd4d9bdcd{hash_no_prefix}"
    prompt = (
        f"Submit raw transaction on Base (chain 8453):\n"
        f"- to: {safe_address}\n"
        f"- data: {calldata}\n"
        f"- value: 0\n"
        f"Wait for confirmation and return the tx hash."
    )
    print(f"[*] Calling approveHash on-chain for hash: {safe_tx_hash}")
    print(f"[*] Calldata: {calldata}")
    result = subprocess.run(
        ["bankr", "agent", prompt],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"ERROR: bankr agent approveHash failed:\n{result.stderr}", file=sys.stderr)
        sys.exit(1)
    output = result.stdout.strip()
    print(f"[✓] approveHash submitted. Bankr response: {output[:300]}")
    return output


def post_proposal(tx_service: str, safe_address: str, to: str, value_wei: int,
                   data_hex: str, nonce: int, safe_tx_hash: str,
                   signer_address: str, signature: str) -> dict:
    """POST the transaction proposal to the Safe Transaction Service."""
    url = f"{tx_service}/api/v1/safes/{safe_address}/multisig-transactions/"
    payload = {
        "to":                       to_checksum_address(to),
        "value":                    str(value_wei),
        "data":                     data_hex or "0x",
        "operation":                0,
        "safeTxGas":                0,
        "baseGas":                  0,
        "gasPrice":                 "0",
        "gasToken":                 "0x0000000000000000000000000000000000000000",
        "refundReceiver":           "0x0000000000000000000000000000000000000000",
        "nonce":                    nonce,
        "contractTransactionHash":  safe_tx_hash,
        "sender":                   to_checksum_address(signer_address),
        "signature":                signature,
    }
    print(f"[*] POSTing proposal to {url}")
    resp = requests.post(url, json=payload, timeout=15)
    if resp.status_code not in (200, 201):
        print(f"ERROR: Safe TX service returned {resp.status_code}:", file=sys.stderr)
        print(resp.text, file=sys.stderr)
        sys.exit(1)
    return resp.json() if resp.text else {}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def parse_args():
    parser = argparse.ArgumentParser(
        description="Propose a Gnosis Safe transaction via approveHash + Safe TX Service"
    )
    parser.add_argument("--safe",   required=True, help="Safe contract address (0x...)")
    parser.add_argument("--to",     required=True, help="Destination address (0x...)")
    parser.add_argument("--value",  required=True, type=float, help="ETH value to send (e.g. 0.01)")
    parser.add_argument("--chain",  required=True, help="Chain ID or name: 8453, 1, 137, base, ethereum, polygon")
    parser.add_argument("--signer", default=None,
                        help="Signer address (0x...); auto-detected via 'bankr whoami' if omitted")
    parser.add_argument("--data",   default="",    help="Optional calldata hex (e.g. 0xabcdef)")
    parser.add_argument("--nonce",  type=int, default=None,
                        help="Override Safe nonce (auto-fetched if not provided)")
    return parser.parse_args()


def main():
    args = parse_args()

    # Resolve chain
    chain_id, tx_service = resolve_chain_id(args.chain)
    print(f"[*] Chain: {CHAIN_CONFIG[chain_id]['name']} (id={chain_id})")
    print(f"[*] TX Service: {tx_service}")

    # Validate and normalize addresses
    safe_address = validate_address(args.safe, "--safe")
    to_address   = validate_address(args.to, "--to")

    # Convert ETH to wei
    value_wei = int(args.value * 10**18)
    print(f"[*] Safe: {safe_address}")
    print(f"[*] To:   {to_address}")
    print(f"[*] Value: {args.value} ETH ({value_wei} wei)")

    # Calldata
    data_hex = args.data.strip()
    if data_hex and not data_hex.startswith("0x"):
        data_hex = "0x" + data_hex
    data_bytes = bytes.fromhex(data_hex[2:]) if data_hex else b""
    print(f"[*] Data: {data_hex or '(none)'}")

    # Fetch nonce
    if args.nonce is not None:
        nonce = args.nonce
        print(f"[*] Nonce: {nonce} (override)")
    else:
        nonce = get_safe_nonce(tx_service, safe_address)
        print(f"[*] Nonce: {nonce} (from TX service)")

    # Compute EIP-712 hash
    safe_tx_hash = compute_safe_tx_hash(
        safe_address=safe_address,
        to=to_address,
        value_wei=value_wei,
        nonce=nonce,
        chain_id=chain_id,
        data=data_bytes,
    )
    print(f"[*] safeTxHash: {safe_tx_hash}")

    # Get signer address (from --signer arg or bankr whoami)
    signer_address = get_signer_address(args.signer)
    print(f"[*] Signer: {signer_address}")

    # Approve on-chain via bankr agent
    approve_hash_on_chain(safe_address, safe_tx_hash)

    # Build contract signature
    signature = build_contract_signature(signer_address)

    # Post proposal to Safe TX Service
    result = post_proposal(
        tx_service=tx_service,
        safe_address=safe_address,
        to=to_address,
        value_wei=value_wei,
        data_hex=data_hex,
        nonce=nonce,
        safe_tx_hash=safe_tx_hash,
        signer_address=signer_address,
        signature=signature,
    )

    print()
    print("=" * 60)
    print("[✓] Transaction proposed successfully!")
    print(f"    safeTxHash: {safe_tx_hash}")
    print(f"    Nonce:      {nonce}")
    print(f"    To:         {to_address}")
    print(f"    Value:      {args.value} ETH")
    print()
    print("Share the safeTxHash with other owners so they can approve.")
    print(f"Track at: https://app.safe.global/transactions/queue?safe={safe_address}")
    print("=" * 60)


if __name__ == "__main__":
    main()
