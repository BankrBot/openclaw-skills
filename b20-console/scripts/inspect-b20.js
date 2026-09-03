#!/usr/bin/env node
"use strict";

const DEFAULT_API = "https://b20.charon.codes/api/inspect";
const MAX_UINT128 = "340282366920938463463374607431768211455";
const AUTO_CHAINS = ["base", "base-sepolia"];
const SUPPORTED_CHAINS = new Set(["auto", ...AUTO_CHAINS]);
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const BYTES32_RE = /^0x[a-fA-F0-9]{64}$/;

const RISK_DESCRIPTIONS = {
  b20_features_inactive: "B20 feature state is not active on this chain.",
  not_b20: "The B20 factory does not recognize this contract as B20.",
  not_initialized: "The B20 factory reports this contract is not initialized.",
  supply_cap_unknown: "Supply cap could not be read.",
  supply_cap_unbounded: "Supply cap is set to the B20 max sentinel.",
  supply_exceeds_cap: "Total supply is greater than the reported cap.",
  permit_incomplete: "Permit / EIP-712 state is incomplete.",
};

const ERROR_DESCRIPTIONS = {
  INVALID_ADDRESS: "Address is not a 0x-prefixed 40-byte EVM address.",
  NO_CONTRACT: "No deployed contract exists at this address on the selected chain.",
  NOT_B20: "Contract exists, but the B20 factory does not recognize it.",
  UNSUPPORTED_CHAIN: "Selected chain is not supported by this skill.",
  RPC_TIMEOUT: "RPC request timed out.",
  RPC_RATE_LIMITED: "RPC rate limit was hit.",
  RPC_NETWORK_ERROR: "RPC network request failed.",
  READ_FAILED: "Required onchain read failed.",
  INTERNAL_ERROR: "B20 Console request failed.",
  HTTP_400: "B20 Console rejected the request.",
  HTTP_422: "B20 Console could not produce a normal report.",
  HTTP_500: "B20 Console server error.",
};

const POLICY_LABELS = new Set(["ALWAYS_ALLOW", "ALWAYS_BLOCK", "CUSTOM"]);
const POLICY_SCOPES = new Set([
  "TRANSFER_SENDER_POLICY",
  "TRANSFER_RECEIVER_POLICY",
  "TRANSFER_EXECUTOR_POLICY",
  "MINT_RECEIVER_POLICY",
]);
const PAUSE_FEATURES = new Set(["TRANSFER", "MINT", "BURN"]);

function usage() {
  console.error("usage: node scripts/inspect-b20.js <address> [--chain auto|base-sepolia|base] [--source] [--json]");
  process.exit(2);
}

function parseArgs(argv) {
  const args = {
    address: null,
    chain: "auto",
    source: false,
    json: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--chain") {
      args.chain = argv[++i];
    } else if (arg === "--source") {
      args.source = true;
    } else if (arg === "--json") {
      args.json = true;
    } else if (!args.address) {
      args.address = arg;
    } else {
      usage();
    }
  }

  if (!args.address || !args.chain) usage();
  if (!SUPPORTED_CHAINS.has(args.chain)) {
    console.error("unsupported chain. use --chain auto, --chain base-sepolia, or --chain base");
    process.exit(2);
  }
  if (!ADDRESS_RE.test(args.address)) {
    console.error("B20 Console result: INVALID_ADDRESS\nAddress is not a 0x-prefixed 40-byte EVM address.");
    process.exit(2);
  }
  args.address = normalizeAddress(args.address);
  return args;
}

function asText(value, fallback = "-") {
  if (value === undefined || value === null || value === "") return fallback;
  return sanitize(value, 80, fallback);
}

