# Capacitr x402 flow

`/api/analyze-link` is the only paid endpoint. Settlement is handled
per the [x402 v1 spec](https://x402.gitbook.io/x402). Capacitr accepts
two assets on Base:

| Asset | Address | Settlement | Verified by |
|---|---|---|---|
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | **Facilitated** when `X402_FACILITATOR_URL` is set on the server (default Coinbase) | Coinbase x402 facilitator |
| `$CAPACITR` | `$CAPACITR_TOKEN_ADDRESS` (see discovery) | **Structural only** in v1 | Capacitr server (shape, payee, amount) |

The trust delta is intentional and surfaced via `accepts[].settlement`
in the 402 challenge and via `notes.settlement_trust` in the discovery
preflight. Agents should choose USDC when stronger settlement assurance
matters.

## Step-by-step

1. **Call without payment.**
   ```bash
   curl -sS -X POST -H "Content-Type: application/json" \
        -d '{"url":"https://x.com/example/status/123"}' \
        "$CAPACITR_BASE_URL/api/analyze-link"
   ```
   Response: `402` with `x402.accepts[]`.

2. **Parse `accepts[]`.** Each entry looks like:
   ```json
   {
     "scheme":             "exact",
     "network":            "base",
     "maxAmountRequired":  "100000",
     "resource":           "https://app.capacitr.xyz/api/analyze-link",
     "description":        "Capacitr URL scan — …",
     "mimeType":           "application/json",
     "payTo":              "0x6503fB61705EB6B3C57EE1ab88a1a75A6eE01869",
     "maxTimeoutSeconds":  30,
     "asset":              "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
     "outputSchema":       null,
     "extra":              { "name": "Capacitr", "version": "1.0", "symbol": "usdc" },
     "settlement":         "facilitated"
   }
   ```

   USDC is always at index 0 when configured, so naive clients can
   take `accepts[0]`.

3. **Sign an EIP-3009 `transferWithAuthorization`** for the chosen
   asset against your wallet, paying `payTo` from your address with
   `value === maxAmountRequired`.

   The EIP-712 domain MUST come from `accepts[].extra` (`name` +
   `version`) and `accepts[].asset` (`verifyingContract`). Capacitr's
   facilitator rebuilds the typed-data hash from those fields — if you
   hard-code different values your signature will be rejected as
   invalid.

   Signing options:
   - **Bankr platform:** signing is handled by Bankr's wallet layer; no
     extra integration required from this skill.
   - **Privy embedded wallet:** `useX402Fetch()` from
     `@privy-io/react-auth` v3.7+ wraps the signing + retry in a single
     fetch call (browsers only).
   - **Vanilla x402 / your own signer:** sign with viem `signTypedData`
     or equivalent, then set the resulting payload as `X-Payment` per
     the [x402 spec](https://x402.gitbook.io/x402).

4. **Retry with payment.**
   ```bash
   curl -sS -X POST \
        -H "Content-Type: application/json" \
        -H "X-Payment: <base64 JSON authorization>" \
        -d '{"url":"https://x.com/example/status/123"}' \
        "$CAPACITR_BASE_URL/api/analyze-link"
   ```

5. **Outcome.**
   - `200`: success. Result body returned.
   - `402`: the header was rejected (asset not configured, payee wrong,
     amount below `maxAmountRequired`, or the facilitator declined).
     Re-fetch discovery if `prices_version` changed and retry.
   - `502`: facilitator unreachable. Back off and retry.
   - `429`: rate limit. Honour `Retry-After`.

## Versioning and cache invalidation

Both discovery and every 402 challenge carry a `prices_version` field
(also returned as `X-Capacitr-Prices-Version`). It is a short sha256
hash derived from the configured assets and their prices. Compare it
to your cached discovery `prices_version`; if it differs, re-fetch
discovery before re-signing.

Operators can force a cache bust by setting
`CAPACITR_PRICES_VERSION_OVERRIDE` to any string.

## $CAPACITR trust delta

In v1, `$CAPACITR` payments are accepted on structural validation
alone — the server checks payee, asset address, and amount but does
**not** verify settlement on-chain. Coinbase's x402 facilitator does
not support custom ERC-20s today; a self-hosted or PayAI/Corbits
facilitator with custom-ERC-20 support is the v2 lever.

If your application has a higher trust bar than `"the agent's wallet
holds enough $CAPACITR and is willing to authorize a transfer"`,
choose USDC.

## Disabled gates

If `X402_DISABLED=true` is set on the server, the gate is bypassed for
every caller. This is for local dev — assume it is off in production.

The web client (capacitr.xyz origins) also bypasses x402; this bypass
is **route-local** and not exposed via the shared x402 helper. Do not
attempt to forge `Origin` or `Referer` from an agent context — the
bypass is intentionally narrow and may be removed without notice.
