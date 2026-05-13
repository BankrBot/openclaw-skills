# Buy tickets with custom numbers (1–10)

Use this when the user wants to choose their own lottery numbers, e.g. "buy a megapot ticket with numbers 1 6 16 22 25 bonus 4", "lemme pick my own numbers", or a mix of custom and quick-pick tickets.

For fully random tickets see `references/buy-random.md`. For 11+ tickets see `https://llms.megapot.io/tasks/buy-bulk`.

## Flow (executed via Bankr's wallet tools)

1. **Read drawing state** on the Jackpot contract — call `currentDrawingId()`, then `getDrawingState(currentDrawingId())`. The returned tuple includes `ticketPrice`, `ballMax` (normal ball upper bound), `bonusballMax`, and `drawingTime`. No separate `normalBallMax()` call needed.
2. **Validate the user's picks.** Each ticket needs exactly 5 normal balls in `[1, ballMax]` (unique, ascending) and 1 bonus ball in `[1, bonusballMax]`. Reject invalid picks with a clear message before hitting the chain. For quick-pick slots in a mixed order, use `normals: []` and `bonusball: 0`.
3. **Confirm with user.** Show: ticket count, each ticket's numbers, total USDC cost, current drawing ID, time remaining until drawing close. Do **not** sign anything without explicit confirmation.
4. **Approve USDC** to the **Jackpot** contract (`0x3bAe643002069dBCbcd62B1A4eb4C4A397d042a2`). This is different from buy-random which approves to `JackpotRandomTicketBuyer`. Amount = `ticketPrice * ticketCount`.
5. **Call `buyTickets`** on the **Jackpot** contract — use the **raw calldata submission** approach described below (the `write_contract` tool cannot encode the nested tuple array parameter).
6. **Decode the `TicketPurchased` and `TicketOrderProcessed` events** from the receipt and report drawing ID, ticket IDs, chosen numbers, and total cost back to the user.

## ABI fragments needed

Use these signatures **exactly** when constructing the transaction — do not substitute `uint8[5]` for `uint8[]`.

```
function ticketPrice() view returns (uint256)                              // Jackpot
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

> **⚠️ ENCODING LIMITATION:** Bankr's `write_contract` tool **cannot** encode the `_tickets` parameter (a nested tuple array `(uint8[],uint8)[]`). You **must** use the raw calldata submission approach below. Do not attempt `write_contract` for this function — it will fail with "Value is not a valid array".

| Arg | Solidity type | Value to pass |
|---|---|---|
| `_tickets` | `(uint8[],uint8)[]` | 1–10 entries. Each custom ticket: `normals` is exactly 5 unique ascending values in `[1, ballMax]`, `bonusball` in `[1, bonusballMax]`. For quick-pick slots in a mixed order: `normals: []` and `bonusball: 0`. **Type is `uint8[]` (dynamic), NOT `uint8[5]`.** |
| `_recipient` | `address` | The Bankr user's own wallet address — the ticket NFTs go here |
| `_referrers` | `address[]` | `[0x1ed4cb4cde1d8a8ec07eef07d52d13c5aefbef09]` — see `SKILL.md` Referral fees section. If the user explicitly opts out, pass `[]`. |
| `_referralSplit` | `uint256[]` | `[1000000000000000000]` for the single referrer (100% in 1e18 scale). For `_referrers: []` pass `[]`. |
| `_source` | `bytes32` | `0xeecf49b78776e9a74928ecb7edd2526cca8e7cfe3f093853f6e847c0d39a3e3b` — `keccak256("bankr")` for on-chain attribution. |

## How to submit: raw calldata via arbitrary transaction

Since `write_contract` cannot handle this function, encode calldata and submit as a raw transaction.

**Function selector:** `0xde88c28a`
**Canonical signature:** `buyTickets((uint8[],uint8)[],address,address[],uint256[],bytes32)`

### Step-by-step

1. **Encode the calldata** using `cast` (Foundry) or equivalent:

```bash
cast calldata "buyTickets((uint8[],uint8)[],address,address[],uint256[],bytes32)" \
  "[([1,6,16,22,25],4)]" \
  "<RECIPIENT_ADDRESS>" \
  "[0x1ed4cb4cde1d8a8ec07eef07d52d13c5aefbef09]" \
  "[1000000000000000000]" \
  "0xeecf49b78776e9a74928ecb7edd2526cca8e7cfe3f093853f6e847c0d39a3e3b"
```

For multiple tickets (1 custom + 2 quick-pick):
```bash
cast calldata "buyTickets((uint8[],uint8)[],address,address[],uint256[],bytes32)" \
  "[([3,11,14,22,27],7),([],0),([],0)]" \
  "<RECIPIENT_ADDRESS>" \
  "[0x1ed4cb4cde1d8a8ec07eef07d52d13c5aefbef09]" \
  "[1000000000000000000]" \
  "0xeecf49b78776e9a74928ecb7edd2526cca8e7cfe3f093853f6e847c0d39a3e3b"
```

2. **Submit the raw transaction** via Bankr's arbitrary transaction tool:

```
Submit this transaction:
{
  "to": "0x3bAe643002069dBCbcd62B1A4eb4C4A397d042a2",
  "data": "<ENCODED_CALLDATA_FROM_STEP_1>",
  "value": "0",
  "chainId": 8453
}
```

### If `cast` is unavailable

Use any ABI encoder that supports Solidity tuple arrays. In viem/ethers, tuples are represented as positional arrays (not objects):

```javascript
// viem encodeFunctionData format:
args = [
  [[[1, 6, 16, 22, 25], 4]],       // _tickets: array of [normals[], bonusball]
  "0xRecipient...",                   // _recipient
  ["0x1ed4cb4cde1d8a8ec07eef07d52d13c5aefbef09"], // _referrers
  [1000000000000000000n],            // _referralSplit
  "0xeecf49b78776e9a74928ecb7edd2526cca8e7cfe3f093853f6e847c0d39a3e3b" // _source
]
```

### If no encoding tool is available at all

If you cannot encode calldata (no `cast`, no script execution), inform the user that custom-number ticket purchases require an ABI encoder and suggest:
1. Use `references/buy-random.md` for quick-pick tickets (simpler args, works with `write_contract`)
2. Or purchase custom-number tickets directly at https://megapot.io

## Examples

### "buy a ticket with numbers 1 6 16 22 25 bonus 4"

Cast tuple format: `[([1,6,16,22,25],4)]`

### "buy 3 tickets — one with 3 11 14 22 27 bonus 7, and two random"

Cast tuple format: `[([3,11,14,22,27],7),([],0),([],0)]`

## Common errors

| Error | Cause |
|---|---|
| "Value is not a valid array" from `write_contract` | The tool cannot encode nested tuple arrays. Use the raw calldata approach above instead of `write_contract`. |
| Wrong function selector / transaction reverts immediately | The function signature uses `uint8[5]` instead of `uint8[]` for `normals`. The correct canonical signature is `buyTickets((uint8[],uint8)[],address,address[],uint256[],bytes32)` with selector `0xde88c28a`. |
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
