# PNP Markets - Complete Examples

## Full Market Lifecycle

```typescript
import { PNPClient } from "pnp-evm";
import { ethers } from "ethers";

async function fullLifecycle() {
  const client = new PNPClient({
    rpcUrl: process.env.RPC_URL || "https://mainnet.base.org",
    privateKey: process.env.PRIVATE_KEY!,
  });

  // 1. CREATE MARKET
  console.log("Creating market...");
  const { conditionId, hash } = await client.market.createMarket({
    question: "Will our community reach 1000 members this month?",
    endTime: Math.floor(Date.now() / 1000) + 86400 * 7,
    initialLiquidity: ethers.parseUnits("50", 6).toString(),
  });
  console.log("Market created:", conditionId);

  // 2. CHECK PRICES
  const prices = await client.market.getMarketPrices(conditionId!);
  console.log("YES:", prices.yesPricePercent);
  console.log("NO:", prices.noPricePercent);

  // 3. BUY TOKENS
  const buyAmount = ethers.parseUnits("10", 6);
  await client.trading.buy(conditionId!, buyAmount, "YES");
  console.log("Bought YES tokens");

  // 4. SELL TOKENS (partial)
  const sellAmount = ethers.parseUnits("2", 18);
  await client.trading.sell(conditionId!, sellAmount, "YES");
  console.log("Sold some YES tokens");

  // 5. SETTLE (after endTime)
  const winningTokenId = await client.trading.getTokenId(conditionId!, "YES");
  await client.market.settleMarket(conditionId!, winningTokenId);
  console.log("Market settled as YES");

  // 6. REDEEM
  await client.redemption.redeem(conditionId!);
  console.log("Winnings redeemed");
}
```

## Custom Token Collateral

```typescript
import { PNPClient } from "pnp-evm";
import { ethers } from "ethers";

async function customTokenMarket() {
  const client = new PNPClient({
    rpcUrl: process.env.RPC_URL || "https://mainnet.base.org",
    privateKey: process.env.PRIVATE_KEY!,
  });

  const MY_TOKEN = "0xYourTokenAddress";
  const TOKEN_DECIMALS = 18;

  const { conditionId } = await client.market.createMarket({
    question: "Will our DAO pass Proposal #42?",
    endTime: Math.floor(Date.now() / 1000) + 86400 * 14,
    initialLiquidity: ethers.parseUnits("10000", TOKEN_DECIMALS).toString(),
    collateralToken: MY_TOKEN,
  });

  console.log("Market with custom token:", conditionId);
}
```

## Market Monitoring

```typescript
import { PNPClient } from "pnp-evm";

async function monitorMarket(conditionId: string) {
  const client = new PNPClient({
    rpcUrl: process.env.RPC_URL || "https://mainnet.base.org",
    privateKey: process.env.PRIVATE_KEY!,
  });

  const info = await client.market.getMarketInfo(conditionId);
  const prices = await client.market.getMarketPrices(conditionId);
  const isSettled = await client.redemption.isResolved(conditionId);

  return {
    question: info.question,
    endTime: new Date(parseInt(info.endTime) * 1000),
    yesPrice: prices.yesPricePercent,
    noPrice: prices.noPricePercent,
    reserve: info.reserve,
    isSettled,
  };
}
```

## Batch Market Creation

```typescript
import { PNPClient } from "pnp-evm";
import { ethers } from "ethers";

interface MarketConfig {
  question: string;
  durationHours: number;
  liquidity: string;
}

async function createBatchMarkets(configs: MarketConfig[]) {
  const client = new PNPClient({
    rpcUrl: process.env.RPC_URL || "https://mainnet.base.org",
    privateKey: process.env.PRIVATE_KEY!,
  });

  const results = [];

  for (const config of configs) {
    const endTime = Math.floor(Date.now() / 1000) + config.durationHours * 3600;
    const liquidity = ethers.parseUnits(config.liquidity, 6);

    const { conditionId, hash } = await client.market.createMarket({
      question: config.question,
      endTime,
      initialLiquidity: liquidity.toString(),
    });

    results.push({ question: config.question, conditionId, hash });
    
    // Wait between creations to avoid rate limits
    await new Promise(r => setTimeout(r, 2000));
  }

  return results;
}

// Usage
const markets = await createBatchMarkets([
  { question: "Will BTC hit $100k in 2025?", durationHours: 720, liquidity: "100" },
  { question: "Will ETH flip BTC by 2026?", durationHours: 8760, liquidity: "100" },
  { question: "Will Solana TPS exceed 100k?", durationHours: 2160, liquidity: "50" },
]);
```

## Trading Bot Pattern

```typescript
import { PNPClient } from "pnp-evm";
import { ethers } from "ethers";

async function simpleTradingStrategy(conditionId: string) {
  const client = new PNPClient({
    rpcUrl: process.env.RPC_URL || "https://mainnet.base.org",
    privateKey: process.env.PRIVATE_KEY!,
  });

  // Get current prices
  const prices = await client.market.getMarketPrices(conditionId);
  const yesPrice = parseFloat(prices.yesPrice);

  // Simple strategy: buy YES if price < 0.3, buy NO if price > 0.7
  const tradeAmount = ethers.parseUnits("5", 6);

  if (yesPrice < 0.3) {
    console.log("YES undervalued, buying...");
    await client.trading.buy(conditionId, tradeAmount, "YES");
  } else if (yesPrice > 0.7) {
    console.log("NO undervalued, buying...");
    await client.trading.buy(conditionId, tradeAmount, "NO");
  } else {
    console.log("No trade signal");
  }
}
```
