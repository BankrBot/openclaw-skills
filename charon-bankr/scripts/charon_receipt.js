#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

function usage() {
  console.error("usage: node scripts/charon_receipt.js action.json verdict.json");
  process.exit(2);
}

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function receiptFor(action, decision, now = new Date()) {
  const executionAllowed = String(decision.verdict || "").toUpperCase() === "PASS";
  const unsigned = {
    schema: "charon.bankr.receipt.v1",
    created_at: now.toISOString(),
    action,
    decision: {
      verdict: String(decision.verdict || "PAUSE").toUpperCase(),
      matched_rule: decision.matched_rule || null,
      reason: decision.reason || null,
    },
    execution: {
      launched: false,
      status: executionAllowed ? "ready_to_launch" : "not_launched",
    },
  };
  const digest = crypto.createHash("sha256").update(stableJson(unsigned)).digest("hex");
  return { receipt_id: `sha256:${digest}`, ...unsigned };
}

function main() {
  const [, , actionFile, decisionFile] = process.argv;
  if (!actionFile || !decisionFile) usage();

  const action = loadJson(path.resolve(actionFile));
  const decision = loadJson(path.resolve(decisionFile));
  process.stdout.write(`${JSON.stringify(receiptFor(action, decision), null, 2)}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { receiptFor, stableJson };
