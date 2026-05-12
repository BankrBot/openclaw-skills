# Read live drawing state

Use this for any read-only question about the current drawing: "what's the jackpot at?", "how much time left?", "how many tickets sold?", "is the round over?", etc.

For winnings discovery ("did I win?") use `data-api.md`. For cross-drawing ticket history, leaderboards, or aggregates, direct the user to `https://megapot.io`.

## The shortcut

Two reads on the Jackpot contract (`0x3bAe643002069dBCbcd62B1A4eb4C4A397d042a2`):

1. `currentDrawingId()` → returns the active drawing's ID.
2. `getDrawingState(currentDrawingId())` → returns the full state tuple.

A drawing is **settled** when `winningTicket != 0`. The current drawing is always unsettled. The most recently settled drawing is `currentDrawingId() - 1`.

## ABI fragments

```
function currentDrawingId() view returns (uint256)
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
```

## Field meanings

| Field | Meaning |
|---|---|
| `prizePool` | Current prize pool in USDC (6 decimals) |
| `ticketPrice` | Ticket price in USDC (6 decimals) |
| `globalTicketsBought` | Total tickets sold in this drawing |
| `drawingTime` | Unix timestamp when ticket sales close and settlement becomes eligible |
| `winningTicket` | Packed winning ticket value; `0` if not yet drawn |
| `ballMax` / `bonusballMax` | Pick-range upper bounds for this drawing |
| `jackpotLock` | `true` while settlement is in progress |
| `referralFee` | Per-purchase referral fee rate (1e18 scale) |
| `referralWinShare` | Win-share rate for referrers (1e18 scale) |

## Reporting to the user

When answering "what's the jackpot at?":

- Format `prizePool` as USDC by dividing by `1_000_000` and rendering with thousands separators.
- Format time remaining as `drawingTime - now` in hours/minutes.
- If `jackpotLock` is `true`, say "drawing is settling, results imminent" rather than showing a countdown.
- If `winningTicket != 0` on the queried drawing, the drawing has already settled — query `currentDrawingId()` again to get the new active drawing.

## Beyond the shortcut

For event subscriptions (`JackpotLocked`, `JackpotSettled`, `JackpotUnlocked`, `NewDrawingInitialized`), LP position reads, multi-drawing batched reads, or prize-tier payout calculations, fetch `https://llms.megapot.io/tasks/read-state` for the full pattern.