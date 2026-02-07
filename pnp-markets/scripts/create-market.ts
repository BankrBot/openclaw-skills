#!/usr/bin/env npx ts-node
/**
 * Create a prediction market on Base
 * Run with --help for usage
 */

import { PNPClient } from "pnp-evm";
import { ethers } from "ethers";

// Token addresses on Base Mainnet
const TOKENS: Record<string, { address: string; decimals: number }> = {
  USDC: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
  WETH: { address: "0x4200000000000000000000000000000000000006", decimals: 18 },
  cbETH: { address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22", decimals: 18 },
};

interface Args {
  question: string;
  durationHours: number;
  liquidity: string;
  collateral: string;
  decimals?: number;
  help?: boolean;
}

function printHelp(): void {
  console.log(`
PNP Markets - Create Prediction Market

USAGE:
  npx ts-node create-market.ts [OPTIONS]

REQUIRED:
  --question <string>       The prediction question
  --duration <hours>        Trading duration in hours
  --liquidity <amount>      Initial liquidity amount

OPTIONAL:
  --collateral <token>      Collateral token: USDC (default), WETH, cbETH, or address
  --decimals <number>       Token decimals (auto-detected for known tokens)
  --help                    Show this help message

ENVIRONMENT:
  PRIVATE_KEY               Wallet private key (required)
  RPC_URL                   Base RPC endpoint (optional, defaults to public RPC)

EXAMPLES:
  # Create market with USDC (default)
  npx ts-node create-market.ts \\
    --question "Will ETH reach \$10k by Dec 2025?" \\
    --duration 168 \\
    --liquidity 100

  # Create market with custom token
  npx ts-node create-market.ts \\
    --question "Will our token hit 1000 holders?" \\
    --duration 720 \\
    --liquidity 1000 \\
    --collateral 0xYourTokenAddress \\
    --decimals 18
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
      case "--question":
        parsed.question = args[++i];
        break;
      case "--duration":
        parsed.durationHours = parseInt(args[++i], 10);
        break;
      case "--liquidity":
        parsed.liquidity = args[++i];
        break;
      case "--collateral":
        parsed.collateral = args[++i];
        break;
      case "--decimals":
        parsed.decimals = parseInt(args[++i], 10);
        break;
    }
  }

  return {
    question: parsed.question || "",
    durationHours: parsed.durationHours || 0,
    liquidity: parsed.liquidity || "0",
    collateral: parsed.collateral || "USDC",
    decimals: parsed.decimals,
    help: parsed.help,
  };
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  // Validate required args
  if (!args.question) {
    console.error("Error: --question is required");
    printHelp();
    process.exit(1);
  }
  if (!args.durationHours || args.durationHours <= 0) {
    console.error("Error: --duration must be a positive number");
    process.exit(1);
  }
  if (!args.liquidity || parseFloat(args.liquidity) <= 0) {
    console.error("Error: --liquidity must be a positive number");
    process.exit(1);
  }
  if (!process.env.PRIVATE_KEY) {
    console.error("Error: PRIVATE_KEY environment variable is required");
    process.exit(1);
  }

  // Resolve collateral token
  let collateralAddress: string;
  let decimals: number;

  if (TOKENS[args.collateral.toUpperCase()]) {
    const token = TOKENS[args.collateral.toUpperCase()];
    collateralAddress = token.address;
    decimals = args.decimals ?? token.decimals;
  } else if (args.collateral.startsWith("0x")) {
    collateralAddress = args.collateral;
    decimals = args.decimals ?? 18;
  } else {
    console.error(`Error: Unknown token "${args.collateral}". Use USDC, WETH, cbETH, or a contract address.`);
    process.exit(1);
  }

  // Initialize client
  const client = new PNPClient({
    rpcUrl: process.env.RPC_URL || "https://mainnet.base.org",
    privateKey: process.env.PRIVATE_KEY,
  });

  // Calculate parameters
  const endTime = Math.floor(Date.now() / 1000) + args.durationHours * 3600;
  const liquidityWei = ethers.parseUnits(args.liquidity, decimals);

  console.log("\n🎯 Creating Prediction Market\n");
  console.log(`Question:    ${args.question}`);
  console.log(`Duration:    ${args.durationHours} hours`);
  console.log(`End Time:    ${new Date(endTime * 1000).toISOString()}`);
  console.log(`Liquidity:   ${args.liquidity} tokens`);
  console.log(`Collateral:  ${collateralAddress}`);
  console.log(`Wallet:      ${client.client.signer?.address}\n`);

  try {
    const { conditionId, hash } = await client.market.createMarket({
      question: args.question,
      endTime,
      initialLiquidity: liquidityWei.toString(),
      collateralToken: collateralAddress,
    });

    console.log("✅ Market Created!\n");
    console.log(`Condition ID: ${conditionId}`);
    console.log(`Tx Hash:      ${hash}`);
    console.log(`\nBaseScan:     https://basescan.org/tx/${hash}`);

    // Output JSON for programmatic use
    console.log("\n--- JSON OUTPUT ---");
    console.log(JSON.stringify({ conditionId, hash, endTime }, null, 2));

  } catch (error: any) {
    console.error("\n❌ Failed:", error.message);
    process.exit(1);
  }
}

main();
