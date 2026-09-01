# flowcore — Full pre-execution pipeline

One-call composition of every other AgentIAM service. Use this as the
default entry point; drop down to individual services only when you need
a specific check in isolation.

## What it does

Given a proposed action (a structured dict describing what the agent is
about to do), flowcore runs the following checks server-side and returns
a single signed decision:

1. **NoLeak** — scans the action payload for prompt-injection patterns,
   PII, credential fragments, or private keys that should not be leaving
   the agent.
2. **MemGuard** — validates that the action is consistent with the
   agent's declared memory/policy state and not a memory-tampering or
   replay attempt.
3. **RiskOracle** — scores the action on a 0–100 risk scale, considering
   counterparty, amount, chain, and pattern-match against known bad
   flows.
4. **SecureExec** — validates the specific tool or call shape (does this
   tool exist, are the args well-formed, is the caller authorized).
5. **Validate** — final structural validation of the complete envelope.

The pipeline short-circuits on the first hard fail: if NoLeak detects a
leaked key, MemGuard is not run.

## Price

$0.02 per call — intentionally priced below the sum of the individual
services so flowcore is the default.

## Endpoint

```
POST https://x402.bankr.bot/0x24908846a4397d3549d07661e0fc02220ab14dad/flowcore
Content-Type: application/json
```

## Request

```json
{
  "action": {
    "type": "transfer",
    "token": "USDC",
    "amount": 500,
    "to": "0xBeef...",
    "chain": "base-mainnet"
  }
}
```

The `action` field is opaque to AgentIAM — you define the shape that
makes sense for your agent. The richer the detail you provide, the more
accurate the risk score.

## Response

```json
{
  "result": {
    "decision": "allow",
    "risk_score": 12,
    "reasons": [],
    "checks_run": ["noleak", "memguard", "riskoracle", "secureexec", "validate"],
    "checks_passed": ["noleak", "memguard", "riskoracle", "secureexec", "validate"]
  },
  "proof": {
    "signer": "0x069c6012e053dfbf50390b19fae275ad96d22ed7",
    "signature": "0x...",
    "timestamp": "2026-04-17T19:50:56Z"
  },
  "payment": {
    "tx_hash": "0x...",
    "amount_usdc": 0.02
  }
}
```

## Decision values

- `allow` — proceed with the action.
- `deny` — do not execute. `reasons` lists why.
- `abstain` — the service cannot make a decision with the info provided.
  Treat as deny in the absence of a human override.

## Failure modes

See `references/failure-modes.md` for the full list. Key ones:

- If the signer is not the canonical wallet, reject the response
  regardless of `decision`.
- If `result.decision` is missing, treat as deny.
- Network timeouts are treated as deny by default in the example scripts.
