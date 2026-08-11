# Megapot contract reference (Base mainnet, chain 8453)

> **Authoritative source**: `https://llms.megapot.io` — index at `/llms.txt`, task recipes at `/tasks/<name>`, ABIs at `/abi/<Name>.json` (viem strings at `/abi/<Name>.txt`). CDN-cached, CORS-open. **Always confirm addresses and signatures against llms.megapot.io before broadcasting** — this file is a convenience summary and llms.megapot.io wins on any conflict.

## The referral triple (mandatory on every purchase, subscription, and compound)

| Arg | Value |
| --- | --- |
| `_referrers` (`address[]`) | `["0x70D3a9aA7e10070d3F528e91c9bCf5158c922C66"]` |
| `_referralSplit` / `_referralSplitBps` (`uint256[]`) | `[1000000000000000000]` — exactly 1e18, or the tx reverts |
| `_source` (`bytes32`) | `"bankr-skill"` encoded as bytes32 (viem: `stringToHex("bankr-skill", { size: 32 })`) |

⚠️ **Naming quirk (verified on-chain)**: `JackpotRandomTicketBuyer.buyTickets` names its split argument `_referralSplitBps` in the live ABI. Despite the `Bps` suffix, it uses **1e18 (PRECISE_UNIT) scale, NOT basis points** — it forwards to `Jackpot`, which enforces sum == 1e18. `[1000000000000000000]` is correct everywhere. (Confirmed working: tx `0x4f5aa3a57aea913f7be6f4c931d055ee4a60e12b04bf116fe170bc677305833d` — `ReferralFeeCollected` fired for the referrer at 10% of ticket price.)

Referrer economics (contract path): 10% of ticket fees + 10% of referred users' winnings accrue as claimable USDC inside `Jackpot`. Read live rates from `getDrawingState()` (`referralFee`, `referralWinShare`, 1e18 = 100%).

## Key addresses (Base mainnet — verify against llms.megapot.io)

| Contract | Address |
|---|---|
| Jackpot | `0x3bAe643002069dBCbcd62B1A4eb4C4A397d042a2` |
| USDC (6 decimals) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| JackpotRandomTicketBuyer | `0xb9560b43b91dE2c1DaF5dfbb76b2CFcDaFc13aBd` |
| BatchPurchaseFacilitator | `0xBA343479D98a1Ed333899999D95a7343B808a76F` |
| JackpotAutoSubscription | `0x2694Bd48f3e6B4775943067DC842C93bf5F19DcD` |
| JackpotTicketNFT | `0x48FfE35AbB9f4780a4f1775C2Ce1c46185b366e4` |

Full table (all contracts, testnet) at `https://llms.megapot.io/contracts/reference`.

## Purchase methods (all carry the trailing referral triple)

| Method | Use case | USDC approval spender |
| --- | --- | --- |
| `Jackpot.buyTickets(tickets, recipient, _referrers, _referralSplit, _source)` | Up to 10 custom-number tickets, minted immediately | Jackpot |
| `JackpotRandomTicketBuyer.buyTickets(_count, _recipient, _referrers, _referralSplitBps, _source)` | Random / quick-pick, minted immediately — **default for chat purchases** | RandomTicketBuyer |
| `BatchPurchaseFacilitator.createBatchOrder(..., _referrers, _referralSplit, _source)` | 11+ tickets, keeper-executed — recipe at `/tasks/buy-bulk` | per recipe |
| `JackpotAutoSubscription.createSubscription(..., _referrers, _referralSplit, _source)` | Recurring daily purchases — recipe at `/tasks/subscribe` | per recipe |
| `TicketAutoCompoundVault.depositAndCompound(..., _referrers, _referralSplit, _source)` | Claim winnings + re-buy in one tx — recipe at `/tasks/auto-compound` | per recipe |

For any method other than the first two, fetch the task recipe from llms.megapot.io for exact argument lists before building the call — do not guess middle arguments.

## Ticket structure (custom numbers)

Each `Ticket` = 5 **unique** normal numbers in `[1, ballMax]` + 1 bonusball in `[1, bonusballMax]`.

```
drawingId = Jackpot.currentDrawingId()
state     = Jackpot.getDrawingState(drawingId)
// state.ballMax, state.bonusballMax, state.referralFee, state.referralWinShare, ...
```

Never hardcode `ballMax` / `bonusballMax`.

## Payment

- $1 USDC per ticket (`1_000_000` units), Base mainnet only. No zero-price primitive — tickets are never free.
- Approve USDC to the specific contract receiving payment for that task (see table) before the purchase call. Check allowance first; approve the exact total if insufficient.

## Wins and claims

- Discovery ("did I win?"): fetch `https://llms.megapot.io/tasks/claim-winnings` and follow it. If it relies on the Data API and no API key is available, fall back to on-chain: enumerate the wallet's JackpotTicketNFT holdings for recent drawings and check drawing results, or direct the user to megapot.io.
- Claim: `Jackpot.claimWinnings(_ticketIds)` from the NFT-owning wallet.
- Skill-owner referral fees: `Jackpot.claimReferralFees()` from the referrer wallet.

## Worked example (viem-style)

```typescript
import { stringToHex } from "viem";

const REFERRER = "0x70D3a9aA7e10070d3F528e91c9bCf5158c922C66";
const SPLIT    = [1000000000000000000n]; // 1e18 = 100% (even when the arg is named _referralSplitBps)
const SOURCE   = stringToHex("bankr-skill", { size: 32 });

// quick-pick, 2 tickets to the buyer
await randomTicketBuyer.buyTickets(2n, buyerAddress, [REFERRER], SPLIT, SOURCE);

// custom-number purchase (tickets validated against live ballMax/bonusballMax)
await jackpot.buyTickets(tickets, recipientAddress, [REFERRER], SPLIT, SOURCE);
```

## Notes

- `_source` is telemetry only — moves no money, independent of `_referrers`. Both must be set as specified.
- Drawings run daily; if settling, purchases may be temporarily unavailable — report state rather than retrying.
- LP deposit/withdraw is intentionally out of scope for this skill.
