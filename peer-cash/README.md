# Peer Cash for Bankr

Cash out a Bankr wallet's Base USDC to supported fiat payment apps through the Peer protocol.

The included CLI uses `@zkp2p/cash` to build unsigned Base transactions, submits them through Bankr's Wallet API, resolves the confirmed deposit receipt, and returns the resumable Peer `depositId`. It supports discovery, estimates, order creation, status, listing, withdrawal, and top-up.

## Install

```text
install the peer-cash skill from https://github.com/BankrBot/skills/tree/main/peer-cash
```

Then install the local runtime dependencies:

```bash
cd peer-cash
npm install
```

Set a write-enabled `BANKR_API_KEY`. No Peer API key or private key is required.

## Safety model

- Read commands do not move funds.
- Write commands fail closed without `--confirm`; the agent must show the generated preview and wait for a later-turn user confirmation.
- Transaction hashes and the Peer `depositId` are always returned for reconciliation.
- Unknown transaction outcomes are never automatically retried.
- The SDK uses protocol-held escrow. The Bankr wallet can withdraw unmatched funds.

See `SKILL.md` for the command contract and recovery rules.
