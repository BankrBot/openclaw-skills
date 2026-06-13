# Tested flow

Real Bankr deposit into PMFI pARBITRAGE was tested successfully on Base.

Successful PMFI requestDeposit transaction:

https://basescan.org/tx/0x89918ee7f4ff63fd0cfa3581c67aa28d8bafaacbd420c329eafd5c27e45529d4

Observed request:

#10 PENDING: $10.0 USDC -> ~10.0 pARB

Tested actions:

- deposit dry-run
- withdraw dry-run
- USDC approval
- real requestDeposit through Bankr Wallet API

Core UX:

Deposit USDC -> PMFI processes after report -> user receives pARB

Withdraw pARB -> PMFI processes after report -> user receives USDC

## Security and preflight validation

Validated:

- Bankr API endpoint is hard-coded to the reviewed Bankr domain
- PMFI vault address is hard-coded
- malicious BANKR_API_URL and PMFI_PARBITRAGE_VAULT values are ignored
- transaction targets and function selectors are allowlisted
- authenticated Bankr wallet is always used as receiver
- prompt-injection guardrails are documented
- risk disclosure is shown before execution
- paused and shutdown state are checked
- on-chain minimum deposit is checked
- vault cap and current usage are checked
- deposit output is previewed
- withdrawal output is previewed
- withdrawal call simulation passes
- execution without direct risk confirmation is blocked
