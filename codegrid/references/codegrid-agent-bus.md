---
name: codegrid-agent-bus
description: >-
  How to collaborate with other AI agents running in CodeGrid using the
  codegrid-agent-bus MCP tools (list_agents, read_pane, message_agent). Use this
  skill whenever the user asks you to delegate to, consult, coordinate with,
  review with, hand work to, or get a second opinion from another agent
  ("ask Codex to…", "have Gemini review…", "get the other agent to…",
  "split this up between the agents"). Covers the read→message→read protocol,
  identifying agents, orchestration patterns (delegate, review, pipeline,
  parallel fan-out, monitor, debate), etiquette, scope/safety, loop prevention,
  failure recovery, and worked end-to-end examples.
metadata:
  product: CodeGrid
  vendor: ZipLyne LLC
  homepage: https://codegrid.app/agent-bus
  docs: https://codegrid.app/docs/agent-bus
  version: 2
---

# Collaborating with other agents in CodeGrid

You are running inside **CodeGrid**, where multiple coding agents (Claude,
Codex, Gemini, Cursor, Grok, shells) run side by side, each in its own pane. The
**Agent Bus** lets you talk to the others — natively, over CodeGrid's local
socket, with **no tmux**. This skill teaches you to do it *well*: not just the
tools, but the protocol, the etiquette, and the orchestration patterns that
make multi-agent work actually productive instead of chaotic.

> Core principle: **you are an orchestrator, not a spammer.** Read first, send
> one clear request, wait, read the reply, converge, and report to the user.

---

## 1. Your tools

| Tool | Signature | Notes |
|------|-----------|-------|
| `list_agents` | `() → [{ session_id, pane_number, command, status, working_dir }]` | Discover who's available. `command` tells you the role (claude/codex/gemini/cursor/grok/…). `status` ∈ running, idle, waiting, error, dead. |
| `read_pane` | `(session_id, max_bytes?) → text` | Recent output, ANSI-stripped, ~last 40 lines. **Always safe** — read freely. |
| `message_agent` | `(session_id, text, submit?) → ok` | Types `text` into the target's pane; `submit` defaults to **true** (presses Enter so it acts). Set `submit:false` to stage a draft without sending. |

**The `session_id` is the address.** Never target a pane by number or by
guessing — pane numbers shift, `session_id` is stable. Get it from `list_agents`.

---

## 2. The protocol — read → message → read

Every interaction follows the same loop. Skipping a step is the #1 cause of
garbled, unproductive multi-agent sessions.

1. **List.** `list_agents` → find the target by role (its `command`) and grab
   its `session_id`. Confirm it isn't `dead`.
2. **Read first.** `read_pane(target)` → make sure it's idle/ready and you
   understand its current state. Don't talk over a busy agent.
3. **Message once.** `message_agent(target, text)` with a **clear, self-
   contained** request. Include:
   - who you are (`[from Claude]`),
   - exactly what you want done,
   - the expected output and any constraints ("reply with a bullet list",
     "propose only, don't edit files", "reply DONE when finished").
4. **Wait, then read.** Give the agent time to think and work. Re-`read_pane`
   after a pause to collect the reply. If it's still working, **read again** —
   do **not** send another message.

```text
list_agents() → target = the "codex" pane, session acc7bc6d-…
read_pane(acc7bc6d-…)                      # idle, ready
message_agent(acc7bc6d-…,
  "[from Claude] Review src/auth.ts for security issues. Reply with a short
   bullet list of findings, ranked by severity. Do not edit any files.")
… wait …
read_pane(acc7bc6d-…)                      # collect the findings
→ report to the user / act on them
```

---

## 3. Identifying agents

- **By role:** match the `command` field — `claude`, `codex`, `gemini`,
  `cursor-agent`, `grok`. If several panes share a role, disambiguate by `working_dir`
  or pane number, then keep using the `session_id`.
- **Yourself:** you usually appear in `list_agents` too. Don't message yourself.
- **No other agents?** If the list shows only you, there's nobody to collaborate
  with — tell the user to open another agent pane (`⌘N`) and stop.

---

## 4. Orchestration patterns

### Delegate (hand off a task)
You stay the lead; another agent does a unit of work.
```text
read_pane(codex) → message_agent(codex, "Implement X. Reply DONE + a summary.")
→ poll read_pane(codex) until DONE → verify → report.
```

### Review / second opinion
Finish your own change, then have another model critique it.
```text
message_agent(gemini, "Review this approach: <paste/describe>. List risks and a
better alternative if you see one. Don't change files.") → read → apply judgment.
```

### Pipeline (chained hand-offs)
Specialize roles; each hand-off is its own read→message→read.
```text
Gemini researches the API → you implement → Codex reviews the diff.
```

