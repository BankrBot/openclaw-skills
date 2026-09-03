"""On-Air Shoutout skill backend — submit a shoutout (paid x402) or check status (free).

Submit pays the API's x402 toll ($5 USDC on Base, gasless via EIP-3009) and POSTs
the shoutout. It returns a RECEIPT (request_id + status pending_review), NOT a
confirmed read — GM Farcaster reviews every request and may decline + refund.

Payment safety: the script only signs a payment when the 402 challenge matches
ALL of its local pins — Base mainnet, the canonical USDC contract, GM Farcaster's
receiving wallet, and a max price (default $5). Any other challenge is refused
before anything is signed. Submitting also requires --confirm: without it the
script prints a full preview (text, amount, endpoint, payer) and pays nothing.

    pip install -r requirements.txt
    export GMFARCASTER_PRIVATE_KEY=0x...   # a wallet holding USDC on Base

    # preview (free, prints exactly what would be submitted and paid):
    python request.py --sponsor "Acme Frames" --read "Today's GM is brought to you by Acme..." --url https://acme.xyz
    # submit (pays $5):
    python request.py --sponsor "Acme Frames" --read "..." --url https://acme.xyz --confirm
    # check status (free, no payment):
    python request.py --status sho_8f3c2a1b9d4e

Networks: Base mainnet = eip155:8453 (real USDC) | Base Sepolia = eip155:84532 (test USDC).
"""
import argparse
import json
import os
import re
import sys
from decimal import Decimal, InvalidOperation

import requests

DEFAULT_API_URL = "https://gateway.gmfarcaster.com/v1/shoutout"
API_URL = os.environ.get("GMFARCASTER_SHOUTOUT_API_URL", DEFAULT_API_URL)
NETWORK = os.environ.get("GMFARCASTER_NETWORK", "eip155:8453")  # Base mainnet

MAX_SPONSOR_CHARS = 120
MAX_READ_CHARS = 280

# --- Local payment pins -----------------------------------------------------
# The 402 challenge advertises the price, but the script only pays a challenge
# that matches ALL of these. USDC has 6 decimals, so $5 = 5_000_000 atomic units.
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
MAX_PRICE_USDC = os.environ.get("GMFARCASTER_MAX_PRICE", "5")


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


def _status_base() -> str:
    # Derive the API origin from the submit URL so --status hits the same deployment.
    return API_URL.rsplit("/v1/", 1)[0]


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
            "pointing at a chmod-600 file) to a wallet holding USDC on Base."
        )
    return key


