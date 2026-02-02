#!/usr/bin/env python3
"""
Clanker Deployment Helper - Deploy ERC20 tokens on Base using Clanker protocol.

Requires: web3 Python package (includes eth_abi)
Install: pip install web3

Usage:
    python3 deploy.py <network> <name> <symbol> <initial-lp-eth> <private-key> [--rpc-url <url>]

Example:
    python3 deploy.py testnet "Test Token" TST 0.01 0x...
"""

import json
import sys
import argparse
import os

try:
    from web3 import Web3
except ImportError:
    print("Error: web3 package not installed.")
    print("Install with: pip install web3")
    sys.exit(1)

try:
    from eth_abi import encode
except ImportError:
    print("Error: eth_abi package not installed.")
    print("Install with: pip install eth-abi")
    sys.exit(1)


ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
ZERO_HASH = "0x" + ("00" * 32)

DEFAULT_TICK_IF_TOKEN0 = -230400
DEFAULT_TICK_SPACING = 200
DEFAULT_POOL_POSITIONS = [
    {"tickLower": -230400, "tickUpper": -120000, "positionBps": 10_000},
]
DEFAULT_FEES = {"type": "static", "clankerFee": 100, "pairedFee": 100}
DEFAULT_SNIPER_FEES = {"startingFee": 666_777, "endingFee": 41_673, "secondsToDecay": 15}
FEE_IN_TO_INT = {"Both": 0, "Paired": 1, "Clanker": 2}

WETH_ADDRESSES = {
    "mainnet": "0x4200000000000000000000000000000000000006",
    "testnet": "0x4200000000000000000000000000000000000006",
}

# Clanker v4 deployments (Base mainnet / Base Sepolia)
CLANKER_CONFIG = {
    "mainnet": {
        "chain_id": 8453,
        "address": "0xE85A59c628F7d27878ACeB4bf3b35733630083a9",
        "version": "v4.0.0",
        "deploy_method": "deployToken",
        "related": {
            "locker": "0x63D2DfEA64b3433F4071A98665bcD7Ca14d93496",
            "vault": "0x8E845EAd15737bF71904A30BdDD3aEE76d6ADF6C",
            "airdrop": "0xf652B3610D75D81871bf96DB50825d9af28391E0",
            "devbuy": "0x1331f0788F9c08C8F38D52c7a1152250A9dE00be",
            "mevModule": "0xFdc013ce003980889cFfd66b0c8329545ae1d1E8",
            "mevModuleV2": "0xebB25BB797D82CB78E1bc70406b13233c0854413",
            "feeLocker": "0xF3622742b1E446D92e45E22923Ef11C2fcD55D68",
            "feeStaticHook": "0xDd5EeaFf7BD481AD55Db083062b13a3cdf0A68CC",
            "feeStaticHookV2": "0xb429d62f8f3bFFb98CdB9569533eA23bF0Ba28CC",
            "feeDynamicHook": "0x34a45c6B61876d739400Bd71228CbcbD4F53E8cC",
            "feeDynamicHookV2": "0xd60D6B218116cFd801E28F78d011a203D2b068Cc",
            "presale": "0xeeBbC567C3D612f50a67820f39CDD30dcCF7E6b8",
            "presaleAllowlist": "0x789c2452353eee400868E7d3e5aDD6Be0Ef4185D",
        },
    },
    "testnet": {
        "chain_id": 84532,
        "address": "0xE85A59c628F7d27878ACeB4bf3b35733630083a9",
        "version": "v4.0.0",
        "deploy_method": "deployToken",
        "related": {
            "locker": "0x824bB048a5EC6e06a09aEd115E9eEA4618DC2c8f",
            "vault": "0xcC80d1226F899a78fC2E459a1500A13C373CE0A5",
            "airdrop": "0x5c68F1560a5913c176Fc5238038098970B567B19",
            "devbuy": "0x691f97752E91feAcD7933F32a1FEdCeDae7bB59c",
            "mevModule": "0x261fE99C4D0D41EE8d0e594D11aec740E8354ab0",
            "feeLocker": "0x42A95190B4088C88Dd904d930c79deC1158bF09D",
            "feeStaticHook": "0xDFcCcfBeef7F3Fc8b16027Ce6feACb48024068cC",
            "feeStaticHookV2": "0x11b51DBC2f7F683b81CeDa83DC0078D57bA328cc",
            "feeDynamicHook": "0xE63b0A59100698f379F9B577441A561bAF9828cc",
            "feeDynamicHookV2": "0xBF4983dC0f2F8FE78C5cf8Fc621f294A993728Cc",
        },
    },
}