function sanitize(value, max = 80, fallback = "-") {
  if (value === undefined || value === null || value === "") return fallback;
  const text = String(value).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/[`<>]/g, "").replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function normalizeAddress(value) {
  return `0x${String(value).slice(2).toLowerCase()}`;
}

function normalizeHash(value) {
  return BYTES32_RE.test(String(value || "")) ? `0x${String(value).slice(2).toLowerCase()}` : null;
}

function featuresState(activation) {
  if (!activation) return "unknown";
  return activation.asset || activation.stablecoin ? "active" : "inactive";
}

function formatSupplyCap(token) {
  const value = token.supplyCapFormatted || token.supplyCap;
  if (String(value) === MAX_UINT128) return "unbounded";
  return asText(value, "unknown");
}

function riskReason(reason) {
  const rawId = String(reason?.id || reason?.code || "unknown");
  let description = RISK_DESCRIPTIONS[rawId];
  if (!description && rawId.startsWith("policy_read_failed.")) description = "A policy registry read failed.";
  if (!description && rawId.startsWith("read_warning.")) description = "An inspection read returned a warning.";
  if (!description && rawId.startsWith("pause_read_failed.")) description = "Pause state could not be read.";
  if (!description && rawId.startsWith("policy_custom.")) description = "A custom policy is attached.";
  if (!description && rawId.startsWith("policy_always_block.")) description = "A policy blocks every matching operation.";
  if (!description && rawId.startsWith("policy_missing.")) description = "Expected policy state is missing.";
  if (!description && rawId.startsWith("policy_admin.")) description = "Policy has an active admin.";
  if (!description && rawId.startsWith("policy_pending_admin.")) description = "Policy has a pending admin transfer.";
  if (!description && rawId.startsWith("paused.")) description = "A B20 feature is paused.";
  if (!description) description = "B20 Console reported this local risk code.";
  return { id: sanitize(rawId, 72, "unknown"), description };
}

function policySummary(report) {
  const entries = Array.isArray(report.policies) ? report.policies : Object.values(report.policies || {});
  if (entries.length === 0) return ["policies: not loaded"];
  return entries.map((value) => {
    const scope = POLICY_SCOPES.has(value?.scope) ? value.scope : "UNKNOWN_POLICY_SCOPE";
    const label = POLICY_LABELS.has(value?.label) ? value.label : "UNKNOWN_POLICY";
    return `${scope}: ${label}`;
  });
}

function pauseSummary(report) {
  const entries = Array.isArray(report.pause) ? report.pause : Object.values(report.pause || {});
  if (entries.length === 0) return ["pause: not loaded"];
  return entries.map((value) => {
    const feature = PAUSE_FEATURES.has(value?.feature) ? value.feature : "UNKNOWN_FEATURE";
    return `${feature}: ${value?.paused ? "paused" : "active"}`;
  });
}

function sanitizeReport(report) {
  const risk = report.risk || {};
  const token = report.token || {};
  const chain = report.chain || {};
  const source = report.source || {};
  const reasons = Array.isArray(risk.reasons) ? risk.reasons : [];

  return {
    result: {
      level: ["low", "medium", "high", "unknown"].includes(risk.level) ? risk.level : "unknown",
      score: Number.isFinite(Number(risk.score)) ? Number(risk.score) : null,
      methodology: risk.methodology === "deterministic_rules_v1" ? risk.methodology : "unknown",
    },
    state: {
      chain: ["base", "base-sepolia"].includes(chain.key) ? chain.key : "unknown",
      isB20: Boolean(token.isB20),
      initialized: Boolean(token.initialized),
      features: featuresState(report.activation),
      tokenName: asText(token.name, "unknown"),
      tokenSymbol: asText(token.symbol, "unknown"),
      tokenAddress: ADDRESS_RE.test(String(token.address || "")) ? normalizeAddress(token.address) : "unknown",
      supplyCap: formatSupplyCap(token),
    },
    riskFlags: reasons.map(riskReason),
    policies: policySummary(report),
    pause: pauseSummary(report),
    source: {
      block: source.creationBlock || source.createdBlock ? sanitize(source.creationBlock || source.createdBlock, 24, "unknown") : null,
      tx: normalizeHash(source.creationTx || source.transactionHash),
    },
  };
}

function format(report) {
  const safe = sanitizeReport(report);
  const lines = [];
  lines.push(`B20 Console result: ${safe.result.level} risk (${safe.result.score ?? "unknown"})`);
  lines.push("");
  lines.push("State:");
  lines.push(`- chain: ${safe.state.chain}`);
  lines.push(`- B20: ${safe.state.isB20 ? "yes" : "no"}`);
  lines.push(`- initialized: ${safe.state.initialized ? "yes" : "no"}`);
  lines.push(`- features: ${safe.state.features}`);
  lines.push(`- token: ${safe.state.tokenName} (${safe.state.tokenSymbol})`);
  lines.push(`- supply cap: ${safe.state.supplyCap}`);

  lines.push("");
  lines.push("Risk flags:");
  if (safe.riskFlags.length === 0) {
    lines.push("- none");
  } else {
    for (const reason of safe.riskFlags) lines.push(`- ${reason.id}: ${reason.description}`);
  }

  lines.push("");
  lines.push("Policies:");
  for (const line of safe.policies) lines.push(`- ${line}`);

  lines.push("");
  lines.push("Pause:");
  for (const line of safe.pause) lines.push(`- ${line}`);

  if (safe.source.tx || safe.source.block) {
    lines.push("");
    lines.push("Source:");
    lines.push(`- block: ${safe.source.block || "unknown"}`);
    lines.push(`- tx: ${safe.source.tx || "unknown"}`);
  }

  return `${lines.join("\n")}\n`;
}

async function inspect(address, chain, source) {
  const url = new URL(DEFAULT_API);
  url.searchParams.set("chain", chain);
  url.searchParams.set("address", address);
  if (source) url.searchParams.set("source", "1");

  const response = await fetch(url, {
    headers: { accept: "application/json" },
  });

  const payload = await response.json().catch(() => null);
  return { chain, response, payload };
}

function errorCode(result) {
  const rawCode = result.payload?.error?.code || result.payload?.code || `HTTP_${result.response.status}`;
  const code = sanitize(rawCode, 32, "INTERNAL_ERROR").replace(/[^A-Z0-9_]/gi, "_").toUpperCase();
  return ERROR_DESCRIPTIONS[code] ? code : "INTERNAL_ERROR";
}

async function inspectAuto(args) {
  const results = await Promise.all(AUTO_CHAINS.map((chain) => inspect(args.address, chain, args.source)));
  const ok = results.filter((result) => result.response.ok && result.payload?.token?.isB20);

  if (ok.length > 0) return ok[0].payload;

  const nonB20 = results.find((result) => errorCode(result) === "NOT_B20");
  const noContract = results.find((result) => errorCode(result) === "NO_CONTRACT");
  return (nonB20 || noContract || results[0]).payload;
}

async function main() {
  const args = parseArgs(process.argv);
  let payload;
  let response;

  if (args.chain === "auto") {
    payload = await inspectAuto(args);
    response = { ok: !payload?.error };
  } else {
    const result = await inspect(args.address, args.chain, args.source);
    payload = result.payload;
    response = result.response;
  }

  if (!response.ok) {
    const code = errorCode({ response, payload });
    const message = ERROR_DESCRIPTIONS[code] || "B20 Console request failed.";
    if (args.json) {
      process.stdout.write(`${JSON.stringify({ result: { code, message } }, null, 2)}\n`);
    } else {
      process.stdout.write(`B20 Console result: ${code}\n${message}\n`);
    }
    process.exit(1);
  }

  if (args.json) {
    process.stdout.write(`${JSON.stringify(sanitizeReport(payload), null, 2)}\n`);
  } else {
    process.stdout.write(format(payload));
  }
}

main().catch((error) => {
  const code = error?.code && ERROR_DESCRIPTIONS[error.code] ? error.code : "RPC_NETWORK_ERROR";
  console.error(`B20 Console result: ${code}\n${ERROR_DESCRIPTIONS[code]}`);
  process.exit(1);
});
