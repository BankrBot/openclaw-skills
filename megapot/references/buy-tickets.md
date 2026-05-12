# Buy tickets with custom numbers (1–10)

Use this when the user wants to choose their own lottery numbers, e.g. "buy a megapot ticket with numbers 1 6 16 22 25 bonus 4", "lemme pick my own numbers", or a mix of custom and quick-pick tickets.

For fully random tickets see `references/buy-random.md`. For 11+ tickets see `https://llms.megapot.io/tasks/buy-bulk`.

## Flow (executed via Bankr's wallet tools)

1. **Read drawing state** on the Jackpot contract — `ticketPrice()`, `normalBallMax()`, `currentDrawingId()`, and `getDrawingState(currentDrawingId())` for `bonusballMax` and `drawingTime`.
2. **Validate the user's picks.** Each ticket needs exactly 5 normal balls in `[1, normalBallMax]` (unique, ascending) and 1 bonus ball in `[1, bonusballMax]`. Reject invalid picks with a clear message before hitting the chain. For quick-pick slots in a mixed order, use `normals: []` and `bonusball: 0`.
3. **Confirm with user.** Show: ticket count, each ticket's numbers, total USDC cost, current drawing ID, time remaining until drawing close. Do **not** sign anything without explicit confirmation.
4. **Approve USDC** to the **Jackpot** contract (`0x3bAe643002069dBCbcd62B1A4eb4C4A397d042a2`). This is different from buy-random which approves to `JackpotRandomTicketBuyer`. Amount = `ticketPrice * ticketCount`.
5. **Call `buyTickets`** on the **Jackpot** contract with the args below.
6. **Decode the `TicketPurchased` and `TicketOrderProcessed` events** from the receipt and report drawing ID, ticket IDs, chosen numbers, and total cost back to the user.

## ABI fragments needed

```
function ticketPrice() view returns (uint256)                              // Jackpot
function normalBallMax() view returns (uint8)                              // Jackpot
function currentDrawingId() view returns (uint256)                         // Jackpot
function getDrawingState(uint256 _drawingId) view returns (
  (
    uint256 prizePool,
    uint256 ticketPrice,
    uint256 edgePerTicket,
    uint256 referralWinShare,
    uint256 referralFee,
    uint256 globalTicketsBought,
    uint256 lpEarnings,
    uint256 drawingTime,
    uint256 winningTicket,
    uint8   ballMax,
    uint8   bonusballMax,
    address payoutCalculator,
    bool    jackpotLock
  )
)
function buyTickets(
  (uint8[] normals, uint8 bonusball)[] _tickets,
  address _recipient,
  address[] _referrers,
  uint256[] _referralSplit,
  bytes32 _source
) returns (uint256[] ticketIds)                                            // Jackpot
event TicketPurchased(
  address indexed recipient,
  uint256 indexed currentDrawingId,
  bytes32 indexed source,
  uint256 userTicketId,
  uint8[] normals,
  uint8 bonusball,
  bytes32 referralScheme
)
event TicketOrderProcessed(
  address indexed buyer,
  address indexed recipient,
  uint256 indexed currentDrawingId,
  uint256 numberOfTickets,
  uint256 lpEarnings,
  uint256 referralFees
)
function approve(address spender, uint256 amount) returns (bool)           // USDC
function allowance(address owner, address spender) view returns (uint256)  // USDC
```

## Argument shape for `buyTickets`

| Arg | Value to pass |
|---|---|
| `_tickets` | Array of `{ normals: uint8[], bonusball: uint8 }`. 1–10 entries. Each custom ticket: `normals` is exactly 5 unique ascending values in `[1, normalBallMax]`, `bonusball` in `[1, bonusballMax]`. For quick-pick slots in a mixed order: `{ normals: [], bonusball: 0 }`. |
| `_recipient` | The Bankr user's own wallet address — the ticket NFTs go here |
| `_referrers` | `[MEGAPOT_REFERRER]` — see `SKILL.md` Referral fees section for the address. If the user explicitly opts out of referral attribution, pass `[]`. |
| `_referralSplit` | `[1000000000000000000n]` for the single Megapot referrer (100% in 1e18 scale). For `_referrers: []` pass `[]`. Despite the `Bps` suffix in the ABI parameter name, this uses 1e18 (PRECISE_UNIT) scale, NOT basis points. |
| `_source` | `0xeecf49b78776e9a74928ecb7edd2526cca8e7cfe3f093853f6e847c0d39a3e3b` — `keccak256("bankr")` for on-chain attribution. |

## Example: "buy a ticket with numbers 1 6 16 22 25 bonus 4"

```
tickets = [
  { normals: [1, 6, 16, 22, 25], bonusball: 4 }
]
```

## Example: "buy 3 tickets — one with 3 11 14 22 27 bonus 7, and two random"

```
tickets = [
  { normals: [3, 11, 14, 22, 27], bonusball: 7 },
  { normals: [], bonusball: 0 },
  { normals: [], bonusball: 0 }
]
```

## Common errors

| Error | Cause |
|---|---|
| `InvalidNormalsCount()` | `normals` array length is not exactly 5 (and is not empty for quick-pick) |
| `InvalidBonusball()` | `bonusball` is outside `[1, bonusballMax]` (and is not 0 for quick-pick) |
| `InvalidTicketCount()` | Ticket array is empty or has more than 10 entries. For 11+, route to `buy-bulk`. |
| `NoTicketsProvided()` | `_tickets` array is empty |
| `JackpotLocked()` | Drawing is in the lock period before settlement; try again after the new drawing opens |
| `TooManyReferrers()` | `_referrers` length exceeds `maxReferrers()` (typically 5) |
| `SafeERC20FailedOperation` | USDC `approve` or `transferFrom` failed. Most often: approval went to `JackpotRandomTicketBuyer` instead of `Jackpot`, or insufficient USDC balance. |

## Post-purchase

Tickets are ERC-721 NFTs in `JackpotTicketNFT` (`0x48FfE35AbB9f4780a4f1775C2Ce1c46185b366e4`). They're automatically associated with the current drawing.

After the drawing settles, if the user asks whether they won, route through `references/data-api.md` and (if applicable) `references/claim-winnings.md`. For viewing all tickets across drawings, direct the user to `https://megapot.io`.
