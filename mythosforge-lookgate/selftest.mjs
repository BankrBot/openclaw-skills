#!/usr/bin/env node
// Self-test for lookgate's anti-spoof finalize(). No key/network needed.
// Proves the gate re-derives verdict/score/fails from criteria and never trusts raw.score.

import { finalize } from "./gate.mjs";

let failed = 0;
const check = (name, cond) => { console.log(`${cond ? "PASS" : "FAIL"}  ${name}`); if (!cond) failed++; };

// 1) SPOOF: model reports a failing criterion but claims score:1 -> must NOT pass at threshold.
const spoof = finalize({ criteria: [{ id: "crisp", result: "fail", reason: "melted" }, { id: "contrast", result: "pass" }], score: 1, verdict: "pass" }, "x.png", 0.9);
check("spoof score:1 ignored -> score computed 0.5", spoof.score === 0.5);
check("spoof -> verdict fail at threshold 0.9", spoof.verdict === "fail");
check("spoof -> fails lists the failed id", spoof.fails.length === 1 && spoof.fails[0] === "crisp");

// 2) STRICT (no threshold): any fail -> fail.
const strict = finalize({ criteria: [{ id: "a", result: "pass" }, { id: "b", result: "fail" }] }, "x.png", null);
check("strict any-fail -> fail", strict.verdict === "fail");

// 3) ALL PASS -> pass, score 1.
const allpass = finalize({ criteria: [{ id: "a", result: "pass" }, { id: "b", result: "pass" }] }, "x.png", null);
check("all pass -> pass, score 1", allpass.verdict === "pass" && allpass.score === 1);

// 4) THRESHOLD met by computed score -> pass. (3 of 4 pass = 0.75 >= 0.75)
const thr = finalize({ criteria: [{ id: "a", result: "pass" }, { id: "b", result: "pass" }, { id: "c", result: "pass" }, { id: "d", result: "fail" }] }, "x.png", 0.75);
check("computed 0.75 >= threshold 0.75 -> pass", thr.score === 0.75 && thr.verdict === "pass");

// 5) 'na' criteria excluded from the score denominator.
const na = finalize({ criteria: [{ id: "a", result: "pass" }, { id: "b", result: "na" }] }, "x.png", null);
check("na excluded from score denominator -> score 1", na.score === 1);

// 6) Invalid result normalized to na (not counted as pass).
const bad = finalize({ criteria: [{ id: "a", result: "pass" }, { id: "b", result: "definitely-yes" }] }, "x.png", null);
check("invalid result -> normalized na, score 1", bad.criteria[1].result === "na" && bad.score === 1);

console.log(failed ? `\n${failed} FAILED` : "\nall self-tests passed");
process.exit(failed ? 1 : 0);
