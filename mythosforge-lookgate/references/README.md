# references/ — mythosforge-lookgate

Design contract for this skill: the rubric, schema, palette, or spec an agent must read
**before running** so its output meets the look/quality bar without a human in the loop.

**This skill's contract:** [`lookgate-rubric.md`](lookgate-rubric.md) — the rubric (`default-visual-v1`)
+ the two-tier invocation + the verdict schema `gate.mjs` implements (owner: shiro). Read it before running.

`SKILL.md` requires the agent read this folder before generating. Keep it machine-usable
(rubric-as-data + a verdict/output schema), not just prose, so any runtime can consume it —
not only a human reading the file.
