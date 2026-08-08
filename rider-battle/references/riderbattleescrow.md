# RiderBattleEscrow — contract reference (V2, transfer-based)

- Network: **Base** (chainId `8453`)
- Address: `0x55c2847003A9e254b8312bf3C75520e06528aBa6`
- $RIDER: `0x544e6E53a9E5Ce11712647c893B3dD10c1d1CBa3` (18 decimals)
- Settler (backend signer): `0xcfbF2aE4103334E21600d9C38fcB42e488371071`
- Treasury (fees): `0x673081c90db2d04187eBF740899110f15D690BF2`

## ⚠️ Funding model — the thing that matters most

This escrow **credits tokens that were already transferred in**. It does **NOT** pull with
`transferFrom`, so **`approve` is never used**. Every stake is funded with a strict two-step
sequence from the staker's wallet, in this order:

```
1) RIDER.transfer(escrow, wagerWei)      // move the stake into the escrow
2) (after step 1 is mined) createMatch/joinMatch(...)   // the escrow credits it
```

`createMatch`/`joinMatch` verify with an on-chain guard `_received >= wager` and revert if the
stake didn't arrive. **Caveat that caused a real bug:** `_received` is derived from the escrow's
*shared* unaccounted balance, not from a transfer bound to the caller's tx. So if you call
`createMatch`/`joinMatch` **without** a matching transfer, the guard can still pass by consuming
the pool's balance → a "ghost" match funded by other users while the caller keeps their tokens,
and the escrow's accounting goes into deficit. **Always transfer first; never skip it.**

Recovery: if step 1 lands but step 2 doesn't, the tokens are safe in the escrow. Retry step 2
(do NOT transfer again); or reclaim via `cancelUnaccepted`/`refundStalled` for that match id.

## The match lifecycle

```
transfer + createMatch ─▶ Open ─(transfer + joinMatch)─▶ Funded ─settle─▶ Settled
                          │                               │
              cancelUnaccepted (after acceptWindow)   refundStalled (after settleWindow)
                          └──────────────▶ Refunded ◀──────────────┘
```
`Status` enum: `0 None`, `1 Open`, `2 Funded`, `3 Settled`, `4 Refunded`.

## Functions

| Function | Signature | Notes |
| --- | --- | --- |
| (ERC-20) transfer | `transfer(address to, uint256 amount)` on the **RIDER token** | `to` = escrow. Step 1 of every deposit. |
| createMatch | `createMatch(uint256 matchId, address token, uint256 wager)` on escrow | Step 2 for create. Credits the just-transferred `wager`; guard `_received >= wager`. Caller becomes `creator`. `matchId` must be unused (status 0). Reverts `exists`, `token not allowed`, `wager=0`, `deposit first`. **No approve.** |
| joinMatch | `joinMatch(uint256 matchId)` on escrow | Step 2 for accept. Match must be `Open`; credits the just-transferred `wager`; sets caller as `opponent` → `Funded`. |
| settle | `settle(uint256 matchId, address winner, bytes sig)` | Match `Funded`. `sig` must be an EIP-191 personal-sign by the **settler** over `keccak256(abi.encode(block.chainid, escrow, matchId, winner))`. Pays winner pot−fee; fee→treasury. Anyone may submit if `sig` is valid. No transfer step. |
| cancelUnaccepted | `cancelUnaccepted(uint256 matchId)` | Creator only, `Open`, after `createdAt + acceptWindow`. Refunds creator. |
| refundStalled | `refundStalled(uint256 matchId)` | `Funded`, after `fundedAt + settleWindow`. Refunds both. |

## Read (view) functions

| Function | Returns |
| --- | --- |
| `matches(uint256 matchId)` | `(address creator, address opponent, address token, uint256 wager, uint64 createdAt, uint64 fundedAt, uint8 status)` |
| ERC-20 `balanceOf(address)` on RIDER | `uint256` — check the user can cover the wager |
| `allowedToken(address)` | `bool` |
| `acceptWindow()` / `settleWindow()` | `uint256` seconds (defaults 86400 / 43200) |
| `defaultFeeBps()` / `feeBps(address)` | `uint16` (default 500 = 5%, cap 1000) |

To test an id is free before creating: `matches(id).status == 0`.

## Events

