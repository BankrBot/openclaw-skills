# Bankr `/wallet/submit` — security scan blocks

## Not a Proof of Dev allowlist

Proof of Dev accepts **any ERC-20 on Base**. `known-escrow.json` / `streaming-hints.json` lists **streaming detection hints only** (e.g. Space). It is **not** a token allowlist.

If `POST /api/agent/lock` returns `ok: true` with `transactions[]`, the API accepted the token — but you must still run `references/TX-VALIDATION.md` before submit.

## Endpoint

Use **`POST https://api.bankr.bot/wallet/submit`** with a `transaction` object. Legacy `/agent/submit` is **removed** (returns 403). See `bankr/references/sign-submit-api.md`.

Requires API key with `walletApiEnabled` and not `readOnly`.

## `untrusted_address` on approve

When Bankr rejects the **approve** step:

```
security scan — high risk for token loss (untrusted_address)
```

That is **Bankr's wallet security scanner** flagging the token contract or spender as high risk.

### Required agent behavior — stop, do not bypass

1. **Stop the lock flow.** Do **not** submit further transactions.
2. **Surface the risk** to the user in plain language: Bankr blocked an approve that could enable token loss; the escrow spender was `0x76dd4C6ea986684CDf822eC0832e142A2D5C8165`.
3. **Do not** tell the user to complete the approve in the Proof of Dev web UI, a browser wallet, or any other path to **circumvent** Bankr's scanner. That trains users to bypass safety controls.
4. **Do not** say "token isn't supported" unless `POST /api/agent/lock` itself failed first.
5. Options you **may** offer:
   - Try a different token Bankr already trusts (if the user agrees)
   - Contact Bankr support to review the token contract for `/wallet/submit`
   - Wait — scanner trust may improve as the token gains history
6. If the user had a **partial** allowance from a failed attempt, mention they can revoke via Bankr or `approve(escrow, 0)` if they want to clear it.

### Forbidden

- "Use https://www.proofofdev.xyz/create to approve there instead"
- "Open the site to bypass the block"
- Any workflow that routes around Bankr after a high-risk scan result

## Streaming tokens (no approve)

Tokens with `isPoolUnlocked()` or Space may use `lockAllowance` — only a **lock** tx, no approve. Bankr scan may still apply to the lock tx; same **stop and surface** rules apply.

## Validation reminder

Even when Bankr accepts a tx, the agent must validate calldata per `references/TX-VALIDATION.md` **before** calling `/wallet/submit`.
