# Memory Schema

Store memory in user-specific files:

- `/.memory/gm-bankr-settings.json`
- `/.memory/gm-bankr-history.json`

Create missing files with default values. Preserve unknown keys to avoid destroying future settings.

## gm-bankr-settings.json

```json
{
  "sections": {
    "leaderboard": true,
    "bnkr": true,
    "openPositions": true,
    "highlight": true,
    "watch": true,
    "mission": true,
    "streak": true
  },
  "preferredChains": ["Base"],
  "hiddenTopics": [],
  "reportLength": "normal"
}
```

## gm-bankr-history.json

```json
{
  "lastCheckDate": null,
  "gmStreak": 0,
  "previousLeaderboardRank": null,
  "previousBnkrPrice": null
}
```

## Update rules

- Treat dates as local calendar dates in the user's timezone when the runtime provides one.
- If `lastCheckDate` is today, do not increment `gmStreak` again.
- If `lastCheckDate` is yesterday, increment `gmStreak` by 1.
- If `lastCheckDate` is older than yesterday or missing, set `gmStreak` to 1.
- Update `lastCheckDate` after a `GM` response is generated.
- Update `previousLeaderboardRank` only when a verified current rank was fetched.
- Do not display or reuse `previousLeaderboardRank` as the current rank when the current rank could not be fetched.
- Update `previousBnkrPrice` only when a verified current BNKR price was fetched.
- Save changed settings before producing the response when the user combines settings changes with `GM`.

## Customization mapping

- "Leaderboard ON/OFF" updates `sections.leaderboard`.
- "BNKR ON/OFF" updates `sections.bnkr`.
- "Open Positions ON/OFF" updates `sections.openPositions`.
- "Highlight ON/OFF" updates `sections.highlight`.
- "Watch ON/OFF" updates `sections.watch`.
- "Today's Mission ON/OFF" or "Mission ON/OFF" updates `sections.mission`.
- "Streak ON/OFF" updates `sections.streak`.
- Preferred chains update `preferredChains`.
- Hidden or muted topics update `hiddenTopics`.
- Short, normal, or detailed mode updates `reportLength`.
