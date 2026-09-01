# Cat Town Boutique — contract + KIBBLE oracle reference

The boutique is a fully onchain daily shop on Base. Every day at **00:00 UTC** the contract surfaces **3 items** selected deterministically from the current season's pool. No offchain API is needed — items, prices, stock, rotation, **and the buy path** are all directly on the Boutique contract.

This doc covers the **Boutique** contract (rotation, item state, **purchase flow**) and the **KIBBLE price oracle** (for USD conversion — the in-game UI shows native-token prices only).

## ⚠️ CRITICAL: each item carries its own `paymentToken` — read it before approving

Most items are priced in **KIBBLE**, but partnership / collab items use other ERC-20s — for example today's **Rat Skull Charm** (Friends of Cat Town collab) is priced in **DOTA** ("Defense of the Agents", `0x5F09821CBb61e09D2a83124Ae0B56aaa3ae85B07`). The contract pulls the price from `msg.sender` in **whichever token the item specifies**, so you must approve the **right token**.

If you reflexively `kibble.approve(boutique, …)` for a DOTA-priced item, the `purchaseItem` tx reverts on the internal `transferFrom` (insufficient DOTA allowance — KIBBLE allowance is irrelevant). The fix is to read `ShopItemView.paymentToken` per item and approve **that** token.

Tokens currently surfaced by the cat.town frontend: **KIBBLE, DOTA, USDC, BARON, cbBTC**. Any ERC-20 the team configures will work; treat the address as authoritative, not the symbol.

## Addresses (Base, chain 8453)

| Contract            | Address                                      |
|---------------------|----------------------------------------------|
| Boutique            | `0xf9843bF01ae7EF5203fc49C39E4868C7D0ca7a02` |
| Kibble Price Oracle | `0xE97B7ab01837A4CbF8C332181A2048EEE4033FB7` |
| KIBBLE token        | `0x64cc19A52f4D631eF5BE07947CABA14aE00c52Eb` |

## Rotation model

- Each day starts at **00:00 UTC**; `getCurrentDayNumber()` returns days since Unix epoch (`block.timestamp / 86400`).
- Rotation is deterministic from `(dayNumber, currentSeason)` — same day + same season = same 3 items.
- `itemsPerDay()` = **3** (constant).
- Season boundaries follow `GameData.getCurrentSeason()` (see [world.md](world.md)); each season has its own pool.
- The matching human-readable doc pages:
  - Top-level shop: https://docs.cat.town/shops/boutique
  - Spring: https://docs.cat.town/boutique/spring-fashion
  - Summer: https://docs.cat.town/boutique/summer-fashion
  - Autumn: https://docs.cat.town/boutique/autumn-fashion
  - Winter: https://docs.cat.town/boutique/winter-fashion

## Primary read — `getTodaysRotationDetails()`

Returns today's 3 items as `ShopItemView[]` — full details in one call. Selector: `0x36362553`, no args.

### `ShopItemView` fields

| Field              | Type        | Notes                                                                 |
|--------------------|-------------|-----------------------------------------------------------------------|
| `itemId`           | `uint256`   | Unique id for the shop item                                           |
| `traitNames`       | `string[]`  | Parallel array of trait keys, e.g. `["Name","Rarity","Image","Slot","Shiny"]` |
| `traitValues`      | `string[]`  | Parallel array of values in the same order                            |
| `paymentToken`     | `address`   | Always the KIBBLE token                                               |
| `price`            | `uint256`   | KIBBLE in **wei** (18 decimals) — divide by `10^18` for display       |
| `stockRemaining`   | `uint256`   | Units still purchasable. `0` → sold out                               |
| `totalPurchased`   | `uint256`   | Units sold so far                                                     |
| `maxSupply`        | `uint256`   | Total ever available. `type(uint256).max` → uncapped                  |
| `startTime`        | `uint64`    | Unix seconds (0 = always available)                                   |
| `endTime`          | `uint64`    | Unix seconds (0 = no end)                                             |
| `availableSeasons` | `uint8`     | Bitmask: `1=Spring`, `2=Summer`, `4=Autumn`, `8=Winter`               |
| `isActive`         | `bool`      | Enabled by admin                                                      |
| `isPurchasableNow` | `bool`      | Passes time + season gates                                            |
| `isInTodaysRotation` | `bool`    | In today's 3-item set                                                 |

