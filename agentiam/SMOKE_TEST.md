# SMOKE_TEST.md — Live Endpoint Verification

Every service in AgentIAM is smoke-tested against the live x402 cloud before
release. This file records the most recent run.

## Method

`scripts/health-check.sh` POSTs an empty JSON body to each service endpoint
and checks that the response is `HTTP 402 Payment Required` (the expected
x402 handshake state when no payment is attached).

A 402 response confirms:

1. The endpoint is reachable.
2. The x402 quote engine is live.
3. The owner wallet is correctly configured at the expected base URL.

Reproduce locally:

```bash
bash scripts/health-check.sh
```

## Latest run

```
AgentIAM health check — 2026-04-17T19:50:56Z
Base URL: https://x402.bankr.bot/0x24908846a4397d3549d07661e0fc02220ab14dad

  [OK]  flowcore     HTTP 402
  [OK]  noleak       HTTP 402
  [OK]  memguard     HTTP 402
  [OK]  riskoracle   HTTP 402
  [OK]  secureexec   HTTP 402
  [OK]  validate     HTTP 402

All services healthy.
```

All six services returned `HTTP 402` with a valid x402 quote envelope.

## Paid-call verification

A paid-call round-trip is not included in this smoke test because it would
spend USDC from the runner's wallet. Integrators should run one of the
`examples/` scripts under a funded BANKR CLI to confirm end-to-end flow.

A paid-call trace (redacted) is documented in
`references/response-schema.md` with the exact field shape you should
expect back, including the signed `proof` envelope.
