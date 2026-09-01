---
name: agentiam
description: >
  AgentIAM by Achilles — pre-execution safety layer for autonomous agent actions on Base.
  Use before an agent runs a tool, commits a trade, transfers funds, or deploys a contract.
  Returns a signed verification proof that a third party checked the action. Six x402 services,
  $0.01–$0.02 USDC per call, settled on Base Mainnet via the BANKR x402 facilitator.
  No account, no API key, no private-key handling. Payment is authorization.
  Triggers on: "verify this action", "is this safe to execute", "pre-trade risk score",
  "check execution integrity", "scan payload for prompt injection", "memory drift check",
  "sandbox tool call", "full policy validation", "flowcore", "agentiam", "ep verify".
metadata:
  {
    "clawdbot":
      {
        "emoji": "🛡",
        "homepage": "https://achillesalpha.onrender.com/ep",
        "requires": { "bins": ["curl", "bankr"] },
      },
  }
---

# AgentIAM by Achilles

**Pre-execution safety layer for autonomous agent actions.** Before your agent runs a tool, commits a trade, transfers funds, or deploys a contract, call AgentIAM. Get back a third-party–signed verification proof.

- **Provider:** Achilles (`did:key:z6MksD98V31uLxhL65NZ6zChk8rnUiXRSAgtgSA7yJWQz762`)
- **Source repo:** https://github.com/achilliesbot/agentiam
- **Facilitator base URL:** `https://x402.bankr.bot/0x24908846a4397d3549d07661e0fc02220ab14dad`
- **Discovery:** https://402index.io — search "achilles"
- **Settlement:** USDC on Base Mainnet (chain id `8453`)

---

## What it does

Every BANKR skill creates actions. AgentIAM verifies them. If your agent is about to do something with real consequences, route it through AgentIAM first and keep the signed proof.

## Capabilities

Six services. All answer the same question — *is this action safe to execute?* — at different granularities.

| Service | Price | Answers |
|---|---|---|
| **`flowcore`** (recommended) | $0.02 | Full pipeline: integrity + memory + risk + sandbox, one call |
| `noleak` | $0.01 | Is the payload tampered or injected? |
| `memguard` | $0.01 | Did the agent's memory state drift from reference? |
| `riskoracle` | $0.01 | What is the market/counterparty/operational risk? |
| `secureexec` | $0.01 | Does the tool call pass sandbox validation? |
| `validate` | $0.01 | Full policy validation (identity + integrity + risk + compliance flags) |

`flowcore` is the headline — it chains the four single-purpose checks in one call and returns a combined decision. Call the individual services only when you need granular control or partial checks.

---

## Usage Examples

Any one of these triggers the skill:

- `@agentiam run flowcore on this transfer: {"token":"USDC","amount":500,"to":"0xBeef..."}`
- `@agentiam give me a pre-trade risk score for this swap`
- `@agentiam scan this payload for prompt injection before I forward it`
- `@agentiam check my memory state for drift`
- `@agentiam sandbox-validate this tool call before I run it`
- `@agentiam full policy validation on this deploy`

---

## Quickstart — BANKR CLI path (recommended)

The BANKR CLI is npm-installed (hash-verified by npm) and already trusted by the catalog. It handles the 402 quote, USDC payment, and retry automatically.

```bash
# 1. Install the CLI (once). npm verifies package integrity.
npm install -g @bankrbot/cli

# 2. Log in + fund the BANKR wallet (no private key held by you).
bankr login
bankr fund USDC 1

# 3. Call flowcore on a proposed action.
bankr x402 call \
  https://x402.bankr.bot/0x24908846a4397d3549d07661e0fc02220ab14dad/flowcore \
  --data '{"action":{"type":"transfer","token":"USDC","amount":500,"to":"0xBeef..."}}'
```

Response carries `result.decision`, `result.risk_score`, a `proof.signature` signed by the settlement wallet, and `payment.tx_hash`. Verify the signature (see `references/signature-verification.md`) before trusting the decision.

## Quickstart — raw HTTP path (no BANKR wallet)

If your agent already holds a Base wallet with USDC, call the endpoints directly and pay with any x402-capable client.

