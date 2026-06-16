---
name: polygraph
description: Behavioral trust grades (A–F) for MCP servers and AI tools. Use when an agent needs to check whether an MCP server is safe before using it, look up a server's published grade, get a project graded, verify an onchain attestation before trusting or paying a server, or understand why a server received a grade. Polygraph connects to a server the way an agent would, fingerprints its exact tool surface, and runs behavioral probes — prompt-injection (C-01), permission/egress overreach (C-02), and sensitive-data leak (C-03) — then publishes a reproducible grade as an onchain EAS attestation on Base. Triggers on mentions of MCP server safety, is this MCP server safe, tool trust, prompt injection, tool poisoning, data leak, permission overreach, unexpected egress, trust grade, attestation, verify before paying, polygraph, litmus, grade my MCP server.
emoji: 🧪
tags: [security, mcp, trust, grade, attestation, base, prompt-injection, agent-safety]
visibility: public
---

# Polygraph: Behavioral Trust Grades for MCP Servers

Agents wire up third-party MCP servers and then trust whatever those servers' tools
return. Polygraph tests a server's **behavior** before your agent does, and assigns a
letter grade **A–F** backed by reproducible evidence.

A passing grade is a **measurement, not a guarantee** — it says "this exact tool surface
did not misbehave under these probes," and because the harness is open and deterministic,
anyone can re-run it and disprove a bad grade. That falsifiability is the whole point.