def guard_custom_endpoint() -> None:
    if API_URL == DEFAULT_API_URL:
        return
    if os.environ.get("GMFARCASTER_ALLOW_CUSTOM_ENDPOINT") != "1":
        sys.exit(
            f"GMFARCASTER_SHOUTOUT_API_URL points at a non-default endpoint ({API_URL}). "
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


def validate_submission(args: argparse.Namespace) -> None:
    problems = []
    if not args.sponsor.strip():
        problems.append("--sponsor is empty")
    if len(args.sponsor) > MAX_SPONSOR_CHARS:
        problems.append(f"--sponsor is {len(args.sponsor)} chars (max {MAX_SPONSOR_CHARS})")
    if not args.read.strip():
        problems.append("--read is empty")
    if len(args.read) > MAX_READ_CHARS:
        problems.append(f"--read is {len(args.read)} chars (max {MAX_READ_CHARS})")
    if args.url and not args.url.startswith("https://"):
        problems.append(f"--url must be an https:// URL, got: {args.url}")
    if args.refund_to and not re.fullmatch(r"0x[0-9a-fA-F]{40}", args.refund_to):
        problems.append(f"--refund-to is not a valid 0x-hex EVM address: {args.refund_to}")
    if problems:
        sys.exit("Refusing to submit (nothing was paid):\n  - " + "\n  - ".join(problems))


def print_preview(args: argparse.Namespace, payer: str) -> None:
    print("PREVIEW — nothing has been paid or submitted yet.")
    print(f"  endpoint:   {API_URL}")
    print(f"  network:    {NETWORK}")
    print(f"  price:      up to {MAX_PRICE_USDC} USDC, paid to {' or '.join(EXPECTED_PAYEES)}")
    print(f"  payer:      {payer}")
    print(f"  sponsor:    {args.sponsor}")
    print(f'  read text:  "{args.read}"')
    print(f"  url:        {args.url or '(none)'}")
    if args.refund_to:
        print(f"  refund-to:  {args.refund_to}  <-- OVERRIDES the default refund destination")
        print("              (default is the paying wallet; only use this if the user asked)")
    if args.notes:
        print(f"  notes:      {args.notes} (internal only, never read on air)")
    print("\nThe read text above is what will be read LIVE ON AIR if approved.")
    print("Confirm it with the user, then re-run the same command with --confirm to pay and submit.")


def submit(args: argparse.Namespace) -> None:
    from eth_account import Account
    from x402 import NoMatchingRequirementsError, x402ClientSync
    from x402.mechanisms.evm.exact.client import ExactEvmScheme
    from x402.mechanisms.evm.signers import EthAccountSigner
    from x402.http.clients.requests import PaymentError as X402HttpPaymentError
    from x402.http.clients.requests import x402_requests

    validate_submission(args)
    guard_custom_endpoint()
    account = Account.from_key(load_private_key())

    if not args.confirm:
        print_preview(args, account.address)
        return

    client = x402ClientSync()
    client.register(NETWORK, ExactEvmScheme(EthAccountSigner(account)))
    client.register_policy(pinned_payment_policy)
    session = x402_requests(client)  # auto-handles 402 -> validate pins -> pay -> retry

    body = {"sponsor_name": args.sponsor, "read_text": args.read}
    if args.url:
        body["url"] = args.url
    if args.refund_to:
        body["refund_to_wallet"] = args.refund_to
    if args.notes:
        body["notes"] = args.notes

    try:
        resp = session.post(API_URL, json=body, timeout=60)
        resp.raise_for_status()
    except NoMatchingRequirementsError:
        sys.exit(_pin_refusal_message())
    except X402HttpPaymentError as e:
        if isinstance(e.__cause__, NoMatchingRequirementsError):
            sys.exit(_pin_refusal_message())
        sys.exit(f"Payment handling failed before completion: {e}")
    data = resp.json()

    print("Shoutout submitted — PENDING EDITORIAL REVIEW.")
    print("This is NOT a confirmed read: GM Farcaster may decline and refund it.")
    print(f"  request_id: {data.get('request_id')}")
    print(f"  status:     {data.get('status')}")
    status_url = data.get("status_url") or ""
    if status_url.startswith(_status_base() + "/"):
        print(f"  status_url: {status_url}")
    else:
        print("  status_url: (unexpected value from API — omitted; use the command below)")
    print(f"  amount:     {data.get('amount')}")
    print("\nKeep the request_id. Check status with: python request.py --status <request_id>")


def check_status(request_id: str) -> None:
    resp = requests.get(f"{_status_base()}/v1/shoutout/{request_id}", timeout=30)
    if resp.status_code == 404:
        sys.exit(f"No shoutout request found with id {request_id!r} — check the request_id.")
    resp.raise_for_status()
    print(json.dumps(resp.json(), indent=2))


def main() -> None:
    p = argparse.ArgumentParser(description="Submit or check an On-Air Shoutout.")
    p.add_argument("--sponsor", help="Sponsor name (read on air).")
    p.add_argument("--read", help="The message read live on air (max 280 chars).")
    p.add_argument("--url", help="Optional https link to mention.")
    p.add_argument("--refund-to", dest="refund_to", help="Optional refund wallet override.")
    p.add_argument("--notes", help="Optional internal note (never read on air).")
    p.add_argument(
        "--confirm",
        action="store_true",
        help="Actually pay and submit. Without it, print a preview and pay nothing.",
    )
    p.add_argument("--status", dest="status_id", help="Check status of a request_id (free).")
    args = p.parse_args()

    if args.status_id:
        check_status(args.status_id)
        return
    if not args.sponsor or not args.read:
        p.error("submit requires --sponsor and --read (or use --status <request_id>)")
    submit(args)


if __name__ == "__main__":
    main()
