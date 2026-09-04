# USDCtoFiat for Bankr

Cash out a Bankr wallet's Base USDC to eligible fiat payment apps through USDCtoFiat by Galleon.

The CLI calls `@usdctofiat/offramp@7.0.1`:

```ts
cashout({ mode: "fast" | "best", signer, amount, currency, platform, payee })
```

- **Fast**: live market rate, 0% spread. Attribution is locked to TOFIAT.
- **Best**: Delegate strategy. 10 bps on fill, taken from USDC released to the taker.

Attribution is handled by `@usdctofiat/offramp`.

Unsigned Base transactions are submitted through Bankr `/wallet/submit`. No private key. No Peer API key.

## Install

```text
install the usdctofiat skill from https://github.com/BankrBot/skills/tree/main/usdctofiat
```

Then install the local runtime dependencies:

```bash
cd usdctofiat
npm install
```

Set a write-enabled `BANKR_API_KEY`.

## Safety model

- Read commands do not move funds.
- Write commands fail closed without `--confirm`; the agent must show the generated preview and wait for a later-turn user confirmation.
- `cashout` requires an explicit `--mode fast` or `--mode best`.
- Transaction hashes and the returned `depositId` are always returned for reconciliation.
- Unknown transaction outcomes are never automatically retried.

See `SKILL.md` for the command contract and recovery rules.