- **Home / methodology:** [polygraph.so](https://polygraph.so)
- **Lookup CLI (npm):** `polygraphso`
- **Grading harness:** `@polygraphso/litmus` (open source)

---

## What a grade measures

Polygraph connects to a server the way an agent would — **stdio** for local packages,
**Streamable HTTP** for remote URLs — fingerprints its exact tool surface
(`tools/list` → canonical JSON → sha256 → `bytes32`), then runs three probe categories:

- **C-01 — Tool-output injection.** Does the server try to hijack the agent? Static scan of
  tool names/descriptions/schemas for injection-shaped content (invisible unicode,
  instruction mimicry, markdown tricks) **plus** dynamic bait calls that check whether tool
  outputs smuggle in instructions.
- **C-02 — Permission / egress overreach.** Does the server do more than it claims? Flags
  tools that declare `readOnlyHint: true` but carry destructive verbs, and runs the server in
  a hardened **default-deny Docker sandbox** where any outbound network attempt is a finding.
- **C-03 — Sensitive-data handling.** Does the server leak secrets? Plants canary values in
  the environment and working directory, exercises the tools, and scans both tool outputs and
  egress for any canary that surfaces.

### Grade scale

| Grade | Meaning |
|-------|---------|
| **A** | Passed all three categories. No injection, no unexpected egress, no data leak. |
| **B** | Injection checks passed; egress **not verified** (no Docker sandbox, or a remote target). Capped at B by design. |
| **C** | Reserved — not currently assigned. |
| **D** | Unexpected egress / permission overreach, but no injection or leak. Serious, not proven exfiltration → capped at D. |
| **F** | Disqualifying: active tool-output injection (C-01) or a sensitive-data leak (C-03). This is a server that would harm an agent that trusts it. |

(There is no E.) Every grade ships with a plain-English **rationale** — never a bare letter.
See [`references/methodology.md`](references/methodology.md) for the full decision logic and
each probe in depth.

---

## Check a grade

A sub-second lookup against published grades — **one command before your agent installs
anything:**

```bash
$ npx polygraphso check npm/@modelcontextprotocol/server-filesystem
→ polygraph: A · litmus-v2 · 2026-06-11
→ details → polygraph.so/#checks
```

Published grades are **live** and span the full range. Browse the graded set with
`polygraphso list`:

```bash
$ polygraphso list
npm/@modelcontextprotocol/server-filesystem    A
npm/@upstash/context7-mcp                      D
npm/@playwright/mcp                            F
```

Refs are **registry-prefixed** — the prefix disambiguates (`redis` exists on npm, PyPI, and
GitHub with different content): `npm/…`, `pypi/…`, `github/…`. A tracked-but-ungraded server
reports `not available yet` with a notify link, and its grade lands as the litmus harness
covers more of the ecosystem. Full CLI reference: [`references/cli.md`](references/cli.md).

---

## ★ Get your project graded

This is the CTA — **run the open harness on your own MCP server, get an A–F grade plus a
reproducible evidence bundle, and publish it onchain so agents can verify it:**

```bash
# Grade your server end-to-end (npm ref, https URL, or local path)
npx -y -p @polygraphso/litmus polygraphso-litmus litmus npm/@your-scope/your-mcp-server
```

You get the grade, the per-category verdicts, your tool-surface fingerprint, and a
content-addressed evidence bundle. Publishing that grade as an **onchain EAS attestation on
Base** (so other agents can look it up and verify it) is a one-step hand-off — see
[`references/methodology.md`](references/methodology.md#publishing-a-grade).

Prefer not to run it yourself? Request a grade or get notified when yours publishes at
**[polygraph.so](https://polygraph.so)**.

> **One line for builders:** check any MCP server before your agent uses it with
> `npx polygraphso check <server>`, and get your own server graded at
> [polygraph.so](https://polygraph.so).

---

## Run the harness locally

The harness is the same open, deterministic engine that produces published grades:

```bash
npm i -g @polygraphso/litmus        # or use npx, above
polygraphso-litmus litmus npm/@modelcontextprotocol/server-filesystem
polygraphso-litmus litmus https://example.com/mcp --bearer "$TOKEN"
polygraphso-litmus litmus ./path/to/local-mcp-server --json
```

- **Node ≥ 18.** **Docker is optional** but recommended — without it the egress probe (C-02)
  is skipped and the grade is **capped at B**.
- **Exit codes are CI-friendly:** non-zero on a failing grade (D/F), zero on A/B/C — drop it
  into a pipeline to gate dependencies.

Flags, env vars, `--json` output, and the `check` / `challenge` / `list` subcommands are all
in [`references/cli.md`](references/cli.md).

---

## Why a server got grade X

Every run prints the methodology, the per-category verdict, the tool-surface fingerprint, and
the grade with a one-paragraph rationale:

```
→ litmus · npm/@modelcontextprotocol/server-filesystem
→ version 0.1.0
→ C-01 pass · C-02 pass · C-03 pass
→ fingerprint 0x1a2b3c4d…5e6f7890
→ grade: A
   All three categories passed. No injection, no unexpected egress, no data leak.
```

On a failure the report surfaces the top HIGH-severity findings (tool name, finding kind, the
offending snippet). [`references/methodology.md`](references/methodology.md) maps every
grade and finding kind to its cause.

---

## Verify before you trust (Bankr integration)

This is why polygraph matters for agents: **gate an MCP server through its grade before your
agent uses it, pays it, or routes a transaction through it.** Polygraph is the *verify* step;
Bankr is the *execute* step.

The trust anchor is the **tool-surface fingerprint**: an attestation is only meaningful if the
server you're about to call still has the surface that was graded. The agent recomputes the
live fingerprint and requires it to equal the attested one before acting — a built-in
rug-pull check. Drop the `verify_attestation` MCP tool in front of execution, or use the
`gateDecision` helper. Full patterns, the MCP server config, and a worked
"verify-then-execute" example: [`references/bankr-integration.md`](references/bankr-integration.md).

---

## How much to trust the grade (honest limits)

- **Reproducibility is the trust anchor.** The harness is open source and deterministic, so a
  false grade is falsifiable — anyone can re-run it against the same server and the result
  must match.
- **A self-published grade is forgeable** by whoever signs it; that's why reproducibility (not
  the signature) is what makes a grade trustworthy, and why the fingerprint recheck guards
  against a graded-then-swapped server.
- **Evasion is the residual limit:** a server that detects the test context could behave during
  grading and misbehave in production. This is disclosed, not hidden.
- Stronger, independent guarantees (staked bonds, TEE-backed runs, independent re-grading) are
  on the roadmap, not claimed today.

---

## Resources

- **Home + methodology:** https://polygraph.so
- **Lookup CLI:** `npx polygraphso check <registry>/<owner>/<name>` · https://www.npmjs.com/package/polygraphso
- **Grading harness:** `@polygraphso/litmus` (open source — see polygraph.so for the repo)
- **Onchain proof:** EAS attestations on Base
- **References:** [`methodology.md`](references/methodology.md) · [`cli.md`](references/cli.md) · [`bankr-integration.md`](references/bankr-integration.md)
