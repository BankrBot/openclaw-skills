# Bankr wallet API — x402 and scan blocks

Most bankr-communities actions are **HTTP-only**. **Fundraising / raffles** may use **x402 USDC on Base** via Bankr.

## Endpoint

Use **`POST https://api.bankr.bot/wallet/submit`**. Legacy `/agent/submit` is removed.

Requires API key with `walletApiEnabled` and not `readOnly`.

## Payment guardrails

Before directing a user to pay or before agent-initiated submit:

- **Chain:** Base only
- **Asset:** USDC (EIP-3009 / Permit2 per bankr.space flow)
- **Payee:** token **fee recipient** — validate against `GET /api/holders/{token}` / fundraising `x402BaseUrl`
- **Amount:** platform caps ($1 per x402 click on fundraisers; see **`references/FUNDRAISING-GUARDRAILS.md`**)
- **Explicit user confirmation** before enabling a fundraiser or submitting payment

## `untrusted_address` or security scan blocks

When Bankr rejects a transaction:

1. **Stop** — no further submits
2. **Surface the risk** plainly
3. **Do not** route users to bankr.space or external UIs to **bypass** the scanner
4. Options: different amount, Bankr support, retry later

### Forbidden

- "Complete the payment on the website instead to bypass the block"
- Any workflow that trains users to circumvent Bankr after a high-risk scan

See **`references/FUNDRAISING-GUARDRAILS.md`** for fundraiser-specific rules.
