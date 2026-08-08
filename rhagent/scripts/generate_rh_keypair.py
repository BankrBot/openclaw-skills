#!/usr/bin/env python3
"""Generate an Ed25519 keypair for Robinhood Crypto Trading API credentials.

Usage:
  python scripts/generate_rh_keypair.py

Prints base64 private and public keys. Register the public key in Robinhood
crypto account settings (web classic) when creating an API credential.
Store the private key only in RH_PRIVATE_KEY_BASE64 on the gateway — never
in Bankr env vars or source control.
"""

from __future__ import annotations

import base64
import sys


def main() -> int:
    try:
        import nacl.signing
    except ImportError:
        print("Install PyNaCl first: python3 -m pip install pynacl", file=sys.stderr)
        return 1

    private_key = nacl.signing.SigningKey.generate()
    public_key = private_key.verify_key

    private_key_base64 = base64.b64encode(private_key.encode()).decode()
    public_key_base64 = base64.b64encode(public_key.encode()).decode()

    print("Private Key (Base64) — set as RH_PRIVATE_KEY_BASE64 on the gateway:")
    print(private_key_base64)
    print()
    print("Public Key (Base64) — paste into Robinhood when creating API credentials:")
    print(public_key_base64)
    print()
    print("Never share the private key. Robinhood will never ask for it.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
