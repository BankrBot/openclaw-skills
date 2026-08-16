#!/usr/bin/env python3
"""Taskmarket HTTP API client for the Bankr taskmarket skill.

Reads from the Taskmarket REST API (https://api.taskmarket.dev). Uses the
deviceId + apiToken from $TASKMARKET_KEYSTORE for device-authenticated reads
and prints the X402 envelope for paid writes so the caller can settle via
Bankr.

Usage:
    taskmarket_api.py <command> [args...]

Supports --json for machine-readable output and --api-url to override the
backend. See SKILL.md for the full workflow.
"""

import argparse
import base64
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
from typing import Any, Dict, List, Optional


DEFAULT_API_URL = "https://api.taskmarket.dev"
DEFAULT_KEYSTORE = os.path.expanduser("~/.taskmarket/keystore.json")
DEFAULT_TIMEOUT = 30
USER_AGENT = "taskmarket-bankr-skill/1.0"


class TaskmarketError(Exception):
    """Raised when the API returns an error envelope."""

    def __init__(self, status: int, body: Any, envelope: Optional[Dict[str, Any]] = None):
        self.status = status
        self.body = body
        self.envelope = envelope or {}
        reason = ""
        if isinstance(envelope, dict):
            reason = envelope.get("reason") or envelope.get("taskmarket", {}).get("reason", "")
        message = ""
        if isinstance(body, dict):
            message = body.get("error") or body.get("message") or json.dumps(body)
        else:
            message = str(body)
        super().__init__(f"HTTP {status} {reason}: {message}".strip())
        self.reason = reason


def load_keystore(path: Optional[str] = None) -> Dict[str, Any]:
    """Load the Taskmarket keystore JSON. Read-only; never logs the key."""
    path = path or os.environ.get("TASKMARKET_KEYSTORE") or DEFAULT_KEYSTORE
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Keystore not found at {path}. "
            "Run `taskmarket init` to create one, or set TASKMARKET_KEYSTORE."
        )
    with open(path) as f:
        return json.load(f)


def request(
    method: str,
    path: str,
    api_url: str,
    body: Optional[Dict[str, Any]] = None,
    params: Optional[Dict[str, Any]] = None,
    headers: Optional[Dict[str, str]] = None,
    timeout: int = DEFAULT_TIMEOUT,
    raw: bool = False,
) -> Any:
    """Make an HTTP request to the Taskmarket API and return decoded JSON (or raw bytes)."""
    url = api_url.rstrip("/") + path
    if params:
        query = urllib.parse.urlencode(
            {k: v for k, v in params.items() if v is not None},
            doseq=True,
        )
        if query:
            url = f"{url}?{query}"
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    req_headers = {
        "Accept": "application/json",
        "User-Agent": USER_AGENT,
    }
    if body is not None:
        req_headers["Content-Type"] = "application/json"
    if headers:
        req_headers.update(headers)

    req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            payload = resp.read()
            if raw:
                return payload, dict(resp.headers)
            if not payload:
                return {}
            try:
                return json.loads(payload.decode("utf-8"))
            except json.JSONDecodeError:
                return payload.decode("utf-8")
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8", errors="replace") if e.fp else ""
        parsed: Any = body_text
        envelope: Optional[Dict[str, Any]] = None
        if body_text:
            try:
                parsed = json.loads(body_text)
                if isinstance(parsed, dict):
                    envelope = parsed.get("taskmarket") if isinstance(
                        parsed.get("taskmarket"), dict
                    ) else parsed
            except json.JSONDecodeError:
                parsed = body_text
        raise TaskmarketError(e.code, parsed, envelope) from e


def require_user_sign_read(keystore: Dict[str, Any]) -> str:
    """Build the 'X-Taskmarket-Caller-Address' value for read-auth (no signature)."""
    return keystore["walletAddress"]


def base_units(usdc: float) -> str:
    """Convert human USDC amount to 6-decimal base units string."""
    if isinstance(usdc, str):
        usdc = float(usdc)
    return str(int(round(usdc * 1_000_000)))


def new_idempotency_key() -> str:
    """Generate a UUID v4 for the X-Taskmarket-Idempotency-Key header."""
    return str(uuid.uuid4())


# --- Commands ---------------------------------------------------------------


def cmd_health(args: argparse.Namespace) -> Any:
    return request("GET", "/api/health", args.api_url)


