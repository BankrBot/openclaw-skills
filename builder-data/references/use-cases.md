# Use Cases

**URL Encoding:** `[` = `%5B`, `]` = `%5D`

---

## Identity → Wallets

```bash
# 1. Search by identity
curl -H "X-API-KEY: $TALENT_API_KEY" \
  "https://api.talentprotocol.com/search/advanced/profiles?query%5Bidentity%5D={handle}&query%5Bidentity_type%5D={identity_type}"
# Response: profiles[0].id → use as profile_id

# 2. Get wallets from profile ID
curl -H "X-API-KEY: $TALENT_API_KEY" \
  "https://api.talentprotocol.com/accounts?id={profile_id}"
# Filter: source = "wallet"
```

**Identity types:** `twitter`, `github`, `farcaster`, `ens`, `lens`, `basename`, `wallet`

---

## Get Rank (default behavior)

Response from `/search/advanced/profiles` includes:

```json
{
  "builder_score": { "rank_position": 127 },
  "scores": [
    { "slug": "builder_score", "rank_position": 154 }
  ]
}
```

**Default:** Always return `rank_position` values. Use `builder_score.rank_position` for latest rank.

**Only when user explicitly asks for scores:** include `points` values from `builder_score.points` or `scores[].points`.

---

## Get the Top Builders

```bash
curl -H "X-API-KEY: $TALENT_API_KEY" \
  "https://api.talentprotocol.com/search/advanced/profiles?sort%5Bscore%5D%5Border%5D=desc&sort%5Bscore%5D%5Bscorer%5D=Builder%20Score&per_page=250"
```

---

## By Location (Country)

**DO NOT USE** `query[standardized_location]=Country` - it doesn't work.

**USE `customQuery` with regex** - this queries the internal `standardized_location` field:

### Top Builders from Argentina

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
    "sort": { "score": { "order": "desc", "scorer": "Builder Score" } },
    "perPage": 50
  }'
```

### Top Builders from Brazil

```bash
curl -X POST -H "X-API-KEY: $TALENT_API_KEY" -H "Content-Type: application/json" \
  "https://api.talentprotocol.com/search/advanced/profiles" \
  -d '{
    "customQuery": {
      "regexp": {
        "standardized_location": {
          "value": ".*brazil.*",
          "case_insensitive": true
        }
      }
    },
    "sort": { "score": { "order": "desc", "scorer": "Builder Score" } },
    "perPage": 50
  }'
```

### Pattern

Replace country in regex: `"value": ".*{country}.*"`

Examples: `.*united states.*`, `.*germany.*`, `.*nigeria.*`, `.*india.*`

### More precise (country at end of string)

To avoid matching "Georgia, USA" when searching for Georgia (country):

```json
{
  "customQuery": {
    "regexp": {
      "standardized_location": {
        "value": ".*,\\s*argentina$",
        "case_insensitive": true
      }
    }
  }
}
```

This matches locations ending with ", argentina" (e.g., "Buenos Aires, Argentina")

---

## Credentials

All from `/credentials?id={profile_id}`.

**Discover all available data points:** Use `/data_issuers_meta` to get the full list of data issuers and credential slugs available. [API docs](https://docs.talentprotocol.com/docs/talent-api/api-reference/get-data-issuers-and-credentials-available)

```bash
curl -H "X-API-KEY: $TALENT_API_KEY" \
  "https://api.talentprotocol.com/data_issuers_meta"
```

**Common credential slugs:**

| Data | Slug |
|------|------|
| Total followers | `total_followers` |
| Total earnings | `total_earnings` |
| Verification | `talent_protocol_human_checkmark` |
| Contracts | `base_mainnet_active_contracts`, `base_mainnet_contracts_deployed` |

---

## GitHub Enrichment

```bash
# 1. Get GitHub username from /accounts
{ "source": "github", "username": "jessepollak" }

# 2. Query GitHub API
curl "https://api.github.com/users/{username}"                    # Profile, company
curl "https://api.github.com/users/{username}/repos?sort=stars&per_page=5"   # Top repos
curl "https://api.github.com/users/{username}/repos?sort=pushed&per_page=5"  # Recent
curl "https://api.github.com/users/{username}/events/public"      # Commits, activity
curl "https://api.github.com/search/issues?q=author:{username}+type:pr+state:open&per_page=5"  # Open PRs
curl "https://api.github.com/repos/{owner}/{repo}/readme"         # README
```

GitHub token for higher rate limits: https://github.com/settings/tokens

---

## Batch Farcaster

```bash
curl -H "X-API-KEY: $TALENT_API_KEY" \
  "https://api.talentprotocol.com/farcaster/scores?fids%5B%5D=123&fids%5B%5D=456"
```
