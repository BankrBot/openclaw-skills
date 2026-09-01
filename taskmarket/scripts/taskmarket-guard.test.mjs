import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("./taskmarket-guard.mjs", import.meta.url));
const taskId = `0x${"1".repeat(64)}`;

function run(operation, input, env = {}) {
  return spawnSync(process.execPath, [script, operation, "-"], {
    input: JSON.stringify(input),
    encoding: "utf8",
    env: { ...process.env, ...env }
  });
}

test("inspect accepts a current free submission path", () => {
  const result = run("inspect", {
    ok: true,
    data: {
      taskId,
      mode: "bounty",
      status: "open",
      submissionWindowOpen: true,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      pendingActions: []
    }
  });
  assert.equal(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.candidateForWorkerReview, true);
  assert.deepEqual(output.blockers, []);
});

test("inspect exposes payment without authorizing it", () => {
  const result = run("inspect", {
    taskId,
    mode: "benchmark",
    status: "open",
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    pendingActions: [{ role: "worker", action: "proof", requiresPayment: true, paymentAmount: "1000" }]
  });
  const output = JSON.parse(result.stdout);
  assert.equal(output.paidActions.length, 1);
  assert.equal(output.paidActions[0].paymentAmountBaseUnits, "1000");
  assert.match(output.warning, /approval/i);
});

test("inspect blocks a task expired by time", () => {
  const result = run("inspect", {
    taskId,
    status: "open",
    submissionWindowOpen: true,
    expiryTime: "2020-01-01T00:00:00Z"
  });
  assert.equal(JSON.parse(result.stdout).candidateForWorkerReview, false);
  assert.ok(JSON.parse(result.stdout).blockers.includes("expired_by_time"));
});

test("preview-create emits exact safe CLI flags", () => {
  const result = run("preview-create", {
    description: "Produce a verified interoperability report and attach reproducible evidence.",
    reward: "4.5",
    duration: 48,
    mode: "bounty",
    taskVisibility: "unlisted",
    submissionVisibility: "winner_only",
    tags: ["integration", "qa"]
  });
  assert.equal(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.previewOnly, true);
  assert.equal(output.escrowUsdc, "4.5");
  assert.ok(output.argv.includes("--task-visibility"));
  assert.ok(output.argv.includes("winner_only"));
});

test("preview-create rejects secret-like fields", () => {
  const result = run("preview-create", {
    description: "Produce a sufficiently detailed public report for the requested integration.",
    reward: "1",
    duration: 24,
    password: "should-not-be-here"
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /secret-like/i);
});

test("preview-create enforces its configured reward cap", () => {
  const result = run("preview-create", {
    description: "Produce a sufficiently detailed public report for the requested integration.",
    reward: "5.01",
    duration: 24
  }, { TASKMARKET_PREVIEW_MAX_REWARD_USDC: "5" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /exceeds/i);
});
