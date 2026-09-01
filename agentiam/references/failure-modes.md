# Failure Modes

Every way AgentIAM can fail, and what your agent should do about it.

## Network-level failures

| Condition | Default posture |
| --- | --- |
| DNS resolution fails | Deny the action. |
| TCP connect timeout | Deny. |
| HTTP 5xx from BANKR | Deny. |
| HTTP 402 but payment attachment fails | Deny. |
| Transient network error, retries exhausted | Deny. |

Rule of thumb: **availability is not a security property.** If AgentIAM
is down, your agent should not act.

## Response-level failures

| Condition | Default posture |
| --- | --- |
| Missing `result` | Deny. |
| Missing `proof` | Deny. |
| Missing `proof.signature` | Deny. |
| Signature does not verify | Deny. Alert. |
| Signer is not canonical | Deny. Alert. |
| Timestamp skew > 5 minutes | Refetch once, then deny. |
| `decision == abstain` | Deny unless a human override exists. |
| `decision == deny` | Deny. Log reasons. |

## Decision-level failures

| Condition | Default posture |
| --- | --- |
| `risk_score` above your threshold | Deny or escalate. |
| `noleak.pass == false` | Deny. Do not retry with redaction silently — log the finding first. |
| `memguard.pass == false` | Deny. This is a strong signal of memory tampering. |
| `secureexec.pass == false` | Deny. |
| `validate.errors` non-empty | Fix the envelope producer. Do not re-encode around the error. |

## Anti-patterns to avoid

- **Treating 5xx as allow.** AgentIAM being down does not make the action
  safe.
- **Caching a previous allow.** A signed response is only valid for the
  specific action it signed.
- **Retrying after a deny with a modified payload.** If noleak denied
  because of a leaked key, stripping the key and retrying is fine —
  but log both calls.
- **Trusting `result` without verifying `proof.signer`.** This is the
  most common failure and the easiest to prevent.

## Escalation

If your agent sees repeated signature failures or non-canonical signers,
escalate out of band. The expected rate of either is effectively zero.
