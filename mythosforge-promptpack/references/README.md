# references/ — mythosforge-promptpack

**This skill's content is the recipe library** — `../recipes.json` (bundled, curated). Each recipe:

```json
{ "id": "neon-noir", "title": "Neon noir cinematic", "model": "flux", "aspect": "landscape",
  "template": "{subject}, neon noir, ...", "negative": "flat, daytime, ..." }
```

- `template` must contain the `{subject}` placeholder (if absent, the subject is prepended).
- `model` is a suggested generator model (`flux` / `retro` / `nano`); `aspect` a suggested ratio.
- `negative` seeds the negative prompt; a `--theme` brandkit's `anti_feel` merges in.

## Recipe vs theme precedence (when `--theme` is used)

A **recipe owns composition** (shot type, framing, aspect); a **brandkit theme owns look** (palette,
feel, lighting). When both are set, the theme is intended to **dominate the look** — `composePrompt`
appends the theme's `feel_words` then `prompt_suffix` *last* in the prompt, so the theme wins.

Note: strongly-styled recipes (`neon-noir`, `storybook`, `cozy-isometric`) bake a look into the
template, so folding in an *opposing* theme can read as a blend rather than a clean override.
Look-neutral recipes (`concept-splash`, `product-hero`, `seamless-texture`) pair cleanly with any
brand token. (Future nice-to-have: a `look-neutral` vs `look-opinionated` tag per recipe.)

**Curating recipes is a design task** (owner: shiro / Designer). Add or refine entries in
`recipes.json`, or ship a domain-specific library and pass it with `--recipes <file>`. Keep each
recipe's style language concrete and its `{subject}` slot clean so the composed prompt reads well.
