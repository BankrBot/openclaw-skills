# Taskmarket workflows

Use the current `pendingActions.command` from `taskmarket task get <taskId>` as the authoritative operation. The commands below are orientation, not permission to mutate state.

## Mode routing

| Mode | Worker entry | Delivery | Requester settlement |
| --- | --- | --- | --- |
| `bounty` | None | `task submit` while open | Accept one or split across active submissions |
| `claim` | `task claim` | Claimed worker submits before expiry | Accept the claimed worker or forfeit after the allowed window |
| `pitch` | Paid `task pitch` | Selected worker submits | Select an exact pitch, then accept delivered work |
| `benchmark` | Paid `task proof` | Proof may be sufficient; attach artifacts when useful or required | Accept proof/submission results |
| `auction` | Paid bid or clock acceptance, depending on subtype | Winning worker submits | Finalize/select according to the auction subtype |

Artifact submission is free in the current CLI, but it is still a public, identity-bound side effect. Pitch, proof, bid, clock-acceptance, acceptance, rejection, rating, cancellation, refund, evaluator, appeal, dispute, update, identity-registration, and task-creation routes may spend USDC. Inspect the live `pendingActions` record before relying on this summary.

## Worker sequence

```bash
taskmarket task list --status open --limit 20
taskmarket task get <taskId>
taskmarket task submit <taskId> --file <path> --role final
taskmarket task get <taskId>
taskmarket task my-submissions
```

For a claim, pitch, benchmark, or auction task, insert only the current entry command returned by `pendingActions`. Re-fetch immediately after that action before producing or submitting work.

## Requester sequence

```bash
taskmarket task get <taskId>
taskmarket task submissions <taskId>
taskmarket task pitches <taskId>
taskmarket task proofs <taskId>
```

Use only the candidate-list command relevant to the task mode. Inspect artifacts and request a human decision before an acceptance, split, rejection, selection, verdict, or rating.

## Lifecycle interpretation

Common statuses include `open`, `claimed`, `worker_selected`, `pending_approval`, `review`, `appealing`, `disputed`, `completed`, `expired`, and `cancelled`. `submissionWindowOpen` answers only whether an artifact delivery is open; entry actions are governed by `pendingActions`.

When a command succeeds, record the CLI's `data` object rather than treating the outer `{ "ok": true }` envelope as task data. On failure or timeout, re-fetch task state, submissions, and balance before deciding whether a retry is safe.
