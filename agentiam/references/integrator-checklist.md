# Integrator Checklist

Work through this list before shipping AgentIAM in production.

## Wiring

- [ ] Base URL configured as
      `https://x402.bankr.bot/0x24908846a4397d3549d07661e0fc02220ab14dad`
- [ ] BANKR CLI installed and authenticated, **or** raw x402 HTTP client
      that handles 402 + retry
- [ ] Payment wallet funded with USDC on Base Mainnet
- [ ] Health check passes: `bash scripts/health-check.sh` returns all OK

## Signature verification

- [ ] Canonical signer hard-coded as
      `0x069c6012E053DFBf50390B19FaE275aD96D22ed7`
- [ ] Every response verified against both `proof.signer` and the
      canonical address
- [ ] Decommissioned wallet `0x16708f79...` explicitly rejected
- [ ] Signature failure → deny, with an alert path

## Decision handling

- [ ] `decision == allow` proceeds
- [ ] `decision == deny` halts and logs `reasons`
- [ ] `decision == abstain` treated as deny unless human override exists
- [ ] `risk_score` threshold set and documented
- [ ] Your own timeout on the AgentIAM call (recommended: 5s) → deny

## Audit trail

- [ ] Store `proof.signature` alongside the action you executed
- [ ] Store `payment.tx_hash` for on-chain evidence of the paid decision
- [ ] Retain both for at least as long as you retain the action itself

## Scope awareness

- [ ] You are not relying on AgentIAM as your only safety layer
- [ ] You have a circuit breaker at the execution layer
- [ ] You have a runtime sandbox or at least a capability allowlist
- [ ] You have run the three `examples/` files against your local
      agent and reproduced both an allow and a deny path

## Secret hygiene

- [ ] AgentIAM sees only what you send it — do **not** send your private
      key "for verification"
- [ ] BANKR CLI is installed from the npm registry (hash-verified),
      not via `curl | sh`
- [ ] No AgentIAM call requires setting an `ETH_PRIVATE_KEY` or similar
      env var. If a tutorial tells you to, it is wrong.

When every box is checked, you are ready to ship.
