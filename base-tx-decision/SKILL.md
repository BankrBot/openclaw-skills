---
name: base-tx-decision
description: Per-transaction fee timing for Base mainnet. Use before submitting any Base transaction to decide submit-now-or-wait and size the fee — returns an EIP-1559 max fee + priority fee in gwei, estimated cost in USD, and a re-check interval when waiting is cheaper. Paid per call over x402 ($0.01 USDC on Base, no API key, no signup). Triggers on mentions of Base gas price, gas fees, when to send, fee estimation, EIP-1559, transaction timing, or submit timing on Base / eip155:8453.
license: MIT
compatibility: Requires network access and any x402 client with a USDC-funded wallet on Base (e.g. @x402/fetch for JS, x402[httpx,evm] for Python). No account or API key. Works from Claude Code, Claude.ai, or any agent runtime that can sign EIP-3009 USDC authorizations.
metadata:
  author: kwizzlesurp10-ctrl
  version: "1.0"
  homepage: https://x402-mcp.onrender.com/llms.txt
---

# Base tx decision: should this transaction go out now, and at what fee?

One paid call answers the question a bot faces before every send on Base:
**submit now or wait, and if now, at what fee?** Computed live from Base RPC
blocks (base fee, priority fee, congestion trend) plus an ETH spot price — not
modeled, measured.

```
GET https://x402-mcp.onrender.com/base/tx-decision?gas=usdc&urgency=flexible
```

- **Price**: $0.01 USDC per call, settled over x402 on Base mainnet
  (`eip155:8453`), gasless for the buyer (EIP-3009).
- **No API key, no signup.** The 402 response IS the price quote.

## When to use

Call this immediately before submitting a Base transaction, inside the send
loop. Use the answer directly:

```
decision = GET /base/tx-decision?gas=usdc&urgency=flexible
if decision.submit:
    send(tx, maxFeePerGas=decision.fee.max_fee_per_gas_gwei,
             maxPriorityFeePerGas=decision.fee.max_priority_fee_per_gas_gwei)
else:
    sleep(decision.recheck_in_s); retry
```

Do NOT use it as a general market feed — that is what its sibling endpoint
(the full Pulse briefing) is for. This one is priced and shaped for one
decision per transaction.

## Parameters

| Param | Values | Default | Meaning |
| --- | --- | --- | --- |
| `gas` | `eth` \| `usdc` \| `erc20` \| `x402` \| integer 21000–30000000 | `usdc` | What you are sending; sets the gas units for the cost estimate |
| `urgency` | `now` \| `soon` \| `flexible` | `flexible` | `now`: always submit, just size the fee. `soon`: submit unless waiting is clearly free. `flexible`: wait for a cheap window |

## Response

```json
{
  "submit": true,
  "verdict": "SETTLE_NOW",
  "why": "Blockspace is 8.4% full at 0.0050 gwei - settlement is at or near the floor...",
  "fee": {
    "max_fee_per_gas_gwei": 0.011,
    "max_priority_fee_per_gas_gwei": 0.001,
    "current_base_fee_gwei": 0.005,
    "next_base_fee_gwei": 0.0052
  },
  "estimated_cost": { "gas": 55000, "eth": 6.6e-7, "usd": 0.0011 },
  "recheck_in_s": null,
  "as_of_block": 48941850,
  "as_of": "2026-07-22T12:48:00+00:00"
}
```

Field notes an agent should respect:

- `fee.max_fee_per_gas_gwei` is sized `2 × base + tip` (standard EIP-1559
  wallet practice — rides out consecutive full blocks). `estimated_cost` uses
  the CURRENT base + tip because the max-fee surplus is never burned.
- `recheck_in_s` is when re-checking becomes informative, **not** a prediction
  of when fees drop. Nobody can predict that; this endpoint does not pretend to.
- `as_of_block` / `as_of`: responses come from a snapshot at most ~4s old
  (~2 Base blocks). Judge freshness yourself; treat anything older than a few
  blocks as history.

## Paying over x402

Any x402 client works. JS:

```js
import { wrapFetchWithPayment } from "@x402/fetch";
const fetchPaid = wrapFetchWithPayment(fetch, walletClient); // USDC on Base
const res = await fetchPaid(
  "https://x402-mcp.onrender.com/base/tx-decision?gas=usdc&urgency=flexible"
);
const decision = await res.json();
```

Python:

```python
# pip install "x402[httpx,evm]"   (signer from EVM_PRIVATE_KEY)
import httpx
from x402.http.clients import x402HttpxClient

async with httpx.AsyncClient() as client:
    async with x402HttpxClient(client) as paid:
        r = await paid.get(
            "https://x402-mcp.onrender.com/base/tx-decision?gas=usdc"
        )
        decision = r.json()
```

Free dry run (no wallet needed) — the 402 carries the full payment terms:

```bash
curl -i "https://x402-mcp.onrender.com/base/tx-decision?gas=usdc"
```

## Failure modes (read before wiring into a loop)

- **Transient facilitator 502 mid-settle**: no funds move, nothing is
  delivered. Retry the same request; there is nothing to reconcile.
- **402 with `payment_invalid`**: your signature expired (300s validity) or was
  bound to a stale challenge. Re-fetch the 402 and sign fresh.
- **422**: bad `gas` or `urgency` value — rejected before any payment logic,
  nothing charged.
- **Delivery is settled-gated**: content is served only after on-chain
  settlement succeeds.

Full agent-readable docs, including the free sibling endpoints:
<https://x402-mcp.onrender.com/llms.txt>
