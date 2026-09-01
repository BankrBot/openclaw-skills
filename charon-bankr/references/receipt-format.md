# Receipt Format

A receipt is the local record of the policy decision.

```json
{
  "schema": "charon.bankr.receipt.v1",
  "receipt_id": "sha256:...",
  "created_at": "2026-06-16T00:00:00.000Z",
  "action": {
    "type": "git.push",
    "category": "git",
    "operation": "push",
    "remote": "origin",
    "branch": "main"
  },
  "decision": {
    "verdict": "PAUSE",
    "matched_rule": "pause-git-push",
    "reason": "pause-git-push matched"
  },
  "execution": {
    "launched": false,
    "status": "not_launched"
  }
}
```

Receipts are created before execution.

`DENY` and `PAUSE` receipts must keep `execution.launched = false`.

`PASS` receipts use `execution.status = "ready_to_launch"` because this skill cannot observe the final
Bankr runtime execution state.
