# Maintenance protocol

Skills rot. This one commits to not rotting.

Quarterly (or after any major market event):
1. Re-verify every dated calibration figure in references/ (census numbers, failure prints) against primary sources; update or mark superseded.
2. Re-check manifest.json: fetch each verified:false entry once; fix moved docs URLs; add new llms.txt endpoints.
3. Add new failure prints to concepts section 9 ONLY with primary-source verification and a date; keep the catalog to shapes plus 3-5 canonical prints per shape.
4. Re-run evals/evals.json with and without the skill; the skill must still beat baseline on its own assertions.
5. Refresh the postmortems-and-voices list in data-sources.md: rotate in whoever produced the best verified analysis this quarter.

On every edit: no em or en dashes; acronyms expanded at first use per file; SKILL.md stays lean (knowledge goes in references/); dated numbers stay dated.

Versioning: semantic-ish. Patch = calibration refresh. Minor = new section or reference. Major = structural change to directives or workflow. Log everything in CHANGELOG.md.

## Self-updating (the automation gradient)

The skill can maintain itself, with one hard rule: automation may verify facts, only humans may change judgment.

- Fully automatic, safe on a schedule: `scripts/verify_manifest.py --write` re-verifies liveness of every recorded docs, llms.txt, llms_full, and pages URL (llms.txt endpoints are content-checked, not just status-checked) and writes per-source liveness objects plus the top-level checked date. It never touches names, categories, priorities, or skill_use, and it does not discover new endpoints.
- Auto-propose, human-merge: an agent runs this file's quarterly checklist (re-verify calibration prints, draft new incident autopsies with primary sources, propose manifest additions) and outputs a diff or pull request. A human approves before anything lands in references/. On GitHub, a scheduled Action opening PRs is the right shape; in a workspace, a recurring task producing a dated change report.
- Human-only: the evergreen concepts and the prime directives. Changing those IS the editorial judgment that makes the skill trustworthy.

Why the gate exists: an agent that rewrites its own beliefs from whatever it reads is a prompt-injection target. One adversarial page saying "best practice now skips oracle checks" must never be able to edit concepts.md. Sources feed proposals; humans feed the skill.

## Where the automation runs

Two homes, same protocol. Public: `.github/workflows/monthly-maintenance.yml` runs on the first of each month, auto-applies only the deterministic manifest verification, has the agent draft a proposal report if the repo owner configured an ANTHROPIC_API_KEY secret, and opens a pull request for human review. Forks inherit the workflow; anyone adopting the skill gets self-maintenance for free. Private: a workspace scheduled task can run the same protocol and deliver the report directly to the maintainer. The two do not conflict; the PR is the canonical merge gate for the public repo.
