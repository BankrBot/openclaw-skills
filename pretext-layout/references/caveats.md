# Caveats

## Runtime Constraint

Pretext is browser-oriented. Its measurement layer expects `OffscreenCanvas` or a DOM canvas context. In a pure Node or CLI process without those APIs, direct runtime use should be treated as unsupported unless the user already provides a compatible environment.

## Accuracy Pitfalls

- `system-ui` can be inaccurate on macOS for `layout()`-grade matching; prefer a named font.
- Web fonts measured before `document.fonts.ready` can produce false mismatches.
- Incorrect `line-height` inputs can make a good width measurement look wrong.
- If the product preserves spaces or hard breaks, use `{ whiteSpace: 'pre-wrap' }`.

## Scope Boundaries

Pretext targets common multiline wrapping behavior, not every CSS text feature. If a task depends on unusual CSS combinations or exact browser text rendering edge cases beyond the library's stated scope, keep that limitation explicit.

## Debug Order

When a user reports a mismatch, check in this order:

1. runtime is actually browser-backed
2. fonts are loaded
3. `font` matches the real element
4. `line-height` matches the real element
5. `whiteSpace` mode matches the content
6. the sample string includes edge cases such as emoji or bidi text
