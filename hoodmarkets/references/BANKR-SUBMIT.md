# Bankr /wallet/submit

Use `POST https://api.bankr.bot/wallet/submit` with write-enabled API key.

## Chain 4663 — abort if unsupported

**Before any submit:** confirm Bankr wallet supports **Robinhood Chain (4663)**. If not → **abort** — do not fall back to another chain. See `references/CHAIN-4663.md`.

Set `"chainId": 4663` on every hood.markets Pro swap transaction.

## untrusted_address

If Bankr blocks a transaction with `untrusted_address`:

1. **Stop** — do not retry with different encoding or calldata
2. **Do not** tell the user to use the web UI, Uniswap, or any alternate venue to bypass Bankr's security scanner
3. Explain the contract is not on Bankr's allowlist yet and the swap cannot proceed through Bankr
4. **Do not** post `uniswapSwapUrl` as a workaround for a blocked Pro tx

**Exception (not a bypass):** Simple (V3) tokens never use Bankr submit — `token-info` returns `launchType: simple` and agents share the Uniswap link as the **primary** route (no prepare-buy/sell). That is normal routing, not a scanner bypass.

## Order

Sell: `approve` (if in `transactions[]`) → `sell`  
Buy: single `buy` tx

Use `"waitForConfirmation": true` on each submit.

## Pre-submit

Complete `references/TX-VALIDATION.md` checklist and show user preview before every submit.