### Parsing the trait arrays

`traitNames` and `traitValues` are parallel. Real trait keys on a live boutique item:

| Trait key     | Example value                                        | Notes                                                      |
|---------------|------------------------------------------------------|------------------------------------------------------------|
| `Item Name`   | `"White Longsleeve"`                                 | Display name                                               |
| `Rarity`      | `"Rare"`                                             | `Common` / `Uncommon` / `Rare` / `Epic` / `Legendary`      |
| `Item Type`   | `"Cosmetic"`                                         | Almost always `Cosmetic` for boutique                      |
| `Source`      | `"Boutique"`                                         | Distinguishes from `Fishing`/`Gacha` in a joined view      |
| `Slot`        | `"Body"`                                             | `Hat` / `Body` / `Eyewear` / `Companion` / etc.            |
| `Sprite`      | `"white-longsleeve"`                                 | Internal asset id                                          |
| `imageUrl`    | `https://cdn.cat.town/nft/equipment/body/...`        | Display image                                              |
| **`Collection`** | `"Spring Fashion"`                                | **Collection label** — use this to tell the user which collection is currently rotating |
| `Flavor Text` | `"Clean and crisp like fresh spring linens."`        | Optional color                                             |
| `Sell Value`  | `"0"`                                                | Usually 0 for boutique (these aren't meant to be resold)   |
| `coreId`      | `"cmlz9n8f30008kz04flhruq6t"`                        | Internal database id                                       |

Boutique metadata is **onchain via the trait arrays** — don't cross-reference `/v2/items/master`. The `ShopItemView.traitNames`/`traitValues` are the source of truth.

## Other useful reads

| Function                              | Returns                       | Notes                                          |
|---------------------------------------|-------------------------------|------------------------------------------------|
| `getTodaysRotation()`                 | `uint256[]`                   | Just today's 3 item ids (cheaper)              |
| `getCurrentDayNumber()`               | `uint256`                     | Days since Unix epoch                          |
| `getCurrentSeason()`                  | `uint8`                       | `0=Spring, 1=Summer, 2=Autumn, 3=Winter`       |
| `getShopItem(itemId)`                 | `ShopItemView`                | One item by id                                 |
| `getAllShopItems()`                   | `ShopItemView[]`              | Full catalog, active + inactive                |
| `getItemsBySeason(season)`            | `ShopItemView[]`              | Season-specific pool                           |
| `previewRotationForDay(day, season)`  | `uint256[]`                   | Future rotation preview (deterministic)        |
| `getItemStock(itemId)`                | `(max, purchased, remaining)` | Stock only                                     |
| `dailyRotationEnabled()`              | `bool`                        | Is daily rotation on (expected: true)          |
| `itemsPerDay()`                       | `uint8`                       | Currently 3                                    |
| `defaultPaymentToken()`               | `address`                     | KIBBLE                                         |

## paymentToken → USD conversion

### ⚠️ The Kibble Price Oracle ONLY converts KIBBLE → USD. Branch on `paymentToken` first.

The Kibble Price Oracle quotes **KIBBLE only**. Applying its rate to a non-KIBBLE amount silently returns nonsense — e.g. 1.5M DOTA × KIBBLE-rate gives ~$1,420, but the actual DOTA market value is ~$2 (off by ~700×). Always check `ShopItemView.paymentToken` against the KIBBLE address before reaching for the oracle:

```
if paymentToken == KIBBLE_ADDRESS:                  # 0x64cc19A52f4D631eF5BE07947CABA14aE00c52Eb
    usd = (price * getKibbleUsdPrice()) / 10^36     # KIBBLE → USD via the oracle (below)
elif paymentToken == USDC_ADDRESS:
    usd = price / 10^6                              # USDC is dollar-pegged
else:
    usd = price_via_dex(paymentToken, price)        # see "Non-KIBBLE collab tokens" below — DOTA, BARON, cbBTC, etc.
```

If you can't get a reliable USD for a non-KIBBLE token, **quote the token amount only and skip the USD readout**. A wrong USD is worse than no USD — users will trust whatever number you show.

### KIBBLE oracle reads (only valid for KIBBLE-priced items)

| Function              | Selector     | Returns                        | Scale       |
|-----------------------|--------------|--------------------------------|-------------|
| `getKibbleUsdPrice()` | `0x00cbfbce` | `uint256` USD per 1 KIBBLE     | **× 10^18** |
| `getEthUsdPrice()`    | `0xa0a8045e` | `uint256` USD per 1 ETH        | × 10^8 (Chainlink) |
| `getKibbleEthPrice()` | `0x47bb71e5` | `uint256` ETH per 1 KIBBLE     | × 10^18     |

**Watch the scale mismatch:** `getKibbleUsdPrice()` is `10^18`, but `getEthUsdPrice()` is `10^8`. Easy to mix up — use the right divisor per call.

#### Formula (KIBBLE-priced items only)

```
kibble_human    = price / 10^18                           # KIBBLE count
usd_per_kibble  = rawKibbleUsdPrice / 10^18               # USD per 1 KIBBLE
usd_value       = kibble_human * usd_per_kibble
                = (price * rawKibbleUsdPrice) / 10^36     # BigInt-safe form
```

For integer cents: `usd_cents = (price * rawKibbleUsdPrice) / 10^34`.

#### Live example (captured during writing)

- `getKibbleUsdPrice()` = `948,723,424,083,878` → **$0.0009487 per KIBBLE**
- 1,000 KIBBLE ≈ $0.95
- 10,000 KIBBLE ≈ $9.49
- 100,000 KIBBLE ≈ $94.87

The oracle tracks KIBBLE's real market price; re-read at least every few minutes if you care about accuracy.

### Non-KIBBLE collab tokens — pricing via DEX

For paymentTokens the cat.town frontend doesn't price internally (DOTA, partnership/collab tokens), use a public DEX aggregator. Dexscreener's API works without auth and ranks pools by liquidity, which avoids the "stale low-liquidity pool" failure mode:

```
GET https://api.dexscreener.com/latest/dex/tokens/<paymentToken>
  → response.pairs: array of pools across DEXes/chains
  → filter: chainId == "base"
  → sort: liquidity.usd DESC
  → use: pairs[0].priceUsd                            # most-liquid Base pool, USD per 1 token

usd_value = (price / 10^paymentTokenDecimals) * priceUsd
```

#### Live example — DOTA (`0x5F09821CBb61e09D2a83124Ae0B56aaa3ae85B07`, 18 decimals)

- Most liquid Base pool: Uniswap v4 DOTA/WETH (~$130k liquidity)
- `priceUsd` ≈ **$0.000001447 per DOTA** (re-read live; small caps move fast)
- 1,500,000 DOTA × $0.000001447 ≈ **$2.17** ← this is what the Rat Skull Charm actually costs in USD, NOT $1,400

#### Sanity check — does the USD make sense for the rarity?

Boutique cosmetics typically price in this band:

| Rarity     | Typical USD range observed |
|------------|----------------------------|
| Common     | $1–$3                      |
| Uncommon   | $3–$8                      |
| Rare       | $5–$15                     |
| Epic       | $15–$40                    |
| Legendary  | $40–$100+                  |

If you compute a USD for a Rare collab item and get something like $1,000+ or $0.0001, the price source is wrong — almost certainly the Kibble oracle was applied to a non-KIBBLE amount. Re-check `paymentToken` and re-route. Collab items can sit slightly below the band (partnership discounts), but never orders of magnitude off.

### USDC — dollar-pegged, no oracle needed

If `paymentToken == USDC` (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` on Base, 6 decimals): `usd = price / 10^6`. Skip the oracle entirely.

## Response pattern — "what's in the boutique today?"

1. Read in parallel: `getTodaysRotationDetails()` (single call, 3 items) and `getKibbleUsdPrice()`. If any item's `paymentToken` is not KIBBLE, also fan out to a DEX price source for those tokens (Dexscreener `/latest/dex/tokens/<addr>`).
2. For each `ShopItemView`:
   - Parse `traitNames`/`traitValues` into a dict → pull `Name`, `Rarity`, `Slot`, `Collection`.
   - `token_price = price / 10^paymentTokenDecimals` (KIBBLE/DOTA/BARON = 18; USDC = 6; cbBTC = 8).
   - `usd_price` — branch on `paymentToken`: KIBBLE → oracle; USDC → `price / 10^6`; else DEX. Sanity-check against the rarity band (above). If you can't price it confidently, drop the USD and just show the token amount.
   - Stock: if `stockRemaining == 0` → **"Sold Out"**; otherwise format as **`"{stockRemaining} of {maxSupply} remaining"`** — stockRemaining first, maxSupply second. The order matters: `stockRemaining` ≤ `maxSupply` always, so if the first number ever exceeds the second you've swapped them. Reread the struct fields if unsure.
3. Sort with the big-ticket order: **rarity DESC** (Legendary → Common), then **USD price DESC** (cross-token comparable), then name ASC.
4. Open the reply with the current season, and end with a link to the matching `docs.cat.town/boutique/...-fashion` page.

### Example response (real data from today's rotation)

> **Boutique today — Spring Fashion collection (Day 20566):**
>
> 1. **White Longsleeve** — Rare Body — **12,500 KIBBLE (~$11.86)** — 1 of 1 remaining
> 2. **Royal Blue Varsity** — Uncommon Body — **6,000 KIBBLE (~$5.69)** — 2 of 2 remaining
> 3. **Classic Academic Blouse** — Uncommon Body — **6,000 KIBBLE (~$5.69)** — 1 of 2 remaining
>
> Browse the other seasonal collections:
> - Spring: https://docs.cat.town/boutique/spring-fashion
> - Summer: https://docs.cat.town/boutique/summer-fashion
> - Autumn: https://docs.cat.town/boutique/autumn-fashion
> - Winter: https://docs.cat.town/boutique/winter-fashion
> - Overview: https://docs.cat.town/shops/boutique

## Buying an item

Single-item purchase per tx — no batch/multi-buy on the contract. Mint is **synchronous** (unlike gacha's async VRF mint): the same `purchaseItem` tx pulls payment, mints the NFT, and returns its token id.

### Write path

```
Boutique.purchaseItem(uint256 itemId) external nonReentrant whenNotPaused returns (uint256 mintedTokenId)
```

- Selector: `0xd38ea5bf`
- `itemId` is the **plain rotation id** from `getTodaysRotation()` (e.g. 208, 173, 196 in today's rotation) — **not** scaled, **not** wei. Pass the integer as-is.
- State mutability: `nonpayable` — do **not** send `msg.value`.
- Modifiers: `nonReentrant` and `whenNotPaused` — if `paused()` returns true, all purchases revert. Read `paused()` first if you suspect downtime.
- Internally: pulls `price` of `paymentToken` from `msg.sender` to a contract-set `treasury` address (NOT held by the Boutique itself), then mints the NFT via the configured V2 minter, then emits `ItemPurchased`. There's no boutique fee — the full price flows to treasury.

### Preconditions (run before submitting)

1. **`canPurchaseItem(itemId)` → `(bool canPurchase, string reason)`** — view-only preflight. If `canPurchase == false`, surface `reason` verbatim. The exact strings the contract returns:
   - `"Item does not exist"`
   - `"Item is not active"`
   - `"Item is out of stock"`
   - `"Item not available yet"` (start-time gate)
   - `"Item no longer available"` (end-time gate)
   - `"Item not available this season"`
   - `"Item not in today's rotation"`

   Note: `canPurchaseItem` does **not** check `paused()`. If the contract is paused but the item is otherwise fine, this returns `(true, "")` and the actual `purchaseItem` tx reverts. Read `paused()` separately when in doubt.
2. **`paymentToken.balanceOf(user) >= price`** — `price` is in `paymentToken`'s native unit (KIBBLE/DOTA/BARON are 18 decimals; USDC is 6 decimals; cbBTC is 8 decimals). Don't reflexively use 18.
3. **`paymentToken.allowance(user, boutique) >= price`** — if not, approve first. The spender is the Boutique address (`0xf9843bF01ae7EF5203fc49C39E4868C7D0ca7a02`), even though tokens flow through to the treasury.

### Reverts from `purchaseItem` are custom errors, NOT strings

The friendly strings only come from `canPurchaseItem`. The actual `purchaseItem` reverts with Solidity custom errors (4-byte selectors, no message). If a tx reverts and you only see a hex selector in the trace, this table maps them:

| Custom error                       | Same condition as `canPurchaseItem` reason |
|------------------------------------|--------------------------------------------|
| `ItemNotFound()`                   | "Item does not exist"                      |
| `ItemNotActive()`                  | "Item is not active"                       |
| `ItemOutOfStock()`                 | "Item is out of stock"                     |
| `ItemNotAvailableYet()`            | "Item not available yet"                   |
| `ItemNoLongerAvailable()`          | "Item no longer available"                 |
| `ItemNotAvailableThisSeason()`     | "Item not available this season"           |
| `ItemNotInDailyRotation()`         | "Item not in today's rotation"             |

This is exactly why preflighting with `canPurchaseItem` is worth one cheap RPC — you get a string the user can read.

### `ItemPurchased` event

```
event ItemPurchased(
    address indexed buyer,
    uint256 indexed itemId,
    uint256 indexed mintedTokenId,
    address paymentToken,
    uint256 price
)
```

`mintedTokenId` is the V2-minter token id the user now owns — useful if you immediately want to surface a sell quote (see [sell-items.md](sell-items.md)) or render the item.

### Never hardcode the price — read it from the contract

`ShopItemView.price` is the literal token amount in `paymentToken`'s native wei. Read it via `getShopItem(itemId)` or `getTodaysRotationDetails()`. Don't infer from any doc, including this one; admin can update prices, the rotation rotates daily, and the currency varies per item. The recipes below use **today's live values** as illustrations — they will be wrong tomorrow.

### Recipe — KIBBLE-priced item (the common case)

Live as of writing — **Striking Baseball Cap** (`itemId = 173`, Legendary, **50,000 KIBBLE**, 1/1 stock).

```
price = ShopItemView.price for itemId 173        # = 50_000 * 10^18 today

0. paused() == false                              # else everything reverts
1. canPurchaseItem(173) → must be (true, "")
2. KIBBLE.balanceOf(user) ≥ price
3. KIBBLE.allowance(user, boutique) ≥ price
     - if not: KIBBLE.approve(boutique, price)    # standard ERC-20 wei
4. Boutique.purchaseItem(173)                     # plain integer, no scaling
```

### Recipe — DOTA-priced item (collab / partnership)

Live as of writing — **Rat Skull Charm** (`itemId = 208`, Rare, **1,500,000 DOTA**, ~64/100 stock remaining, "Friends of Cat Town" collection).

```
price = ShopItemView.price for itemId 208        # = 1_500_000 * 10^18 today (DOTA, 18 decimals)

0. paused() == false
1. canPurchaseItem(208) → must be (true, "")
2. DOTA.balanceOf(user) ≥ price                   # else swap (see below)
3. DOTA.allowance(user, boutique) ≥ price
     - if not: DOTA.approve(boutique, price)      # DOTA = 0x5F09821CBb61e09D2a83124Ae0B56aaa3ae85B07
4. Boutique.purchaseItem(208)
```

If the user doesn't hold any DOTA, the cat.town UI sends them to Uniswap to swap in:

```
https://app.uniswap.org/swap?chain=mainnet&outputChain=base&inputCurrency=NATIVE&outputCurrency=0x5f09821cbb61e09d2a83124ae0b56aaa3ae85b07
```

For collab tokens generally, prefer to swap *into* the required token from KIBBLE / ETH / USDC rather than asking users to source it themselves. Bankr's swap surface (via the `trails` or `symbiosis` skill) handles this.

### Per-wallet purchase counts

`getUserPurchaseCount(itemId, user)` returns how many times a wallet has bought a specific item. The contract increments this on every buy but does **not** enforce a per-user max — stock is enforced globally via `stockRemaining`. Useful only as a "you've already bought this" UX hint.

### Common revert reasons

- **`ERC20: transfer amount exceeds allowance`** (or `ERC20InsufficientAllowance`) — wrong token approved, or allowance too low. Reread `paymentToken` from `ShopItemView` and approve that exact address with the spender set to the Boutique.
- **`ERC20: transfer amount exceeds balance`** (or `ERC20InsufficientBalance`) — user doesn't hold enough of `paymentToken`. Offer a swap.
- **`EnforcedPause()`** — contract is paused. Read `paused()`; nothing actionable until ops un-pauses.
- **Custom errors** (`ItemNotFound()` etc., see table above) — these come through as bare 4-byte selectors. Always preflight with `canPurchaseItem` so you can show the user the matching string.

### Bankr execution

Natural-language prompt (handles approval + buy in one shot):

```bash
bankr agent prompt "Buy the Rat Skull Charm from the Cat Town boutique"
```

Or encode calldata directly. **Do NOT copy a hex price from this doc** — read `ShopItemView.price` live and encode that exact value. Below is a worked example for today's Rat Skull Charm price (1,500,000 DOTA), purely to show the byte layout:

```bash
# Today's price hex for Rat Skull Charm (read live; will change):
PRICE_HEX=0x13da329b6336470000000        # = 1_499_999_999_999_999_974_834_176 wei DOTA

# 1) approve DOTA → boutique for that price
#    (cast calldata "approve(address,uint256)" 0xf9843bF01ae7EF5203fc49C39E4868C7D0ca7a02 $PRICE_HEX)
bankr wallet submit \
  --to 0x5F09821CBb61e09D2a83124Ae0B56aaa3ae85B07 \
  --data 0x095ea7b3000000000000000000000000f9843bf01ae7ef5203fc49c39e4868c7d0ca7a02000000000000000000000000000000000000000000013da329b6336470000000 \
  --chain base

# 2) purchaseItem(208)
#    (cast calldata "purchaseItem(uint256)" 208)
bankr wallet submit \
  --to 0xf9843bF01ae7EF5203fc49C39E4868C7D0ca7a02 \
  --data 0xd38ea5bf00000000000000000000000000000000000000000000000000000000000000d0 \
  --chain base
```

For a KIBBLE-priced item, swap the approve target to the KIBBLE token (`0x64cc19A52f4D631eF5BE07947CABA14aE00c52Eb`) and re-encode against the live `price`. Always re-encode from a fresh contract read; never reuse stale hex.

## Notes

- **Caching:** `getTodaysRotationDetails()` is stable within a UTC day — cache freely. The oracle moves with market — 1–5 min cache is reasonable.
- **Future rotations:** `previewRotationForDay(day, season)` supports "what's in the boutique tomorrow?" queries without waiting.
- **Season mismatch:** if `GameData.getCurrentSeason()` disagrees with `Boutique.getCurrentSeason()`, trust Boutique's for rotation questions (they should match, but boutique may lag a block).
- **No batch buy.** Two purchases = two `purchaseItem` calls. Approve the cumulative amount once if both items share the same `paymentToken`.
