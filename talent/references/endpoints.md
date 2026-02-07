# Endpoints

**API Key:** https://talent.app/~/settings/api

```bash
curl -H "X-API-KEY: $TALENT_API_KEY" "https://api.talentprotocol.com/..."
```

**URL Encoding:** `[` = `%5B`, `]` = `%5D`

---

## /search/advanced/profiles

### GET (identity, tags, verification)

```bash
curl -H "X-API-KEY: $TALENT_API_KEY" \
  "https://api.talentprotocol.com/search/advanced/profiles?query%5Bidentity%5D=jessepollak&query%5Bidentity_type%5D=twitter"
```

| Parameter | Example |
|-----------|---------|
| `query[identity]` | `jessepollak` |
| `query[identity_type]` | `twitter`, `github`, `farcaster`, `ens`, `wallet` |
| `query[human_checkmark]` | `true` |
| `query[verified_nationality]` | `true` |
| `query[tags][]` | `developer` |
| `sort[score][order]` | `desc` |
| `sort[score][scorer]` | `Builder Score` |
| `page` | `1` |
| `per_page` | `250` (max) |

### POST with customQuery (for location filtering)

**DO NOT USE** `query[standardized_location]` - it doesn't work.

**USE POST with `customQuery` regex:**

```bash
curl -X POST -H "X-API-KEY: $TALENT_API_KEY" -H "Content-Type: application/json" \
  "https://api.talentprotocol.com/search/advanced/profiles" \
  -d '{
    "customQuery": {
      "regexp": {
        "standardized_location": {
          "value": ".*argentina.*",
          "case_insensitive": true
        }
      }
    },
    "humanCheckmark": true,
    "sort": { "score": { "order": "desc", "scorer": "Builder Score" } },
    "perPage": 50
  }'
```

See [use-cases.md](use-cases.md#by-location-country) for more location examples.

### Response

```json
{
  "profiles": [{
    "id": "uuid",
    "name": "username",
    "display_name": "Name",
    "bio": "...",
    "location": "Buenos Aires, Argentina",
    "human_checkmark": true,
    "tags": ["developer"],
    "builder_score": { "rank_position": 127, "points": 229 },
    "scores": [
      { "slug": "builder_score_2025", "rank_position": 154 }
    ]
  }],
  "pagination": { "current_page": 1, "total": 100 }
}
```

---

## /profile

```bash
curl -H "X-API-KEY: $TALENT_API_KEY" \
  "https://api.talentprotocol.com/profile?id={profile_id}"
```

| Parameter | Description |
|-----------|-------------|
| `id` | Profile ID, wallet, or identifier |
| `account_source` | `farcaster`, `github`, `wallet` |

---

## /accounts

Get connected wallets and platforms. Use to find GitHub username for enrichment.

```bash
curl -H "X-API-KEY: $TALENT_API_KEY" \
  "https://api.talentprotocol.com/accounts?id={profile_id}"
```

**Response:**

```json
{
  "accounts": [
    { "source": "wallet", "identifier": "0x..." },
    { "source": "github", "username": "jessepollak" },
    { "source": "farcaster", "username": "jesse" },
    { "source": "x_twitter", "username": "jessepollak" }
  ]
}
```

---

## /socials

Get social profiles with bios and follower counts.

```bash
curl -H "X-API-KEY: $TALENT_API_KEY" \
  "https://api.talentprotocol.com/socials?id={profile_id}"
```

**Response:**

```json
{
  "socials": [
    { "social_name": "Twitter", "handle": "jessepollak", "bio": "...", "followers_count": 5000 },
    { "social_name": "Github", "handle": "jessepollak", "followers_count": 200 },
    { "social_name": "Farcaster", "handle": "jesse", "followers_count": 1500 }
  ]
}
```

---

## /credentials

Get all data points: earnings, followers, hackathons, events, memberships.

```bash
curl -H "X-API-KEY: $TALENT_API_KEY" \
  "https://api.talentprotocol.com/credentials?id={profile_id}"
```

**Response:**

```json
{
  "credentials": [
    { "slug": "github_total_contributions", "readable_value": "500" },
    { "slug": "total_earnings", "readable_value": "1250" },
    { "slug": "eth_global_hacker", "points": 10 },
    { "slug": "base_basecamp", "points": 5 }
  ]
}
```

**Common slugs:**

| Category | Slugs |
|----------|-------|
| Followers | `total_followers`, `twitter_followers`, `github_followers`, `farcaster_followers` |
| Earnings | `total_earnings`, `total_builder_earnings`, `base_builder_rewards_eth` |
| Events | `base_basecamp`, `farcaster_farcon_nyc_2025_attendee` |
| Hackathons | `eth_global_hacker`, `eth_global_finalist`, `devfolio_hackathons_won` |
| Verification | `talent_protocol_human_checkmark`, `world_id_human`, `coinbase_verified_account` |
| Memberships | `developer_dao_member`, `fwb_member` |

---

## /human_checkmark

```bash
curl -H "X-API-KEY: $TALENT_API_KEY" \
  "https://api.talentprotocol.com/human_checkmark?id={profile_id}"
```

**Response:** `{ "human_checkmark": true }`

---

## /data_points

List available data point slugs for a profile.

```bash
curl -H "X-API-KEY: $TALENT_API_KEY" \
  "https://api.talentprotocol.com/data_points?id={profile_id}"
```

---

## Errors

| Status | Meaning |
|--------|---------|
| 400 | Bad request (e.g., per_page > 250) |
| 401 | Missing/invalid API key |
| 404 | Profile not found |
| 302 | Used POST instead of GET |