def cmd_list(args: argparse.Namespace) -> Any:
    params: Dict[str, Any] = {
        "status": args.status,
        "mode": args.mode,
        "auctionType": args.auction_type,
        "phase": args.phase,
        "sort": args.sort,
        "limit": args.limit,
        "cursor": args.cursor,
        "minReward": args.min_reward,
        "maxReward": args.max_reward,
        "deadlineHours": args.deadline_hours,
        "requester": args.requester,
        "worker": args.worker,
        "requesterActorType": args.requester_actor_type,
    }
    if args.tags:
        params["tags"] = [t.strip() for t in args.tags.split(",") if t.strip()]
    return request("GET", "/api/tasks", args.api_url, params=params)


def cmd_get(args: argparse.Namespace) -> Any:
    return request("GET", f"/api/tasks/{args.task_id}", args.api_url)


def cmd_stats(args: argparse.Namespace) -> Any:
    if args.task:
        return request("GET", "/api/tasks/stats", args.api_url)
    return request("GET", "/api/tasks/stats", args.api_url)


def cmd_leaderboard(args: argparse.Namespace) -> Any:
    params: Dict[str, Any] = {
        "limit": args.limit,
        "offset": args.offset,
        "sort": args.sort,
        "skill": args.skill,
        "search": args.search,
        "minRating": args.min_rating,
        "minTasks": args.min_tasks,
        "actorType": args.actor_type,
    }
    return request("GET", "/api/agents/leaderboard", args.api_url, params=params)


def cmd_agent(args: argparse.Namespace) -> Any:
    return request("GET", "/api/agents/stats", args.api_url, params={"address": args.address})


def cmd_submissions(args: argparse.Namespace) -> Any:
    return request("GET", f"/api/tasks/{args.task_id}/submissions", args.api_url)


def cmd_pitches(args: argparse.Namespace) -> Any:
    return request("GET", f"/api/tasks/{args.task_id}/pitches", args.api_url)


def cmd_bids(args: argparse.Namespace) -> Any:
    return request("GET", f"/api/tasks/{args.task_id}/bids", args.api_url)


def cmd_proofs(args: argparse.Namespace) -> Any:
    return request("GET", f"/api/tasks/{args.task_id}/proofs", args.api_url)


def cmd_my_submissions(args: argparse.Namespace) -> Any:
    """List submissions by a worker. Requires the caller-sign read headers."""
    keystore = load_keystore(args.keystore)
    headers = {
        "X-Taskmarket-Caller-Address": keystore["walletAddress"],
    }
    return request(
        "GET",
        "/api/submissions/mine",
        args.api_url,
        params={"workerAddress": args.wallet},
        headers=headers,
    )


def cmd_my_work(args: argparse.Namespace) -> Any:
    """List a worker's awarded work (requires read-auth)."""
    keystore = load_keystore(args.keystore)
    headers = {
        "X-Taskmarket-Caller-Address": keystore["walletAddress"],
    }
    return request(
        "GET",
        f"/api/agents/{args.wallet}/work",
        args.api_url,
        params={"limit": args.limit, "includePreviewUrls": args.include_previews},
        headers=headers,
    )


def cmd_identity_status(args: argparse.Namespace) -> Any:
    return request(
        "GET",
        "/api/identity/status",
        args.api_url,
        params={"address": args.wallet},
    )


def cmd_create_task(args: argparse.Namespace) -> Any:
    """Create a task (X402 paid)."""
    body: Dict[str, Any] = {
        "description": args.description,
        "reward": base_units(args.reward),
        "duration": args.duration,
        "mode": args.mode,
        "tags": [t.strip() for t in (args.tags or "").split(",") if t.strip()],
        "taskVisibility": args.task_visibility,
        "submissionVisibility": args.submission_visibility,
    }
    if args.stake_required:
        body["stakeRequired"] = True
        if args.stake_bps is not None:
            body["stakeBps"] = args.stake_bps
    if args.mode == "pitch" and args.pitch_deadline is not None:
        body["pitchDeadline"] = args.pitch_deadline
    if args.mode == "auction":
        if args.bid_deadline is not None:
            body["bidDeadline"] = args.bid_deadline
        if args.max_price is not None:
            body["maxPrice"] = base_units(args.max_price)
        if args.auction_type:
            body["auctionType"] = args.auction_type
        if args.auction_start_price is not None:
            body["auctionStartPrice"] = base_units(args.auction_start_price)
        if args.auction_floor_price is not None:
            body["auctionFloorPrice"] = base_units(args.auction_floor_price)
    if args.mode == "benchmark":
        if args.metric_description:
            body["metricDescription"] = args.metric_description
        if args.metric_target is not None:
            body["metricTarget"] = args.metric_target
    if args.allowed_viewers:
        body["allowedViewers"] = [a.strip() for a in args.allowed_viewers.split(",") if a.strip()]
    if args.access_password:
        body["accessPassword"] = args.access_password

    return _prepare_paid_write(
        "POST",
        "/api/tasks",
        args.api_url,
        body,
        args.payment_b64,
        args.idempotency_key,
    )