CLANKER_DEPLOY_ABI = [
    {
        "type": "function",
        "name": "deployToken",
        "inputs": [
            {
                "name": "deploymentConfig",
                "type": "tuple",
                "internalType": "struct IClanker.DeploymentConfig",
                "components": [
                    {
                        "name": "tokenConfig",
                        "type": "tuple",
                        "internalType": "struct IClanker.TokenConfig",
                        "components": [
                            {"name": "tokenAdmin", "type": "address", "internalType": "address"},
                            {"name": "name", "type": "string", "internalType": "string"},
                            {"name": "symbol", "type": "string", "internalType": "string"},
                            {"name": "salt", "type": "bytes32", "internalType": "bytes32"},
                            {"name": "image", "type": "string", "internalType": "string"},
                            {"name": "metadata", "type": "string", "internalType": "string"},
                            {"name": "context", "type": "string", "internalType": "string"},
                            {"name": "originatingChainId", "type": "uint256", "internalType": "uint256"},
                        ],
                    },
                    {
                        "name": "poolConfig",
                        "type": "tuple",
                        "internalType": "struct IClanker.PoolConfig",
                        "components": [
                            {"name": "hook", "type": "address", "internalType": "address"},
                            {"name": "pairedToken", "type": "address", "internalType": "address"},
                            {"name": "tickIfToken0IsClanker", "type": "int24", "internalType": "int24"},
                            {"name": "tickSpacing", "type": "int24", "internalType": "int24"},
                            {"name": "poolData", "type": "bytes", "internalType": "bytes"},
                        ],
                    },
                    {
                        "name": "lockerConfig",
                        "type": "tuple",
                        "internalType": "struct IClanker.LockerConfig",
                        "components": [
                            {"name": "locker", "type": "address", "internalType": "address"},
                            {"name": "rewardAdmins", "type": "address[]", "internalType": "address[]"},
                            {"name": "rewardRecipients", "type": "address[]", "internalType": "address[]"},
                            {"name": "rewardBps", "type": "uint16[]", "internalType": "uint16[]"},
                            {"name": "tickLower", "type": "int24[]", "internalType": "int24[]"},
                            {"name": "tickUpper", "type": "int24[]", "internalType": "int24[]"},
                            {"name": "positionBps", "type": "uint16[]", "internalType": "uint16[]"},
                            {"name": "lockerData", "type": "bytes", "internalType": "bytes"},
                        ],
                    },
                    {
                        "name": "mevModuleConfig",
                        "type": "tuple",
                        "internalType": "struct IClanker.MevModuleConfig",
                        "components": [
                            {"name": "mevModule", "type": "address", "internalType": "address"},
                            {"name": "mevModuleData", "type": "bytes", "internalType": "bytes"},
                        ],
                    },
                    {
                        "name": "extensionConfigs",
                        "type": "tuple[]",
                        "internalType": "struct IClanker.ExtensionConfig[]",
                        "components": [
                            {"name": "extension", "type": "address", "internalType": "address"},
                            {"name": "msgValue", "type": "uint256", "internalType": "uint256"},
                            {"name": "extensionBps", "type": "uint16", "internalType": "uint16"},
                            {"name": "extensionData", "type": "bytes", "internalType": "bytes"},
                        ],
                    },
                ],
            }
        ],
        "outputs": [
            {"name": "tokenAddress", "type": "address", "internalType": "address"}
        ],
        "stateMutability": "payable",
    }
]

CLANKER_READ_ABI = [
    {"type": "function", "name": "enabledHooks", "inputs": [{"name": "hook", "type": "address"}], "outputs": [{"type": "bool"}], "stateMutability": "view"},
    {"type": "function", "name": "enabledLockers", "inputs": [{"name": "locker", "type": "address"}, {"name": "hook", "type": "address"}], "outputs": [{"type": "bool"}], "stateMutability": "view"},
    {"type": "function", "name": "enabledMevModules", "inputs": [{"name": "mevModule", "type": "address"}], "outputs": [{"type": "bool"}], "stateMutability": "view"},
]

