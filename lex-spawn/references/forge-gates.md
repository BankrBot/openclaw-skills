# Forge gates: the full checklists

Every gate stops the run on failure with its named code. Quote the failing line in the report. Never ship around a gate.

## Gate 1: SEED

- [ ] Capability stated in one sentence, concrete verb, no abstractions
- [ ] Installer named: which kind of operator or agent wants this
- [ ] Load-trigger sentence written: the exact situation where a host should reach for it
- [ ] Three-line test passed. If the seed needs a fourth line, split into two skills and report both seeds

Abort: `SPAWN_SEED_SPLIT` (seed describes two skills; both seeds returned for the operator to choose)

## Gate 2: SWEEP

- [ ] Live catalog listing read this session, not from memory
- [ ] Three nearest neighbors named
- [ ] One line per neighbor stating what the spawn does that it does not
- [ ] Strongest adjacent skill read in full; its conventions noted (frontmatter style, table use, trigger phrasing)

Abort: `SPAWN_COLLISION` (a neighbor already does it; report the neighbor and stop)

## Gate 3: FORGE

- [ ] Folder name is the slug, lowercase, hyphenated
- [ ] SKILL.md frontmatter: name, description with explicit triggers, tags, version, metadata block
- [ ] Body sections in order: when to load, method or gates, output contract, host-native uses
- [ ] Body over 80 lines: depth moved to references/, linked by relative path
- [ ] catalog.json (catalog target only): schemaVersion 1, slug == folder == repoPath, provider, providerUrl, logo, demo, setup, install command
- [ ] No empty references/ or scripts/ folders

## Gate 4: GATE

Format:

- [ ] Frontmatter parses as YAML
- [ ] name == slug == folder == install repoPath
- [ ] Description under four lines, concrete, includes "Triggers:"
- [ ] Every file under 100 KB
- [ ] Every internal link relative and resolving

Secrets:

- [ ] No API keys or key-shaped strings, full or partial
- [ ] No wallet addresses belonging to the operator
- [ ] No emails, no server addresses, no session-specific paths

Injection posture (the spawn must pass what a security scan would check):

- [ ] No instruction directing a host to send data anywhere the operator did not name
- [ ] No instruction overriding a host's operator, confirmation flow, or spend limits
- [ ] No fetched-content-as-instructions pattern: external text is data, never directive
- [ ] No obfuscated blocks, encoded payloads, or instructions hidden in examples

Eval manifest (born-audited):

- [ ] references/eval-manifest.yml written: required_sections, forbidden_patterns, minimum output shape
- [ ] Manifest reflects the output contract, not aspirations

Abort: `SPAWN_GATE_FAIL` (failing check quoted)

## Gate 5: SHIP

- [ ] Full tree emitted
- [ ] Gate table: five rows, evidence per row
- [ ] Description read back alone, judged as the only thing a stranger sees
- [ ] Install command emitted
- [ ] Catalog target: PR checklist emitted (fork, branch `add-<slug>`, commit `Add <slug>: <one-line>`, folder at repo root, PR body with test cases)
- [ ] Lineage footer present if lineage is on, absent if off
- [ ] Stated plainly: the operator pushes; the forge does not publish

## The third-repetition rule

Track workflows across the session. On the third repetition of any multi-step workflow, surface one line: "this is the third run; want it as a skill?" Never build unprompted. The rule is an offer, not an action.