### Parallel fan-out + gather
Kick off independent subtasks on different agents, then collect.
```text
message_agent(codex, "Do subtask A. Reply DONE-A when finished.")
message_agent(gemini, "Do subtask B. Reply DONE-B when finished.")
… periodically read_pane each … gather both results → synthesize.
```
Use **git worktrees** (one per agent) so parallel file edits don't collide.

### Monitor
Watch a long-running build/test/shell pane and react.
```text
read_pane(shell) → if it shows a failing test, fix it (or delegate the fix).
```

### Debate / consensus (use sparingly)
Ask two agents the same question, compare, and you decide. Cap it at one round
each — do **not** let them argue back and forth unbounded (see §6).

---

## 5. Etiquette & scope safety

- **One message, then wait.** Multiple messages before a reply interleave into
  the target's input box and corrupt it. Patience beats spam.
- **Be explicit about scope.** Many agents run in **autonomous / YOLO mode** and
  will *act* on whatever you send — including editing files or running commands.
  If you only want analysis, say **"propose only — do not edit files or run
  anything."** If you want action, say so and define "done."
- **Hand off context, not just a command.** The other agent doesn't share your
  conversation. Include the file paths, the goal, and constraints in the message.
- **Prefer `read_pane` when unsure.** Observing is always safe; messaging changes
  another agent's state.
- **Use `submit:false`** when you want to place text for the user to review/edit
  before it runs.
- **Respect the user's machine.** Don't instruct another agent to run
  destructive commands (`rm -rf`, force-push, credential access) on your own
  initiative.

---

## 6. Loop & runaway prevention (critical)

Multi-agent setups can ping-pong forever or fork-bomb work. Guard against it:

- **Converge and report.** Your job is to reach a result and tell the **user** —
  not to keep two agents talking indefinitely.
- **If an agent might message you back**, don't reflexively reply. Decide whether
  another round adds value; usually it doesn't.
- **Bound debates** to one round per side.
- **Don't spawn unbounded helpers.** Delegate to existing panes; don't create new
  agents in a loop.
- **Set a step budget** in your own head (e.g. "at most 3 hand-offs"); if you're
  not converging, summarize the state for the user and ask how to proceed.
- **Detect stalls.** If `read_pane` shows no progress after a reasonable wait,
  re-read once more, then report "agent X appears stuck" rather than nagging it.

---

## 7. Failure modes & recovery

| Signal | Meaning | Do |
|--------|---------|-----|
| "Can't reach CodeGrid" | App not running / socket gone | Stop; tell the user CodeGrid must be open. |
| `list_agents` shows only you | No collaborators | Tell the user to open another agent pane (`⌘N`). |
| `message_agent` errors | Wrong/dead `session_id` | Re-run `list_agents`; the pane may have closed. |
| Target `status: dead` | Process ended | Don't message it; tell the user (they can Restart the pane). |
| Reply never appears | Agent is busy, waiting on a prompt, or off-track | Re-`read_pane` once; if it's stuck on a prompt, report it — don't keep sending. |
| Garbled input in the target | You sent multiple messages | Stop; let it settle; read; resend one clean message. |

---

## 8. Anti-patterns (don't do these)

- ❌ Messaging before reading the target's state.
- ❌ Firing several messages in a row "to be safe."
- ❌ Addressing by pane number instead of `session_id`.
- ❌ Sending a bare command with no context or success criterion.
- ❌ Letting two agents converse with no termination condition.
- ❌ Telling another agent to do something destructive on your own initiative.
- ❌ Assuming the other agent shares your memory/conversation.

---

## 9. Worked example — delegate + review

> User: "Have Codex add an Export button, then check its work."

```text
1. list_agents()
   → me (claude, pane 1), codex (acc7bc6d-…, pane 2, idle)
2. read_pane(acc7bc6d-…)            # idle, at a prompt — ready
3. message_agent(acc7bc6d-…,
     "[from Claude] In this repo, add an 'Export' button to the toolbar that
      downloads the current view as JSON. Implement it and reply 'DONE' with a
      one-line summary of the files you changed.")
4. … wait ~20–40s …
   read_pane(acc7bc6d-…)            # "DONE — added ExportButton.tsx, wired onClick"
5. (optional) read the changed files yourself / git diff, apply a fix if needed.
6. Report to the user: what Codex did, your review, and the final state.
```

## 10. Combining with other CodeGrid features

- **Broadcast (`⌘B`)** is *you → all panes*. The bus is *agent → agent*. Use
  broadcast to fan a prompt out from yourself; use the bus to let agents
  coordinate among themselves.
- **Worktrees** keep parallel agents on separate branches — pair them with
  fan-out so simultaneous edits never conflict.
- For full control of the workspace (spawning panes, opening folders, the raw
  socket), see the companion **`using-codegrid`** skill.

Reference: <https://codegrid.app/docs/agent-bus>.
