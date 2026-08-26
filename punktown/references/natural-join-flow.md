# Natural join flow

Read this when the user asks for a composite outcome such as “buy me a Bario
Punk and join Punk Town,” “get me into Punk Town,” or chooses a Crew tier but
does not hold enough BAES. The user should not need to know the protocol's
transaction sequence.

## Bankr-native boundary

Use two execution layers, each for what it is designed to do:

- Acquire a BAES shortfall with Bankr's **named, same-chain exact-output swap**
  capability. Bankr supports exact-output natural-language swaps on same-chain
  EVM routes. Invoke the current agent's native swap capability directly; do
  not recursively call `/agent/prompt`. Bind the output by the Base BAES
  contract in `deployment.json`, never by ticker alone.
- Build every Punk Town approval and protocol call with `punktown.mjs`, inspect
  it locally, and submit the exact unsigned transaction through Bankr one at a
  time.

Do not use `/wallet/submit` or hand-built DEX calldata for BAES acquisition. Do
not reverse Punk Town's `BaseV4FeeRouter`: it is a one-way, caller-bound
BAES-to-WETH fee adapter and cannot sell BAES to a visitor.

The direct `/wallet/swap-quote` and `/wallet/swap` API is documented as
exact-input. It is a fallback only. If a runtime exposes only that lower-level
API, size and freshly requote an exact input until the returned `minBuyAmount`
is at least the BAES deficit. Then run `bind-acquisition` with the planner's
request context/key and the concrete quote. Never treat an estimated output as
a guarantee. Use one UUID `idempotencyKey` for execution and compare decimal
strings or integer base units without floating-point conversion.

Official Bankr references:

- <https://docs.bankr.bot/features/trading/swaps/>
- <https://docs.bankr.bot/wallet-api/swap/>
- <https://docs.bankr.bot/wallet-api/portfolio/>

## Buy a Punk and then ask for the tier

Map the composite request to:

```bash
node scripts/punktown.mjs plan-buy \
  --wallet 0xActiveBankrWallet \
  --slippage-bps 300 \
  --acquisition-slippage-bps 300 \
  --join
```

This first checks the deployment, fee route, current FIFO head, Punk custody,
fee-conversion quote, current wallet bytecode state, and BAES balance. A
code-free wallet is the simple receiver case; a contract wallet is not proven
ERC721-C compatible until the funded buy action itself passes fresh simulation.
Follow the phase returned by the planner.

### `phase: acquire-baes`

The planner has passed the pre-acquisition gates available without spending,
but the wallet does not hold the required BAES. Its acquisition request fixes:

- Base as both source and destination chain;
- the reviewed BAES output token address;
- the current BAES deficit as the requested exact output and fallback floor;
- the maximum acquisition slippage;
- the balance and final-action request bindings;
- the exact command to resume after success.

Use the authenticated Base portfolio to find a supported funding asset. The
only sources this skill can bind and prove are native ETH, WETH, and official
Base USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`). Keep enough native ETH
for gas. If the user names any other asset, explain that its debit semantics are
outside this verifier and ask them to swap it to one of those three sources
first. Never auto-sell tokenized stock, another NFT, or a Crew reward credit.
Do not bridge from another chain or change wallets.

Bankr may represent native Base ETH as either the zero address or its
`0xEeee...` native-token sentinel. `bind-acquisition` canonicalizes both to the
Bankr sentinel, and `verify-acquisition` proves the bounded native input from
the wallet's logical call value rather than the sponsored outer transaction
value, which is normally zero, or an ERC-20 `Transfer` log. That logical value
is conservative: a router refund can make the wallet's eventual net spend
lower, so the verifier does not claim an exact net native-ETH debit.

`acquisitionRequestKey` is an integrity binding, not authorization to spend an
unknown token. Ask Bankr's native exact-output action for a fresh concrete
preview, then run `bind-acquisition --mode bankr-native-exact-output` with its
source token, maximum source amount, BAES output floor, and all available quote
fields. Before the swap, show one natural confirmation covering the complete
known economic action and its `acquisitionAuthorizationKey`:

- source asset and maximum source amount;
- Bankr fee and price impact when available;
- exact BAES deficit and slippage bound;
- current FIFO Punk ID and the fixed 6,600,000 BAES desk payment;
- the expected serial phases: swap, exact approval when needed, Punk buy;
- that Crew tier and its non-refundable BAES cost are **not** authorized yet.

The user may authorize these unchanged phases with one yes only after the
source and maximum spend are concrete. Bankr's receipt waiting is not human
confirmation; the assistant must obtain the yes before the first write. If the
native action cannot show these bounds, stop.

For the native path, pass `--mode bankr-native-exact-output`; `--source-amount`
means the quoted maximum input, `--min-baes-out` is the requested BAES deficit,
and no UUID is supplied. Execute only the resulting `execution.intent` through
the current Bankr agent's native swap action.

For the direct Wallet API fallback, generate the UUID before confirmation and
run:

```bash
node scripts/punktown.mjs bind-acquisition \
  --wallet 0xActiveBankrWallet \
  --request-context 0xAcquisitionRequestContextHex \
  --request-key 0xAcquisitionRequestKey \
  --mode wallet-api-exact-input \
  --source-token 0x4200000000000000000000000000000000000006 \
  --source-symbol WETH \
  --source-decimals 18 \
  --source-amount EXACT_INPUT \
  --min-baes-out QUOTED_MINIMUM \
  --idempotency-key UUID \
  [--quote-id FRESH_QUOTE_ID] [--fee-bps N] [--price-impact-bps N] \
  [--swap-impact-bps N] [--max-price-impact-bps N] [--network-costs-usd N]