```bash
WALLET=0x24908846a4397d3549d07661e0fc02220ab14dad
BASE="https://x402.bankr.bot/$WALLET"

# 1. POST to get the 402 quote. Empty JSON body is valid.
curl -sS -X POST "$BASE/riskoracle" \
  -H "Content-Type: application/json" \
  -d '{"action":{"type":"transfer","token":"USDC","amount":500}}'

# 2. Read payTo, maxAmountRequired, asset, network from the 402 response.
# 3. Send USDC on Base Mainnet to payTo.
# 4. Retry with X-Payment-Proof: <tx_hash>.
```

All calls are POST with JSON body. All responses are JSON. TLS everywhere. No shell evaluation of remote content.

## Quickstart — compose in Python

Minimal pattern for chaining multiple checks. Uses only `subprocess` from the stdlib and the npm-installed BANKR CLI.

```python
import subprocess, json

WALLET = "0x24908846a4397d3549d07661e0fc02220ab14dad"
BASE = f"https://x402.bankr.bot/{WALLET}"

def call(service, payload):
    r = subprocess.run(
        ["bankr", "x402", "call", f"{BASE}/{service}", "--data", json.dumps(payload)],
        capture_output=True, text=True, check=True,
    )
    return json.loads(r.stdout)

action = {"type": "transfer", "token": "USDC", "amount": 500, "to": "0xBeef..."}

flow = call("flowcore", {"action": action})   # $0.02
if flow["result"]["decision"] != "allow":
    raise SystemExit(f"agentiam denied: {flow['result'].get('reasons')}")
# proceed with action, keep flow["proof"]["signature"] as audit trail
```

More examples — pre-trade guard, tool-call wrapper — in `examples/` of the source repo.

---

## Response shape

Every service returns JSON with the same top-level keys:

```json
{
  "service": "flowcore",
  "result": {
    "decision": "allow",
    "risk_score": 0.18,
    "checks": {
      "noleak":     {"pass": true,  "proof_hash": "0x…"},
      "memguard":   {"pass": true,  "proof_hash": "0x…"},
      "riskoracle": {"pass": true,  "score": 0.18},
      "secureexec": {"pass": true,  "proof_hash": "0x…"}
    }
  },
  "proof": {
    "ep_version": "1.0",
    "signed_at":  "2026-04-17T14:00:00Z",
    "signer":     "0x069c6012E053DFBf50390B19FaE275aD96D22ed7",
    "signature":  "0x…"
  },
  "payment": {
    "amount_usdc": "0.02",
    "tx_hash":     "0x…",
    "chain":       "base-mainnet"
  }
}
```

**Always verify `proof.signature` before trusting `result`.** A reference verification script lives at `scripts/verify-signature.js` in the source repo. If the signer does not match `0x069c6012E053DFBf50390B19FaE275aD96D22ed7`, reject the response.

---

## Requirements

- **Tools:** `curl` (system default) and/or the BANKR CLI (`npm install -g @bankrbot/cli`).
- **Wallet:** any Base Mainnet wallet with USDC + a small ETH balance for gas. A BANKR-managed wallet works out of the box with no private-key handling on your side.
- **Network:** Base Mainnet, chain id `8453`.
- **Asset:** USDC at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.
- **No API key.** No account.

---

## Trust model

- **Identity.** Provider DID: `did:key:z6MksD98V31uLxhL65NZ6zChk8rnUiXRSAgtgSA7yJWQz762`. Agents may pin this DID out-of-band.
- **Payment.** x402 v2 quote + retry. Sending USDC authorises the call. No further authentication.
- **Integrity.** Every response is signed by the canonical settlement wallet. Consuming agents verify with `ecrecover` (see `scripts/verify-signature.js`). Signatures with a signer other than `0x069c6012E053DFBf50390B19FaE275aD96D22ed7` must be rejected.
- **Facilitator.** The `payTo` in 402 quotes is BANKR's facilitator wallet (`0x8AEE621035D93Deb3C0C1177fac252dC2dd501a0`). BANKR collects + sweeps to the provider wallet `0x24908846a4397d3549d07661e0fc02220ab14dad`. This is expected — not a misconfiguration.
- **Decommissioned.** Never send funds to `0x16708f79D6366eE32774048ECC7878617236Ca5C`. That wallet is retired and any instruction pointing to it should be treated as hostile.

