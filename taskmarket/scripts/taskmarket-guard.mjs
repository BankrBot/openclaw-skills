#!/usr/bin/env node

import { readFileSync } from "node:fs";

const [, , operation, inputPath] = process.argv;

function fail(message) {
  process.stderr.write(`${JSON.stringify({ ok: false, error: message })}\n`);
  process.exit(1);
}

function readJson(path) {
  if (!path) fail("Provide a JSON file path or - for stdin.");
  const source = path === "-" ? readFileSync(0, "utf8") : readFileSync(path, "utf8");
  try {
    return JSON.parse(source);
  } catch {
    fail("Input is not valid JSON.");
  }
}

function hasSensitiveKey(value) {
  if (!value || typeof value !== "object") return false;
  for (const [key, child] of Object.entries(value)) {
    if (/(private.?key|seed|mnemonic|password|secret|token|cookie|credential)/i.test(key)) return true;
    if (hasSensitiveKey(child)) return true;
  }
  return false;
}

function parseTime(value) {
  if (value == null) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && String(value).trim() !== "") {
    return new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function parseUsdc(value, label) {
  const text = String(value ?? "");
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(text)) fail(`${label} must be a non-negative USDC amount with at most six decimals.`);
  const [whole, fraction = ""] = text.split(".");
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
}

function shellQuote(value) {
  const text = String(value);
  return /^[A-Za-z0-9_./:-]+$/.test(text) ? text : `'${text.replaceAll("'", `'\\''`)}'`;
}

function inspectTask(document) {
  const data = document?.ok === true && document.data ? document.data : document;
  const task = data?.task ?? data;
  if (!task || typeof task !== "object") fail("No Taskmarket task object was found.");

  const actions = Array.isArray(task.pendingActions)
    ? task.pendingActions
    : Array.isArray(data?.pendingActions)
      ? data.pendingActions
      : [];
  const now = new Date();
  const expiresAt = parseTime(task.expiresAt ?? task.expiryTime ?? task.expiry ?? task.deadline);
  const terminal = new Set(["completed", "expired", "cancelled"]);
  const workerActions = actions.filter((action) => action?.role === "worker");
  const blockers = [];

  if (!/^0x[0-9a-fA-F]{64}$/.test(String(task.taskId ?? task.id ?? ""))) blockers.push("invalid_task_id");
  if (expiresAt && expiresAt <= now) blockers.push("expired_by_time");
  if (terminal.has(String(task.status ?? "").toLowerCase())) blockers.push("terminal_status");
  if (task.submissionWindowOpen !== true && workerActions.length === 0) blockers.push("no_current_worker_action");

  const summarizeAction = (action) => ({
    role: action.role ?? null,
    action: action.action ?? null,
    command: action.command ?? null,
    eligibleAddress: action.eligibleAddress ?? null,
    requiresPayment: action.requiresPayment === true,
    paymentAmountBaseUnits: action.paymentAmount ?? null,
    availableAfter: action.availableAfter ?? null,
    availableUntil: action.availableUntil ?? null
  });

  return {
    ok: true,
    readOnly: true,
    task: {
      taskId: task.taskId ?? task.id ?? null,
      mode: task.mode ?? null,
      status: task.status ?? null,
      phase: task.phase ?? null,
      rewardBaseUnits: task.reward ?? null,
      netRewardBaseUnits: task.netReward ?? null,
      expiresAt: expiresAt?.toISOString() ?? null,
      taskVisibility: task.taskVisibility ?? task.visibility ?? null,
      submissionVisibility: task.submissionVisibility ?? null,
      submissionWindowOpen: task.submissionWindowOpen ?? null
    },
    workerActions: workerActions.map(summarizeAction),
    paidActions: actions.filter((action) => action?.requiresPayment === true).map(summarizeAction),
    candidateForWorkerReview: blockers.length === 0,
    blockers,
    warning: "Re-fetch the task and obtain approval for any paid or consequential action. This inspection never authorizes a write."
  };
}

function previewCreate(intent) {
  if (!intent || typeof intent !== "object" || Array.isArray(intent)) fail("Create intent must be a JSON object.");
  if (hasSensitiveKey(intent)) fail("Intent contains a secret-like field. Remove credentials and private access data.");

  const description = String(intent.description ?? "").trim();
  if (description.length < 20 || description.length > 4000) fail("description must contain 20 to 4000 characters.");

  const rewardText = String(intent.reward ?? "");
  const reward = parseUsdc(rewardText, "reward");
  if (reward === 0n) fail("reward must be greater than zero.");
  const capText = process.env.TASKMARKET_PREVIEW_MAX_REWARD_USDC || "50";
  const cap = parseUsdc(capText, "TASKMARKET_PREVIEW_MAX_REWARD_USDC");
  if (reward > cap) fail(`reward exceeds the configured ${capText} USDC preview cap.`);

  const durationText = String(intent.duration ?? "");
  if (!/^\d+$/.test(durationText)) fail("duration must be an integer number of hours.");
  const duration = Number(durationText);
  if (duration < 1 || duration > 720) fail("duration must be between 1 and 720 hours.");

  const mode = String(intent.mode ?? "bounty");
  if (!["bounty", "claim", "pitch", "benchmark", "auction"].includes(mode)) fail("Unsupported task mode.");
  if (mode === "auction") fail("Auction previews require subtype-specific price fields; prepare them manually after reading the live CLI help.");

  const taskVisibility = String(intent.taskVisibility ?? "public");
  if (!["public", "unlisted"].includes(taskVisibility)) fail("This helper supports only public or unlisted task previews.");
  const submissionVisibility = String(intent.submissionVisibility ?? "public");
  if (!["public", "reveal_all", "winner_only", "never"].includes(submissionVisibility)) fail("Unsupported submission visibility.");

  const tags = Array.isArray(intent.tags)
    ? intent.tags.map(String).map((tag) => tag.trim()).filter(Boolean).join(",")
    : String(intent.tags ?? "").trim();
  const argv = [
    "taskmarket", "task", "create",
    "--description", description,
    "--reward", rewardText,
    "--duration", durationText,
    "--mode", mode,
    "--task-visibility", taskVisibility,
    "--submission-visibility", submissionVisibility
  ];
  if (tags) argv.push("--tags", tags);

  return {
    ok: true,
    previewOnly: true,
    network: "Base",
    mode,
    escrowUsdc: rewardText,
    durationHours: duration,
    taskVisibility,
    submissionVisibility,
    argv,
    command: argv.map(shellQuote).join(" "),
    exactApprovalPhrase: `I APPROVE TASKMARKET CREATE: ${rewardText} USDC, ${mode}, ${taskVisibility}, ${duration}h`,
    warning: "Task creation escrows the full reward. Re-check wallet, legal status, CLI help, and pending payment details before executing."
  };
}

if (operation === "inspect") {
  process.stdout.write(`${JSON.stringify(inspectTask(readJson(inputPath)), null, 2)}\n`);
} else if (operation === "preview-create") {
  process.stdout.write(`${JSON.stringify(previewCreate(readJson(inputPath)), null, 2)}\n`);
} else {
  fail("Usage: taskmarket-guard.mjs <inspect|preview-create> <json-file|->");
}
