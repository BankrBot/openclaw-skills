"""
x402 HTTPX Client Example

This example demonstrates how to use x402 with HTTPX to make requests to x402-protected endpoints.
Supports both EVM and SVM networks with automatic payment handling.
"""

import asyncio
import os
from datetime import datetime

from dotenv import load_dotenv
from eth_account import Account

from x402 import x402Client
from x402.http import x402HTTPClient
from x402.http.clients import x402HttpxClient
from x402.mechanisms.evm import EthAccountSigner
from x402.mechanisms.evm.exact.register import register_exact_evm_client
from x402.mechanisms.svm import KeypairSigner
from x402.mechanisms.svm.exact.register import register_exact_svm_client

# Load environment variables
load_dotenv()


async def main() -> None:
    """Main function demonstrating x402 client usage"""
    # Get environment variables
    evm_private_key = os.getenv("EVM_PRIVATE_KEY")
    svm_private_key = os.getenv("SVM_PRIVATE_KEY")
    base_url = os.getenv("RESOURCE_SERVER_URL", "http://localhost:4021")

    # Create x402 client
    client = x402Client()

    # Initialize EVM signer if private key provided
    if evm_private_key:
        account = Account.from_key(evm_private_key)
        register_exact_evm_client(client, EthAccountSigner(account))
        print(f"✅ Initialized EVM account: {account.address}")

    # Initialize SVM signer if private key provided
    if svm_private_key:
        svm_signer = KeypairSigner.from_base58(svm_private_key)
        register_exact_svm_client(client, svm_signer)
        print(f"✅ Initialized SVM account: {svm_signer.address}")

    # Create HTTP client helper
    http_client = x402HTTPClient(client)

    # Example 1: Request weather data
    print(f"\n📡 Making request to: {base_url}/weather")
    async with x402HttpxClient(client) as http:
        response = await http.get(f"{base_url}/weather?city=Tokyo")
        await response.aread()

        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")

        if response.is_success:
            try:
                settle_response = http_client.get_payment_settle_response(
                    lambda name: response.headers.get(name)
                )
                print(f"Payment settled: {settle_response.model_dump_json(indent=2)}")
            except ValueError:
                print("No payment response header found")

    # Example 2: Request premium data
    print(f"\n📡 Making request to: {base_url}/premium/data")
    async with x402HttpxClient(client) as http:
        response = await http.get(f"{base_url}/premium/data")
        await response.aread()

        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")

        if response.is_success:
            try:
                settle_response = http_client.get_payment_settle_response(
                    lambda name: response.headers.get(name)
                )
                print(f"Payment settled: {settle_response.model_dump_json(indent=2)}")
            except ValueError:
                print("No payment response header found")


if __name__ == "__main__":
    asyncio.run(main())
