# Operating Model

Charon is a pre-action check.

The agent should not ask "is this safe?" in prose. It should build an action object and run the policy
script.

## Agent loop

1. Identify the next concrete action.
2. Normalize it into the action model.
3. Evaluate policy.
4. Obey the verdict.
5. Record a receipt.
6. Continue only if allowed.

## What counts as one action

One action is the smallest unit with a side effect:

- one file write
- one delete set
- one shell command
- one git push
- one HTTP request
- one wallet transfer
- one signature
- one automation creation

Batch related reads together. Split side effects.

## Fail closed

If the action cannot be normalized, return `PAUSE`.

If policy cannot be loaded, return `PAUSE`.

If a required field is missing for a risky action, return `PAUSE`.

If the action contains secrets and the next step would expose them, return `DENY`.

## Boundaries

This skill can make Bankr policy-aware. It cannot force Bankr's runtime to obey the decision by itself.

For hard enforcement, Charon needs a Bankr pre-execution hook, MCP routing, or another runtime boundary
that sees actions before execution.
