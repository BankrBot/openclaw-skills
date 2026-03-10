---
name: productclank-campaigns
description: This skill should be used when the user asks to "create a Twitter campaign", "boost a tweet", "amplify a post", "run community-driven marketing", "intercept competitor mentions", "scale word-of-mouth", "turn users into brand advocates", or mentions "ProductClank", "Communiply", or "Twitter engagement campaign". Enables AI-powered brand advocacy on Twitter/X through community coordination.
license: Proprietary
metadata:
  author: ProductClank
  version: "3.0.0"
  api_endpoint: https://api.productclank.com/api/v1/agents/campaigns
  website: https://www.productclank.com
  web_ui: https://app.productclank.com/communiply/campaigns/
  compatibility: Credit-based pay-per-use system. Self-registration with 300 free credits. Agents buy more credits with USDC on Base (chain ID 8453). Supports x402 protocol and direct USDC transfers. Works with any wallet type.
---

# ProductClank Communiply — Community-Driven Brand Advocacy

Communiply solves the authenticity problem in social media marketing. Instead of a brand promoting itself (which people dismiss as advertising), real community members naturally recommend the brand in relevant Twitter/X conversations — creating genuine word-of-mouth at scale.

**How it works:** AI discovers relevant conversations 24/7 → generates context-aware replies → community members post from personal accounts → track engagement and ROI.

## Choosing the Right Endpoint

```
What to do?
│
├─ Amplify a specific tweet RIGHT NOW
│  └─> POST /agents/campaigns/boost
│      Cost: 200-300 credits | Immediate | One-shot
│
└─ Monitor conversations ongoing & respond when relevant
   └─> POST /agents/campaigns (Communiply)
       Cost: 10 + (12 × posts) | Ongoing 24/7 | Keyword-based
```

| Feature | Communiply | Boost |
|---------|-----------|-------|
| **Target** | Keyword-based conversations | Specific tweet URL |
| **Cost** | 10 + (12 × posts) | 200-300 credits (fixed) |
| **Timeline** | Ongoing campaign | One-shot action |
| **Best for** | Competitor intercept, problem targeting | Launch announcements, specific posts |

## Cost Estimator

300 free credits from registration can run:

| Campaign Type | Credits | Posts | Best For |
|---------------|---------|-------|----------|
| Small test | ~60 | 4 | Testing the API |
| Medium test | ~130 | 10 | Proof of concept |
| Full test | ~250 | 20 | Real campaign |
| Tweet boost | 200-300 | 10 replies or engagement | One-time amplification |

**Formula:** `Total = 10 (campaign) + (posts × 12) + (optional: review × 2/post)`

## Agent Setup

Two setup paths:

### Autonomous Agent (self-funded)

Register, get API key + 300 free credits instantly. Top up via USDC on Base.

```bash
curl -X POST https://api.productclank.com/api/v1/agents/register \
  -H "Content-Type: application/json" \
  -d '{"name": "MyAgent", "description": "Growth automation agent"}'
```

Save the `api_key` from the response — shown once only.

### Owner-Linked Agent (user-funded)

Register first (same as above), then link to a ProductClank account to share the owner's credit balance:

```bash
curl -X POST https://api.productclank.com/api/v1/agents/create-link \
  -H "Authorization: Bearer pck_live_YOUR_KEY"
```

Share the returned `link_url` with the user. They click it, log in via Privy, and the agent is linked. Campaigns then appear in the owner's dashboard, and credits are shared.

For detailed funding scenarios and payment methods, consult **`references/FUNDING.md`**.

## Campaign Workflow

### 1. Find a product

```bash
GET /api/v1/agents/products/search?q=product+name
```

