# Context Collapse Detection Skill

> An AI agent skill that detects when your agent is losing coherence, drifting off-goal, stuck in a loop, or missing critical context — before the mistake compounds.

---

## The Problem

AI agents fail silently.

They keep executing confidently while:
- Drifting away from the original goal
- Repeating the same actions in a loop
- Operating on incomplete or stale context
- Solving a different problem than assigned

By the time you notice, the damage is done.

## The Solution

**Context Collapse Detection** gives your agent a structured self-monitoring layer. It runs lightweight checks at key moments in the agent loop — catching collapse early, triggering recovery, and only stopping execution when absolutely necessary.

**Non-blocking by design.** The skill runs as a parallel evaluation, not a gate. Your agent stays fast. It only hard-stops for severe collapse or irreversible actions.

---

## Install

### Claude Code
```bash
claude skill install https://github.com/fcfsprojects/skills/tree/main/skills/context-collapse-detection
```

### Manual (any SKILL.md-compatible agent)
Copy `SKILL.md` into your project's skills directory.

```
your-project/
└── .claude/
    └── skills/
        └── context-collapse-detection/
            └── SKILL.md
```

---

## How It Works

At key moments in your agent loop, the skill runs four checks:

| Check | Question | If Failed |
|-------|----------|-----------|
| Coherence | Does my last output serve the original goal? | Re-anchor |
| Goal | Can I state the original goal right now? | Recovery protocol |
| Loop | Have I done this same action 3+ times? | Change approach |
| Context | Do I have everything I need? | Get missing info first |

**Score 4/4** → continue  
**Score 3/4** → proceed with caution  
**Score ≤ 2/4** → run recovery protocol

---

## When It Triggers

- Before any **irreversible action** (delete, send, deploy, purchase)
- Every **3–5 steps** in a long task
- When **switching between subtasks**
- Before **reporting results** to the user

---

## Recovery Protocol

When collapse is detected:

1. **Stop** — do not take the next planned action
2. **Summarize** — original goal vs current state in 2 sentences
3. **Gap analysis** — what's the difference?
4. **Choose** — re-anchor / restructure / surface to human
5. **Checkpoint** — save state before resuming

---

## Output Format

When collapse is surfaced to a human:

```
[CONTEXT COLLAPSE DETECTED]
Collapse type: [coherence drift / goal displacement / loop trap / memory gap]
Original goal: [one sentence]
Current state: [one sentence]
Gap: [one sentence]
Recommended action: [re-anchor / restructure / escalate]
```

---

## Compatibility

| Platform | Supported |
|----------|-----------|
| Claude Code | ✅ |
| Codex CLI | ✅ |
| GitHub Copilot Agent | ✅ |
| Any MCP-compatible agent | ✅ |

No external dependencies. No API calls. Runs on the agent's existing context.

---

## License

MIT — free to use, modify, and distribute.

---

## Author

Contributed to the [Bankr Skills](https://github.com/BankrBot/skills) ecosystem.

*If this skill saves your agent from a costly mistake, consider starring the repo.*
