# PNP Markets Use Cases

Prediction markets are versatile infrastructure. Here are key use cases for AI agents.

## 1. True Information Finance

Aggregate collective intelligence into probability estimates. Market prices reveal crowd beliefs about uncertain events.

```typescript
// Create market to discover sentiment probability
await client.market.createMarket({
  question: "Will positive sentiment about Project X exceed 70% this week?",
  endTime: Math.floor(Date.now() / 1000) + 86400 * 7,
  initialLiquidity: ethers.parseUnits("100", 6).toString(),
});
```

**Applications:**
- Crowdsource probability estimates on uncertain events
- Discover collective beliefs about future outcomes
- Gather market-based forecasts for decision making

## 2. Token Utility & Engagement

Use your project's token as collateral to drive utility and engagement.

```typescript
const MY_TOKEN = "0xYourTokenContractAddress";

await client.market.createMarket({
  question: "Will we ship v2.0 by end of month?",
  endTime: Math.floor(Date.now() / 1000) + 86400 * 30,
  initialLiquidity: ethers.parseUnits("1000", 18).toString(),
  collateralToken: MY_TOKEN,
});
```

**Benefits:**
- Create immediate utility for token holders
- Drive engagement through prediction participation
- Align community incentives with project outcomes

## 3. Contests & Competitions

Run prediction contests where participants compete by trading on outcomes.

```typescript
await client.market.createMarket({
  question: "Which feature will get the most community votes: A, B, or C?",
  endTime: Math.floor(Date.now() / 1000) + 86400 * 7,
  initialLiquidity: ethers.parseUnits("50", 6).toString(),
});
```

**Applications:**
- Community prediction competitions
- Gamified governance decisions
- Tournament-style events

## 4. Automated Market Making

Create markets programmatically based on data feeds or events.

```typescript
async function createTrendingMarket(topic: string) {
  const question = `Will "${topic}" remain trending for 24 hours?`;
  
  return await client.market.createMarket({
    question,
    endTime: Math.floor(Date.now() / 1000) + 86400,
    initialLiquidity: ethers.parseUnits("25", 6).toString(),
  });
}

// Create markets based on trending topics
for (const topic of trendingTopics) {
  await createTrendingMarket(topic);
}
```

## 5. Conditional Decision Markets

Create markets to inform decisions based on predicted outcomes.

```typescript
// Market to inform product decision
await client.market.createMarket({
  question: "If we launch Feature X, will DAU increase by >20% in 30 days?",
  endTime: Math.floor(Date.now() / 1000) + 86400 * 45,
  initialLiquidity: ethers.parseUnits("200", 6).toString(),
});
```

## 6. Event-Driven Markets

Create markets around specific events with known resolution dates.

```typescript
// Sports, elections, product launches, etc.
await client.market.createMarket({
  question: "Will Company X announce earnings above $5B on Q4 call?",
  endTime: earningsCallTimestamp,
  initialLiquidity: ethers.parseUnits("500", 6).toString(),
});
```

## pAMM Virtual Liquidity Model

The PNP Protocol uses a **pAMM (Prediction AMM) virtual liquidity model** that ensures:

1. **Smooth Tradeability**: Even with minimal initial liquidity
2. **Self-Balancing**: Markets adjust through trading activity
3. **Capital Efficiency**: Virtual liquidity amplifies real deposits
4. **Fair Pricing**: Constant-product formula for price discovery

This makes it practical to create markets with relatively small initial liquidity while still providing good trading experiences.
