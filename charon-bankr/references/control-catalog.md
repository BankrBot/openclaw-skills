# Control Catalog

Use these controls as policy building blocks.

## Code and Files

Pause writes outside the project root.

Deny deletes of source, config, lockfiles, secrets, and git metadata unless explicitly allowed.

Pause broad rewrites, generated code over many files, or dependency changes.

Deny reads of `.env`, key files, wallet files, and private configs.

## Shell and Package Scripts

Pause unknown shell commands.

Deny destructive commands such as recursive delete, disk formatting, permission changes, and process killing.

Pause package scripts before expansion when they can run arbitrary commands.

## Git

Pass status, diff, log, and branch reads.

Pause commits.

Pause pushes.

Deny force pushes by default.

Deny remote changes unless explicitly requested.

## Network and Browser

Pass allowlisted domains.

Pause unknown domains.

Deny webhook and exfiltration-style domains.

Deny requests carrying secret-looking values.

## Wallet and Signing

Pass read-only portfolio checks.

Pause transfers, swaps, contract calls, and signatures.

Deny transfers above hard limits.

Deny unknown chains or recipients when policy requires allowlists.

## Automations

Pause any recurring job, scheduled job, watcher, or trading automation.

Deny automations without an end condition, spend cap, or scope.
