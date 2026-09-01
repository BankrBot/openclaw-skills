# Usage Patterns

## `prepare()` + `layout()`

Choose this pair for:

- chat bubbles
- message lists
- feed cards
- virtualization
- resize-driven height recalculation
- scroll anchoring

Mental model:

- `prepare()` does analysis and measurement once.
- `layout()` is the cheap repeat call for each width.

## `prepareWithSegments()` + `layoutWithLines()`

Choose this when the caller needs actual line text and widths for fixed-width layouts.

Typical uses:

- drawing text into canvas
- SVG text placement
- editorial or poster-like layouts
- custom line highlighting

## `walkLineRanges()`

Choose this when the caller needs geometry without building line strings.

Typical uses:

- shrink-wrap width search
- balanced-width experiments
- width-vs-height optimization loops

## `layoutNextLine()`

Choose this when line widths vary while the paragraph flows.

Typical uses:

- text wrapping around floated media
- magazine-like irregular columns
- staged layout where each row has a different available width
