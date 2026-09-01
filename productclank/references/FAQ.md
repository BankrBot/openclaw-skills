# ProductClank Agent API — Frequently Asked Questions

## Getting Started

**Q: Do I need to contact anyone to get an API key?**
A: No. Self-register via `POST /api/v1/agents/register`. API key is provided instantly. Then top up credits via the [webapp](https://app.productclank.com/credits/purchase) or x402.

**Q: Do I need USDC to start?**
A: You need credits to run campaigns. Top up via the [webapp](https://app.productclank.com/credits/purchase) (credit card — no crypto needed) or USDC on Base. The nano bundle ($2, 40 credits) is enough for a quick test.

**Q: Is there a test environment?**
A: No separate test API — use the production API with a small credit top-up (nano bundle: $2 for 40 credits).

## Campaigns

**Q: What happens after a campaign is created?**
A: Share the admin dashboard URL (`/my-campaigns/communiply/{id}`) with the campaign owner and the public URL (`/communiply/{id}`) with community participants. Then call `POST /api/v1/agents/campaigns/{id}/generate-posts` to trigger Twitter discovery and reply generation (12 credits/post). Optionally use `review-posts` to AI-filter irrelevant results (2 credits/post).

**Q: How much does it cost to create a campaign?**
A: 10 credits for campaign creation + 12 credits per post discovered. A typical 10-post test campaign costs ~130 credits.

**Q: Can I list or check campaigns via API?**
A: Yes. `GET /api/v1/agents/campaigns` lists all campaigns. `GET /api/v1/agents/campaigns/{id}` shows details and stats.

**Q: Can I delete or pause campaigns?**
A: Yes, via the admin dashboard at `https://app.productclank.com/my-campaigns/communiply/{campaign_id}`

**Q: Which endpoint — Communiply or Boost?**
A: Communiply for ongoing keyword-based monitoring. Boost for amplifying a specific tweet immediately. See the decision tree in SKILL.md.

**Q: Do I need a product on ProductClank to launch a Boost?**
A: No. `product_id` is **optional** on `POST /agents/campaigns/boost`. Tweet-first boosts work without one — AI replies use generic amplification language ("this post" instead of the product name) and brand-mention enforcement is skipped. Pass `product_id` when you want the boost linked to a product on ProductClank (so AI replies reference the product name and enforce mentions). Discover/Communiply campaigns (`POST /agents/campaigns`) still require `product_id`.

## Agent Setup

**Q: What's the difference between autonomous and owner-linked agents?**
A: **Autonomous agents** have their own credit balance and fund themselves via crypto. **Owner-linked agents** share the owner's credit balance — the owner can also manage campaigns in the webapp UI.

**Q: How do I link my agent to my account?**
A: Call `POST /api/v1/agents/create-link` to get a linking URL. Click it, log in via Privy, and the agent is linked.

## Account Management

**Q: What if I lose my API key?**
A: Use `POST /api/v1/agents/rotate-key` with the current key to generate a new one. If access is lost completely, contact ProductClank.

**Q: How do I increase rate limits?**
A: Contact ProductClank with use case and expected volume.
