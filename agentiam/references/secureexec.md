# secureexec — Tool-call validation

Validates a proposed tool call before the agent executes it locally. Catches:

- tools that do not exist for this agent's declared capability set
- argument shapes that do not match the tool's schema
- calls to privileged tools from contexts that should not have access

## Price

$0.01 per call.

## Endpoint

```
POST https://x402.bankr.bot/0x24908846a4397d3549d07661e0fc02220ab14dad/secureexec
```

## Request

```json
{
  "tool": "send_email",
  "args": {
    "to": "user@example.com",
    "subject": "...",
    "body": "..."
  }
}
```

## Response

```json
{
  "result": {
    "pass": true,
    "reasons": []
  },
  "proof": { "signer": "0x069c...", "signature": "0x...", "timestamp": "..." },
  "payment": { "tx_hash": "0x...", "amount_usdc": 0.01 }
}
```

On fail, `reasons` is a list of structured reason codes (e.g.
`TOOL_NOT_DECLARED`, `ARG_TYPE_MISMATCH`).

## Integration pattern

Wrap your tool dispatcher with a secureexec pre-check. The
`examples/tool-wrapper.py` file shows a minimal higher-order function
that does exactly this.

## Scope

secureexec is a pre-execution gate, not a sandbox. It does not run the
tool for you. The intent is that your agent calls secureexec, gets
allow, and then proceeds to invoke the tool in its own runtime.