```

Show its report and confirm its `acquisitionAuthorizationKey`. Submit exactly
its `execution.request` to `/wallet/swap` once. A changed source, input, BAES
floor, fee/impact, quote, slippage, wallet, UUID, or target plan requires a new
binding and confirmation.

Execute one Bankr swap attempt. A `2xx` response is not enough: Bankr can return
HTTP 200 with `success: false` for a mined revert. Require a successful mined
swap hash, then prove the bound source and BAES receipt before resuming:

```bash
node scripts/punktown.mjs verify-acquisition \
  --wallet 0xActiveBankrWallet \
  --tx 0xMinedSwapHash \
  --authorization-context 0xAuthorizationContextHex \
  --authorization-key 0xAcquisitionAuthorizationKey
```

This checks the direct sender or selected sponsored UserOperation sender, its
successful Base execution, canonical WETH/USDC net debit or logical native
value against the confirmed exact/maximum input, net BAES `Transfer` delivery
against the floor, and the fresh required BAES balance. Self-transfers and
out-and-back transfer amounts do not count. In a shared EntryPoint bundle, only the
active wallet's selected UserOperation log window counts. It deliberately makes
no claim about Bankr's managed router, calldata, token approval, native refund,
or exact net native spend. Then run the planner's exact resume command; that
fresh planner is the authoritative target-action state.

If it still returns `acquire-baes`, stop and show the remaining shortfall. One
confirmation authorizes one concrete acquisition attempt, not an unbounded
loop.

### `phase: approval` or `phase: action`

Continue through `bankr-execution.md`: inspect, submit one transaction, require
its receipt proof, and freshly re-plan after every approval. Continue without a
second prompt only while the final `confirmationKey`, FIFO Punk ID, recipient,
amounts, spenders, and slippage bounds remain unchanged. A changed FIFO head is
a different NFT and requires a new confirmation.

After the buy receipt and a fresh `ownerOf(tokenId) == wallet` read both pass,
use the plan's `afterSuccess` data. Match the user's tone; a natural result is:

> BAES'in yoktu; yeteri kadarını aldım ve Bario Punk #123 artık cüzdanında.
> Crew'a hangi tier'dan girelim?

Do not say this after only an approval, swap, submitted hash, pending receipt,
or unproven buy. Do not ask for the tier before the Punk is verifiably owned by
the wallet.

Present all current choices without choosing for the user:

| Tier | Non-refundable BAES cost | Weight |
|---|---:|---:|
| Signal | 600,000 | 100 |
| Surge | 1,500,000 | 158 |
| Riot | 3,300,000 | 235 |
| Overdrive | 6,000,000 | 316 |
| Maximum | 15,000,000 | 500 |

Higher tiers buy more reward weight but intentionally cost more BAES per unit
of weight. Exiting later returns the Punk, never the tier BAES.

## After the user chooses a tier

Run `plan-stake` for the verified Punk and chosen tier. If it returns
`acquire-baes`, repeat the Bankr-native acquisition procedure for only the
current tier shortfall. This is a new economic decision: show the acquisition
source plus the non-refundable tier cost and obtain confirmation before the
swap. Then resume the exact planner command, run exact BAES and token-specific
NFT approvals serially, execute `stake`, and prove `PositionOpened`, LockVault
custody, tier, weight, depositor, and beneficiary.

`plan-upgrade` follows the same rule for its exact live BAES delta. Never acquire
BAES automatically for reserve top-ups, WETH top-ups, claims, conversions, or
any other operation.

## Resume and unknown outcomes

- A timeout, `504`, ambiguous `502`, pending result, or missing confirmation may
  already have broadcast. Check Bankr activity and Base for the original hash;
  never retry under a new idempotency key just because the response was lost.
- After a proven acquisition, re-plan from chain state. Never cache the old
  approval or Punk call.
- After an ambiguous Punk buy, do not run a generic new `plan-buy`: that could
  buy the next FIFO Punk. Resolve the original transaction and token ID first.
- If the swap succeeded but the Punk head changed, keep the BAES in the user's
  wallet and ask whether to buy the newly identified head. Do not spend it
  silently.
- If Bankr security, spend-limit, price-impact, token-scan, read-only, or raw
  contract-call controls reject a step, explain the exact control and stop. Do
  not weaken or route around it.