TOKEN_CREATED_EVENT_ABI = {
    "type": "event",
    "name": "TokenCreated",
    "inputs": [
        {"name": "msgSender", "type": "address", "indexed": False, "internalType": "address"},
        {"name": "tokenAddress", "type": "address", "indexed": True, "internalType": "address"},
        {"name": "tokenAdmin", "type": "address", "indexed": True, "internalType": "address"},
        {"name": "tokenImage", "type": "string", "indexed": False, "internalType": "string"},
        {"name": "tokenName", "type": "string", "indexed": False, "internalType": "string"},
        {"name": "tokenSymbol", "type": "string", "indexed": False, "internalType": "string"},
        {"name": "tokenMetadata", "type": "string", "indexed": False, "internalType": "string"},
        {"name": "tokenContext", "type": "string", "indexed": False, "internalType": "string"},
        {"name": "startingTick", "type": "int24", "indexed": False, "internalType": "int24"},
        {"name": "poolHook", "type": "address", "indexed": False, "internalType": "address"},
        {"name": "poolId", "type": "bytes32", "indexed": False, "internalType": "PoolId"},
        {"name": "pairedToken", "type": "address", "indexed": False, "internalType": "address"},
        {"name": "locker", "type": "address", "indexed": False, "internalType": "address"},
        {"name": "mevModule", "type": "address", "indexed": False, "internalType": "address"},
        {"name": "extensionsSupply", "type": "uint256", "indexed": False, "internalType": "uint256"},
        {"name": "extensions", "type": "address[]", "indexed": False, "internalType": "address[]"},
    ],
    "anonymous": False,
}

# Default RPC URL candidates (can be overridden by environment variables)
DEFAULT_RPC_URLS = {
    "mainnet": [
        "https://1rpc.io/base",
    ],
    "testnet": [
        "https://sepolia.base.org",
        "https://base-sepolia-rpc.publicnode.com",
        "https://base-sepolia.blockpi.network/v1/rpc/public",
    ],
}

EXPECTED_CHAIN_IDS = {
    "mainnet": 8453,
    "testnet": 84532,
}


def _dedupe(seq):
    seen = set()
    out = []
    for item in seq:
        if not item or item in seen:
            continue
        seen.add(item)
        out.append(item)
    return out


def _rpc_candidates(network, override_url=None):
    candidates = []
    if override_url:
        candidates.append(override_url)

    env_key = f"CLANKER_RPC_{network.upper()}"
    env_url = os.environ.get(env_key)
    if env_url:
        candidates.append(env_url)

    candidates.extend(DEFAULT_RPC_URLS.get(network, []))
    return _dedupe(candidates)


def _connect_rpc(network, override_url=None):
    candidates = _rpc_candidates(network, override_url)
    if not candidates:
        print(f"Error: No RPC URLs configured for {network}")
        sys.exit(1)

    expected_chain_id = EXPECTED_CHAIN_IDS.get(network)
    last_error = None
    for url in candidates:
        try:
            w3 = Web3(Web3.HTTPProvider(url, request_kwargs={"timeout": 8}))
            if not w3.is_connected():
                continue

            chain_id = None
            try:
                chain_id = w3.eth.chain_id
            except Exception as exc:
                last_error = exc

            if expected_chain_id is not None and chain_id is not None and chain_id != expected_chain_id:
                print(
                    f"Warning: RPC {url} returned chain_id {chain_id}, expected {expected_chain_id}. Skipping."
                )
                continue

            return w3, url, chain_id
        except Exception as exc:
            last_error = exc
            continue

    print(f"Error: Failed to connect to {network}")
    print("Tried RPC URLs:")
    for url in candidates:
        print(f"  - {url}")
    if last_error:
        print(f"Last error: {last_error}")
    sys.exit(1)


def _encode(types, values):
    return encode(types, values)


def _encode_tuple(types, values):
    return encode([f"({','.join(types)})"], [tuple(values)])


