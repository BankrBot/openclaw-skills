# AGENTS.md: how to work on this repo (any agent, any harness)

defi-native is a public Agent Skill (SKILL.md + references/) plus its
marketing site (site/, deployed to https://defi-native.ai by GitHub
Pages on every push to main). This file is the operating manual for any
coding agent. CONTRIBUTING.md covers content rules for the skill body;
MAINTENANCE.md covers the upkeep policy.

## Hard conventions, every edit, no exceptions

- Never use em or en dashes. Commas, colons, periods, parentheses.
- Expand every acronym at first use per file.
- Every number carries an as-of date or is labeled a calibration example.
- Never invent a metric, count, or quote. Verify before writing.
- SKILL.md stays lean; knowledge lives in references/ and loads per task.
- The skill is read-only by design: it never constructs, signs, submits,
  or approves transactions. Do not weaken that language anywhere.

## Versioning (MAINTENANCE.md is canonical)

Patch = calibration refresh. Minor = new section or reference file.
Major = structural change to directives or workflow. Every release gets
a CHANGELOG.md entry, and the site changelog gets a plain-language entry.

## Gates: run these before any push

```
python3 scripts/verify_manifest.py --skip-network   # skill invariants, counts, caps
python3 scripts/build_site.py                       # site must match the skill
```

Both must exit 0. CI runs them on every PR (.github/workflows/pr-check.yml)
and the Pages deploy refuses drifted pages. What build_site.py enforces:
stat tiles match manifest/api-routes/glossary/evals counts, version
strings match SKILL.md on both pages, the update page offers the current
version, every must or core priority manifest source is named in the
data-sources list, and asset URLs carry current content hashes.

## Editing the site

- Pages: site/index.html and site/update/index.html. Shared styles and
  script: site/assets/site.css and site/assets/site.js.
- After ANY change to site/assets/site.css or site.js run
  `python3 scripts/build_site.py --stamp` to refresh the cache-busting
  hashes on both pages, then the gate. Skipping this fails the deploy.
- Source logos for the marquee live in site/assets/logos/.
- The GitHub star count is fetched live client side; the number in the
  HTML is only a no-JS fallback.

## Workflow

Branch, commit, push, open a PR, wait for the verify check, merge.
Merging to main deploys the site automatically. Do not push to main
directly. Do not commit anything from ../ (the parent folder holds
private research and memory; .gitignore guards it, leave those guards
alone). Show Emily before anything user-facing ships if she has not
already specified the exact copy.

## Skill releases

Update: SKILL.md version, manifest.json version and counts,
api-routes.json version, CHANGELOG.md, README.md counts, llms.txt
counts, site stat tiles and site changelog entry, the update page demo
line. The gates catch most of these; the CHANGELOG entry and site
changelog prose are on you.
