"""Query the GM Farcaster Warpee Knowledge API and print a cited answer.

This is the runnable backend for the `gmfarcaster` Claude skill. It pays the
API's x402 402 challenge, signing with the operator's own wallet. The x402
"exact" EVM scheme is gasless for the buyer (EIP-3009), so the wallet needs
USDC on Base but no ETH.

Payment safety: the script only signs a payment when the 402 challenge matches
ALL of its local pins — Base mainnet, the canonical USDC contract, GM
Farcaster's receiving wallet, and a max price (default $0.005). Any other
challenge is refused before anything is signed. The pins are env-overridable
(see SKILL.md) so the operator, not the server, decides when to loosen them.

    pip install -r requirements.txt
    export GMFARCASTER_PRIVATE_KEY=0x...   # a wallet holding USDC on Base
    python query.py "What is the Clanker Ecosystem Fund?"

Networks: Base mainnet = eip155:8453 (real USDC) | Base Sepolia = eip155:84532 (test USDC).
"""
import os
import sys
from decimal import Decimal, InvalidOperation

import requests
from eth_account import Account
from x402 import NoMatchingRequirementsError, x402ClientSync
from x402.mechanisms.evm.exact.client import ExactEvmScheme
from x402.mechanisms.evm.signers import EthAccountSigner
from x402.http.clients.requests import PaymentError as X402HttpPaymentError
from x402.http.clients.requests import x402_requests

DEFAULT_API_URL = "https://api.gmfarcaster.com/v1/query"
API_URL = os.environ.get("GMFARCASTER_API_URL", DEFAULT_API_URL)
NETWORK = os.environ.get("GMFARCASTER_NETWORK", "eip155:8453")  # default: Base mainnet

# --- Local payment pins -----------------------------------------------------
# The 402 challenge advertises the price, but the script only pays a challenge
# that matches ALL of these. USDC has 6 decimals, so $0.005 = 5000 atomic units.
USDC_DECIMALS = 6
EXPECTED_ASSET = os.environ.get(
    "GMFARCASTER_EXPECTED_ASSET",
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",  # canonical USDC on Base mainnet
).lower()
EXPECTED_PAYEES = [
    a.strip().lower()
    for a in os.environ.get(
        "GMFARCASTER_EXPECTED_PAYEE",
        "0x8a99FEF40D17e0bd6d48Ce088Cc207847D1C0596",  # GM Farcaster receiving wallet
    ).split(",")
    if a.strip()
]
MAX_PRICE_USDC = os.environ.get("GMFARCASTER_MAX_PRICE", "0.005")


def _max_amount_atomic() -> int:
    try:
        atomic = int(Decimal(MAX_PRICE_USDC) * (10**USDC_DECIMALS))
    except InvalidOperation:
        sys.exit(f"GMFARCASTER_MAX_PRICE is not a valid decimal USDC amount: {MAX_PRICE_USDC!r}")
    if atomic <= 0:
        sys.exit(f"GMFARCASTER_MAX_PRICE must be positive: {MAX_PRICE_USDC!r}")
    return atomic


MAX_AMOUNT_ATOMIC = _max_amount_atomic()


def pinned_payment_policy(version, reqs):
    """x402 payment policy: drop every challenge entry that doesn't match the pins.

    Runs inside the x402 client's requirement selection, before any signing.
    If nothing survives, the client raises NoMatchingRequirementsError and no
    payment is made.
    """
    return [
        r
        for r in reqs
        if r.network == NETWORK
        and r.asset.lower() == EXPECTED_ASSET
        and r.pay_to.lower() in EXPECTED_PAYEES
        and int(r.get_amount()) <= MAX_AMOUNT_ATOMIC
    ]


