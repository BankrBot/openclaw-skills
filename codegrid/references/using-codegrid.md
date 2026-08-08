---
name: using-codegrid
description: >-
  How an AI coding agent should operate inside CodeGrid — the macOS canvas that
  runs Claude, Codex, Gemini, Cursor, Grok, and shells side by side and lets them
  collaborate. Use this skill whenever you are running in a CodeGrid pane, or a
  user asks you to spawn/list/control agents, open a project, drive the
  workspace, or coordinate work across panes. Covers the local control socket
  (agent_list / agent_read / agent_send, open_folder, new_session,
  new_workspace), the codegrid:// deep-link scheme, the canvas/pane/workspace
  model, and the operating playbook.
metadata:
  product: CodeGrid
  vendor: ZipLyne LLC
  homepage: https://codegrid.app
  docs: https://codegrid.app/docs
  version: 2
---

# Operating CodeGrid

CodeGrid is a native macOS workspace where several coding agents run side by
side, each in its own **pane** on an infinite 2D **canvas**. It is *local-first*:
no cloud, no account, no stored API keys. Agents are launched as normal CLIs
(`claude`, `codex`, `gemini`, `cursor-agent`, `grok`, or a shell) — CodeGrid does
not wrap or replace them, so they behave exactly as they do in a terminal.

This skill is your operating manual for **driving CodeGrid** — discovering what
is running, reading and messaging other panes, and opening projects — both from
inside a pane (via MCP tools) and from outside (via the local control socket or
deep links).

---

## 1. Orientation: how to tell you're in CodeGrid

You are very likely running inside CodeGrid if **any** of these hold:

- The MCP server `codegrid-agent-bus` is connected (run `/mcp` to check). Its
  tools — `list_agents`, `read_pane`, `message_agent` — are the primary way you
  interact with sibling agents.
- The control socket exists: `~/.codegrid/socket` (its path is also written to
  `~/.codegrid/socket-path`).
- You were started with a working directory chosen in CodeGrid's new-session
  dialog.

If the `codegrid-agent-bus` tools are **not** present but the user wants
collaboration, tell them to enable it (onboarding → "Enable collaboration", or
run `node <app>/Contents/Resources/resources/agent-bus-mcp.cjs setup`) and then
open a **fresh** pane — tools load at pane start.

---

## 2. The mental model

| Term | Meaning |
|------|---------|
| **Canvas** | An infinite 2D surface holding panes. Each workspace has its own. |
| **Pane / Session** | One running process (an agent or shell) with a working dir, git branch, live terminal, and a stable `session_id`. The pane is its window. |
| **Agent** | The CLI inside a session: `claude`, `codex`, `gemini`, `cursor`, `grok`, or a shell. |
| **Workspace** | A named project context — its own panes, layout, and (optionally) bound repo. |
| **Agent Bus** | The local channel that lets one agent read/message another's pane. |

**Addressing rule:** always identify a target pane by its `session_id` (from
`list_agents` / `agent_list`). Pane numbers can change; `session_id` is stable.

---

## 3. Primary interface — MCP tools (use these from inside a pane)

If `codegrid-agent-bus` is connected, prefer these tools over raw sockets:

- **`list_agents()`** → every pane: `session_id`, pane number, `command`,
  `status` (`running` | `idle` | `waiting` | `error` | `dead`), working dir.
  Call this first to discover who is available.
- **`read_pane(session_id, max_bytes?)`** → recent output of a pane, ANSI-
  stripped. Always safe (read-only). Default tail ~4000 bytes.
- **`message_agent(session_id, text, submit?)`** → types `text` into the target
  pane and (default `submit=true`) presses Enter so the agent acts on it.

For deep collaboration patterns and etiquette, load the companion skill
**`codegrid-agent-bus`**.

---

## 4. Control socket — the full reference (for scripts & external tools)

CodeGrid serves a line-delimited JSON-RPC 2.0 API over a Unix domain socket.
Same-machine only; the socket directory is `0700` (your user account).

**Find it**

```bash
SOCK="$(cat ~/.codegrid/socket-path 2>/dev/null || echo ~/.codegrid/socket)"
```

