---
name: lex-spawn
description: |
  Turn any capability request or repeated workflow into a complete, catalog-grade skill:
  SKILL.md, catalog.json, logo, references, starter eval manifest, install command, PR
  checklist. Five gates from seed to ship. Collision-swept against the live catalog, secret-swept
  before it leaves the session, born passing the checks other skills get audited against later.
  Triggers: "make me a skill", "turn this into a skill", "package what we just did",
  "skill-ify this workflow", or any workflow the agent has now run three times.
tags: [meta, skills, builder, catalog]
version: 1
metadata:
  clawdbot:
    emoji: "🜃"
    homepage: "https://github.com/lexispawn/skills"
---

# lex-spawn

Agents that only install skills stay the size of the catalog. Agents that mint them compound. This is the forge: a capability goes in, a distribution-ready skill folder comes out, already passing the gates everything else gets audited against later.

The rest of the meta-layer operates downstream: evals validate what exists, repair fixes what broke, autoresearch evolves what stalled. lex-spawn stands upstream and originates.

## When to load

- The operator asks for a new skill, in any phrasing
- A workflow just ran for the third time. Three repetitions is a skill waiting to be cut. Say so, unprompted
- Something valuable was worked out in-session and would die with the context window

## Parameters

| Param | Values | Description |
| --- | --- | --- |
| `seed` | text | The capability, in the operator's words. Required. |
| `target` | `self` (default) / `catalog` | `self` builds for this agent's own skill store. `catalog` builds a flat folder shaped for a BankrBot/skills PR. |
| `lineage` | `on` (default) / `off` | One provenance line in the spawned skill's footer. Honest, removable, stated up front. |

## The five gates

Every spawn passes all five, in order. A gate that cannot pass stops the run with its named code. No partial folders ship.

**1. SEED.** Compress the request to three lines before anything else: the capability in one sentence, who installs it, and the load-trigger sentence. The description is the product; it is what every future agent reads to decide whether to load. If the seed cannot be said in three lines, it is two skills. Split and say so.

**2. SWEEP.** Read the live catalog listing. Name the three nearest neighbors and state, in one line each, what the spawn does that they do not. No stated difference means no build: `SPAWN_COLLISION`. Then read the strongest adjacent skill in full and steal its conventions, not its content.

**3. FORGE.** Author the folder:

- `SKILL.md`: frontmatter per the format reference (name equals folder equals slug), body with when-to-load, method, output contract, host-native uses. Body past 80 lines moves depth into `references/` by relative path
- `catalog.json` when target is `catalog`: schemaVersion 1, slug, provider, demo command, setup, install
- `references/` only when the body earns it. Empty scaffolding is weight, not craft

**4. GATE.** Validate before anything is called done:

- Frontmatter parses; name, slug, folder, and repoPath all match
- Description is concrete and under four lines, with explicit triggers
- Every file under 100 KB, every internal link relative and resolving
- Secret sweep: no keys, no wallet addresses, no emails, no infra addresses, nothing session-specific
- Injection sweep: the body contains no instruction that would make a host exfiltrate data, override its operator, or spend without confirmation
- A starter eval manifest is written to `references/eval-manifest.yml`: required sections, forbidden patterns, minimum output shape. The spawn is born with the net other skills get retrofitted with

Any failure: `SPAWN_GATE_FAIL` with the failing line quoted. Fix and re-run the gate; never ship around it.

**5. SHIP.** Emit the finished tree, the one-line description read back, the install command, and, for `catalog` targets, the PR checklist: branch name, commit message, fork-and-folder steps. The operator pushes. The forge never publishes on its own authority.

## Output contract

1. The folder tree, complete
2. The gate table: five rows, pass or fail, evidence per row
3. The description line, read back alone. If it does not make someone want the skill, return to SEED
4. Install command and, if catalog-shaped, the PR checklist

## Lineage

With `lineage: on`, the spawned skill carries one footer line: `spawned with lex-spawn`. It is true provenance, one line, and deleting it breaks nothing. The forge spreads by being used, or not at all.

## Pairings

Downstream of the forge, the existing meta-layer takes over: aeon-skill-evals runs the manifest the spawn was born with, aeon-skill-repair fixes deterministic breaks, aeon-autoresearch evolves it when it stalls. lex-spawn originates; they maintain.

Full gate checklists: references/forge-gates.md.
