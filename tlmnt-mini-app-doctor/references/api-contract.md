# TLMNT public API contract

Pinned reference date: 2026-08-10. Treat live mismatches as a stop condition and verify current schemas at `https://tlmnt.app/openapi.json` and discovery at `https://tlmnt.app/.well-known/x402`.

## Shared x402 terms

| Field | Required value |
| --- | --- |
| x402 version | `2` |
| scheme | `exact` |
| network | `eip155:8453` |
| asset | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| payTo | `0xae79Ad22EB2723f40678Cb8A1e098bC9A27E8aA0` |
| maxTimeoutSeconds | `300` |
| accepted.extra | exactly `{"name":"USD Coin","version":"2"}` |
| authorization | EIP-3009; Permit2 is not accepted |

USDC amounts use six decimals.

The service uses `https://facilitator.xpay.sh` as its server-side authoritative verifier and settler. This is not a client-selectable fallback: never route an uncertain authorization to a different facilitator.

## Static Evidence Dossier

- Free eligibility: `POST https://tlmnt.app/api/x402/miniapp-audit/eligibility`
- Paid resource: `POST https://tlmnt.app/api/x402/miniapp-audit`
- Recovery: `POST https://tlmnt.app/api/x402/miniapp-audit/recovery`
- Amount: `750000` atomic USDC (`0.75 USDC`)
- Request body: `{"url":"<normalized public URL>"}`
- Scope: deterministic static scan findings and remediation-oriented evidence.
- Explicit exclusions: no cryptographic account-association verification, image-dimension verification, real-client execution, release approval, uptime guarantee, or security audit.

## Pinned Server-Side Release Gate

- Free eligibility: `POST https://tlmnt.app/api/x402/miniapp-deep-release/eligibility`
- Paid resource: `POST https://tlmnt.app/api/x402/miniapp-deep-release`
- Recovery: `POST https://tlmnt.app/api/x402/miniapp-deep-release/recovery`
- Amount: `5990000` atomic USDC (`5.99 USDC`)
- Request body: `{"url":"<exact normalized public HTTPS URL>"}`
- Scope: original header/payload JFS evidence, fresh finalized Optimism custody/key state and pinned registry-code hashes, strict manifest/embed rules, and bounded referenced-image evidence.
- Bounds: at most 10 candidates, 12 MB per fetch, 30 MB aggregate, and one shared 40-request gate envelope.
- PNG-only v1: GO requires every referenced image to be PNG. The gate validates PNG structure, CRCs, geometry, alpha-channel or `tRNS` structure, and zlib header framing, but not DEFLATE pixel decodability or rendering.
- Explicit exclusions: no client execution, release approval, security audit, uptime guarantee, future-state claim, or whole-release proof. `readyForRelease` is always `false`.

## Recovery contract

Send the original x402 `Payment-Signature` header to the matching recovery endpoint. Do not include a new authorization.

Recovery is fail-closed. A successful response returns the exact stored dossier bytes. When hook settlement is uncertain, the service may reconcile a finalized canonical Base USDC `AuthorizationUsed` event, successful receipt, and adjacent exact transfer to the merchant. A failed or unavailable proof never authorizes another payment.

## Free scan

`POST https://tlmnt.app/api/scan` with `{"url":"<public URL>"}` provides the interactive product's free scan. It is separate from x402 eligibility and may persist a public-target scan report. Never send confidential URLs.