def _pin_refusal_message() -> str:
    return (
        "REFUSED TO PAY: the API's 402 challenge did not match this script's payment pins "
        f"(network {NETWORK}, USDC asset {EXPECTED_ASSET}, "
        f"recipient {' or '.join(EXPECTED_PAYEES)}, max {MAX_PRICE_USDC} USDC). "
        "No payment was signed. This can mean a legitimate price change, a misconfigured "
        "endpoint, or a compromised/spoofed server — verify at "
        "https://github.com/atenger/gmfarcaster-api before overriding the pins "
        "(GMFARCASTER_MAX_PRICE / GMFARCASTER_EXPECTED_PAYEE / GMFARCASTER_EXPECTED_ASSET)."
    )


def load_private_key() -> str:
    key_file = os.environ.get("GMFARCASTER_PRIVATE_KEY_FILE")
    if key_file:
        try:
            with open(key_file) as f:
                return f.read().strip()
        except OSError as e:
            sys.exit(f"Could not read GMFARCASTER_PRIVATE_KEY_FILE: {e}")
    key = os.environ.get("GMFARCASTER_PRIVATE_KEY")
    if not key:
        sys.exit(
            "Missing key. Set GMFARCASTER_PRIVATE_KEY (or GMFARCASTER_PRIVATE_KEY_FILE, "
            "pointing at a chmod-600 file) to the private key of a wallet holding USDC "
            "on Base (no ETH needed — x402 settlement is gasless). "
            "Each query costs ~$0.005 USDC."
        )
    return key


def guard_custom_endpoint() -> None:
    if API_URL == DEFAULT_API_URL:
        return
    if os.environ.get("GMFARCASTER_ALLOW_CUSTOM_ENDPOINT") != "1":
        sys.exit(
            f"GMFARCASTER_API_URL points at a non-default endpoint ({API_URL}). "
            "Refusing to send payments there. If this is intentional (e.g. a testnet "
            "deployment), set GMFARCASTER_ALLOW_CUSTOM_ENDPOINT=1 and adjust the "
            "payment pins to match that deployment."
        )
    print(
        f"NOTE: paying a custom endpoint {API_URL} "
        f"(pins: {NETWORK}, recipient {' or '.join(EXPECTED_PAYEES)}, "
        f"max {MAX_PRICE_USDC} USDC).",
        file=sys.stderr,
    )


def main() -> None:
    query = " ".join(sys.argv[1:]).strip()
    if not query:
        sys.exit('Usage: python query.py "<your question about the GM Farcaster archive>"')

    guard_custom_endpoint()
    key = load_private_key()

    account = Account.from_key(key)
    client = x402ClientSync()
    client.register(NETWORK, ExactEvmScheme(EthAccountSigner(account)))
    client.register_policy(pinned_payment_policy)
    session = x402_requests(client)  # auto-handles 402 -> validate pins -> pay -> retry

    try:
        resp = session.post(API_URL, json={"query": query}, timeout=300)
        resp.raise_for_status()
    except NoMatchingRequirementsError:
        sys.exit(_pin_refusal_message())
    except X402HttpPaymentError as e:
        if isinstance(e.__cause__, NoMatchingRequirementsError):
            sys.exit(_pin_refusal_message())
        sys.exit(f"Payment handling failed before completion: {e}")
    except requests.HTTPError:
        status = resp.status_code
        hint = {
            402: "Payment could not be completed — check the wallet holds USDC on Base.",
            400: "The query was rejected (empty or too long).",
        }.get(status, "Please try again shortly.")
        sys.exit(f"GM Farcaster API request failed (HTTP {status}). {hint}")
    except requests.RequestException as e:
        sys.exit(f"Could not reach the GM Farcaster API: {type(e).__name__}.")

    data = resp.json()
    print(data.get("answer", "(no answer returned)"))

    citations = data.get("citations") or []
    if citations:
        print("\nSources:")
        for c in citations:
            label = c.get("title") or c.get("display_name") or c.get("episode") or "source"
            url = c.get("url", "")
            print(f"- {label}: {url}".rstrip())


if __name__ == "__main__":
    main()
