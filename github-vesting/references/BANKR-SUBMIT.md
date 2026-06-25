# Bankr agent/submit — security scan blocks

## Not a Proof of Dev allowlist

Proof of Dev accepts **any ERC-20 on Base**. `known-escrow.json` / `streaming-hints.json` lists **streaming detection hints only** (e.g. Space). It is **not** a token allowlist.

If `POST /api/agent/lock` returns `ok: true` with `transactions[]`, the API accepted the token.

## `untrusted_address` on approve

When Bankr `POST https://api.bankr.bot/agent/submit` rejects the **approve** step:

```
security scan — high risk for token loss (untrusted_address)
```

That is **Bankr's wallet security scanner**, not this skill. New or low-history tokens (e.g. Harness) may fail until Bankr trusts the contract.

### What to tell the user

1. The vesting API prepared the lock correctly.
2. Bankr blocked the approve tx before broadcast.
3. Options:
   - **Web UI (recommended):** `https://www.proofofdev.xyz/create` — connect wallet in browser and approve there
   - Try a token Bankr already trusts (e.g. one with longer holder/liquidity history)
   - Ask Bankr to allowlist the token contract for `agent/submit`
4. **Do not** say "token isn't supported" without a failed `POST /api/agent/lock` first.

## Streaming tokens (no approve)

Tokens with `isPoolUnlocked()` or Space may use `lockAllowance` — only a **lock** tx, no approve. Bankr scan may still apply to the lock tx.

TMP and similar Bankr ecosystem tokens often use streaming path when the contract supports it.
