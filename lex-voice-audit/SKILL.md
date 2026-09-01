---
name: lex-voice-audit
description: Audit an agent account's recent posts for machine tells. Hedge creep, template autocomplete, engagement bait, cadence patterns. Returns a graded scorecard with quoted evidence, a per-account banned list, and three rewrites. Load when an account starts sounding like every other bot.
tags: [social, agents, writing, audit]
version: 2
metadata:
  clawdbot:
    emoji: "🎛️"
    homepage: "https://github.com/lexispawn/skills"
---

# lex-voice-audit

Nobody follows an account that sounds generated. The failure is rarely one bad post. It is drift: twenty posts, each three percent more templated than the last. This skill is the periodic instrument check.

## When to load

- Monthly, per posting account (schedule it, see below)
- After changing prompts, models, or personality files
- When engagement drops with no market cause
- Before scaling up a posting automation

## Inputs

The account's last 30 to 50 posts.

- X: paste-first. The operator pastes the posts, or they arrive in the thread that summons the audit. Host timeline reads are gated on most runtimes; when the host offers no native pull, ask for the paste and say so plainly.
- Farcaster: pull natively through the connected surface.
- Never scrape X through mirrors or third-party frontends. A fragile mirror returns a partial window, and a partial window scores as drift that is not there.

## The audit

Score each dimension 0 to 5. Quote the evidence. No claims without quoted receipts.

**1. Hedge density.** Count: maybe, could, might, seems, likely, "we think". Healthy is under one hedge per ten posts.

**2. Template autocomplete.** The phrases that write themselves: "excited to announce", "big things coming", "stay tuned", "just getting started", "let that sink in". Each occurrence is a tell.

**3. Cadence tells.** Uniform sentence lengths, dash chains, "X isn't just Y. It's Z." constructions, triple parallel closers. Machines are rhythmic. People are ragged.

**4. Engagement bait.** "Thoughts?", "who's with me", ratio fishing, question-mark endings above 30% of posts.

**5. Emoji and hashtag drift.** The direction and rate of change matter more than the count.

**6. Specificity ratio.** Posts carrying a number, a name, a link, or a date, versus posts of pure mood. Healthy accounts run above 60% specific.

**7. Repetition entropy.** The same opener twice in ten posts is a pattern. Three times is a template.

## Output contract

1. Scorecard: seven lines, each with quoted evidence
2. Verdict: one plain line stating what this account sounds like right now
3. Banned list for this account: the exact phrases and constructions it leans on
4. Three rewrites: the worst three recent posts, redone in the account's own claimed voice
5. One structural fix: the single highest-yield change

## Bankr-native uses

- Schedule as a monthly automation: run the audit on the last 40 posts and deliver the scorecard.
- Run against an account you admire to extract what it does differently.
- Pair with lex-memetic-density for the rewrite pass.

The full tells catalog with examples: references/tells.md.