def deploy_token(network, name, symbol, initial_lp_eth, private_key, rpc_url=None):
    """Deploy a token using Clanker protocol."""

    config = CLANKER_CONFIG.get(network)
    if not config:
        print(f"Error: No Clanker config for {network}")
        sys.exit(1)

    # Connect to network
    w3, rpc_url, chain_id = _connect_rpc(network, rpc_url)

    network_label = "Base" if network == "mainnet" else "Base Sepolia"
    print(f"Connected to {network_label}")
    print(f"RPC: {rpc_url}")
    if chain_id is not None:
        print(f"Chain ID: {chain_id}")

    if chain_id and chain_id != config["chain_id"]:
        print(f"Error: RPC chain id {chain_id} does not match expected {config['chain_id']}")
        sys.exit(1)

    # Check private key
    if private_key.startswith("0x"):
        private_key = private_key[2:]

    account = w3.eth.account.from_key(private_key)
    print(f"Deployer address: {account.address}")

    # Get balance
    balance = w3.eth.get_balance(account.address)
    balance_eth = w3.from_wei(balance, "ether")
    print(f"Balance: {balance_eth:.4f} ETH")

    if balance_eth < 0.001:
        print("Warning: Low balance. You may need more ETH for deployment.")

    clanker_address = config["address"]
    related = config["related"]
    deploy_method = config.get("deploy_method", "deployToken")
    version = config.get("version", "unknown")

    code = w3.eth.get_code(clanker_address)
    if not code or len(code) == 0:
        print(f"Error: No contract code at {clanker_address} on {network_label}")
        sys.exit(1)

    if deploy_method != "deployToken":
        print(f"Warning: Unsupported deploy method '{deploy_method}', using deployToken")
        deploy_method = "deployToken"

    print(f"\nPreparing deployment...")
    print(f"  Token name: {name}")
    print(f"  Token symbol: {symbol}")
    print(f"  Clanker: {clanker_address}")
    print(f"  Version: {version}")
    print(f"  Deploy method: {deploy_method}")

    # Build token config
    metadata = ""
    context = json.dumps({"interface": "clanker.sh"})
    token_admin = account.address

    token_config = (
        token_admin,
        name,
        symbol,
        ZERO_HASH,
        "",
        metadata,
        context,
        int(config["chain_id"]),
    )

    deploy_abi = CLANKER_DEPLOY_ABI

    # Pool config (default WETH pair, standard positions)
    paired_token = WETH_ADDRESSES[network]
    positions = DEFAULT_POOL_POSITIONS

    fee_data = _encode([
        "uint24",
        "uint24",
    ], [
        DEFAULT_FEES["clankerFee"] * 100,
        DEFAULT_FEES["pairedFee"] * 100,
    ])

    version = str(config.get("version", "")).lower()
    use_hook_v2 = version.startswith("v4.1")
    hook = related.get("feeStaticHook")
    if use_hook_v2 and related.get("feeStaticHookV2"):
        hook = related.get("feeStaticHookV2")
        pool_data = _encode(["(address,bytes,bytes)"], [(ZERO_ADDRESS, b"", fee_data)])
    else:
        pool_data = fee_data

    pool_config = (
        hook,
        paired_token,
        DEFAULT_TICK_IF_TOKEN0,
        DEFAULT_TICK_SPACING,
        pool_data,
    )

    # Rewards/locker config
    reward_admins = [token_admin]
    reward_recipients = [token_admin]
    reward_bps = [10_000]
    fee_preferences = [FEE_IN_TO_INT["Both"]]

    locker_data = _encode(["(uint8[])"], [(fee_preferences,)])

    tick_lower = [p["tickLower"] for p in positions]
    tick_upper = [p["tickUpper"] for p in positions]
    position_bps = [p["positionBps"] for p in positions]

    locker_config = (
        related["locker"],
        reward_admins,
        reward_recipients,
        reward_bps,
        tick_lower,
        tick_upper,
        position_bps,
        locker_data,
    )

    # MEV module config
    mev_module = related.get("mevModule")
    mev_module_data = b""
    if use_hook_v2 and related.get("mevModuleV2"):
        mev_module = related.get("mevModuleV2")
        mev_module_data = _encode(["(uint24,uint24,uint256)"], [
            (
                DEFAULT_SNIPER_FEES["startingFee"],
                DEFAULT_SNIPER_FEES["endingFee"],
                DEFAULT_SNIPER_FEES["secondsToDecay"],
            )
        ])

    mev_module_config = (
        mev_module,
        mev_module_data,
    )

    # Optional dev buy extension if initial_lp_eth is provided
    extension_configs = []
    tx_value = 0
    if initial_lp_eth > 0:
        dev_buy_value = w3.to_wei(initial_lp_eth, "ether")
        pool_key = (ZERO_ADDRESS, ZERO_ADDRESS, 0, 0, ZERO_ADDRESS)
        dev_buy_data = _encode(
            ["(address,address,uint24,int24,address)", "uint128", "address"],
            [pool_key, 0, token_admin],
        )
        extension_configs.append((related["devbuy"], int(dev_buy_value), 0, dev_buy_data))
        tx_value = int(dev_buy_value)
        print(f"  Dev buy: {initial_lp_eth} ETH")

    deployment_args = (
        (
            token_config,
            pool_config,
            locker_config,
            mev_module_config,
            extension_configs,
        ),
    )

    clanker_contract = w3.eth.contract(
        address=clanker_address,
        abi=deploy_abi + [TOKEN_CREATED_EVENT_ABI],
    )

    # Preflight checks for enabled hooks/lockers/mev modules (v4)
    try:
        read_contract = w3.eth.contract(address=clanker_address, abi=CLANKER_READ_ABI)
        if not read_contract.functions.enabledHooks(hook).call():
            print(f"Error: Hook not enabled: {hook}")
            sys.exit(1)
        if not read_contract.functions.enabledLockers(related['locker'], hook).call():
            print(f"Error: Locker not enabled for hook: {related['locker']} -> {hook}")
            sys.exit(1)
        if not read_contract.functions.enabledMevModules(mev_module).call():
            print(f"Error: MEV module not enabled: {mev_module}")
            sys.exit(1)
    except Exception as exc:
        print(f"Warning: Could not verify hook/locker/mev module enablement: {exc}")

    # Get the correct function based on deploy method
    deploy_func = getattr(clanker_contract.functions, deploy_method)

    # Build transaction
    nonce = w3.eth.get_transaction_count(account.address)
    tx = deploy_func(*deployment_args).build_transaction({
        "from": account.address,
        "value": tx_value,
        "nonce": nonce,
        "chainId": int(config["chain_id"]),
        # Prevent implicit estimate during build; we will attempt estimate explicitly.
        "gas": 2_500_000,
    })

    # Estimate gas
    try:
        gas_estimate = deploy_func(*deployment_args).estimate_gas({
            "from": account.address,
            "value": tx_value,
        })
        tx["gas"] = int(gas_estimate * 12 // 10)
    except Exception as exc:
        print(f"Warning: Gas estimation failed: {exc}")
        tx["gas"] = 2_500_000

    # Set fees (EIP-1559 if supported)
    try:
        latest_block = w3.eth.get_block("latest")
        if "baseFeePerGas" in latest_block:
            try:
                priority = w3.eth.max_priority_fee
            except Exception:
                priority = w3.to_wei(1, "gwei")
            tx["maxPriorityFeePerGas"] = int(priority)
            tx["maxFeePerGas"] = int(latest_block["baseFeePerGas"] * 2 + priority)
        else:
            tx["gasPrice"] = int(w3.eth.gas_price)
    except Exception:
        tx["gasPrice"] = int(w3.eth.gas_price)

    signed = w3.eth.account.sign_transaction(tx, private_key)
    raw_tx = getattr(signed, "rawTransaction", None)
    if raw_tx is None:
        raw_tx = signed.raw_transaction
    tx_hash = w3.eth.send_raw_transaction(raw_tx)
    tx_hex = tx_hash.hex()

    print("\nSubmitted transaction:")
    print(f"  Hash: {tx_hex}")

    explorer = "https://basescan.org" if network == "mainnet" else "https://sepolia.basescan.org"
    print(f"  Explorer: {explorer}/tx/{tx_hex}")

    # Wait for receipt
    try:
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    except Exception:
        print("\nTransaction pending. Check the explorer for confirmation.")
        return tx_hex

    if receipt.get("status") != 1:
        print("\nTransaction failed.")
        print(f"Explorer: {explorer}/tx/{tx_hex}")
        return tx_hex

    token_address = None
    try:
        events = clanker_contract.events.TokenCreated().process_receipt(receipt)
        if events:
            token_address = events[0]["args"]["tokenAddress"]
    except Exception:
        token_address = None

    print("\nTransaction confirmed.")
    if token_address:
        print(f"Token Address: {token_address}")
        print(f"Explorer: {explorer}/token/{token_address}")

    return tx_hex


def main():
    parser = argparse.ArgumentParser(
        description="Deploy ERC20 tokens on Base using Clanker protocol"
    )
    parser.add_argument(
        "network",
        choices=["mainnet", "testnet"],
        help="Network to deploy on"
    )
    parser.add_argument(
        "name",
        help="Token name"
    )
    parser.add_argument(
        "symbol",
        help="Token symbol (e.g., TST)"
    )
    parser.add_argument(
        "initial_lp_eth",
        type=float,
        help="Initial liquidity in ETH (used as dev buy if > 0)"
    )
    parser.add_argument(
        "private_key",
        help="Private key (with or without 0x prefix)"
    )
    parser.add_argument(
        "--rpc-url",
        dest="rpc_url",
        help="Override RPC URL (otherwise uses env or defaults)"
    )

    args = parser.parse_args()

    deploy_token(
        args.network,
        args.name,
        args.symbol,
        args.initial_lp_eth,
        args.private_key,
        args.rpc_url,
    )


if __name__ == "__main__":
    main()
