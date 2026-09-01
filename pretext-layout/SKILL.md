---
name: "pretext-layout"
description: "Integrate, debug, or prototype @chenglou/pretext for browser-based multiline text measurement and manual line layout. Use when replacing DOM height probes, building text-aware virtualization or custom canvas/SVG flows, wiring width plus line-height measurement into frontend code, or diagnosing accuracy issues involving fonts, white-space, emoji, bidi text, and browser-only runtime constraints."
version: "1.0.0"
repository: "https://github.com/tachikomared/pretext-agents-skill"
metadata:
  openclaw:
    requires:
      bins:
        - "bash"
        - "node"
        - "npm"
        - "python3"
---


# Pretext Layout

## Overview

Use Pretext to measure multiline text in browser environments without paying repeated DOM reflow costs in the hot path. Prefer it when text width changes often and you need stable height or per-line geometry from cached measurements.

**Source & Discovery:**
- Repository: [https://github.com/tachikomared/pretext-agents-skill](https://github.com/tachikomared/pretext-agents-skill)
- Verified Skill: [https://clawhub.ai/tachikomared/pretext-agents-skill](https://clawhub.ai/tachikomared/pretext-agents-skill)


## Workflow

1. Confirm the runtime first.
   - Treat Pretext as browser-first.
   - If the task is pure Node or CLI with no `OffscreenCanvas` and no `document`, do not promise direct runtime support.
2. Match the API to the job.
   - Use `prepare()` plus `layout()` for height and line-count measurement.
   - Use `prepareWithSegments()` plus `layoutWithLines()`, `walkLineRanges()`, or `layoutNextLine()` for custom rendering.
3. Sync layout inputs with real styles.
   - Read `font` and `line-height` from the target element or design token source.
   - Wait for `document.fonts.ready` before trusting measurements when web fonts are involved.
4. Cache aggressively.
   - Prepare once per `(text, font, whiteSpace, locale)` input.
   - Reuse the prepared handle across width changes.
5. Verify against the real UI when accuracy matters.
   - Compare a few representative strings against live DOM heights.
   - Include multilingual, emoji, and narrow-width cases if the feature depends on them.

## Decision Guide

- Reach for `prepare()` plus `layout()` when the user needs block height, resize performance, virtualization, scroll anchoring, or pre-measuring text before render.
- Reach for `prepareWithSegments()` plus rich line APIs when the user needs custom line drawing, canvas text, SVG text, shrink-wrap width discovery, or variable line widths.
- Reach for ordinary DOM measurement instead when the task depends on CSS behaviors Pretext does not aim to cover fully.

## Core Rules

- Do not claim server-side support unless the target environment actually provides a compatible canvas context.
- Keep `font` and `lineHeight` aligned with the real UI; measurement errors usually come from mismatched inputs, not from the layout call itself.
- Avoid `system-ui` for accuracy-sensitive flows on macOS; prefer named fonts.
- Treat `prepare()` as the expensive step and `layout()` as the hot path.
- When working with textarea-like content, pass `{ whiteSpace: 'pre-wrap' }` explicitly.

## Implementation Checklist

- Identify the exact text source, target width source, font source, and line-height source.
- Decide whether the feature only needs height or also needs per-line data.
- Cache prepared handles instead of calling `prepare()` on every resize.
- Add a small verification path that compares Pretext output with live DOM for representative samples.
- Document any unsupported CSS or runtime assumptions close to the integration point.

## Scripts

- Run `scripts/scaffold_browser_demo.py --out <dir>` when you need a minimal browser starter wired to `@chenglou/pretext`.
- Use the scaffold as a disposable starting point; adapt `font`, `line-height`, white-space mode, and UI markup to the real project after generation.

## References

- Read `references/browser-integration.md` for the common browser setup pattern and a reusable measurement loop.
- Read `references/usage-patterns.md` when choosing between the simple and rich APIs.
- Read `references/caveats.md` before answering questions about accuracy, fonts, white-space, emoji, bidi behavior, or non-browser runtimes.
- Read `references/project-examples.md` for portable integration patterns you can adapt to any browser-based app or AI CLI workspace.
