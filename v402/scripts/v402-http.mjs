#!/usr/bin/env node

import { fileURLToPath } from "url";
import { checkPolicy, recordPayment, getBudget } from "./v402-policy.mjs";
import { submitPayment } from "./v402-pay.mjs";

// ---------------------------------------------------------------------------
// Header parsing helpers
// ---------------------------------------------------------------------------

function findHeader(headers, name) {
  const lower = name.toLowerCase();
  for (const [k, v] of headers.entries()) {
    if (k.toLowerCase() === lower) return v;
  }
  return null;
}

function tryParseJson(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Exported — full automated 402 flow
// ---------------------------------------------------------------------------

export async function callWithPayment({ url, method = "GET", body, headers = {} }) {
  const reqHeaders = { ...headers };
  if (body && !reqHeaders["content-type"]) {
    reqHeaders["content-type"] = "application/json";
  }

  // Step 1 — initial request
  const res1 = await fetch(url, {
    method,
    headers: reqHeaders,
    body: body ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
  });

  // Not a 402 — return the response directly
  if (res1.status !== 402) {
    let resBody;
    const ct = res1.headers.get("content-type") || "";
    if (ct.includes("json")) {
      resBody = await res1.json();
    } else {
      resBody = await res1.text();
    }
    return { success: res1.ok, status: res1.status, body: resBody, paid: false };
  }

  // Step 2 — parse V402-Intent
  const intentRaw =
    findHeader(res1.headers, "V402-Intent") ||
    findHeader(res1.headers, "v402-intent");

  if (!intentRaw) {
    return { error: "402 received but no V402-Intent header found" };
  }

  const intent = tryParseJson(intentRaw);
  if (!intent) {
    return { error: "Could not parse V402-Intent header as JSON" };
  }

  // Step 3 — check expiry
  if (intent.expires_at && intent.expires_at < Math.floor(Date.now() / 1000)) {
    return { error: "Intent has expired", intent };
  }

  const amount = parseFloat(intent.amount);

  // Step 4 — policy check
  const policy = checkPolicy(amount, intent.tool_id, intent.merchant);
  if (!policy.allowed) {
    return { blocked: true, reason: policy.reason, intent };
  }

  // Step 5 — submit payment
  const payment = await submitPayment({
    amount,
    merchant: intent.merchant,
    intentId: intent.id,
    toolId: intent.tool_id,
  });

  if (!payment.success) {
    return { error: `Payment failed: ${payment.error}`, intent };
  }

  // Step 6 — retry with V402-Payment header
  const retryHeaders = {
    ...reqHeaders,
    "V402-Payment": JSON.stringify({
      intent_id: intent.id,
      tx_signature: payment.tx_signature,
      payer: payment.payer,
    }),
  };

  const res2 = await fetch(url, {
    method,
    headers: retryHeaders,
    body: body ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
  });

  let resBody;
  const ct = res2.headers.get("content-type") || "";
  if (ct.includes("json")) {
    resBody = await res2.json();
  } else {
    resBody = await res2.text();
  }

  // Step 7 — extract receipt
  const receiptRaw =
    findHeader(res2.headers, "V402-Receipt") ||
    findHeader(res2.headers, "v402-receipt");
  const receipt = receiptRaw ? tryParseJson(receiptRaw) : null;

  const budget = getBudget();

  return {
    success: res2.ok,
    status: res2.status,
    body: resBody,
    payment: {
      amount,
      currency: intent.currency || "USDC",
      tx_signature: payment.tx_signature,
      confirmed_ms: payment.confirmed_ms,
      intent_id: intent.id,
    },
    receipt,
    budget: {
      spent_today: budget.spent_today,
      remaining: budget.remaining,
    },
  };
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

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  if (command !== "call") {
    console.log(JSON.stringify({ error: `Unknown command: ${command}. Use call` }));
    process.exit(1);
  }

  try {
    const result = await callWithPayment({
      url: args.url,
      method: args.method || "GET",
      body: args.body ? JSON.parse(args.body) : undefined,
      headers: args.headers ? JSON.parse(args.headers) : {},
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.log(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
