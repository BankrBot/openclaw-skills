#!/usr/bin/env npx ts-node
/**
 * Settle a prediction market with the winning outcome
 * Run with --help for usage
 */

import { PNPClient } from "pnp-evm";

interface Args {
  conditionId: string;
  outcome: "YES" | "NO";
  help?: boolean;
  status?: boolean;
}

function printHelp(): void {
  console.log(`
PNP Markets - Settle Market

USAGE:
  npx ts-node settle.ts [OPTIONS]

REQUIRED:
  --condition <id>          Market condition ID
  --outcome <YES|NO>        Winning outcome

OPTIONAL:
  --status                  Check settlement status only
  --help                    Show this help message

ENVIRONMENT:
  PRIVATE_KEY               Wallet private key (required, must be market creator)
  RPC_URL                   Base RPC endpoint (optional)

NOTE:
  Only the market creator can settle the market.
  Market can only be settled after the trading period ends.

EXAMPLES:
  # Settle market as YES
  npx ts-node settle.ts --condition 0x123... --outcome YES

  # Check if market is settled
  npx ts-node settle.ts --status --condition 0x123...
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
      case "--status":
        parsed.status = true;
        break;
      case "--condition":
        parsed.conditionId = args[++i];
        break;
      case "--outcome":
        parsed.outcome = args[++i]?.toUpperCase() as "YES" | "NO";
        break;
    }
  }

  return {
    conditionId: parsed.conditionId || "",
    outcome: parsed.outcome || "YES",
    help: parsed.help,
    status: parsed.status,
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
  console.log("\n📊 Market Status\n");

  const info = await client.market.getMarketInfo(args.conditionId);
  const isSettled = await client.redemption.isResolved(args.conditionId);

  console.log(`Question:   ${info.question}`);
  console.log(`End Time:   ${new Date(parseInt(info.endTime) * 1000).toISOString()}`);
  console.log(`Settled:    ${isSettled}`);

  if (isSettled) {
    const winningToken = await client.redemption.getWinningToken(args.conditionId);
    const yesTokenId = await client.trading.getTokenId(args.conditionId, "YES");
    const outcome = winningToken === yesTokenId.toString() ? "YES" : "NO";
    console.log(`Winner:     ${outcome}`);

    if (args.status) {
      console.log("\n--- JSON OUTPUT ---");
      console.log(JSON.stringify({ settled: true, winner: outcome }, null, 2));
    }
    process.exit(0);
  }

  if (args.status) {
    const now = Math.floor(Date.now() / 1000);
    const endTime = parseInt(info.endTime);
    const canSettle = now >= endTime;
    
    console.log(`\nCan Settle: ${canSettle}`);
    if (!canSettle) {
      const remaining = endTime - now;
      const hours = Math.floor(remaining / 3600);
      const mins = Math.floor((remaining % 3600) / 60);
      console.log(`Time Left:  ${hours}h ${mins}m`);
    }

    console.log("\n--- JSON OUTPUT ---");
    console.log(JSON.stringify({ settled: false, canSettle, endTime }, null, 2));
    process.exit(0);
  }

  // Validate settlement
  if (args.outcome !== "YES" && args.outcome !== "NO") {
    console.error("\nError: --outcome must be YES or NO");
    process.exit(1);
  }

  const now = Math.floor(Date.now() / 1000);
  if (now < parseInt(info.endTime)) {
    const remaining = parseInt(info.endTime) - now;
    const hours = Math.floor(remaining / 3600);
    const mins = Math.floor((remaining % 3600) / 60);
    console.error(`\n❌ Cannot settle yet. Trading ends in ${hours}h ${mins}m`);
    process.exit(1);
  }

  // Execute settlement
  console.log(`\n⚖️ Settling Market\n`);
  console.log(`Outcome:    ${args.outcome}`);
  console.log(`Wallet:     ${client.client.signer?.address}`);

  try {
    const winningTokenId = await client.trading.getTokenId(args.conditionId, args.outcome);
    const result = await client.market.settleMarket(args.conditionId, winningTokenId);

    console.log("\n✅ Market Settled!\n");
    console.log(`Winner:   ${args.outcome}`);
    console.log(`Tx Hash:  ${result.hash}`);
    console.log(`\nBaseScan: https://basescan.org/tx/${result.hash}`);

    console.log("\n--- JSON OUTPUT ---");
    console.log(JSON.stringify({ settled: true, winner: args.outcome, hash: result.hash }, null, 2));

  } catch (error: any) {
    console.error("\n❌ Settlement failed:", error.message);
    process.exit(1);
  }
}

main();