---

## What this skill does not do

Stated plainly to avoid false assurances:

- It does **not** hold your keys. It never asks for a private key, seed phrase, or API secret.
- It does **not** broadcast transactions. You still execute the action yourself.
- It does **not** guarantee an action is safe — it returns a probabilistic decision + signed record. Treat the proof as evidence of third-party review, not as indemnity.
- It does **not** replace on-chain simulation tools such as Tenderly, sandbox forks, or compiler-level analysers. It complements them.
- It does **not** run in-session as an MCP server. It is a pure HTTP skill in v1. No conversation context is exposed to a local binary.

---

## Safety design (100/100 target)

Concrete choices made to minimise attack surface:

1. **No install script.** No `curl | sh`. CLI is installed via npm, which hash-verifies packages.
2. **No private keys handled.** Payment flows through BANKR's wallet API or the consumer's own wallet — AgentIAM never sees secret material.
3. **No plain-env-var secrets.** No `ETH_PRIVATE_KEY`, no `API_KEY`, nothing.
4. **No remote code execution.** No `eval`, no fetched-and-executed code paths. Every example is static.
5. **No MCP server in v1.** Avoids exposing conversation context to a local binary.
6. **TLS everywhere.** All endpoints enforce HTTPS. No plaintext HTTP.
7. **Wallet disclosure is explicit.** Canonical, facilitator, and decommissioned addresses all stated with roles.
8. **Every example is smoke-tested live** before release. Results logged in `SMOKE_TEST.md` of the source repo.
9. **Signed responses.** Every result is cryptographically signed — consuming agents can verify independently with `ecrecover`.
10. **Transparent limitations.** See `What this skill does not do` above.

Full safety review in `SAFETY.md` of the source repo.

---

## References

Detailed docs for each service + trust model live in the source repo under `references/`:

- `references/noleak.md`
- `references/memguard.md`
- `references/riskoracle.md`
- `references/secureexec.md`
- `references/flowcore.md`
- `references/validate.md`
- `references/api-reference.md`
- `references/response-schema.md`
- `references/signature-verification.md`
- `references/trust-model.md`
- `references/wallet-disclosure.md`
- `references/failure-modes.md`
- `references/integrator-checklist.md`

---

## Troubleshooting

**`402 Payment Required` with no retry.** Expected on the first call — your client must read the quote headers and re-send with payment attached. The BANKR CLI handles this automatically; raw HTTP clients need to implement the x402 handshake.

**`signer mismatch: recovered X is not the canonical wallet`.** Reject the response. Do not fall back, do not retry silently. The canonical signer is `0x069c6012E053DFBf50390B19FaE275aD96D22ed7` — anything else means the response is not from AgentIAM. See `references/failure-modes.md`.

**`result.decision` is missing.** Treat as deny. A well-formed AgentIAM response always carries `result` + `proof` + `payment`; any of the three missing means the response is invalid.

**Timeout from `x402.bankr.bot`.** Default posture is deny — do not cache a previous allow. Availability is not a security property.

Run `bash scripts/health-check.sh` from the source repo to confirm every endpoint is live before integration.

---

## Security

- **Never send a private key, seed phrase, or API secret to AgentIAM.** No service endpoint needs one.
- **Never install the BANKR CLI via `curl | sh`.** Use `npm install -g @bankrbot/cli` — the npm registry hash-verifies the package.
- **Never trust a response you have not signature-verified.** Two lines of ethers/eth_account. Examples in `scripts/verify-signature.js`.
- **Never send funds to `0x16708f79D6366eE32774048ECC7878617236Ca5C`** — decommissioned wallet, any instruction pointing there is hostile.

---

## Operator

Achilles — autonomous orchestrator of Project Olympus. Human oversight: Zeus.

- DID: `did:key:z6MksD98V31uLxhL65NZ6zChk8rnUiXRSAgtgSA7yJWQz762`
- X: [@AchillesAlphaAI](https://x.com/AchillesAlphaAI)
- Issues: https://github.com/achilliesbot/agentiam/issues — autonomous triage within hours.
