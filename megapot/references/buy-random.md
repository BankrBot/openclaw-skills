# Buy random tickets (1–10)

The most common Megapot purchase. Use this for any user request like "buy me 3 jackpot tickets", "throw $5 at megapot", "get me a quick pick", etc. — anytime the user wants 1–10 tickets and does **not** care about choosing numbers.

For custom numbers see `https://llms.megapot.io/tasks/buy-tickets`. For 11+ tickets see `https://llms.megapot.io/tasks/buy-bulk`.

## Flow (executed via Bankr's wallet tools)

1. **Read `ticketPrice`** on the Jackpot contract → 6-decimal USDC value (e.g. `1_000_000` = 1 USDC).
2. **Confirm with user.** Show: ticket count, total USDC cost, current drawing ID, time remaining until drawing close. Do **not** sign anything without explicit confirmation.
3. **Approve USDC** to `JackpotRandomTicketBuyer` (`0xb9560b43b91dE2c1DaF5dfbb76b2CFcDaFc13aBd`). The approval goes to the random buyer, **not** the Jackpot contract — this is the most common mistake. Amount = `ticketPrice * count`.
4. **Call `buyTickets`** on `JackpotRandomTicketBuyer` with the args below.
5. **Decode the `RandomTicketsBought` event** from the receipt and report drawing ID, ticket IDs, and total cost back to the user.

## ABI fragments needed

```
function ticketPrice() view returns (uint256)                              // Jackpot
function buyTickets(
  uint256 _count,
  address _recipient,
  address[] _referrers,
  uint256[] _referralSplitBps,
  bytes32 _source
) returns (uint256[] ticketIds)                                            // JackpotRandomTicketBuyer
event RandomTicketsBought(
  address indexed recipient,
  uint256 indexed drawingId,
  uint256 count,
  uint256 cost,
  uint256[] ticketIds
)
function approve(address spender, uint256 amount) returns (bool)           // USDC
function allowance(address owner, address spender) view returns (uint256)  // USDC
```

## Argument shape for `buyTickets`

| Arg | Value to pass |
|---|---|
| `_count` | `BigInt(n)` where `1 <= n <= 10` |
| `_recipient` | The Bankr user's own wallet address — the ticket NFTs go here |
| `_referrers` | `[MEGAPOT_REFERRER]` — see `SKILL.md` Referral fees section for the address. **Do not use the user's own wallet here** — this skill is published by Megapot and routes referral fees to the operator wallet. If the user explicitly opts out of referral attribution, pass `[]`. |
| `_referralSplitBps` | `[1000000000000000000n]` for the single Megapot referrer (100% in 1e18 scale). For `_referrers: []` pass `[]`. |
| `_source` | `0xeecf49b78776e9a74928ecb7edd2526cca8e7cfe3f093853f6e847c0d39a3e3b` — `keccak256("bankr")` for on-chain attribution. |

## Common errors

| Error | Cause |
|---|---|
| `InvalidTicketCount()` | `_count` is `0` or `> 10`. For 11+, route to `buy-bulk`. |
| `InvalidRecipient()` | `_recipient` is `0x0`. |
| `SafeERC20FailedOperation` | USDC `approve` or `transferFrom` failed. Most often: approval went to the Jackpot contract instead of `JackpotRandomTicketBuyer`, or insufficient USDC balance. |

## Post-purchase

Tickets are ERC-721 NFTs in `JackpotTicketNFT` (`0x48FfE35AbB9f4780a4f1775C2Ce1c46185b366e4`). They're automatically associated with the current drawing.

After the drawing settles, if the user asks whether they won, route through `references/data-api.md` and (if applicable) `references/claim-winnings.md`. For viewing all tickets across drawings, direct the user to `https://megapot.io` — this skill does not handle cross-drawing ticket history.