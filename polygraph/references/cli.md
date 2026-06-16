# Polygraph CLI & MCP reference

Polygraph ships two command-line surfaces:

| Package | Bin | Purpose |
|---------|-----|---------|
| **`polygraphso`** | `polygraphso` | Thin, sub-second **lookup** client for published grades. Published on npm. |
| **`@polygraphso/litmus`** | `polygraphso-litmus`, `polygraphso-litmus-mcp` | The full open **harness** — runs the probes and grades a server; also an embeddable MCP server. |

Server refs are always **registry-prefixed**: `<registry>/<owner>/<name>` — e.g.
`npm/@modelcontextprotocol/server-filesystem`, `pypi/mcp-server-git`,
`github/anthropic/mcp-server-foo`. The prefix disambiguates names that exist on multiple
registries. The harness also accepts a raw `https://…/mcp` URL or a local path.

---

## `polygraphso` — look up a grade

```bash
npx polygraphso check npm/@modelcontextprotocol/server-filesystem   # sub-second lookup
npm i -g polygraphso                                                # or install globally

polygraphso check <registry>/<owner>/<name>     # latest published grade
polygraphso list [--json]                       # every graded server + its grade
polygraphso --version
polygraphso --help
```

Grades are live. Example output (the list rows are **illustrative** — a grade is point-in-time
evidence, so the live set at `polygraphso list` / polygraph.so is the source of truth):

```
$ polygraphso check npm/@modelcontextprotocol/server-filesystem
→ polygraph: A · litmus-v2 · 2026-06-11
→ details → polygraph.so/#checks

$ polygraphso list                              # every graded server + its grade
npm/@modelcontextprotocol/server-filesystem    A
npm/@scope/example-search-mcp                   D
npm/@scope/example-browser-mcp                  F

$ polygraphso list --json | jq -r '.servers[] | "\(.polygraph)  \(.server_ref)"'
A  npm/@modelcontextprotocol/server-filesystem
…
```

A tracked-but-ungraded server reports `not available yet` with a
`polygraph.so/notify?for=<ref>` link; its grade lands as the litmus harness covers more of the
ecosystem.

Config: `POLYGRAPH_API_URL` overrides the lookup endpoint (useful for local testing).

---

## `@polygraphso/litmus` — run the harness

```bash
npm i -g @polygraphso/litmus
# or, no install:
npx -y -p @polygraphso/litmus polygraphso-litmus litmus <ref>
```

### Commands

```bash
polygraphso-litmus litmus <ref | https-url | local-path>   # grade a server end-to-end
polygraphso-litmus check  <ref>                            # look up a published grade
polygraphso-litmus list                                    # list published grades
polygraphso-litmus --version | --help
```

Reproducibility is the teeth: re-run `litmus` against a server that already carries a grade
and, if your result disagrees, that's a falsification anchored to the same tool-surface
fingerprint.

### Flags (`litmus`)

| Flag | Effect |
|------|--------|
| `--json` | Emit the full canonical `EvidenceBundle` instead of the human summary. |
| `--bearer <token>` | Bearer auth for an HTTP target (or set `LITMUS_BEARER`). |
| `--header "Key: Value"` | Add a custom request header (repeatable). |
| `--allow-state-changing` | Permit calls to state-mutating tools during dynamic probes. |

### Environment

| Var | Effect |
|-----|--------|
| `POLYGRAPH_API_URL` | Set to `https://polygraph.so` to pin the evidence bundle and get a publish/mint hand-off URL. Unset = fully offline run. |
| `LITMUS_BEARER` | Bearer token for HTTP auth. |
| `LITMUS_STDIO_ISOLATION` | Set to `docker` to **require** Docker isolation for stdio targets (fail-closed if Docker is unavailable). |

### Requirements & exit codes

- **Node ≥ 18.**
- **Docker optional** — without it the egress probe (C-02) is skipped and the grade is capped
  at **B**. A **remote/HTTP target also caps at B**, since it can't be sandboxed for egress —
  that's a property of the measurement, not a knock against the server. With
  `LITMUS_STDIO_ISOLATION=docker`, isolation is mandatory.
- **Exit codes:** non-zero on a failing grade (**D/F**), zero on a passing grade (**A/B**) —
  drop `litmus` into CI to gate a dependency on its behavioral grade.

### Human output

```
→ litmus · npm/@modelcontextprotocol/server-filesystem
→ version 0.1.0
→ C-01 pass · C-02 pass · C-03 pass
→ fingerprint 0x1a2b3c4d…5e6f7890
→ grade: A
   All three categories passed. No injection, no unexpected egress, no data leak.
```

On failure the summary lists the top HIGH-severity findings (tool name, finding kind,
snippet). The `--json` bundle carries everything (see
[`methodology.md`](methodology.md#the-evidence-bundle)).

---

## MCP server (`polygraphso-litmus-mcp`)

Embed polygraph in Claude, Cursor, or any MCP client so your agent can grade and verify
servers inline. Tools:

- **`run_litmus`** — grade a server and return grade, per-category findings, fingerprint, and
  (when `POLYGRAPH_API_URL` is set) a publish hand-off.
- **`verify_attestation`** — read a server's onchain grade and return the attested grade,
  fingerprint, report CID, and revocation/network status. Recompute the live fingerprint and
  require it to equal the attested one before trusting the server.

```json
{
  "mcpServers": {
    "polygraph": {
      "command": "npx",
      "args": ["-y", "-p", "@polygraphso/litmus", "polygraphso-litmus-mcp"],
      "env": { "POLYGRAPH_API_URL": "https://polygraph.so" }
    }
  }
}
```

See [`bankr-integration.md`](bankr-integration.md) for the verify-then-execute pattern.

---

## Programmatic use

```ts
import { runLitmus, gateDecision, liveFingerprint, readAttestation } from "@polygraphso/litmus";

const bundle = await runLitmus("npm/@scope/server");   // → EvidenceBundle { grade, categories, fingerprint, … }

const attestation = await readAttestation("npm/@scope/server");
const live = await liveFingerprint("npm/@scope/server");
const decision = gateDecision(attestation, live);      // → { action: "pay" | "refuse", reason }
```
