# Capacitr x402 flow

`/api/analyze-link` is the only paid endpoint. Settlement is handled
per the [x402 spec](https://x402.gitbook.io/x402). Capacitr accepts
two assets on Base, routed to different facilitators depending on the
asset transfer method advertised in the 402 envelope:

| Asset | Address | Methods advertised | Settled by |
|---|---|---|---|
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | `eip3009` | Coinbase CDP facilitator |
| `$CAPACITR` | `$CAPACITR_TOKEN_ADDRESS` (see discovery) | `permit2` **or** `erc7710` (operator picks one) | Coinbase CDP (permit2) or MetaMask CDP (erc7710) |

Real on-chain settlement is verified end-to-end for all three
combinations — see `SKILL.md` "Proven on-chain settlement" for the
basescan transaction hashes.

## Step-by-step

1. **Call without payment.**
   ```bash
   curl -sS -X POST -H "Content-Type: application/json" \
        -d '{"url":"https://x.com/example/status/123"}' \
        "$CAPACITR_BASE_URL/api/analyze-link"
   ```
   Response: `402` with `x402.accepts[]`.

2. **Parse `accepts[]`.** Each entry advertises one
   `assetTransferMethod` in `extra`:

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
     "extra":              {
       "assetTransferMethod": "eip3009",
       "name": "USD Coin",
       "version": "2",
       "symbol": "usdc",
       "product": "Capacitr"
     },
     "settlement":         "facilitated"
   }
   ```

   USDC is always at index 0 when configured, so naive clients can
   take `accepts[0]`.

3. **Sign the right primitive for the advertised method.**

   The `extra.assetTransferMethod` field tells you what to sign and
   the EIP-712 domain values to use. Capacitr's server rebuilds the
   typed-data hash from `accepts[].extra` (`name` + `version`) and
   `accepts[].asset` (`verifyingContract`) and forwards to the
   facilitator — if you hard-code different values your signature
   will be rejected as `invalid`.

   See **SKILL.md** for the full typed-data shapes per method. Short
   summary:

   - **`eip3009`** (USDC): one EIP-712 sig of
     `TransferWithAuthorization` against the token contract.
   - **`permit2`** ($CAPACITR via Coinbase): two EIP-712 sigs — token
     `Permit` granting MaxUint allowance to the canonical Permit2
     contract, plus a Permit2 `PermitWitnessTransferFrom` binding the
     amount, recipient, and `x402ExactPermit2Proxy` spender.
   - **`erc7710`** ($CAPACITR via MetaMask): one ERC-7710 delegation
     signed by a MetaMask Smart Account or EIP-7702-upgraded EOA, with
     an ERC-20 transfer scope and a redeemer caveat naming MetaMask's
     facilitator.

   Signing options:
   - **Bankr platform:** signing handled by Bankr's wallet layer; no
     extra integration required from this skill. Bankr picks the
     `accepts[]` entry matching its wallet's capability.
   - **Privy embedded wallet:** `useX402Fetch()` from
     `@privy-io/react-auth` v3.7+ wraps the signing + retry in a single
     fetch call (browsers only; USDC / `eip3009` only today).
   - **`@coinbase/x402`:** if you're settling USDC or paying $CAPACITR
     via the `permit2` method, the official Coinbase x402 SDK can build
     and sign the headers for you. Same SDK Capacitr uses server-side.
   - **`@metamask/smart-accounts-kit`:** for the `erc7710` path,
     `createOpenDelegation` + `signDelegation` produces the delegation
     bytes that go into `payload.permissionContext`.
   - **Vanilla x402 / your own signer:** sign with viem `signTypedData`
     or equivalent, then set the resulting payload as `X-Payment` per
     the [x402 spec](https://x402.gitbook.io/x402).

4. **Retry with payment.**
   ```bash
   curl -sS -X POST \
        -H "Content-Type: application/json" \
        -H "X-Payment: <base64 JSON paymentPayload>" \
        -d '{"url":"https://x.com/example/status/123"}' \
        "$CAPACITR_BASE_URL/api/analyze-link"
   ```

5. **Outcome.**
   - `200`: success. Result body returned. Real on-chain settlement
     has already cleared at this point (or is in flight, per the
     facilitator's `waitUntil` policy).
   - `402`: the header was rejected (asset not configured, payee wrong,
     amount below `maxAmountRequired`, signature mismatch, or the
     facilitator declined). Re-fetch discovery if `prices_version`
     changed and retry.
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

## Operator switches that agents see in `accepts[]`

Capacitr operators control which $CAPACITR settlement path is exposed
via the `CAPACITR_FACILITATOR` env on the server:

- `CAPACITR_FACILITATOR=coinbase` → `extra.assetTransferMethod = "permit2"`
- `CAPACITR_FACILITATOR=metamask` (default) → `extra.assetTransferMethod = "erc7710"`

The agent never needs to know which env is set — it just reads the
method from the 402 envelope and signs accordingly. If the operator
flips the switch, the agent sees the new method in the next 402 and
adapts.

USDC always uses `eip3009`, regardless of this setting.

## Disabled gates

If `X402_DISABLED=true` is set on the server, the gate is bypassed for
every caller. This is for local dev — assume it is off in production.

The web client (capacitr.xyz origins) also bypasses x402; this bypass
is **route-local** and not exposed via the shared x402 helper. Do not
attempt to forge `Origin` or `Referer` from an agent context — the
bypass is intentionally narrow and may be removed without notice.
