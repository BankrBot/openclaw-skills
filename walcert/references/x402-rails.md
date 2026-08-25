# x402 rails

Same `POST /v1/certificates/{type}` lists three `accepts`. The client picks **one**.

| Priority | Network | Asset | How to pay | NFT receipt |
|---------|---------|-------|------------|-------------|
| Default | Base `eip155:8453` | Native USDC (6 dec) | EIP-3009 via CDP | No |
| Fallback | Celo `eip155:42220` | USDC (6 dec) | EIP-3009 via x402.celo.org | No |
| Optional | BNB `eip155:56` | Binance-Peg USDC 18 dec `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d` | Permit2 via Dexter | Yes, after `claim` |

Price is **$0.05** on every rail. Canonical certificate (EIP-712 + `giveFeedback`) is
always on **Celo**, regardless of which rail paid.

## Default: Base

Use Base unless the host cannot settle USDC there. This matches `accepts[0]` (CDP Bazaar).

## BNB (optional)

Only if **all** are true:

1. Host wallet holds Binance-Peg USDC on BSC.
2. Host can sign **Permit2** (first time: `approve` USDC → Permit2
   `0x000000000022D473030F116dDEE9F6B43aC78BA3`).
3. After HTTP 200, host will `claim` the voucher as the **payer**.

The receipt contract is already deployed (do not deploy):
[`0x4e430fB5A5f26ED08eC123373Cd8AD3cE15C24c7`](https://bscscan.com/address/0x4e430fB5A5f26ED08eC123373Cd8AD3cE15C24c7).
Soulbound. `msg.sender` must be the x402 payer. Claim gas is BNB, not the $0.05.

If the host cannot Permit2 or cannot send a BSC tx, **pay on Base**. A Base payment
does not mint this NFT.

## Forbidden

Do not wrap these URLs on Bankr x402 Cloud (`x402.bankr.bot`). That creates a second
402, a foreign URL, and a platform fee. Call Walcert directly.
