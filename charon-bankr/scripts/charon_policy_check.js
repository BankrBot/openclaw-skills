#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

function usage() {
  console.error("usage: node scripts/charon_policy_check.js action.json policy.json|policy.yml");
  process.exit(2);
}

function loadStructured(file) {
  const raw = fs.readFileSync(file, "utf8");
  if (/\.ya?ml$/i.test(file)) {
    try {
      return require("js-yaml").load(raw);
    } catch (error) {
      throw new Error(`YAML input requires js-yaml to be available: ${error.message}`);
    }
  }
  return JSON.parse(raw);
}

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function getPath(root, dottedPath) {
  return dottedPath.split(".").reduce((value, key) => {
    if (value && Object.prototype.hasOwnProperty.call(value, key)) return value[key];
    return undefined;
  }, root);
}

function resolveRef(value, policy) {
  if (typeof value === "string" && value.startsWith("$")) {
    return getPath(policy, value.slice(1));
  }
  return value;
}

function normalizeString(value) {
  return String(value || "").toLowerCase();
}

function includesNormalized(list, value) {
  const normalized = normalizeString(value);
  return asArray(list).map(normalizeString).includes(normalized);
}

function globToRegExp(glob) {
  const escaped = String(glob)
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\u0000")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0000/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function pathMatches(action, patterns) {
  const candidates = [...asArray(action.path), ...asArray(action.paths), ...asArray(action.target)]
    .filter((value) => value !== undefined && value !== null)
    .map(String);
  if (candidates.length === 0) return false;
  return asArray(patterns).some((pattern) => {
    const re = globToRegExp(pattern);
    return candidates.some((candidate) => re.test(candidate));
  });
}

function compareNumber(actionValue, expectedValue, operator) {
  const left = Number(actionValue);
  const right = Number(expectedValue);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  if (operator === "gt") return left > right;
  if (operator === "gte") return left >= right;
  if (operator === "lt") return left < right;
  if (operator === "lte") return left <= right;
  return false;
}

function actionMatches(ruleAction, actionType) {
  if (ruleAction === undefined || ruleAction === null || ruleAction === "*") return true;
  return asArray(ruleAction).some((candidate) => candidate === "*" || normalizeString(candidate) === normalizeString(actionType));
}

function conditionMatches(action, policy, key, expectedRaw) {
  const expected = resolveRef(expectedRaw, policy);
  if (key === "category_in") return includesNormalized(expected, action.category);
  if (key === "operation_in") return includesNormalized(expected, action.operation);
  if (key === "risk_in") return includesNormalized(expected, action.risk);
  if (key === "command_in") return includesNormalized(expected, action.command);
  if (key === "command_not_in") return !includesNormalized(expected, action.command);
  if (key === "path_glob") return pathMatches(action, expected);
  if (key === "contains_secret") return Boolean(action.contains_secret) === Boolean(expected);
  if (key === "amount_usd_gt") return compareNumber(action.amount_usd, expected, "gt");
  if (key === "amount_usd_gte") return compareNumber(action.amount_usd, expected, "gte");
  if (key === "amount_usd_lt") return compareNumber(action.amount_usd, expected, "lt");
  if (key === "amount_usd_lte") return compareNumber(action.amount_usd, expected, "lte");
  if (key === "chain_in") return includesNormalized(expected, action.chain);
  if (key === "chain_not_in") return !includesNormalized(expected, action.chain);
  if (key === "asset_in") return includesNormalized(expected, action.asset);
  if (key === "recipient_in") return includesNormalized(expected, action.recipient);
  if (key === "recipient_not_in") return !includesNormalized(expected, action.recipient);
  if (key === "type_in") return includesNormalized(expected, action.type);
  if (key === "method_in") return includesNormalized(expected, action.method);
  if (key === "domain_in") return includesNormalized(expected, action.domain);
  if (key === "domain_not_in") return !includesNormalized(expected, action.domain);
  if (key === "field_exists") return action[expected] !== undefined && action[expected] !== null && action[expected] !== "";
  if (key === "field_missing") return action[expected] === undefined || action[expected] === null || action[expected] === "";
  return false;
}

function matchesWhen(action, policy, when) {
  const entries = Object.entries(when || {});
  return entries.every(([key, expected]) => conditionMatches(action, policy, key, expected));
}

function evaluate(action, policy) {
  for (const rule of policy.rules || []) {
    if (!actionMatches(rule.action, action.type)) continue;
    if (!matchesWhen(action, policy, rule.when || {})) continue;
    return {
      verdict: String(rule.verdict || "PAUSE").toUpperCase(),
      matched_rule: rule.id || null,
      reason: rule.id ? `${rule.id} matched` : "rule matched",
    };
  }
  return {
    verdict: String(policy.default || "PASS").toUpperCase(),
    matched_rule: null,
    reason: "default verdict",
  };
}

function main() {
  const [, , actionFile, policyFile] = process.argv;
  if (!actionFile || !policyFile) usage();

  const action = loadStructured(path.resolve(actionFile));
  const policy = loadStructured(path.resolve(policyFile));
  const decision = evaluate(action, policy);
  process.stdout.write(`${JSON.stringify(decision, null, 2)}\n`);
  process.exit(decision.verdict === "DENY" ? 126 : decision.verdict === "PAUSE" ? 125 : 0);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { evaluate };
