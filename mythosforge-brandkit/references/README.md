# references/ — mythosforge-brandkit

Design contract for this skill: the rubric, schema, palette, or spec an agent must read
**before running** so its output meets the look/quality bar without a human in the loop.

**This skill's contract:** [`brandkit-schema.md`](brandkit-schema.md) — the style-token schema
`brandkit.mjs` emits (owner: shiro), which the generators + lookgate consume. Read it before running.

`SKILL.md` requires the agent read this folder before generating. Keep it machine-usable
(rubric-as-data + a verdict/output schema), not just prose, so any runtime can consume it —
not only a human reading the file.
