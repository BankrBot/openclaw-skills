#!/usr/bin/env npx ts-node
/**
 * Trade on a prediction market (buy/sell YES or NO tokens)
 * Run with --help for usage
 */

import { PNPClient } from "pnp-evm";
import { ethers } from "ethers";

interface Args {
  conditionId: string;
  action: "buy" | "sell";
  outcome: "YES" | "NO";
  amount: string;
  decimals: number;
  minOut: string;
  help?: boolean;
  info?: boolean;
}

function printHelp(): void {
  console.log(`
PNP Markets - Trade on Market

USAGE:
  npx ts-node trade.ts [OPTIONS]

ACTIONS:
  --buy                     Buy outcome tokens with collateral
  --sell                    Sell outcome tokens for collateral

REQUIRED:
  --condition <id>          Market condition ID
  --outcome <YES|NO>        Outcome to trade
  --amount <number>         Amount to trade

OPTIONAL:
  --decimals <number>       Token decimals (default: 6 for buy, 18 for sell)
  --min-out <number>        Minimum output for slippage protection (default: 0)
  --info                    Show market info only, don't trade
  --help                    Show this help message

ENVIRONMENT:
  PRIVATE_KEY               Wallet private key (required)
  RPC_URL                   Base RPC endpoint (optional)

EXAMPLES:
  # Buy YES tokens with 10 USDC
  npx ts-node trade.ts --buy --condition 0x123... --outcome YES --amount 10

  # Sell 5 NO tokens
  npx ts-node trade.ts --sell --condition 0x123... --outcome NO --amount 5 --decimals 18

  # Check market prices
  npx ts-node trade.ts --info --condition 0x123...
`);
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const parsed: Partial<Args> = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--help":
      case "-h":
        parsed.help = true;
        break;
      case "--info":
        parsed.info = true;
        break;
      case "--buy":
        parsed.action = "buy";
        break;
      case "--sell":
        parsed.action = "sell";
        break;
      case "--condition":
        parsed.conditionId = args[++i];
        break;
      case "--outcome":
        parsed.outcome = args[++i]?.toUpperCase() as "YES" | "NO";
        break;
      case "--amount":
        parsed.amount = args[++i];
        break;
      case "--decimals":
        parsed.decimals = parseInt(args[++i], 10);
        break;
      case "--min-out":
        parsed.minOut = args[++i];
        break;
    }
  }

  return {
    conditionId: parsed.conditionId || "",
    action: parsed.action || "buy",
    outcome: parsed.outcome || "YES",
    amount: parsed.amount || "0",
    decimals: parsed.decimals ?? (parsed.action === "sell" ? 18 : 6),
    minOut: parsed.minOut || "0",
    help: parsed.help,
    info: parsed.info,
  };
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (!args.conditionId) {
    console.error("Error: --condition is required");
    printHelp();
    process.exit(1);
  }

  if (!process.env.PRIVATE_KEY) {
    console.error("Error: PRIVATE_KEY environment variable is required");
    process.exit(1);
  }

  const client = new PNPClient({
    rpcUrl: process.env.RPC_URL || "https://mainnet.base.org",
    privateKey: process.env.PRIVATE_KEY,
  });

  // Fetch market info
  console.log("\n📊 Market Info\n");
  
  const info = await client.market.getMarketInfo(args.conditionId);
  const prices = await client.market.getMarketPrices(args.conditionId);

  console.log(`Question:   ${info.question}`);
  console.log(`End Time:   ${new Date(parseInt(info.endTime) * 1000).toISOString()}`);
  console.log(`Settled:    ${info.isSettled}`);
  console.log(`YES Price:  ${prices.yesPricePercent}`);
  console.log(`NO Price:   ${prices.noPricePercent}`);

  if (args.info) {
    console.log("\n--- JSON OUTPUT ---");
    console.log(JSON.stringify({ ...info, prices }, null, 2));
    process.exit(0);
  }

  // Validate trade params
  if (!args.amount || parseFloat(args.amount) <= 0) {
    console.error("\nError: --amount must be a positive number");
    process.exit(1);
  }

  if (args.outcome !== "YES" && args.outcome !== "NO") {
    console.error("\nError: --outcome must be YES or NO");
    process.exit(1);
  }

  // Check if tradeable
  const now = Math.floor(Date.now() / 1000);
  if (now >= parseInt(info.endTime)) {
    console.error("\n❌ Market trading period has ended");
    process.exit(1);
  }
  if (info.isSettled) {
    console.error("\n❌ Market is already settled");
    process.exit(1);
  }

  const amount = ethers.parseUnits(args.amount, args.decimals);
  const minOut = ethers.parseUnits(args.minOut, args.action === "buy" ? 18 : args.decimals);

  console.log(`\n💱 Executing ${args.action.toUpperCase()}\n`);
  console.log(`Action:     ${args.action.toUpperCase()} ${args.outcome}`);
  console.log(`Amount:     ${args.amount}`);
  console.log(`Wallet:     ${client.client.signer?.address}`);

  try {
    let result;
    if (args.action === "buy") {
      result = await client.trading.buy(args.conditionId, amount, args.outcome, minOut);
    } else {
      result = await client.trading.sell(args.conditionId, amount, args.outcome, minOut);
    }

    console.log("\n✅ Trade Executed!\n");
    console.log(`Tx Hash: ${result.hash}`);
    console.log(`\nBaseScan: https://basescan.org/tx/${result.hash}`);

    // Show updated prices
    const newPrices = await client.market.getMarketPrices(args.conditionId);
    console.log(`\nUpdated Prices:`);
    console.log(`  YES: ${newPrices.yesPricePercent}`);
    console.log(`  NO:  ${newPrices.noPricePercent}`);

  } catch (error: any) {
    console.error("\n❌ Trade failed:", error.message);
    process.exit(1);
  }
}

main();
