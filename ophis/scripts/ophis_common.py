"""Shared helpers for the Ophis Bankr skill: chain maps, appData, ABI encoding,
Ophis/CoW orderbook calls, and the Bankr Submit API.

All endpoint URLs and contract addresses below are taken from @ophis/sdk
(packages/sdk/src/{orderbook,domain,partner-fee,flow}.ts). See references/api.md
for the source-of-truth citations.

Ophis is CoW Protocol intent settlement: a swap is an OFF-CHAIN signed order, not
a normal swap tx. From a Bankr-managed wallet we authorize the order with the
`presign` scheme — POST the order, then send an on-chain setPreSignature(uid,true)
to the Settlement contract via the Bankr Submit API — so no raw message-signing is
needed (a clean fit for Bankr's transaction-submission model).
"""
from __future__ import annotations

import json
import os
import re
import socket
import sys
import urllib.request
import urllib.error

# ── Per-chain orderbook base URL (OPHIS_ORDERBOOK_URLS, orderbook.ts) ──────────
# CoW-hosted chains hit api.cow.fi/<slug>; OP + Unichain hit the Ophis self-hosted
# orderbook (hitting api.cow.fi there silently bypasses the Ophis solver + fee).
ORDERBOOK_URLS = {
    1:        "https://api.cow.fi/mainnet",
    100:      "https://api.cow.fi/xdai",
    137:      "https://api.cow.fi/polygon",
    8453:     "https://api.cow.fi/base",
    42161:    "https://api.cow.fi/arbitrum_one",
    43114:    "https://api.cow.fi/avalanche",
    56:       "https://api.cow.fi/bnb",
    59144:    "https://api.cow.fi/linea",
    9745:     "https://api.cow.fi/plasma",
    57073:    "https://api.cow.fi/ink",
    11155111: "https://api.cow.fi/sepolia",
    10:       "https://optimism-mainnet.ophis.fi",   # Ophis-sovereign
    130:      "https://unichain-mainnet.ophis.fi",   # Ophis-sovereign
}

# ── Settlement (setPreSignature target) + VaultRelayer (approve spender) ───────
# domain.ts. Canonical CoW addresses on hosted chains; NON-canonical on OP/Unichain
# (using the canonical addresses there makes the order/signature silently invalid).
_CANONICAL_SETTLEMENT = "0x9008D19f58AAbD9eD0D60971565AA8510560ab41"
_CANONICAL_RELAYER = "0xC92E8bdf79f0507f65a392b0ab4667716BFE0110"
SETTLEMENT = {
    10:  "0x310784c7FCE12d578dA6f53460777bAc9718B859",
    130: "0x108A678716e5E1776036eF044CAB7064226F714E",
}
VAULT_RELAYER = {
    10:  "0x83847EaB41ad9ea43809ce71569eB2e9daF51830",
    130: "0xaB29E2a859704C914E55566Ae9b3A7EDE25959cb",
}

# ── Ophis partner fee (partner-fee.ts) ────────────────────────────────────────
OPHIS_PARTNER_FEE_RECIPIENT = "0x858f0F5eE954846D47155F5203c04aF1819eCeF8"  # Ophis Safe
OPHIS_VOLUME_FEE_BPS = 5          # integrator/partner rate
OPHIS_STABLE_VOLUME_FEE_BPS = 1   # stable-stable pair rate
APP_DATA_VERSION = "1.4.0"

REBATE_INDEXER_URL = "https://rebates.ophis.fi"
BANKR_API = "https://api.bankr.bot"


def orderbook_url(chain_id: int) -> str:
    url = ORDERBOOK_URLS.get(chain_id)
    if not url:
        sys.exit(
            f"chain {chain_id} has no Ophis orderbook (unsupported or paused). "
            f"Supported: {sorted(ORDERBOOK_URLS)}"
        )
    return url


def settlement_address(chain_id: int) -> str:
    return SETTLEMENT.get(chain_id, _CANONICAL_SETTLEMENT)


def vault_relayer(chain_id: int) -> str:
    return VAULT_RELAYER.get(chain_id, _CANONICAL_RELAYER)


