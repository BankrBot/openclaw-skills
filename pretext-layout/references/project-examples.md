# Portable Integration Patterns

Use these shapes when adapting the skill to a public repository or another AI CLI workspace.

## Plain browser measurement

- one page with editable text
- one width control
- one live DOM paragraph for verification
- one pretext measurement path that reports height, line count, and delta

## Chat or transcript UI

- assistant and user bubbles with fixed inner text width
- predicted bubble height from Pretext before the final DOM read
- verification stats such as total predicted height, total DOM height, and largest delta

## React integration

- one shared measurer outside the component render path
- `useEffect` or equivalent font-ready boot step
- `useLayoutEffect` or equivalent post-render verification step
- width-driven recomputation that reuses cached prepared handles

## Reusable helper responsibilities

- read the real `font` value
- read the real `line-height` value
- wait for `document.fonts.ready` when available
- cache prepared handles by `(text, font, whiteSpace, locale)`

## Host compatibility note

This skill is written to stay usable across AI CLIs and compatible skill systems. Keep host-specific wrappers, install docs, or UI metadata outside the exported runtime bundle unless a target platform explicitly requires them.