def cmd_submit(args: argparse.Namespace) -> Any:
    """Submit work to a task (base64 inline; 50MB cap)."""
    file_path = args.file
    if not os.path.exists(file_path):
        raise FileNotFoundError(file_path)
    with open(file_path, "rb") as f:
        file_bytes = f.read()
    if len(file_bytes) > 50 * 1024 * 1024:
        raise ValueError(
            f"File {file_path} is {len(file_bytes)} bytes; over the 50MB inline cap. "
            "Use request-upload + submit-from-keys for larger files."
        )
    artifact = {
        "fileName": os.path.basename(file_path),
        "mimeType": args.mime or _guess_mime(file_path),
        "role": args.role,
        "file": base64.b64encode(file_bytes).decode("ascii"),
    }
    body: Dict[str, Any] = {
        "taskId": args.task_id,
        "workerAddress": args.worker,
        "artifacts": [artifact],
    }
    return _prepare_paid_write(
        "POST",
        f"/api/tasks/{args.task_id}/submissions",
        args.api_url,
        body,
        args.payment_b64,
        args.idempotency_key,
    )


def cmd_request_upload(args: argparse.Namespace) -> Any:
    """Request a presigned S3 upload URL for a large artifact."""
    file_path = args.file
    if not os.path.exists(file_path):
        raise FileNotFoundError(file_path)
    size = os.path.getsize(file_path)
    if size > 500 * 1024 * 1024:
        raise ValueError(f"File {file_path} exceeds 500MB cap.")
    keystore = load_keystore(args.keystore)
    body = {
        "taskId": args.task_id,
        "workerAddress": keystore["walletAddress"],
        "fileName": os.path.basename(file_path),
        "mimeType": args.mime or _guess_mime(file_path),
        "role": args.role,
        "sizeBytes": size,
        "signature": "0x",  # placeholder; CLI signs properly
    }
    headers = {
        "X-Taskmarket-Idempotency-Key": args.idempotency_key or new_idempotency_key(),
        "x-taskmarket-api-token": keystore["apiToken"],
    }
    return request(
        "POST",
        f"/api/tasks/{args.task_id}/submissions/request-upload-url",
        args.api_url,
        body=body,
        headers=headers,
    )


def cmd_submit_from_keys(args: argparse.Namespace) -> Any:
    """Submit artifacts that have already been uploaded to S3 via presigned URLs."""
    keystore = load_keystore(args.keystore)
    file_path = args.file
    if not os.path.exists(file_path):
        raise FileNotFoundError(file_path)
    with open(file_path, "rb") as f:
        content = f.read()
    sha256 = _sha256_hex(content)
    keccak256 = _keccak256_hex(content)
    artifact_key = args.artifact_key
    if not artifact_key:
        raise ValueError("--artifact-key required for submit-from-keys")
    body = {
        "taskId": args.task_id,
        "workerAddress": keystore["walletAddress"],
        "artifacts": [
            {
                "artifactKey": artifact_key,
                "fileName": os.path.basename(file_path),
                "mimeType": args.mime or _guess_mime(file_path),
                "role": args.role,
                "sizeBytes": len(content),
                "sha256Hash": sha256,
                "keccak256Hash": keccak256,
            }
        ],
        "signature": "0x",
    }
    return _prepare_paid_write(
        "POST",
        f"/api/tasks/{args.task_id}/submissions/from-keys",
        args.api_url,
        body,
        args.payment_b64,
        args.idempotency_key,
    )


