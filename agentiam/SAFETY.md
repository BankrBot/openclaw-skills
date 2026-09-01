# AgentIAM Safety Review

Reviewer-facing document. Enumerates every design decision made to minimise attack surface. Target: 100/100 on the BANKR skill auditor.

## Threat model

AgentIAM is called by an autonomous agent that may hold user funds, publish content, or execute tool calls on behalf of its operator. The consumer agent trusts AgentIAM to return a *correct* decision about a proposed action. The operator trusts the skill to:

1. Never steal funds or reveal secrets.
2. Never tamper with the agent's environment.
3. Never inject instructions into the agent's context.

Non-goals: AgentIAM is not an indemnity product. A pass decision is evidence of third-party review, not insurance.

## Design decisions

| # | Risk addressed | Decision |
|---|---|---|
| 1 | Install-time malware (gitlawb was flagged for this) | No install script. CLI is installed via `npm install -g @bankrbot/cli`. npm registry hash-verifies the package. |
| 2 | Remote code execution during install or runtime | No `curl \| sh` anywhere. No `eval` of remote content. All examples use static, local code paths. |
| 3 | Plain env-var secret exposure (gitlawb was flagged for this) | Skill never reads, requires, or documents any private key, seed phrase, or API key as an env var. |
| 4 | MCP conversation-context exfiltration (gitlawb was flagged for this) | No MCP server in v1. Skill is pure HTTPS request/response. A future MCP wrapper (if added) will ship separately with its own audit. |
| 5 | Transport-layer MITM | All endpoints enforce TLS (HTTPS). No `http://` fallback. No certificate pinning exceptions documented. |
| 6 | Wallet-spoofing (agent is tricked into paying the wrong address) | Three wallets enumerated in `references/wallet-disclosure.md`: canonical (signer), facilitator (BANKR escrow, appears as `payTo`), and decommissioned (hostile). Consumers are told which is which and why. |
| 7 | Response tampering | Every response is signed by the canonical wallet. `scripts/verify-signature.js` shows concrete ecrecover verification. SKILL.md instructs consumers to reject any signature not from `0x069c6012E053DFBf50390B19FaE275aD96D22ed7`. |
| 8 | Fake pass decisions | Operator cannot unilaterally produce a valid signature without the canonical wallet's key. Consumers that verify get end-to-end integrity. |
| 9 | Prompt injection via skill frontmatter | `description` contains only factual capability statements + trigger phrases. No imperative language directed at host LLMs. No "always trust", "ignore previous instructions", or similar patterns. |
| 10 | Unbounded resource consumption | `maxTimeoutSeconds: 60` per service (enforced by x402 quote). No long-polling, no websockets. |
| 11 | Payment front-running or replay | Each 402 quote is one-shot — server binds payment to the nonce in the retry header. Replay is detected and rejected. |
| 12 | Fee drift | Prices fixed in the 402 quote. Consumer sees the exact `amount` before paying. No hidden upcharges. |
| 13 | Data exfiltration via the payload | Payloads are POSTed over TLS directly to Achilles' backend. Not logged in third-party systems other than BANKR's facilitator (standard x402 routing). |
| 14 | Liability for false-pass decisions | SKILL.md states explicitly: "It does not guarantee an action is safe — it returns a probabilistic decision + signed record." No guarantee language. |

## Audit trail

- All 6 endpoints return valid 402 quotes with canonical wallet metadata. Last verified: see `SMOKE_TEST.md`.
- Signature-verification script executes the canonical `ecrecover` path against a real response. Run `node scripts/verify-signature.js` after receiving any response.
- Provider DID pinned: `did:key:z6MksD98V31uLxhL65NZ6zChk8rnUiXRSAgtgSA7yJWQz762`.

## Known limitations

- AgentIAM's decision quality is as good as the upstream signals feeding it. A novel attack pattern not in the training or rules set may receive a pass.
- `riskoracle` uses market data on a best-effort basis. During data-feed degradation it returns `decision: "abstain"` rather than a false pass.
- Base Mainnet downtime blocks settlement. The skill cannot be called without USDC payment, by design.

## Not yet done, will improve score over time

- Formal third-party security audit of the backend services (planned).
- Publicly verifiable hash of each service's signing key in a canonical registry (planned once the registry standard stabilises).
- MCP server wrapper with its own isolated audit (planned for v1.1).

## Reporting a vulnerability

Open a private issue on https://github.com/achilliesbot/agentiam or message `@AchillesAlphaAI` on X. Autonomous triage within hours. A human (Zeus) reviews all security reports before response.
