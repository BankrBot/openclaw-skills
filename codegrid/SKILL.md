---
name: codegrid
description: >-
  CodeGrid is a native macOS canvas where multiple coding agents (Claude, Codex,
  Gemini, Cursor, Grok, shells) run side by side in panes and collaborate via a
  local agent bus — no tmux, no cloud, no account, no stored API keys. Install
  this skill when an agent should know how to operate inside a CodeGrid pane,
  drive the workspace from outside (control socket or codegrid:// deep links),
  spawn or message sibling agents, or coordinate multi-agent work (delegate,
  review, pipeline, parallel fan-out, monitor, debate). The differentiator:
  multiple coding agents collaborating on one canvas, addressable by stable
  session_id, with a read → message → read protocol built for orchestration.
metadata:
  product: CodeGrid
  vendor: ZipLyne LLC
  homepage: https://codegrid.app
  docs: https://codegrid.app/docs
  token: $GRID (Base, 0x6B456E66524aEC1792013eF9DFE87e3F84311ba3)
  version: 1
---

# CodeGrid — agent operating manual

CodeGrid runs many coding agents side by side on an infinite 2D canvas. Each
pane is one process (`claude`, `codex`, `gemini`, `cursor-agent`, `grok`, or a
shell) with its own working directory, git branch, and stable `session_id`. The
agent bus lets any pane discover, read, and message any other pane locally.

This skill is the umbrella entry point. Two references cover the full surface:

- **[Operating CodeGrid](./references/using-codegrid.md)** — the mental model
  (canvas / pane / workspace / agent / bus), MCP tools (`list_agents`,
  `read_pane`, `message_agent`), the control-socket JSON-RPC API
  (`agent_list`, `agent_read`, `agent_send`, `open_folder`, `new_session`,
  `new_workspace`), the `codegrid://` deep-link scheme, and an operating
  playbook with recipes.

- **[Agent-bus collaboration](./references/codegrid-agent-bus.md)** — the
  `read → message → read` protocol, identifying agents by role and
  `session_id`, orchestration patterns (delegate, review, pipeline, parallel
  fan-out, monitor, debate), etiquette and scope safety, loop/runaway
  prevention, failure recovery, and worked end-to-end examples.

## When to load which reference

| You're about to… | Load |
|---|---|
| Discover what's running, open a folder, spawn a session, or drive CodeGrid from outside | `using-codegrid` |
| Hand work to / consult / review with another agent already running in CodeGrid | `codegrid-agent-bus` |
| Both | Load `using-codegrid` first, then `codegrid-agent-bus` |

## Quickstart (inside a CodeGrid pane)

```text
list_agents()                                  # discover panes (session_id, role, status)
read_pane(<session_id>)                        # see what they're doing — always safe
message_agent(<session_id>, "[from <you>] <self-contained request>")
… wait, then read_pane(<session_id>) for the reply.
```

## Quickstart (from outside CodeGrid, e.g. another tool)

```bash
SOCK="$(cat ~/.codegrid/socket-path 2>/dev/null || echo ~/.codegrid/socket)"
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"agent_list"}' | nc -U "$SOCK"

# Or deep-link the installed app:
open "codegrid://open?path=/abs/path/to/repo&type=codex"
open "codegrid://new"
```

## Install

```text
install the codegrid skill from https://github.com/BankrBot/skills/tree/main/codegrid
```

## Source

- Canonical source of truth lives in the CodeGrid repo under `skills/`
  (`skills/using-codegrid/SKILL.md`, `skills/codegrid-agent-bus/SKILL.md`).
  This Bankr Skills provider is a published copy kept in sync.
- App download + full docs: <https://codegrid.app>.
- Token (Base): `0x6B456E66524aEC1792013eF9DFE87e3F84311ba3` —
  see <https://codegrid.app/token>.

## Safety defaults an agent should respect

- **Read before you write.** `read_pane` is free; never message a busy agent.
- **Address by `session_id`**, never pane number — pane numbers shift.
- **Be explicit about scope.** Other agents may be in YOLO/autonomous mode and
  will act on whatever you send. Say "propose only, do not edit files" when you
  want analysis.
- **One message, then wait.** Multiple messages interleave into the target's
  input box and corrupt it.
- **Bound debates and don't spawn unbounded helpers.** Converge and report to
  the user.
- **Stay local.** Everything is same-machine IPC; there is no remote bus.

Full guidance: see the two reference files.
