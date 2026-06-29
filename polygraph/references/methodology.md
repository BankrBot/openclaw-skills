# Polygraph Methodology — how a server gets its grade

Polygraph runs the **litmus** harness: connect to an MCP server the way an agent would,
fingerprint its exact tool surface, run four behavioral probe categories, and assign an
**A–F** grade with a deterministic, content-addressed evidence bundle. The harness is open
source and the run is reproducible — that is what makes a grade trustworthy.

## Connect & fingerprint

- **Transport:** `stdio` for local packages (npm/PyPI/path), **Streamable HTTP** for remote
  URLs.
- **Fingerprint:** `tools/list` → canonical JSON of each tool's `{name, description,
  inputSchema}` → `sha256` → `bytes32`. The fingerprint is the trust anchor: a grade is only
  valid for the exact surface it was measured against. If a server is graded and then changes
  its tools, the fingerprint no longer matches and any verifier should refuse (see
  [`bankr-integration.md`](bankr-integration.md)).

## The four probe categories

### C-01 — Tool-output injection
Does the server try to hijack the agent that calls it?
- **Static (1.1):** scan every tool name, description, and `inputSchema` for injection-shaped
  content — invisible/zero-width unicode, instruction mimicry ("ignore previous
  instructions…"), and markdown tricks. Deterministic; makes no calls.
- **Dynamic (1.2):** issue benign bait calls to each tool and scan the outputs for injected
  instructions echoed back to the agent.
- **Fail:** any HIGH-severity finding in either probe.

### C-02 — Permission / egress overreach
Does the server do more than it declares?
- **Declared-permission honesty (2.1):** flag tools that declare `readOnlyHint: true` but whose
  names carry destructive verbs (`send`, `delete`, `swap`, `sign`, `transfer`, …).
- **Unexpected egress (2.2):** run the server inside a hardened **default-deny Docker sandbox**
  with a network sinkhole; any outbound attempt is a finding.
- **Fail:** any HIGH-severity finding in 2.1, or any finding in 2.2.
- **Skipped** (not failed) only when 2.1 passes and 2.2 could not run — because no Docker
  sandbox was available, or because the target is a **remote/HTTP server** that can't be
  sandboxed for egress. Either way the grade caps at **B**. This is a property of the
  measurement, not a knock against the server: a remote B is not "worse than" a local A, since
  egress was never observed on the remote one.

### C-03 — Sensitive-data handling
Does the server leak secrets it was exposed to?
- **Output leak (3.1):** plant canary values in the environment and seed the working directory
  with fake secrets, exercise the tools, and scan outputs for any canary echo.
- **Egress leak (3.2):** scan the egress-sandbox capture for canary bytes. Degrades to
  `partial` without a sandbox; never silently dropped.
- **Fail:** any canary surfacing in either probe.

### C-04 — Adversarial-input handling
Does the server stay robust under hostile input? Both probes run only on non-state-changing
tools and require no Docker sandbox.
- **Malformed/oversized (3.1):** stress each tool with malformed and oversized inputs. **Fail**
  if the server crashes, hangs, or leaks an uncaught stack trace; a clean validation error or a
  benign result passes.
- **Jailbreak amplification (3.2):** feed jailbreak-pattern strings and scan the server's
  **outputs** with the C-01 injection scanners. **Fail only** if the server emits
  injection-shaped content it did not merely reflect from the input — a verbatim echo is
  excluded, so an honest echo/summarize tool is not penalized.
- **Fail:** any finding in 3.1 or any amplification finding in 3.2.
- A C-04 failure **caps the overall grade at D** (a robustness failure, not proven injection or
  exfiltration).

### Finding kinds
`invisible-unicode`, `instruction-mimicry`, `markdown-trick` (C-01) · `permission-mislabel`,
`egress` (C-02) · `canary` (C-03) · `crash`, `internals-leak`, `amplification` (C-04).
Each finding carries a severity and a snippet.

## Grade decision logic

| Grade | Condition |
|-------|-----------|
| **A** | C-01 pass · C-02 pass · C-03 pass · C-04 pass. |
| **B** | C-01 pass · C-02 **skipped** (no sandbox / remote target) · C-03 pass. Injection passed; egress unverified. |
| **C** | Reserved — not assigned by the current logic. |
| **D** | C-02 **fail** (unexpected egress / overreach) **or** C-04 **fail** (crash / internals-leak / amplification) while C-01 and C-03 pass. A robustness or overreach failure is serious but not proven injection or exfiltration, so the grade caps at D. |
| **F** | C-01 **fail** (injection) **or** C-03 **fail** (data leak). Active injection or a leak harms an agent that trusts the server. |

A grade is always paired with a rationale string explaining *why* — the harness never emits a
bare letter.

## The evidence bundle

`--json` (and the published record) emit a canonical `EvidenceBundle`:

- `grade`, `gradeRationale`
- `categories[]` — each with probe results and findings
- `toolDefs[]` (canonicalized name/description/inputSchema) and `toolDefsFingerprint` (bytes32)
- `methodologyVersion`, `ranAt`, resolved version
- harness info (Docker availability, stdio isolation mode) and a reproducibility disclaimer

Because the bundle is canonical and content-addressed (its CID is a hash of its bytes), two
honest runs of the same harness against the same server produce the same bundle and the same
fingerprint.

## Publishing a grade

The harness **grades and hands off**; it does not mint. Publishing a grade means recording it
as an **EAS (Ethereum Attestation Service) attestation on Base**, which binds:

`serverRef` · `toolDefsFingerprint` · overall grade · per-category verdicts (C-01/C-02/C-03/C-04) ·
evidence CID (the bundle, pinned to IPFS) · methodology version · run timestamp · resolved
version.

Run the harness with `POLYGRAPH_API_URL=https://polygraph.so` to pin the evidence bundle and
receive a browser hand-off to sign the attestation, or request publication at
[polygraph.so](https://polygraph.so). Once attested, the grade is discoverable by ref and
verifiable onchain by any agent.

## How much to trust it (disclosed limits)

- **Reproducibility is the anchor.** Open + deterministic harness ⇒ a false grade is
  falsifiable by re-running it.
- **A published grade is forgeable by its signer.** Trust comes from reproducibility and the
  fingerprint recheck, not from the signature alone. The read path binds to our EAS schema and a
  fixed Base RPC (fail-closed), and `gateDecision` checks revocation, expiry, and the server-ref +
  fingerprint binding. **Before routing value**, also require an attester allowlist and an accepted
  methodology version (`gateDecision` options), demand a grade whose **egress was actually verified**
  (a local A, not a remote/no-sandbox B), or — strongest — re-run the harness yourself and compare.
- **Evasion is the residual limit:** a server that detects the test context could pass grading
  and misbehave in production.
- Independent/unforgeable upgrades (staked bonds, zkTLS, TEE-backed runs, independent
  re-grading) are roadmap, not claimed today.

The canonical, versioned methodology lives at **[polygraph.so](https://polygraph.so)**; the
open-source harness is the source of truth for the exact probe and grade logic.
