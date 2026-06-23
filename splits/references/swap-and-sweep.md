# Swap & sweep: automated revenue processing

Splits automation accounts process incoming revenue (protocol fees, token fees, product income) on a rule the human configures once: convert to stablecoin, buy back a token, withhold tax, or consolidate balances. Bankr handles trading decisions; Splits applies the standing revenue policy.

## What automations do

Splits automation accounts run rules that fire on receipt when a threshold ($5 of a single token) is met:

- **Convert to stablecoin** — sweep volatile inflows into USDC so treasury value is predictable.
- **Buyback** — route a share of revenue into your own token.
- **Swap into ETH / blue-chips** — accumulate a target asset from mixed inflows.
- **Withhold tax** — split a percentage into a dedicated tax-reserve subaccount on every inbound payment.
- **Consolidate** — sweep balances from many income-earning subaccounts up to a primary treasury.

## CLI capability today: discover & monitor, not create

> Automation account **rules are configured by a human in the Splits web app.** The CLI does not create automations. An agent should propose the structure to the human, then point them to the web app to enable it. Once an automation account is created, you then need to update the upstream revenue producer to send the funds to the automation account.

Via CLI the agent can **discover and monitor**:

```bash
splits automations list                                   # rules configured for the org
splits accounts balances <REVENUE_ACCOUNT> --chainIds 1,8453
splits transactions list --account <REVENUE_ACCOUNT> --direction inbound --period last30Days
splits transactions list --account <TAX_RESERVE> --direction inbound --period thisYear
```

Use this to verify an automation is firing (inbound revenue → expected swaps/sweeps appearing), to report how much has accrued in the tax reserve, or to total buybacks over a period.

## Agent-executed one-off swaps

When there is no standing automation — a discretionary buyback, a manual conversion, a consolidation sweep — the agent can execute a discrete swap with a custom transaction, **only with known calldata**:

```bash
splits transactions create custom \
  --account <ACCOUNT> --chainId 8453 \
  --calls '[
    {"to":"0xToken","data":"0x<approve-calldata>","value":"0"},
    {"to":"0xRouterOrSwapper","data":"0x<swap-calldata>","value":"0"}
  ]' \
  --memo "Buyback: swap USDC -> TOKEN" --property category=buyback
```

Then sign/approve per the account threshold (see `treasury-workflows.md`). Rules:

- Do **not** invent router addresses, Swapper addresses, ABIs, or calldata. Source them from canonical docs/explorers, or ask.
- Before creating, show the human the target contract(s), the decoded intent of each call, value, slippage assumptions, and risk.
- Default to human-in-the-loop thresholds for buybacks and conversions of material size.

## A typical producer setup

1. **Revenue automation account** receives fees/product income (see fee-locker claiming in `treasury-workflows.md`).
2. **Agent** monitors with `automations list` + inbound `transactions list`, reports accrual by destination, and executes discretionary swaps via `create custom` when asked.
3. **Consolidation**: periodically sweep idle operating subaccount balances up to the primary treasury with `transactions create transfer`.