# ── keccak256 (needed for appDataHash + the setPreSignature selector) ──────────
# hashlib.sha3_256 is NOT keccak256 (different padding), so we need a keccak lib.
def keccak256(data: bytes) -> bytes:
    try:
        import sha3  # pysha3
        h = sha3.keccak_256()
        h.update(data)
        return h.digest()
    except Exception:
        pass
    try:
        from Crypto.Hash import keccak  # pycryptodome
        h = keccak.new(digest_bits=256)
        h.update(data)
        return h.digest()
    except Exception:
        pass
    try:
        from eth_hash.auto import keccak as ek  # eth-hash
        return ek(data)
    except Exception:
        pass
    sys.exit(
        "No keccak256 backend found. Install one:\n"
        "  pip install pysha3        # or\n"
        "  pip install pycryptodome  # or\n"
        "  pip install 'eth-hash[pycryptodome]'"
    )


# ── Ophis appData (flow.ts / partner-fee.ts / referral.ts) ────────────────────
def build_app_data(referral_code: str | None = None, is_stable_pair: bool = False):
    """Return (full_app_data_string, app_data_hash_0x).

    appCode MUST be the literal 'ophis' or the rebate indexer silently drops the
    order. partnerFee is the CIP-75 VOLUME shape {volumeBps, recipient}. The pair
    is signed with appData=hash but SUBMITTED with appData=full string + a separate
    appDataHash; the backend checks keccak256(full) == hash, so the two are always
    self-consistent here regardless of key ordering.
    """
    metadata = {
        "partnerFee": {
            "volumeBps": OPHIS_STABLE_VOLUME_FEE_BPS if is_stable_pair else OPHIS_VOLUME_FEE_BPS,
            "recipient": OPHIS_PARTNER_FEE_RECIPIENT,
        },
        "hooks": {},
    }
    if referral_code:
        # Validate against the SDK grammar /^[a-z0-9_-]{3,64}$/ (referral.ts) and FAIL
        # LOUDLY on a bad code — an unmatchable code would be silently written to
        # appData, so the order settles but the referrer earns NO rebate (silent
        # unattribution). Optional: omitting the code still yields a valid fee-bearing
        # order, you just forgo the rebate.
        code = referral_code.strip().lower()
        if not re.match(r"^[a-z0-9_-]{3,64}$", code):
            sys.exit(f"invalid referral code {referral_code!r}: must match [a-z0-9_-]{{3,64}}")
        metadata["ophisReferrer"] = {"code": code}
    doc = {"appCode": "ophis", "metadata": metadata, "version": APP_DATA_VERSION}
    # Deterministic compact JSON (sorted keys), matching cow-sdk's stringify.
    full = json.dumps(doc, sort_keys=True, separators=(",", ":"))
    app_hash = "0x" + keccak256(full.encode("utf-8")).hex()
    return full, app_hash


# ── Minimal ABI encoding (no web3 dependency) ─────────────────────────────────
def _pad(hex_no0x: str) -> str:
    return hex_no0x.rjust(64, "0")


def encode_approve(spender: str, amount: int) -> str:
    """approve(address,uint256) — selector 0x095ea7b3."""
    return "0x095ea7b3" + _pad(spender.lower().replace("0x", "")) + _pad(format(amount, "x"))


def encode_set_presignature(order_uid_hex: str, signed: bool = True) -> str:
    """setPreSignature(bytes orderUid, bool signed).

    orderUid is a dynamic `bytes` (56 bytes for a CoW order UID), so the head is
    [offset=0x40, bool] and the tail is [length, data-padded-to-32].
    """
    selector = keccak256(b"setPreSignature(bytes,bool)")[:4].hex()
    uid = order_uid_hex.lower().replace("0x", "")
    length = len(uid) // 2
    padded_data = uid + "0" * ((64 - (len(uid) % 64)) % 64)
    return (
        "0x" + selector
        + _pad(format(64, "x"))               # offset to the bytes arg (0x40)
        + _pad("1" if signed else "0")        # bool signed
        + _pad(format(length, "x"))           # bytes length (56)
        + padded_data                          # uid, right-padded to 32
    )