**Call it** (one JSON object per line; one response line per request)

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"ping"}' | nc -U "$SOCK"
# → {"jsonrpc":"2.0","result":"pong","error":null,"id":1}
```

### Methods

| Method | Params | Effect / Result |
|--------|--------|-----------------|
| `ping` | — | `"pong"`. Liveness check. |
| `agent_list` | — | `{ agents: [{ id, pane_number, workspace_id, working_dir, command, git_branch, status, ... }] }` |
| `agent_read` | `{ session_id, max_bytes? }` | `{ output }` — raw tail of the pane (contains ANSI; strip if needed). |
| `agent_send` | `{ session_id, text, submit? }` | Writes `text` to the pane's stdin; if `submit` (default true), also sends Enter. `{ status: "ok" }`. |
| `open_folder` | `{ path }` | Asks CodeGrid to open `path` (must be an existing dir). |
| `new_session` | `{ path }` | Asks CodeGrid to start a new session at `path`. |
| `new_workspace` | `{ name }` | Creates/focuses a workspace. |
| `list_sessions` | — | Nudges the UI to surface the session list. |

Errors come back as `{ "error": { "code", "message" }, "id" }` — e.g.
`"Failed to write to session"` (bad/dead `session_id`),
`"Session not found or has no output"`, `"Missing 'session_id'"`.

### Robust one-shot client (Node, no deps)

```js
const net = require("net"), fs = require("fs"), os = require("os"), path = require("path");
function sock() {
  const f = path.join(os.homedir(), ".codegrid", "socket-path");
  try { return fs.readFileSync(f, "utf8").trim(); } catch { return path.join(os.homedir(), ".codegrid", "socket"); }
}
function rpc(method, params = {}) {
  return new Promise((res, rej) => {
    const s = net.createConnection(sock()); let buf = "";
    const t = setTimeout(() => { s.destroy(); rej(new Error("timeout")); }, 8000);
    s.on("connect", () => s.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) + "\n"));
    s.on("data", d => { buf += d; const i = buf.indexOf("\n"); if (i >= 0) { clearTimeout(t); s.destroy();
      const m = JSON.parse(buf.slice(0, i)); m.error ? rej(new Error(m.error.message)) : res(m.result); } });
    s.on("error", e => { clearTimeout(t); rej(new Error("CodeGrid not running? " + e.message)); });
  });
}
// await rpc("agent_list"); await rpc("agent_send", { session_id, text, submit: true });
```

---

## 5. Deep links — drive CodeGrid from anywhere

CodeGrid registers the `codegrid://` URL scheme (installed app only):

```bash
open "codegrid://open?path=/abs/path/to/repo&type=codex"   # open a folder as a Codex session
open "codegrid://new"                                       # open the new-session dialog
```

`type` accepts `claude` | `codex` | `gemini` | `cursor` | `grok` | `shell`. Use
this for "Open in CodeGrid" buttons, scripts, and editor integrations.

---

## 6. Operating playbook (recipes)

**Discover the workspace**
```text
list_agents → note each pane's session_id, command (role), and status.
```

**Read what another agent is doing (safe, non-disruptive)**
```text
read_pane(session_id) → inspect the tail before you act.
```

**Hand work to a sibling agent**
```text
1. list_agents → find the target (e.g. the `codex` pane).
2. read_pane(target) → confirm it's idle/ready.
3. message_agent(target, "[from <you>] <clear, self-contained request>").
4. wait, then read_pane(target) for the reply.
```
(See the `codegrid-agent-bus` skill for the full collaboration protocol.)

**Spin up a helper for the user**
```text
Prefer asking the user to press ⌘N (they see and place the pane). For automation,
open_folder / new_session over the socket, or a codegrid:// deep link.
```

**Guide a human using CodeGrid** — key shortcuts to recommend:
`⌘N` new agent · `⌘B` broadcast · `⌘K` command palette · `⌘⇧A` jump to the next
agent needing attention · **AUTO**/**FIT** (top-right of the canvas) to tile or
fit all panes.

---

## 7. Best practices & safety

- **Address by `session_id`, never guess** a pane.
- **Read before you write.** `read_pane` is free and prevents talking over a busy agent.
- **Respect autonomy.** Other agents may be in autonomous/YOLO mode and will act
  on what you send. Say "propose only / don't edit" when you only want analysis.
- **The app must be running.** Socket/MCP calls fail with "Can't reach CodeGrid"
  if it isn't — surface that to the user rather than retrying blindly.
- **Stay local.** This is all same-machine IPC; there is no remote/cross-machine
  bus. Don't assume network reachability.
- **Don't spam.** One message, then wait and re-read — see the collaboration skill.

## 8. When something's off

| Symptom | Cause / fix |
|---------|-------------|
| `codegrid-agent-bus` tools missing | Pane started before install — enable collaboration, open a fresh pane. |
| "Can't reach CodeGrid" | App not running, or socket stale — ensure CodeGrid is open. |
| `agent_send` → "Failed to write" | Target `session_id` is wrong or its process ended; re-run `list_agents`. |
| Only one pane visible to the user | Canvas is zoomed/panned — tell them to click **FIT** or **AUTO**. |

Full reference: <https://codegrid.app/docs>.
