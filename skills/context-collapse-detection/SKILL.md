---
name: context-collapse-detection
description: "Use this skill at every major decision point in an agentic loop. Detects when an AI agent is losing coherence, drifting from its original goal, stuck in a loop, or missing critical context — before the mistake compounds. Triggers: any multi-step task, long-running agent loop, autonomous execution with tool use, or anytime the agent is about to take an irreversible action. Runs as a lightweight async check — does NOT block execution unless a critical collapse is detected."
---

# Context Collapse Detection

## What This Skill Does

AI agents fail silently. They keep executing confidently while drifting off-goal, repeating steps, or operating on stale context. This skill gives your agent a structured way to self-monitor and self-correct — catching collapse before it compounds.

**Four collapse signals this skill detects:**
- **Coherence drift** — outputs no longer connect to the original goal
- **Goal displacement** — agent is solving a different problem than assigned
- **Loop trap** — agent repeating the same actions without progress
- **Memory gap** — agent missing information it needs to proceed correctly

---

## When To Run This Check

Run at these moments in your agent loop:

1. Before any **irreversible action** (delete, send, deploy, purchase, submit)
2. After every **3–5 steps** in a long task
3. When **switching between subtasks**
4. When **confidence feels low** about the next step
5. Before **reporting results** to the user

---

## The Check (Run This Internally)

Ask yourself these four questions before proceeding:

```
1. COHERENCE: Does my last output directly serve the original goal?
   → If no: stop, re-read the goal, reframe your next action.

2. GOAL CHECK: Can I state the original goal in one sentence right now?
   → If not: run recovery protocol before continuing.

3. LOOP CHECK: Have I done this exact action (or very similar) more than twice?
   → If yes: you are in a loop. Change your approach or ask for help.

4. CONTEXT CHECK: Do I have everything I need to complete the next step correctly?
   → If no: identify what's missing before acting.
```

**Scoring:**
- 4 YES → continue execution
- 3 YES → note the gap, proceed with caution
- 2 or fewer YES → run recovery protocol immediately

---

## Recovery Protocol

When collapse is detected, execute in order:

```
Step 1 — STOP: Do not take the next planned action.

Step 2 — SUMMARIZE: Write a 2-sentence summary of:
  - What you were asked to do (original goal)
  - What you have done so far

Step 3 — GAP ANALYSIS: What is the difference between
  where you are and where you need to be?

Step 4 — CHOOSE:
  A) If gap is small → re-anchor and continue
  B) If gap is medium → restructure your remaining steps
  C) If gap is large or action was irreversible → surface to human immediately

Step 5 — CHECKPOINT: Save current state before resuming.
```

---

## Async Implementation Note

This check is designed to be **non-blocking**. Run it as a parallel evaluation — not as a gate before every single action. Only hard-stop the agent when:

- Score is 1 or 0 (severe collapse)
- The next action is irreversible
- A loop is detected (same action 3+ times)

For all other cases: log the result, adjust course, keep moving.

---

## Output Format When Collapse Is Detected

When surfacing collapse to a human, always use this format:

```
[CONTEXT COLLAPSE DETECTED]
Collapse type: [coherence drift / goal displacement / loop trap / memory gap]
Original goal: [one sentence]
Current state: [one sentence]
Gap: [one sentence]
Recommended action: [A / B / C from recovery protocol]
```

---

## Examples

**Example 1 — Loop trap:**
> Agent assigned to "find the best flight from Jakarta to Tokyo under $500"
> has called the search API 7 times with nearly identical parameters.
> → Loop detected. Agent should change search strategy or surface to human.

**Example 2 — Goal displacement:**
> Agent assigned to "summarize this contract" is now rewriting clauses.
> → Goal displacement. Agent should stop, re-read original instruction.

**Example 3 — Memory gap:**
> Agent about to send an email but does not have the recipient's address.
> → Memory gap. Agent should request missing info before proceeding.

---

## Integration

This skill works with any agent framework that supports SKILL.md:
- Claude Code
- Codex CLI
- GitHub Copilot Agent
- Any MCP-compatible agent

No dependencies. No external API calls. Runs entirely on the agent's existing context.