# ── HTTP + Bankr Submit API ───────────────────────────────────────────────────
def _http(method: str, url: str, body: dict | None = None, headers: dict | None = None,
          timeout: int = 60) -> dict:
    if not url.lower().startswith("https://"):
        sys.exit(f"refusing non-HTTPS URL: {url}")  # block file://, http://, etc.
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("content-type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected -- URL is scheme-guarded to https:// above and built from the fixed ORDERBOOK_URLS/BANKR_API https maps.
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode()
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        sys.exit(f"{method} {url} -> HTTP {e.code}: {detail[:500]}")
    except (urllib.error.URLError, socket.timeout, TimeoutError) as e:
        # A DNS/connection/timeout failure must exit cleanly, not dump a traceback.
        sys.exit(f"{method} {url} -> network error: {e}")
    # Single explicit return: the except branches sys.exit (NoReturn), so this is the only
    # non-error path — no implicit fall-through to None for a function typed -> dict.
    return json.loads(raw) if raw else {}


def bankr_api_key() -> str:
    key = os.environ.get("BANKR_API_KEY")
    if not key:
        cfg = os.path.expanduser("~/.bankr/config.json")
        if os.path.exists(cfg):
            with open(cfg) as f:
                key = json.load(f).get("apiKey")
    if not key:
        sys.exit("Set BANKR_API_KEY (or configure ~/.bankr/config.json). Get a key at bankr.bot/api-keys.")
    return key


_EVM_ADDR_RE = re.compile(r"^0x[0-9a-fA-F]{40}$")


def bankr_wallet_address(key: str) -> str:
    # GET /wallet/me returns the wallet info (address + chains). The legacy /agent/* endpoints
    # were removed; the Wallet API is the current surface. Resolve the EVM address by FORMAT,
    # not by guessing one exact key: Bankr is multi-chain (EVM + Solana) and a Solana address is
    # never 0x-40-hex, so a format guard can never return one.
    res = _http("GET", f"{BANKR_API}/wallet/me", headers={"X-API-Key": key})

    def _named(d):
        # Prefer an explicitly wallet-named key, so a stray token/contract 0x can't win.
        if not isinstance(d, dict):
            return None
        for k in ("evmAddress", "address", "evm", "wallet", "walletAddress", "signer", "owner"):
            v = d.get(k)
            if isinstance(v, str) and _EVM_ADDR_RE.match(v):
                return v
        return None

    addr = None
    if isinstance(res, dict):  # a non-object JSON response falls through to the clean error below
        addr = _named(res)
        for nest in ("data", "wallet", "addresses", "evm"):  # tolerate one level of nesting
            addr = addr or _named(res.get(nest))
        if not addr:
            # Last resort: any top-level 0x EVM value. /wallet/me is wallet info (address + chains),
            # not a token list, so a bare format-guarded scan is safe.
            addr = next((v for v in res.values() if isinstance(v, str) and _EVM_ADDR_RE.match(v)), None)
    if not addr:
        sys.exit(f"could not resolve the Bankr EVM wallet address from /wallet/me: {json.dumps(res)[:300]}")
    return addr


def bankr_submit(key: str, chain_id: int, to: str, data: str, description: str, value: str = "0") -> dict:
    # POST /wallet/submit (the current Wallet API; /agent/submit was removed). Same body shape.
    res = _http(
        "POST", f"{BANKR_API}/wallet/submit",
        body={
            "transaction": {"to": to, "chainId": chain_id, "value": value, "data": data},
            "description": description,
            "waitForConfirmation": True,
        },
        headers={"X-API-Key": key},
        timeout=120,  # waitForConfirmation blocks on the tx being mined
    )
    # Documented /wallet/submit status values are "success" | "reverted" | "pending". With
    # waitForConfirmation a mined-but-REVERTED tx still returns a hash, so a hash alone is NOT
    # success (a reverted approval / setPreSignature would otherwise print as a fillable order).
    status = str(res.get("status") or res.get("state") or "").lower()
    if status in ("reverted", "failed", "failure", "error", "dropped"):
        sys.exit(f"Bankr submit reverted/failed ({description}, status={status!r}): {json.dumps(res)[:400]}")
    if status == "pending":
        # Not yet confirmed — refuse regardless of any success flag; an approval/presign this
        # skill submits MUST be mined before we build/print an order that depends on it.
        sys.exit(f"Bankr submit not confirmed ({description}, status=pending): {json.dumps(res)[:400]}")
    has_status_key = ("status" in res) or ("state" in res)
    # Accept an explicit confirmed success; only fall back to a bare hash when the response
    # reports NO status field at all (legacy) — a present-but-empty status is not "confirmed".
    ok = status in ("success", "confirmed", "mined", "ok") or res.get("success") is True \
        or (not has_status_key and bool(res.get("transactionHash")))
    if not ok:
        sys.exit(f"Bankr submit not confirmed successful ({description}): {json.dumps(res)[:400]}")
    return res


# ── Ophis / CoW orderbook ─────────────────────────────────────────────────────
def get_quote(chain_id: int, sell_token: str, buy_token: str, sell_amount_wei: int,
              from_addr: str, full_app_data: str, app_data_hash: str) -> dict:
    base = orderbook_url(chain_id)
    body = {
        "sellToken": sell_token,
        "buyToken": buy_token,
        "from": from_addr,
        "receiver": from_addr,
        "kind": "sell",
        "sellAmountBeforeFee": str(sell_amount_wei),
        "partiallyFillable": False,
        "sellTokenBalance": "erc20",
        "buyTokenBalance": "erc20",
        "priceQuality": "optimal",
        # The order is submitted with signingScheme presign, so quote with the same scheme — CoW
        # treats the requested scheme as part of the returned order shape/UID expectations.
        "signingScheme": "presign",
        "onchainOrder": False,
        # Send the appData HASH (not the full JSON) to the quote: CoW's strict app-data schema
        # rejects the Ophis-only ophisReferrer key, so an inline full doc 400s a referral'd quote.
        # The full string is only PUT + submitted (those paths accept the extension).
        "appData": app_data_hash,
        "appDataHash": app_data_hash,
        "validFor": 1200,
    }
    res = _http("POST", f"{base}/api/v1/quote", body=body)
    quote = res.get("quote") or res
    return quote


def put_app_data(chain_id: int, app_data_hash: str, full_app_data: str) -> None:
    """Upload the full appData so solvers can read the partnerFee for this hash."""
    base = orderbook_url(chain_id)
    _http("PUT", f"{base}/api/v1/app_data/{app_data_hash}", body={"fullAppData": full_app_data})


def post_order(chain_id: int, order: dict) -> str:
    base = orderbook_url(chain_id)
    res = _http("POST", f"{base}/api/v1/orders", body=order)
    # The orderbook returns the order UID as a bare JSON string (or under a key).
    if isinstance(res, str):
        return res
    uid = res.get("uid") or res.get("orderUid") or res
    if not isinstance(uid, str) or not uid.startswith("0x"):
        sys.exit(f"unexpected POST /orders response (no order uid): {json.dumps(res)[:300]}")
    return uid


def enroll_wallet(wallet: str) -> None:
    """Best-effort: register the wallet so the rebate indexer indexes its trades.
    Idempotent GET /tier/{wallet}. MUST NOT block or abort the swap — a rebate-
    indexer outage (DNS/connection/timeout/non-2xx) is swallowed so the healthy
    swap+fee path still proceeds. Uses a raw urllib call (not _http, which exits on
    error) so every failure mode is caught here."""
    if not re.match(r"^0x[0-9a-fA-F]{40}$", wallet or ""):
        return  # only a validated 0x-address goes into the URL path
    try:
        req = urllib.request.Request(f"{REBATE_INDEXER_URL}/tier/{wallet}", method="GET")
        # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected -- fixed https REBATE_INDEXER_URL + a validated 0x-address path segment.
        with urllib.request.urlopen(req, timeout=15) as resp:
            resp.read()
    except Exception:
        # Best-effort + non-blocking by design (see docstring): every failure mode of the
        # rebate-indexer GET is swallowed so a swap never aborts on an enrollment hiccup.
        pass


def to_wei(amount_human: str, decimals: int) -> int:
    from decimal import Decimal
    return int(Decimal(amount_human) * (Decimal(10) ** decimals))
