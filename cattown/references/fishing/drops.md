# Fishing drop tables — world state → items

Cat Town's public item catalog (`GET https://api.cat.town/v2/items/master`) lists every active item with optional drop conditions keyed to season, time of day, weather, and seasonal events. This doc covers the **fishing subset** — mirroring the frontend's live filter logic so agents can answer:

- "What fish can I catch in the rain?"
- "What drops are exclusive to Winter evenings?"
- "What's special about Storm weather?"

## Endpoint

```
GET https://api.cat.town/v2/items/master?limit=1000
```

- Public, no auth. Confirmed — plain `fetch` with no Authorization header or credentials option.
- ~430 active items at the last check. One request gets the full catalog.
- Frontend caches indefinitely (`staleTime: Infinity`). Agents should cache for ≥1 hour — items change rarely.

## Response shape (fields relevant for fishing filters)

```ts
{
  items: Array<{
    id: string
    name: string                 // "Pristine Snowflake"
    itemType: string             // "Fish" | "Treasure" | "Cosmetic" | "Collectible" | ...
    rarity: string               // "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary" | ...
    source: string               // "Fishing" | "Incantation" | "Gacha" | ...
    isActive: boolean            // always check — skip if false
    dropConditions: null | {
      events?: string[]          // "Halloween" | "Christmas" | "Easter" | "Valentines Day"
      seasons?: string[]         // "Spring" | "Summer" | "Autumn" | "Winter"
      timesOfDay?: string[]      // "Morning" | "Afternoon" | "Evening" | "Night"
      weathers?: string[]        // "Sun" | "Rain" | "Wind" | "Storm" | "Snow" | "Heatwave"
    }
    imageUrl: string
    flavorText: string | null
    acquisitionMethod: string | null
  }>
  pagination: { limit: number; offset: number; total: number }
}
```

## Fishing filter — the frontend's exact logic

Ported verbatim from the live game's `utils/helpers/fishingHelpers.tsx` (`getFishingItemsFor{Weather,Season,TimeOfDay}`):

```
filter_fishing_items(axis, axis_value, current_event):
  for each item in catalog:
    1. require item.isActive == true
    2. require item.source == "Fishing"
    3. require item.itemType in {"Fish", "Treasure"}     // fishing catches only
    4. require axis_value in item.dropConditions[axis]   // items *exclusive* to this axis value
    5. event gate (see below) — skip if is_event_exclusive()
  sort by: rarity DESC (Legendary → Common), then name ASC
```

### Event-exclusivity gate

```
is_event_exclusive(item, current_event):
  events = item.dropConditions.events
  if events is empty:                     return false        // no event condition → always pass
  if current_event is None:               return true         // requires an event but none active
  return current_event not in events                          // active event doesn't match
```

In plain terms: Halloween-tagged items are invisible outside Halloween. Christmas items invisible outside Christmas. Etc.

### The filter returns *exclusive* items, not all available ones

`getFishingItemsForWeather("Snow")` returns only items with `"Snow"` in their `weathers` array — 3 items as of last check. It does **not** return the hundreds of always-available items without any weather condition. This matches the game UI's "special drops this weather" panel.

If an agent is answering "what's special about Storm weather?" — use this filter verbatim. If an agent is answering "what can I possibly catch right now?" — you'd want to union weather-exclusive drops with season-exclusive drops with unconstrained drops, and that's a different question the frontend doesn't expose directly.

## Recipe: "what can I catch in this weather?"

1. Read world state from GameData (see [../world/contract.md](../world/contract.md)):
   ```
   GameData.getGameState() → (season, timeOfDay, isWeekend, worldEvent, weather)
   ```
2. Normalize enum values for the item API (weather and season strings match after lowercasing; `worldEvent` uint8 → event name or `None`):

   | Contract `timeOfDay` | Item API `timesOfDay` |
   |----------------------|-----------------------|
   | `Morning`            | `Morning`             |
   | `Daytime`            | `Afternoon`           |
   | `Evening`            | `Evening`             |
   | `Nighttime`          | `Night`               |

3. Fetch the catalog once (cacheable):
   ```
   GET https://api.cat.town/v2/items/master?limit=1000
   ```
4. Apply the filter above for the axis the user asked about.

## Live weather → exclusive fishing drops (production sweep)

| Weather  | Exclusive fishing drops                                                                                              |
|----------|----------------------------------------------------------------------------------------------------------------------|
| Sun      | Solar Pearl (Uncommon Treasure), Sun-Kissed Catfish (Epic Fish), Amberfin Catfish (Epic Fish)                        |
| Rain     | Fancy Duck (Rare Treasure), and shared Rain/Storm items below                                                        |
| Storm    | Misty Duck (Rare), Lovely Duck (Rare), King Snapper (Rare Fish), **Elusive Marlin (Legendary Fish)**                 |
| Snow     | Frozen Tusk (Epic Treasure), Snow Globe (Rare Treasure), Pristine Snowflake (Uncommon Treasure)                      |
| Wind     | Driftwood, Pirate Doubloon, Lost Compass (treasures)                                                                 |
| Heatwave | Radiant Catfish, Gilded Sundial, Amberfin Catfish, Solar Pearl                                                       |

**Weather rotates on the scale of minutes to hours — it's the highest-frequency axis.** Weather-exclusive catches are the highest-value thing to surface to a user deciding when to fish. Season rotates much slower; time-of-day in between.

## Axis coverage at a glance (last sweep)

- Items with any `weathers` condition: 21
- Items with any `seasons` condition: 274 (Spring 94, Winter 96, Autumn 68, Summer 16)
- Items with any `timesOfDay` condition: 34
- Items with any `events` condition: 46 (Halloween dominates)

Total active items in catalog: 429.