| Event | Signature |
| --- | --- |
| MatchCreated | `MatchCreated(uint256 indexed matchId, address indexed creator, address token, uint256 wager)` |
| MatchJoined | `MatchJoined(uint256 indexed matchId, address indexed opponent)` |
| MatchSettled | `MatchSettled(uint256 indexed matchId, address indexed winner, uint256 toWinner, uint256 fee)` |
| MatchRefunded | `MatchRefunded(uint256 indexed matchId)` |

Sanity check for a real deposit: a legit create/join tx contains an **ERC-20 `Transfer`**
(RIDER → escrow) in the same sequence as the `MatchCreated`/`MatchJoined` event. A create/join
with **no preceding `Transfer`** is the ghost-match bug.

**Finding open matches on-chain (fallback to the DB):** read `MatchCreated` logs, then keep ids
whose `matches(id).status == 1 (Open)`, filter by `token == RIDER` and wager, sort by `createdAt`.

## Function selectors (raw calldata for `bankr.tx.prepare`)

Calldata = selector + 32-byte-padded args (uint256 as hex; address = 12 zero bytes + 20-byte addr).
For `settle`, `bytes sig` is dynamic: head `matchId(32)`+`winner(32)`+`offset(32)=0x60`, then
tail `len(32)`+`sig` padded to a 32-byte multiple.

| Call | Selector |
| --- | --- |
| ERC-20 `transfer(address,uint256)` (to = escrow) | `0xa9059cbb` |
| `createMatch(uint256,address,uint256)` | `0xdf1888ec` |
| `joinMatch(uint256)` | `0xfeb8c438` |
| `settle(uint256,address,bytes)` | `0x9abe08e6` |
| `cancelUnaccepted(uint256)` | `0x955c1247` |
| `refundStalled(uint256)` | `0xdd5d4496` |
| ERC-20 `balanceOf(address)` | `0x70a08231` |

(No `approve`/`allowance` — this escrow doesn't use them.)

## Revert reason strings

| String | Meaning |
| --- | --- |
| `deposit first` | escrow didn't receive the wager — you skipped or under-sent the `transfer` step |
| `exists` | `matchId` already used → pick another |
| `token not allowed` | token not whitelisted |
| `wager=0` | wager must be > 0 |
| `not open` / `not funded` | wrong status for the action |
| `not creator` | only the creator may call |
| `too early` | accept/settle window hasn't elapsed |
| `bad winner` / `bad sig` | settle target/signature invalid |

## Minimal ABI (for `bankr.chain.readContract` / encoding)

```json
[
  {"type":"function","name":"createMatch","stateMutability":"nonpayable","inputs":[{"name":"matchId","type":"uint256"},{"name":"token","type":"address"},{"name":"wager","type":"uint256"}],"outputs":[]},
  {"type":"function","name":"joinMatch","stateMutability":"nonpayable","inputs":[{"name":"matchId","type":"uint256"}],"outputs":[]},
  {"type":"function","name":"settle","stateMutability":"nonpayable","inputs":[{"name":"matchId","type":"uint256"},{"name":"winner","type":"address"},{"name":"sig","type":"bytes"}],"outputs":[]},
  {"type":"function","name":"cancelUnaccepted","stateMutability":"nonpayable","inputs":[{"name":"matchId","type":"uint256"}],"outputs":[]},
  {"type":"function","name":"refundStalled","stateMutability":"nonpayable","inputs":[{"name":"matchId","type":"uint256"}],"outputs":[]},
  {"type":"function","name":"matches","stateMutability":"view","inputs":[{"name":"","type":"uint256"}],"outputs":[{"name":"creator","type":"address"},{"name":"opponent","type":"address"},{"name":"token","type":"address"},{"name":"wager","type":"uint256"},{"name":"createdAt","type":"uint64"},{"name":"fundedAt","type":"uint64"},{"name":"status","type":"uint8"}]},
  {"type":"function","name":"acceptWindow","stateMutability":"view","inputs":[],"outputs":[{"name":"","type":"uint256"}]},
  {"type":"function","name":"settleWindow","stateMutability":"view","inputs":[],"outputs":[{"name":"","type":"uint256"}]},
  {"type":"function","name":"transfer","stateMutability":"nonpayable","inputs":[{"name":"to","type":"address"},{"name":"amount","type":"uint256"}],"outputs":[{"name":"","type":"bool"}]},
  {"type":"function","name":"balanceOf","stateMutability":"view","inputs":[{"name":"","type":"address"}],"outputs":[{"name":"","type":"uint256"}]}
]
```
