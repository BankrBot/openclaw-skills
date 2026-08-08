# Accounting & analysis

Query, tag, and export treasury activity. `transactions list` is the query surface; `transactions memo` and `transactions properties` handle tagging and cleanup. Do arithmetic with scripts, not by hand.

## Querying transactions

```bash
splits transactions list --account <address> --period thisMonth
```

Filters (combine freely; pair `--memo` with `--account`/`--chainId`/a date range for efficiency):

| Flag | Purpose |
|---|---|
| `--account` | One address or comma-separated list (results union across accounts) |
| `--chainId` | Filter by chain |
| `--direction` | `inbound` (asset transfers in) or `outbound` (splits txns + outbound transfers) |
| `--period` | `thisWeek` `thisMonth` `thisYear` `lastWeek` `lastMonth` `lastYear` `last30Days` `last90Days` `last6Months` (local tz) |
| `--startDate` / `--endDate` | ISO 8601. `--endDate` is **exclusive** — use `2026-04-02` to include April 1. Mutually exclusive with `--period` |
| `--minAmount` / `--maxAmount` | Absolute USD bounds, sign-agnostic; excludes txns with no resolved USD price |
| `--memo` | Case-insensitive substring (min 3 chars) across txn and asset-transfer memos |
| `--transactionHash` | Onchain tx hash; combine with `--chainId` to disambiguate across chains |
| `--userOpHash` | ERC-4337 user-op hash; returns 0 or 1 result (splits-initiated txns only) |
| `--limit` / `--cursor` | Page size (default 50) and pagination. Replay the same filters when using a cursor |

Examples:

```bash
# ~$5k payment to Acme last month, outbound only
splits transactions list --account <addr> --period lastMonth --memo Acme \
  --minAmount 4500 --maxAmount 5500 --direction outbound

# All inbound activity this year on Base
splits transactions list --account <addr> --chainId 8453 --period thisYear --direction inbound

# Q1 payroll with explicit dates (note exclusive end)
splits transactions list --account <addr> --memo "Q1 payroll" \
  --startDate 2026-01-01 --endDate 2026-04-01

# Look up the txn you just submitted, by the userOpHash from `transactions sign`
splits transactions list --userOpHash 0x1dfe...dcf
```

## Cleaning up memos & properties

Keep books reconcilable by attaching consistent memos and structured properties.

```bash
# Set or clear a memo (empty string clears)
splits transactions memo <id> --memo "Q1 payroll — contractor X"
splits transactions memo <id> --memo ""

# Merge string properties into existing metadata
splits transactions properties set <id> --property category=payroll --property period=2026Q1
splits transactions properties set <id> --unset oldkey

# Replace the entire properties object (supports non-string types via JSON)
splits transactions properties replace <id> --properties '{"category":"vendor","amountUsd":1000}'

# Remove all custom metadata
splits transactions properties clear <id>
```

- `set` shallow-merges; `replace` overwrites the whole object; `clear` wipes it.
- `--property key=value` is repeatable and string-typed; use `--properties` JSON for numbers/booleans.
- Total minified properties ≤ 500 chars; memo ≤ 500 chars.

Establish a small, consistent property vocabulary up front (e.g. `category`, `invoice`, `period`, `vendor`, `source`) so later filtering and exports are clean.

## Exports & reconciliation

- Summarize by period/account/category by pulling `transactions list` and aggregating in a script (page through with `--cursor`, replaying the same filters).
- Reconcile a specific onchain payment with `--transactionHash` (+ `--chainId`), or a submitted proposal with `--userOpHash`.
- Splits also offers accounting exports and read-only accountant access from the web app — use those for formal period-close; use the CLI for ad-hoc queries, tagging, and cleanup.

## Read-only access for accountants

For an accountant or auditor, prefer a read-scoped API key (`sk_read_...`) or the web app's read-only accountant role rather than sharing an owner key. Read scope covers `accounts list/get/balances`, `transactions list/get`, and `automations list` without exposing state-changing operations.
