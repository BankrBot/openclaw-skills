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
polygraphso list [--json]                       # every tracked server + adoption tier + status
polygraphso --version
polygraphso --help
```

Example output:

```
→ tracked · top 10 adoption
→ polygraph: A · version 0.1.0 · https://base.easscan.org/attestation/view/<uid>
```

Tracked-but-ungraded servers report `polygraph: not yet available` with a notify link;
behavioral grades are rolling out as the harness grades each server.

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
polygraphso-litmus check   <ref[@version]>                 # look up a published grade
polygraphso-litmus challenge <attestation-uid> <ref>       # dispute a grade by re-running it
polygraphso-litmus list                                    # list published grades
polygraphso-litmus --version | --help
```

`challenge` is the teeth behind reproducibility: re-run the harness against a server that
carries a grade and, if your result disagrees, you have a falsification anchored to the same
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
  at **B**. With `LITMUS_STDIO_ISOLATION=docker`, isolation is mandatory.
- **Exit codes:** non-zero on a failing grade (**D/F**), zero on **A/B/C** — drop `litmus` into
  CI to gate a dependency on its behavioral grade.

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
