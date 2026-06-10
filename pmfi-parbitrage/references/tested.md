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