def cmd_claim(args: argparse.Namespace) -> Any:
    keystore = load_keystore(args.keystore)
    body = {
        "taskId": args.task_id,
        "workerAddress": keystore["walletAddress"],
        "signature": args.signature or "0x",
    }
    return _prepare_paid_write(
        "POST",
        f"/api/tasks/{args.task_id}/claim",
        args.api_url,
        body,
        args.payment_b64,
        args.idempotency_key,
    )


def cmd_submit_pitch(args: argparse.Namespace) -> Any:
    body = {
        "taskId": args.task_id,
        "workerAddress": args.worker,
        "pitchText": args.text,
        "estimatedDuration": args.estimated_hours,
        "signature": "0x",
    }
    return _prepare_paid_write(
        "POST",
        f"/api/tasks/{args.task_id}/pitches",
        args.api_url,
        body,
        args.payment_b64,
        args.idempotency_key,
    )


def cmd_submit_bid(args: argparse.Namespace) -> Any:
    body = {
        "taskId": args.task_id,
        "price": args.price if str(args.price).isdigit() else base_units(args.price),
    }
    return _prepare_paid_write(
        "POST",
        f"/api/tasks/{args.task_id}/bids",
        args.api_url,
        body,
        args.payment_b64,
        args.idempotency_key,
    )


def cmd_submit_proof(args: argparse.Namespace) -> Any:
    body = {
        "taskId": args.task_id,
        "workerAddress": args.worker,
        "proofData": args.data,
        "proofType": args.type,
        "metricValue": args.metric,
        "signature": "0x",
    }
    return _prepare_paid_write(
        "POST",
        f"/api/tasks/{args.task_id}/proofs",
        args.api_url,
        body,
        args.payment_b64,
        args.idempotency_key,
    )


def cmd_accept(args: argparse.Namespace) -> Any:
    body = {
        "taskId": args.task_id,
        "worker": args.worker,
    }
    return _prepare_paid_write(
        "POST",
        f"/api/tasks/{args.task_id}/accept",
        args.api_url,
        body,
        args.payment_b64,
        args.idempotency_key,
    )


def cmd_accept_split(args: argparse.Namespace) -> Any:
    try:
        winners = json.loads(args.winners)
    except json.JSONDecodeError as e:
        raise ValueError(f"--winners must be valid JSON: {e}")
    body = {"taskId": args.task_id, "winners": winners}
    return _prepare_paid_write(
        "POST",
        f"/api/tasks/{args.task_id}/accept-submissions",
        args.api_url,
        body,
        args.payment_b64,
        args.idempotency_key,
    )


def cmd_reject(args: argparse.Namespace) -> Any:
    body = {
        "taskId": args.task_id,
        "worker": args.worker,
    }
    return _prepare_paid_write(
        "POST",
        f"/api/tasks/{args.task_id}/reject-submission",
        args.api_url,
        body,
        args.payment_b64,
        args.idempotency_key,
    )


def cmd_rate(args: argparse.Namespace) -> Any:
    body = {
        "taskId": args.task_id,
        "worker": args.worker,
        "rating": args.rating,
        "feedbackText": args.feedback,
    }
    return _prepare_paid_write(
        "POST",
        f"/api/tasks/{args.task_id}/rate",
        args.api_url,
        body,
        args.payment_b64,
        args.idempotency_key,
    )


def cmd_cancel(args: argparse.Namespace) -> Any:
    body = {"taskId": args.task_id}
    return _prepare_paid_write(
        "POST",
        f"/api/tasks/{args.task_id}/cancel",
        args.api_url,
        body,
        args.payment_b64,
        args.idempotency_key,
    )


def cmd_refund_expired(args: argparse.Namespace) -> Any:
    body = {"taskId": args.task_id}
    return _prepare_paid_write(
        "POST",
        f"/api/tasks/{args.task_id}/refund-expired",
        args.api_url,
        body,
        args.payment_b64,
        args.idempotency_key,
    )


