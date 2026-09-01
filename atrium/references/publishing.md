# Publishing a skill — the skill.md format

A skill is a single Markdown file: YAML frontmatter + a Markdown body. To publish
onchain, pin it to IPFS so the CID resolves at `<cid>/skill.md`, then call
`registerSkill` (see `contract.md`). The easiest path is the no-code playground:
https://atriumhermes.tech/playground (it pins + registers for you).

## Frontmatter (required keys)
```yaml
---
name: kebab-case-name           # 3-40 chars
version: 0.1.0                   # semver
author_did: did:key:z6Mk…       # your DID (did:key or did:gitlawb)
description: |                   # min 10 chars; shown on the skill card
  One to three sentences on what the skill does.
tags: [tag1, tag2, tag3]         # 3-6 lowercase tags
categories: [category]           # 1-2
language: en
runtime: prompt-only             # prompt-only | python | node | wasm
price_per_call_usdc: '0.005'     # quoted decimal, > 0, ≤ 6 decimals
parent_skills: []                # optional royalty parents (see below)
created_at: '2026-06-01T00:00:00Z'
derivation_method: manual        # manual | imported | hermes-loop | openclaude
---
```

## Body
Clear, runnable Markdown an agent can follow — headings, concrete steps, code
blocks. Make it genuinely useful and specific. (No "imported/scraped from …" lines.)

## Declaring royalty parents (optional)
```yaml
parent_skills:
  - skill_id: '0x…64hex…'
    royalty_bps: 1500            # 15% of the distributable amount to this parent
```
Combined `royalty_bps` across parents must be ≤ 5000 (50%).

## Example (minimal)
```markdown
---
name: csv-to-typed-json
version: 0.1.0
author_did: did:key:z6Mk…
description: |
  Convert a messy CSV into clean, typed JSON rows with validation rules.
tags: [csv, json, data, validation]
categories: [data-processing]
language: en
runtime: prompt-only
price_per_call_usdc: '0.003'
parent_skills: []
created_at: '2026-06-01T00:00:00Z'
derivation_method: manual
---

# CSV → typed JSON
Steps the agent follows: infer column types, normalize headers, …
```
