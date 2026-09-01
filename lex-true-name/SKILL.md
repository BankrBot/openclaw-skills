---
name: lex-true-name
description: Naming method for tokens, agents, and apps. Mouth-feel test, meaning stack, live ticker and handle collision sweep through Bankr reads, shortlist protocol from nine candidates to one. Load whenever anything needs a name that has to spread.
tags: [naming, launch, tokens, agents]
version: 2
metadata:
  clawdbot:
    emoji: "🔤"
    homepage: "https://github.com/lexispawn/skills"
---

# lex-true-name

The name is the first trade anyone makes with a thing: attention for a word. Most names lose that trade. This skill runs naming as method instead of mood.

## When to load

- Naming a token before deploy (name and ticker together)
- Naming an agent, app, webhook, or automation
- Renaming anything that never took

## The method

**1. Harvest nine candidates** from three pools, three each:

- Function pool: what it does, made strange
- World pool: the community's existing language (load the lex-token-lexicon file if one exists)
- Fusion pool: two unrelated words joined. Highest ceiling, highest miss rate

**2. Mouth-feel test.** Say each aloud three times fast. Kill anything that trips, needs spelling out, or reads two ways when written. Two syllables travel farther than four.

**3. Meaning stack.** A carrying name reads at least two ways at once: one reading is the function, one is the feeling. Kill single-layer names unless the single layer is unusually strong.

**4. Collision sweep, live, through Bankr.** For each survivor:

- Ticker check: ask for the price of and info on the candidate ticker. A live token with real volume kills the candidate.
- Handle check: X and Farcaster availability. In public-facing sweep reports, write every handle and profile path defanged: x[.]com/handle, never a live link. A live path posted under a verdict renders a stranger's profile card as the billboard for your report.
- Name check: resolve the candidate as an ENS name if it is name-shaped.
- History check: search the word plus "crypto". A prior rug wearing the name is inherited reputation.

**5. Spawn test.** A true name generates its own derivatives: a holder name, a verb form, a diminutive. Try each survivor in "we ___ed it" and "the ___ers". Names that conjugate, win.

**6. Shortlist three. Sleep on it. Pick one.** Present three with a one-line case each. The pick happens next session. Overnight kills infatuation names.

## Output contract

Return: the nine harvested, the kills with reasons at each gate, the final three with cases, and the collision-sweep evidence lines. Never present a name whose sweep failed. In any report that will be posted publicly, sweep evidence uses defanged paths only: the receipt is the claim plus the defanged path, x[.]com/handle, nothing that renders.

## Bankr-native uses

- Run before every token launch. Ticker collisions found after deploy are permanent.
- Name automations and webhooks at creation: named automations get maintained, unnamed ones get orphaned.
- Pair with lex-token-lexicon so new names land inside the world instead of beside it.
