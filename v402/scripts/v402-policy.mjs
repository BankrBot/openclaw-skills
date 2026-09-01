#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(__dirname, ".v402-state.json");

// ---------------------------------------------------------------------------
// Config — read from environment
// ---------------------------------------------------------------------------

function getConfig() {
  return {
    dailyCap: parseFloat(process.env.V402_DAILY_CAP || "5.0"),
    perCallCap: parseFloat(process.env.V402_PER_CALL_CAP || "1.0"),
    allowedTools: (process.env.V402_ALLOWED_TOOLS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    allowedMerchants: (process.env.V402_ALLOWED_MERCHANTS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

// ---------------------------------------------------------------------------
// State persistence
// ---------------------------------------------------------------------------

function todayUTC() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export function loadState() {
  if (!existsSync(STATE_FILE)) {
    return { payments: [], dailySpent: 0, dayStart: todayUTC() };
  }
  const state = JSON.parse(readFileSync(STATE_FILE, "utf8"));
  if (state.dayStart !== todayUTC()) {
    state.dailySpent = 0;
    state.dayStart = todayUTC();
  }
  return state;
}

function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ---------------------------------------------------------------------------
// Exported functions (used by v402-http.mjs and tests)
// ---------------------------------------------------------------------------

export function checkPolicy(amount, toolId, merchant) {
  const cfg = getConfig();

  if (!Number.isFinite(amount) || amount <= 0) {
    return { allowed: false, reason: "Invalid amount: " + amount };
  }

  if (amount > cfg.perCallCap) {
    return {
      allowed: false,
      reason: `Amount ${amount} exceeds per-call cap ${cfg.perCallCap}`,
    };
  }

  if (cfg.allowedTools.length > 0 && (!toolId || !cfg.allowedTools.includes(toolId))) {
    return {
      allowed: false,
      reason: `Tool "${toolId}" not in allowed list [${cfg.allowedTools.join(", ")}]`,
    };
  }

  if (cfg.allowedMerchants.length > 0 && (!merchant || !cfg.allowedMerchants.includes(merchant))) {
    return {
      allowed: false,
      reason: `Merchant "${merchant}" not in allowed list [${cfg.allowedMerchants.join(", ")}]`,
    };
  }

  const state = loadState();
  if (state.dailySpent + amount > cfg.dailyCap) {
    return {
      allowed: false,
      reason: `Daily cap would be exceeded: spent ${state.dailySpent} + ${amount} > cap ${cfg.dailyCap}`,
    };
  }

  return { allowed: true, reason: "ok" };
}

export function recordPayment({ amount, toolId, merchant, txSignature, intentId }) {
  const state = loadState();
  state.payments.push({
    amount,
    tool_id: toolId,
    merchant,
    tx_signature: txSignature,
    intent_id: intentId,
    timestamp: new Date().toISOString(),
  });
  state.dailySpent += amount;
  saveState(state);
  return { recorded: true };
}

export function getBudget() {
  const cfg = getConfig();
  const state = loadState();
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);

  return {
    daily_cap: cfg.dailyCap,
    per_call_cap: cfg.perCallCap,
    spent_today: state.dailySpent,
    remaining: Math.max(0, cfg.dailyCap - state.dailySpent),
    allowed_tools: cfg.allowedTools.length > 0 ? cfg.allowedTools : "all",
    allowed_merchants: cfg.allowedMerchants.length > 0 ? cfg.allowedMerchants : "all",
    resets_at: tomorrow.toISOString(),
  };
}

export function getHistory(limit) {
  const state = loadState();
  const payments = limit ? state.payments.slice(-limit) : state.payments;
  return { total: state.payments.length, payments };
}

export function resetState() {
  if (existsSync(STATE_FILE)) {
    writeFileSync(STATE_FILE, JSON.stringify({ payments: [], dailySpent: 0, dayStart: todayUTC() }, null, 2));
  }
  return { reset: true };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const map = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--") && i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
      map[argv[i].slice(2)] = argv[i + 1];
      i++;
    }
  }
  return map;
}

function main() {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  switch (command) {
    case "check": {
      const amount = parseFloat(args.amount || "0");
      const result = checkPolicy(amount, args.tool_id, args.merchant);
      console.log(JSON.stringify(result));
      break;
    }
    case "budget": {
      console.log(JSON.stringify(getBudget()));
      break;
    }
    case "history": {
      const limit = args.limit ? parseInt(args.limit) : undefined;
      console.log(JSON.stringify(getHistory(limit)));
      break;
    }
    case "record": {
      const result = recordPayment({
        amount: parseFloat(args.amount || "0"),
        toolId: args.tool_id,
        merchant: args.merchant,
        txSignature: args.tx_signature,
        intentId: args.intent_id,
      });
      console.log(JSON.stringify(result));
      break;
    }
    case "reset": {
      console.log(JSON.stringify(resetState()));
      break;
    }
    default:
      console.log(JSON.stringify({ error: `Unknown command: ${command}. Use check|budget|history|record|reset` }));
      process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