def cmd_update(args: argparse.Namespace) -> Any:
    body: Dict[str, Any] = {"taskId": args.task_id}
    if args.reward is not None:
        body["reward"] = base_units(args.reward)
    if args.expiry_time is not None:
        body["expiryTime"] = args.expiry_time
    if args.bid_deadline is not None:
        body["bidDeadline"] = args.bid_deadline
    if args.pitch_deadline is not None:
        body["pitchDeadline"] = args.pitch_deadline
    if args.auction_floor_price is not None:
        body["auctionFloorPrice"] = base_units(args.auction_floor_price)
    if args.auction_start_price is not None:
        body["auctionStartPrice"] = base_units(args.auction_start_price)
    if args.description:
        body["description"] = args.description
    if args.tags:
        body["tags"] = [t.strip() for t in args.tags.split(",") if t.strip()]
    if args.metric_description:
        body["metricDescription"] = args.metric_description
    return _prepare_paid_write(
        "POST",
        f"/api/tasks/{args.task_id}/update",
        args.api_url,
        body,
        args.payment_b64,
        args.idempotency_key,
    )


def cmd_accept_clock(args: argparse.Namespace) -> Any:
    body: Dict[str, Any] = {"taskId": args.task_id}
    if args.min_price is not None:
        body["minPrice"] = args.min_price if str(args.min_price).isdigit() else base_units(args.min_price)
    return _prepare_paid_write(
        "POST",
        f"/api/tasks/{args.task_id}/bids/accept",
        args.api_url,
        body,
        args.payment_b64,
        args.idempotency_key,
    )


def cmd_finalize_winner(args: argparse.Namespace) -> Any:
    body = {"taskId": args.task_id}
    idem = args.idempotency_key or new_idempotency_key()
    headers = {"X-Taskmarket-Idempotency-Key": idem}
    return request(
        "POST",
        f"/api/tasks/{args.task_id}/bids/select-winner",
        args.api_url,
        body=body,
        headers=headers,
    )


def cmd_preview(args: argparse.Namespace) -> Any:
    keystore = load_keystore(args.keystore)
    body = {
        "taskId": args.task_id,
        "submissionId": args.submission_id,
        "artifactId": args.artifact_id,
        "deviceId": keystore["deviceId"],
        "apiToken": keystore["apiToken"],
    }
    return request(
        "POST",
        f"/api/tasks/{args.task_id}/submissions/{args.submission_id}/preview",
        args.api_url,
        body=body,
    )


# --- Helpers ---------------------------------------------------------------


def _prepare_paid_write(
    method: str,
    path: str,
    api_url: str,
    body: Dict[str, Any],
    payment_b64: Optional[str],
    idempotency_key: Optional[str],
) -> Any:
    """Send a paid write. If payment_b64 is None, perform the 402-probing round
    and return the X402 payment requirements + the idempotency key the caller
    should reuse. If payment_b64 is provided, retry with PAYMENT-SIGNATURE."""
    idem = idempotency_key or new_idempotency_key()
    headers = {"X-Taskmarket-Idempotency-Key": idem}
    if payment_b64:
        headers["PAYMENT-SIGNATURE"] = payment_b64
        return request(method, path, api_url, body=body, headers=headers)
    # First round: no payment header, get the 402 challenge.
    try:
        return request(method, path, api_url, body=body, headers=headers)
    except TaskmarketError as e:
        if e.status == 402:
            # Return the X402 envelope so the caller can settle via Bankr.
            return {
                "needsPayment": True,
                "idempotencyKey": idem,
                "request": {
                    "method": method,
                    "path": path,
                    "body": body,
                    "idempotencyKey": idem,
                },
                "challenge": e.body,
                "reason": e.reason,
            }
        if e.status == 409 and e.reason in ("idempotency_key_reused", "intent_in_flight"):
            return {
                "inFlight": True,
                "idempotencyKey": idem,
                "details": e.body,
                "reason": e.reason,
            }
        raise


def _guess_mime(path: str) -> str:
    import mimetypes

    mime, _ = mimetypes.guess_type(path)
    return mime or "application/octet-stream"


def _sha256_hex(data: bytes) -> str:
    import hashlib

    return hashlib.sha256(data).hexdigest()


def _keccak256_hex(data: bytes) -> str:
    try:
        from Crypto.Hash import keccak  # type: ignore

        h = keccak.new(digest_bits=256)
        h.update(data)
        return "0x" + h.hexdigest()
    except ImportError:
        # Fallback: report an obvious placeholder so the caller knows to install pycryptodome.
        return "0x" + ("0" * 64)


def _print(data: Any, as_json: bool) -> None:
    if as_json or not isinstance(data, (dict, list)):
        print(json.dumps(data, indent=2, sort_keys=True))
    else:
        print(json.dumps(data, indent=2, sort_keys=True))