No product yet? Direct users to create one at [app.productclank.com/products](https://app.productclank.com/products).

### 2. Create campaign (10 credits)

```bash
POST /api/v1/agents/campaigns
```

Required fields: `product_id`, `title`, `keywords[]`, `search_context`

Optional: `mention_accounts`, `reply_style_tags`, `reply_length` ("very-short"|"short"|"medium"|"long"|"mixed"), `reply_guidelines`, `min_follower_count`, `max_post_age_days`, `require_verified`

Response includes `campaign.url` (public) and `campaign.admin_url` (owner dashboard). Always share both URLs with the user.

### 3. Generate posts (12 credits/post)

```bash
POST /api/v1/agents/campaigns/{id}/generate-posts
```

Triggers Twitter discovery and AI reply generation. Credits deducted per post found.

### 4. Review posts — optional (2 credits/post)

```bash
POST /api/v1/agents/campaigns/{id}/review-posts
```

AI-scores posts against custom relevancy rules. Irrelevant posts are deleted. Run with `dry_run: true` first to preview. Both modes consume credits since AI scoring runs either way.

### 5. Check results

```bash
GET /api/v1/agents/campaigns/{id}
```

Returns `stats.posts_discovered`, `stats.replies_total`, `stats.replies_by_status`.

## Tweet Boost

Amplify a specific tweet with community engagement:

```bash
POST /api/v1/agents/campaigns/boost
```

| Action | Items | Credits |
|--------|-------|---------|
| `replies` | 10 AI replies | 200 |
| `likes` | 30 like tasks | 300 |
| `repost` | 10 repost tasks | 300 |

Re-boosting the same tweet generates fresh content without duplicates.

## Credit Costs

| Operation | Credits |
|-----------|---------|
| Registration | +300 free |
| Create campaign | 10 |
| Discover + generate reply | 12/post |
| Review post (AI relevancy) | 2/post |
| Boost (replies) | 200 |
| Boost (likes/repost) | 300 |

Top up via USDC on Base. Bundles range from nano ($2, 40 cr) to enterprise ($500, 14,000 cr). See **`references/FUNDING.md`** for details.

## Rate Limits

| Resource | Limit |
|----------|-------|
| Campaigns/day | 10 |
| API calls/hour | 100 |
| Delegates/campaign | 5 |

429 responses include `retry_after` timestamp.

## Key Use Cases

1. **Launch campaigns with community rewards** — Boost launch tweets, community earns rewards for engagement. Export leaderboard to reward participants. Coming soon: full API support.
2. **Competitor intercept** — Target "Looking for [competitor] alternatives" conversations.
3. **Problem-based targeting** — Find people expressing pain points the product solves.
4. **Brand amplification** — Third-party validation reinforces positive mentions.
5. **Product launches** — Coordinate community amplification during launch week. Community responds on relevant posts mentioning the product.

## Campaign Best Practices

- **Specific keywords**: ["AI productivity tools", "automation software"] not ["AI", "tools"]
- **Clear search context**: "People discussing challenges with project management" not "People talking about stuff"
- **Set filters**: `min_follower_count` (default 100), `max_post_age_days`, `require_verified`
- **Custom reply guidelines**: Brand voice instructions, key value propositions, do's and don'ts
- **Share both URLs**: Admin dashboard (`/my-campaigns/communiply/{id}`) + public page (`/communiply/{id}`)

## Troubleshooting

| Error | Fix |
|-------|-----|
| `insufficient_credits` (402) | Top up at `POST /agents/credits/topup` |
| `not_found` (404) | Search products: `GET /agents/products/search?q=name` |
| `unauthorized` (401) | Key must start with `pck_live_`. Rotate: `POST /agents/rotate-key` |
| `rate_limit_exceeded` (429) | 10 campaigns/day. Contact ProductClank for more. |

## Skill Version Updates

API responses include `X-Skill-Version` header. Compare against `metadata.version` above. If newer, re-fetch from:
`https://raw.githubusercontent.com/covariance-network/productclank-agent-skill/main/SKILL.md`

## Additional Resources

### Reference Files

For detailed documentation, consult:
- **`references/API_REFERENCE.md`** — Complete endpoint specification with request/response shapes for all 19 endpoints
- **`references/EXAMPLES.md`** — Full code examples for common workflows
- **`references/FUNDING.md`** — Detailed funding scenarios, payment methods, credit bundles
- **`references/FAQ.md`** — Common questions and answers

### Scripts

- **`scripts/create-campaign.mjs`** — Create a Communiply campaign
- **`scripts/boost-tweet.mjs`** — Boost a specific tweet
- **`scripts/review-posts.mjs`** — AI-review posts
- **`scripts/check-results.mjs`** — Poll campaign stats

### Links

- **Campaign Dashboard**: [app.productclank.com/communiply/campaigns/](https://app.productclank.com/communiply/campaigns/)
- **Twitter**: [@productclank](https://twitter.com/productclank)
- **Warpcast**: [warpcast.com/productclank](https://warpcast.com/productclank)
