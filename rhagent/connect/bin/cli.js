#!/usr/bin/env node
"use strict";

const { runOAuth } = require("../lib/oauth");
const {
  loadBankrApiKey,
  saveToBankr,
  copyToClipboard,
  PROXY_MCP_URL,
} = require("../lib/bankr");

function parseArgs(argv) {
  const opts = { setupMcp: true, noBankr: false, bankrApiKey: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--no-bankr") opts.noBankr = true;
    else if (a === "--no-mcp") opts.setupMcp = false;
    else if (a === "--bankr-api-key" && argv[i + 1]) {
      opts.bankrApiKey = argv[++i];
    } else if (a === "--help" || a === "-h") {
      console.log(`
RH Wallet Connect — Robinhood Agentic OAuth for Bankr

Usage:
  npx @rhwallet/connect
  npx @rhwallet/connect --no-mcp          Skip auto MCP server setup
  npx @rhwallet/connect --no-bankr        Print token only (no Bankr save)

Reads Bankr API key from ~/.bankr/config.json if you ran 'bankr login'.
`);
      process.exit(0);
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv);

  console.log("\n🟩 RH Wallet Connect");
  console.log("=".repeat(50));
  console.log("One-time Robinhood Agentic login for Bankr.\n");

  const tokens = await runOAuth({
    onStatus: (msg) => console.log(`→ ${msg}`),
  });

  console.log("\n✓ OAuth complete");

  const apiKey = opts.noBankr ? null : loadBankrApiKey(opts.bankrApiKey);

  if (apiKey) {
    console.log("→ Saving AGENTIC_TOKEN to your Bankr wallet...");
    try {
      const { mcpJob } = await saveToBankr({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        apiKey,
        setupMcp: opts.setupMcp,
      });
      console.log("✓ Saved AGENTIC_TOKEN to Bankr env");
      if (tokens.refreshToken) {
        console.log("✓ Saved AGENTIC_REFRESH_TOKEN to Bankr env");
      }
      if (opts.setupMcp) {
        if (mcpJob && mcpJob.error) {
          console.log("⚠ MCP auto-setup:", mcpJob.error);
          console.log("  Add manually in Bankr → MCP Servers:");
        } else if (mcpJob && mcpJob.jobId) {
          console.log("✓ Queued MCP server setup (job:", mcpJob.jobId + ")");
        } else {
          console.log("✓ MCP server setup requested");
        }
      }
    } catch (err) {
      console.error("⚠ Could not save to Bankr:", err.message);
      console.log("  Copy the token below and paste into Bankr → Env Vars manually.\n");
      copyToClipboard(tokens.accessToken);
      console.log("AGENTIC_TOKEN:");
      console.log("-".repeat(50));
      console.log(tokens.accessToken);
      console.log("-".repeat(50));
      console.log("(Also copied to clipboard if supported)\n");
    }
  } else {
    console.log("\nNo Bankr API key found.");
    console.log("Run 'bankr login' first, or paste token manually into Bankr env.\n");
    copyToClipboard(tokens.accessToken);
    console.log("(Token copied to clipboard on macOS/Windows if supported)\n");
  }

  if (!apiKey) {
    console.log("AGENTIC_TOKEN:");
    console.log("-".repeat(50));
    console.log(tokens.accessToken);
    console.log("-".repeat(50));
  }

  console.log("\nNext: ask Bankr");
  console.log('  "What is my Robinhood Agentic buying power?"');
  console.log("\nMCP proxy URL (if adding manually):");
  console.log(`  ${PROXY_MCP_URL}`);
  console.log("  Header: Authorization → Bearer {{AGENTIC_TOKEN}}\n");

  if (tokens.expiresIn) {
    console.log(`Token expires in ~${tokens.expiresIn}s — re-run this command when it expires.\n`);
  }
}

main().catch((err) => {
  console.error("\n✗", err.message);
  process.exit(1);
});
