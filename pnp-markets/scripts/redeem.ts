#!/usr/bin/env npx ts-node
/**
 * Redeem winning tokens for collateral after settlement
 * Run with --help for usage
 */

import { PNPClient } from "pnp-evm";

interface Args {
  conditionId: string;
  help?: boolean;
}

function printHelp(): void {
  console.log(`
PNP Markets - Redeem Winnings

USAGE:
  npx ts-node redeem.ts --condition <id>

REQUIRED:
  --condition <id>          Market condition ID

OPTIONAL:
  --help                    Show this help message

ENVIRONMENT:
  PRIVATE_KEY               Wallet private key (required)
  RPC_URL                   Base RPC endpoint (optional)

NOTE:
  Can only redeem after market is settled.
  Must hold winning outcome tokens to redeem.

EXAMPLES:
  npx ts-node redeem.ts --condition 0x123...
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
      case "--condition":
        parsed.conditionId = args[++i];
        break;
    }
  }

  return {
    conditionId: parsed.conditionId || "",
    help: parsed.help,
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

  // Check settlement status
  console.log("\n📊 Checking Market\n");

  const isSettled = await client.redemption.isResolved(args.conditionId);

  if (!isSettled) {
    const info = await client.market.getMarketInfo(args.conditionId);
    console.log(`Question: ${info.question}`);
    console.error("\n❌ Market is not yet settled. Cannot redeem.");
    process.exit(1);
  }

  // Get winning info
  const info = await client.market.getMarketInfo(args.conditionId);
  const winningToken = await client.redemption.getWinningToken(args.conditionId);
  const yesTokenId = await client.trading.getTokenId(args.conditionId, "YES");
  const winner = winningToken === yesTokenId.toString() ? "YES" : "NO";

  console.log(`Question:   ${info.question}`);
  console.log(`Winner:     ${winner}`);
  console.log(`Collateral: ${info.collateral}`);

  // Execute redemption
  console.log(`\n💰 Redeeming Position\n`);
  console.log(`Wallet:     ${client.client.signer?.address}`);

  try {
    const result = await client.redemption.redeem(args.conditionId);

    console.log("\n✅ Redemption Successful!\n");
    console.log(`Tx Hash:  ${result.hash}`);
    console.log(`\nBaseScan: https://basescan.org/tx/${result.hash}`);

    console.log("\n--- JSON OUTPUT ---");
    console.log(JSON.stringify({ redeemed: true, hash: result.hash }, null, 2));

  } catch (error: any) {
    console.error("\n❌ Redemption failed:", error.message);
    process.exit(1);
  }
}

main();
