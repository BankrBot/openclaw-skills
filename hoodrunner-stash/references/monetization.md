# Stash monetization

You sell software **actions** (wrap / gift / unwrap / route), not assets — cleaner than a fund taking
a cut, and it fits an agent surface (get paid per call).

## Fee surfaces
| Fee | Where | Shape | Notes |
| --- | --- | --- | --- |
| Wrap | `StashMint.wrap()` on-chain | FLAT (e.g. ~$1–2 equiv) | Per-action, **not** a % of contents (a % reads like a load/AUM). Unbypassable. |
| Gift / drop | hosted endpoint or on-chain | FLAT per gift | The courier running the drop for you. |
| Routing spread | pay-with-anything swap | small % à la 0x/1inch | **Only** when paying in an arbitrary token. MT-flagged — ship after the swap rail. |
| Resale royalty | EIP-2981 on the collection | ~2.5% | Passive, standard, on secondary Stash trades. |
| Premium | hold-to-unlock | — | Nesting, gift-by-QR links, rare art variants, batch drops. |

## x402 (the native "get paid per call" rail)
Expose the batch **`drop`** endpoint (wrap + gift N Stashes for a community) as an x402-priced API.
Agents auto-pay per run — this is how the *skill* earns directly, without a web app checkout. Price
per drop or per Stash.

## $HOODRUNNER (Howey-safe hooks only)
1. **Pay any fee in $HOODRUNNER → discount** (buy-pressure ∝ usage; pure medium-of-exchange).
2. **Fees fund a buyback** (revenue, not inflation; keeps it trading without a dump).
3. **Hold-to-unlock** premium features (utility gating).
**Never:** staking-for-fee-share, inflationary rewards, or "buy the token to earn."

## Who pays (the go-to-market)
- **Retail (weak at current scale):** individuals wrap/gift for themselves; the loop is gift-by-QR.
- **B2B drops (the thesis):** a project/community/creator pays HoodRunner to run a **branded drop**
  to their holders (launch/loyalty/reward). Marketing budget buying a service, not retail buying a
  security → sidesteps Howey and is where intentful money lives. **This is the line to sell**, and
  the Bankr skill + x402 is the delivery mechanism.

## Legal one-liner
Self-directed (buyer/creator picks contents) + non-custodial + flat per-action fees + no
performance/return claims = a tool, not a fund. The money-transmission edge lives on the swap, not
the wrap. Testnet is not the regulated act; counsel before real money on mainnet.
