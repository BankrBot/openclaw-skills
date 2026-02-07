---
name: talent-powers
description: Query builder reputation data via Talent Protocol API. Get Builder Rank, verify humans, resolve identities (Twitter/Farcaster/GitHub/wallet), search by location/country, get credentials, and enrich with GitHub data.
---

# Talent Powers

Query professioanl data from [Talent Protocol](https://talent.app) - a platform that tracks onchain builders

**Use this skill to:**
- Find verified developers by location, skills, or identity (Twitter/GitHub/Farcaster/wallet)
- Check builder reputation scores and rankings
- Map Twitter accounts with Wallets
- Verify human identity from a wallet
- Search for builder's credentials (earnings, contributions, hackathons, contracts, etc)
- Discover what projects are being built by profiles

**API Key:** https://talent.app/~/settings/api  
**Base URL:** `https://api.talentprotocol.com`

```bash
curl -H "X-API-KEY: $TALENT_API_KEY" "https://api.talentprotocol.com/..."
```

## Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/search/advanced/profiles` | Search profiles by identity, tags, rank, verification |
| `/profile` | Get profile by ID |
| `/accounts` | Get connected wallets, GitHub, socials |
| `/socials` | Get social profiles + bios |
| `/credentials` | Get data points (earnings, followers, hackathons, etc.) |
| `/human_checkmark` | Check if human-verified |
| `/farcaster/scores` | Batch lookup Farcaster users |

## Key Parameters

**Identity lookup:**
```
query[identity]={handle}&query[identity_type]={twitter|github|farcaster|ens|wallet}
```

**Filters:**
```
query[human_checkmark]=true
query[verified_nationality]=true
query[tags][]=developer
```

**Sorting:**
```
sort[score][order]=desc&sort[score][scorer]=Builder%20Score
```

**Pagination:** `page=1&per_page=250` (max 250)

## URL Encoding

`[` = `%5B`, `]` = `%5D`, Space = `%20`

## Response Fields

- `builder_score.rank_position` - Primary metric
- `location` - User-entered location (returned in response)
- `scores[]` - Use `builder_score_2025` for latest rank

## Location Filter

**DO NOT USE** `query[standardized_location]=Country` - doesn't work.

**USE `customQuery` with regex:**

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

See [use-cases.md](references/use-cases.md#by-location-country) for more examples.

## Limitations

- Max 250 per page
- GET only for most endpoints (POST for customQuery)
- Simple `query[standardized_location]` param broken - use `customQuery` regex

## GitHub Enrichment

Get projects/repos via GitHub after resolving username from `/accounts`:

```bash
# 1. Get GitHub username
/accounts?id={profile_id} → { "source": "github", "username": "..." }

# 2. Query GitHub
GET https://api.github.com/users/{username}                           # Profile
GET https://api.github.com/users/{username}/repos?sort=stars&per_page=5   # Top repos
GET https://api.github.com/users/{username}/repos?sort=pushed&per_page=5  # Recent
GET https://api.github.com/users/{username}/events/public             # Commits
GET https://api.github.com/search/issues?q=author:{username}+type:pr+state:open  # Open PRs
```

GitHub token: https://github.com/settings/tokens (60 req/hr without, 5000 with)

## References

- [endpoints.md](references/endpoints.md) - Full endpoint docs
- [use-cases.md](references/use-cases.md) - Common patterns
- [github-enrichment.md](references/github-enrichment.md) - GitHub data