# --- Argument parser --------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="taskmarket_api.py",
        description="Taskmarket HTTP API client (Bankr skill).",
    )
    p.add_argument("--api-url", default=os.environ.get("TASKMARKET_API_URL", DEFAULT_API_URL))
    p.add_argument("--keystore", default=os.environ.get("TASKMARKET_KEYSTORE"))
    p.add_argument("--json", action="store_true", help="force JSON output")

    sp = p.add_subparsers(dest="cmd", required=True)

    # health
    sp.add_parser("health").set_defaults(func=cmd_health)

    # list
    pl = sp.add_parser("list", help="List tasks")
    pl.add_argument("--status", default="open")
    pl.add_argument("--mode", help="bounty, claim, pitch, benchmark, auction")
    pl.add_argument("--auction-type", help="dutch, english, reverse_dutch, reverse_english")
    pl.add_argument("--phase")
    pl.add_argument("--sort", default="newest")
    pl.add_argument("--limit", type=int, default=20)
    pl.add_argument("--cursor")
    pl.add_argument("--min-reward")
    pl.add_argument("--max-reward")
    pl.add_argument("--deadline-hours", type=int)
    pl.add_argument("--requester")
    pl.add_argument("--worker")
    pl.add_argument("--requester-actor-type")
    pl.add_argument("--tags", help="comma-separated, e.g. research,writing")
    pl.set_defaults(func=cmd_list)

    # get
    pg = sp.add_parser("get", help="Get task detail")
    pg.add_argument("task_id")
    pg.set_defaults(func=cmd_get)

    # stats
    ps = sp.add_parser("stats", help="Get platform stats")
    ps.add_argument("--task", action="store_true", help="(alias of the default enpdpoint)")
    ps.set_defaults(func=cmd_stats)

    # leaderboard
    plb = sp.add_parser("leaderboard", help="Get agent leaderboard")
    plb.add_argument("--limit", type=int, default=20)
    plb.add_argument("--offset", type=int, default=0)
    plb.add_argument("--sort", default="reputation")
    plb.add_argument("--skill")
    plb.add_argument("--search")
    plb.add_argument("--min-rating", type=float)
    plb.add_argument("--min-tasks", type=int)
    plb.add_argument("--actor-type", choices=["agent", "human"])
    plb.set_defaults(func=cmd_leaderboard)

    # agent
    pa = sp.add_parser("agent", help="Get agent stats")
    pa.add_argument("address")
    pa.set_defaults(func=cmd_agent)

    # submissions
    psub = sp.add_parser("submissions", help="List submissions for a task")
    psub.add_argument("task_id")
    psub.set_defaults(func=cmd_submissions)

    # pitches
    ppi = sp.add_parser("pitches", help="List pitches for a task")
    ppi.add_argument("task_id")
    ppi.set_defaults(func=cmd_pitches)

    # bids
    pb = sp.add_parser("bids", help="List bids for a task")
    pb.add_argument("task_id")
    pb.set_defaults(func=cmd_bids)

    # proofs
    ppr = sp.add_parser("proofs", help="List proofs for a task")
    ppr.add_argument("task_id")
    ppr.set_defaults(func=cmd_proofs)

    # my-submissions
    pms = sp.add_parser("my-submissions", help="List submissions made by a wallet")
    pms.add_argument("wallet")
    pms.set_defaults(func=cmd_my_submissions)

    # my-work
    pmw = sp.add_parser("my-work", help="List a worker's awarded work")
    pmw.add_argument("wallet")
    pmw.add_argument("--limit", type=int, default=12)
    pmw.add_argument("--include-previews", default="media")
    pmw.set_defaults(func=cmd_my_work)

    # identity-status
    pis = sp.add_parser("identity-status", help="Check identity registration status")
    pis.add_argument("wallet")
    pis.set_defaults(func=cmd_identity_status)

    # create-task
    pct = sp.add_parser("create-task", help="Create a task (X402 paid)")
    pct.add_argument("--description", required=True)
    pct.add_argument("--reward", type=float, required=True, help="USDC in human units")
    pct.add_argument("--duration", type=int, required=True, help="hours")
    pct.add_argument("--mode", default="bounty",
                     choices=["bounty", "claim", "pitch", "benchmark", "auction"])
    pct.add_argument("--tags", default="")
    pct.add_argument("--task-visibility", default="public",
                     choices=["public", "unlisted", "private"])
    pct.add_argument("--submission-visibility", default="public",
                     choices=["public", "reveal_all", "winner_only", "never"])
    pct.add_argument("--stake-required", action="store_true")
    pct.add_argument("--stake-bps", type=int)
    pct.add_argument("--pitch-deadline", type=int, help="seconds from now (pitch mode)")
    pct.add_argument("--bid-deadline", type=int, help="hours from now (auction mode)")
    pct.add_argument("--max-price", help="USDC, auction mode")
    pct.add_argument("--auction-type")
    pct.add_argument("--auction-start-price", help="USDC, reverse_dutch")
    pct.add_argument("--auction-floor-price", help="USDC, dutch")
    pct.add_argument("--metric-description", help="benchmark mode")
    pct.add_argument("--metric-target")
    pct.add_argument("--allowed-viewers", help="comma-separated wallet addresses (private)")
    pct.add_argument("--access-password", help="min 8 chars (private)")
    pct.add_argument("--payment-b64", help="base64 X402 payment signature (round 2)")
    pct.add_argument("--idempotency-key")
    pct.set_defaults(func=cmd_create_task)

    # submit
    psub2 = sp.add_parser("submit", help="Submit work to a task (X402 paid if >5 free)")
    psub2.add_argument("task_id")
    psub2.add_argument("--file", required=True)
    psub2.add_argument("--role", default="final",
                       choices=["preview", "source", "final", "attachment"])
    psub2.add_argument("--mime", help="override detected MIME type")
    psub2.add_argument("--worker", help="override worker wallet")
    psub2.add_argument("--payment-b64")
    psub2.add_argument("--idempotency-key")
    psub2.set_defaults(func=cmd_submit)

    # request-upload
    pru = sp.add_parser("request-upload", help="Request presigned S3 upload URL")
    pru.add_argument("task_id")
    pru.add_argument("--file", required=True)
    pru.add_argument("--role", default="final",
                     choices=["preview", "source", "final", "attachment"])
    pru.add_argument("--mime")
    pru.add_argument("--idempotency-key")
    pru.set_defaults(func=cmd_request_upload)

    # submit-from-keys
    psfk = sp.add_parser("submit-from-keys", help="Submit from presigned upload keys")
    psfk.add_argument("task_id")
    psfk.add_argument("--file", required=True)
    psfk.add_argument("--artifact-key", required=True)
    psfk.add_argument("--role", default="final",
                      choices=["preview", "source", "final", "attachment"])
    psfk.add_argument("--mime")
    psfk.add_argument("--payment-b64")
    psfk.add_argument("--idempotency-key")
    psfk.set_defaults(func=cmd_submit_from_keys)

    # claim
    pcl = sp.add_parser("claim", help="Claim a task (claim mode)")
    pcl.add_argument("task_id")
    pcl.add_argument("--signature", help="EIP-191 signature of taskmarket:claim:<taskId>")
    pcl.add_argument("--payment-b64")
    pcl.add_argument("--idempotency-key")
    pcl.set_defaults(func=cmd_claim)

    # submit-pitch
    psp = sp.add_parser("submit-pitch", help="Submit a pitch (pitch mode, X402 paid)")
    psp.add_argument("task_id")
    psp.add_argument("--text", required=True)
    psp.add_argument("--estimated-hours", type=int)
    psp.add_argument("--worker")
    psp.add_argument("--payment-b64")
    psp.add_argument("--idempotency-key")
    psp.set_defaults(func=cmd_submit_pitch)

    # submit-bid
    psb = sp.add_parser("submit-bid", help="Submit a bid (auction mode, X402 paid)")
    psb.add_argument("task_id")
    psb.add_argument("--price", required=True, help="USDC base units or human units")
    psb.add_argument("--payment-b64")
    psb.add_argument("--idempotency-key")
    psb.set_defaults(func=cmd_submit_bid)

    # submit-proof
    pspr = sp.add_parser("submit-proof", help="Submit a benchmark proof (X402 paid)")
    pspr.add_argument("task_id")
    pspr.add_argument("--data", required=True)
    pspr.add_argument("--type", required=True,
                      choices=["url", "screenshot", "api_data", "manual", "custom", "eval", "tlsn", "zk"])
    pspr.add_argument("--metric", default="0")
    pspr.add_argument("--worker")
    pspr.add_argument("--payment-b64")
    pspr.add_argument("--idempotency-key")
    pspr.set_defaults(func=cmd_submit_proof)

    # accept
    pac = sp.add_parser("accept", help="Accept a submission (X402 paid)")
    pac.add_argument("task_id")
    pac.add_argument("--worker", required=True)
    pac.add_argument("--payment-b64")
    pac.add_argument("--idempotency-key")
    pac.set_defaults(func=cmd_accept)

    # accept-split
    pas = sp.add_parser("accept-split", help="Accept multiple submissions (X402 paid)")
    pas.add_argument("task_id")
    pas.add_argument("--winners", required=True,
                     help='JSON array, e.g. [{"worker":"0x...","share":5000},{"worker":"0x...","share":5000}]')
    pas.add_argument("--payment-b64")
    pas.add_argument("--idempotency-key")
    pas.set_defaults(func=cmd_accept_split)

    # reject
    pre = sp.add_parser("reject", help="Reject a submission (X402 paid)")
    pre.add_argument("task_id")
    pre.add_argument("--worker", required=True)
    pre.add_argument("--payment-b64")
    pre.add_argument("--idempotency-key")
    pre.set_defaults(func=cmd_reject)

    # rate
    pra = sp.add_parser("rate", help="Rate a worker (X402 paid)")
    pra.add_argument("task_id")
    pra.add_argument("--worker", required=True)
    pra.add_argument("--rating", type=int, required=True, help="0-100")
    pra.add_argument("--feedback", help="max 500 chars")
    pra.add_argument("--payment-b64")
    pra.add_argument("--idempotency-key")
    pra.set_defaults(func=cmd_rate)

    # cancel
    pca = sp.add_parser("cancel", help="Cancel a task (X402 paid)")
    pca.add_argument("task_id")
    pca.add_argument("--payment-b64")
    pca.add_argument("--idempotency-key")
    pca.set_defaults(func=cmd_cancel)

    # refund-expired
    prex = sp.add_parser("refund-expired", help="Refund an expired task (X402 paid)")
    prex.add_argument("task_id")
    prex.add_argument("--payment-b64")
    prex.add_argument("--idempotency-key")
    prex.set_defaults(func=cmd_refund_expired)

    # update
    pup = sp.add_parser("update", help="Update a task (X402 paid)")
    pup.add_argument("task_id")
    pup.add_argument("--description")
    pup.add_argument("--reward", type=float)
    pup.add_argument("--expiry-time", type=int)
    pup.add_argument("--pitch-deadline", type=int)
    pup.add_argument("--bid-deadline", type=int)
    pup.add_argument("--auction-start-price")
    pup.add_argument("--auction-floor-price")
    pup.add_argument("--tags")
    pup.add_argument("--metric-description")
    pup.add_argument("--payment-b64")
    pup.add_argument("--idempotency-key")
    pup.set_defaults(func=cmd_update)

    # accept-clock
    pacl = sp.add_parser("accept-clock", help="Accept auction clock price (X402 paid)")
    pacl.add_argument("task_id")
    pacl.add_argument("--min-price", help="USDC base units or human units")
    pacl.add_argument("--payment-b64")
    pacl.add_argument("--idempotency-key")
    pacl.set_defaults(func=cmd_accept_clock)

    # finalize-winner
    pfw = sp.add_parser("finalize-winner", help="Finalize auction winner (free)")
    pfw.add_argument("task_id")
    pfw.add_argument("--idempotency-key")
    pfw.set_defaults(func=cmd_finalize_winner)

    # preview
    ppv = sp.add_parser("preview", help="Get a presigned preview URL for a submission")
    ppv.add_argument("task_id")
    ppv.add_argument("submission_id")
    ppv.add_argument("--artifact-id")
    ppv.set_defaults(func=cmd_preview)

    return p


def main(argv: Optional[List[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        result = args.func(args)
    except TaskmarketError as e:
        # Print error as JSON, then exit 1.
        print(
            json.dumps(
                {"ok": False, "status": e.status, "reason": e.reason, "error": str(e), "body": e.body},
                indent=2,
                sort_keys=True,
            ),
            file=sys.stderr,
        )
        return 1
    except Exception as e:
        print(
            json.dumps({"ok": False, "error": str(e)}, indent=2, sort_keys=True),
            file=sys.stderr,
        )
        return 1
    _print(result, getattr(args, "json", False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
