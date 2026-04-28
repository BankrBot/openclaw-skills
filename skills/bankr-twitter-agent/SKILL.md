# Skill: twitter-agent
> Build and run one or more Twitter/X agents, each with a distinct personality, storyline, and post-image library.

# Twitter Agent Skill

This skill provides a framework for creating, managing, and automating Twitter/X agents with persistent personalities and voices. It supports running multiple agents side-by-side, each with its own files and (optionally) its own X account.

## Prerequisites

### X Account Setup (REQUIRED — Do This First, Per Agent)

Every agent's X account MUST be marked as an **automated account** before it posts a single tweet. X requires this disclosure; skipping it is the fastest way to get suspended.

**Exact path:**
1. Log in as the agent account on x.com.
2. Go to **Settings and privacy** → **Your account** → **Account information**.
3. Scroll to **Automation** and tap it.
4. Enter the password when prompted.
5. Set **Managing account** to the human/handle responsible for the bot and save.

Direct link (while logged in as the agent account): https://x.com/settings/account/automation

This adds the "Automated by @…" label to the profile and replies. Non-negotiable — do this once per agent account.

### Environment Variables (Default + Per-Agent Override)

This skill supports a single default credential set (for the primary / only agent) AND per-agent overrides (when running multiple agents with distinct X accounts).

**Default credentials** (used by the primary agent or any agent that does not have overrides):
- `X_API_KEY`
- `X_API_KEY_SECRET`
- `X_ACCESS_TOKEN`
- `X_ACCESS_TOKEN_SECRET`

**Per-agent overrides** (optional; only required when a second+ agent uses a different X account):
- `X_API_KEY_{SLUG_UPPER}`
- `X_API_KEY_SECRET_{SLUG_UPPER}`
- `X_ACCESS_TOKEN_{SLUG_UPPER}`
- `X_ACCESS_TOKEN_SECRET_{SLUG_UPPER}`

`{SLUG_UPPER}` is the agent's slug uppercased with hyphens converted to underscores. Example: the agent at `/agents/tn100x-intern/` looks up `X_API_KEY_TN100X_INTERN` first.

**Resolution order at post-time:**
1. Look up `X_*_{SLUG_UPPER}` for the target agent's slug.
2. If any of the four suffixed vars is missing, fall through to the default `X_*` set.
3. If still unset, error with a message naming both env var forms and the slug.

Generate all keys from the [X Developer Portal](https://developer.x.com/en/portal/dashboard) with **Read and Write** permissions enabled.

### Approval Channel for Flagged Drafts (Optional)

When a draft hits a guardrail, the automation does not post it — it ends its run by surfacing the draft in its final output message so you can approve or reject manually. Where that final message gets delivered is up to you: Bankr automations natively support **Telegram** (link Telegram once, select it as the output destination per automation, no bot token or custom code needed) but any destination Bankr automations support works. If you don't configure an output destination, flagged drafts are still logged to the `## Pending Approval Queue` in storyline.md — you'll see them on the next manual session.

## Agent Directory Structure

Each agent lives under its own folder at `/agents/{slug}/`. A top-level index file lists all agents. Every agent folder follows a predictable layout so automations and manual sessions can discover files the same way.

```
/agents/
  index.md                       ← TOP-LEVEL INDEX: lists all agents + path to each bundle.md
  {agent-slug}/
    bundle.md                    ← PER-AGENT MANIFEST: agent metadata + paths + fileIds for every file this agent uses
    personality.md               ← voice, style, vocabulary rules (required)
    storyline.md                 ← narrative history, entry log (required)
    post-images/                 ← library of images the agent can attach to posts
    references/                  ← (optional) arc-state, trade ledgers, trading configs, any other per-agent docs
    archive/                     ← pre-compaction storyline snapshots
  {next-agent-slug}/
    bundle.md
    ...
```

**How the agent discovers files at runtime:**
1. The user names the agent (slug, handle, or "default agent"). If ambiguous, read `/agents/index.md` and ask.
2. Read `/agents/{slug}/bundle.md` — this is the manifest. Every other file path is resolved through it.
3. Read the files the current operation needs (always personality + storyline; references as needed).

### Top-Level Index: `/agents/index.md`

A simple markdown table listing every agent. Minimal required columns:

```markdown
# Twitter Agents Index

| Slug | Handle | Bundle |
|------|--------|--------|
| tn100x-intern | @theinternbot | /agents/tn100x-intern/bundle.md |
| {next-slug} | @{next-handle} | /agents/{next-slug}/bundle.md |
```

### Per-Agent Bundle File: `/agents/{slug}/bundle.md`

The bundle is the manifest. It declares agent metadata and paths to every file this agent uses. Template:

```markdown
# Agent Bundle: {Display Name}

## Metadata
- **agent_slug**: tn100x-intern
- **agent_name**: The TN100x Intern
- **x_handle**: @theinternbot
- **x_account_url**: https://x.com/theinternbot
- **created**: 2026-04-22
- **env_var_prefix**: TN100X_INTERN  (uppercase slug used in X_API_KEY_{PREFIX} etc.; omit to use default X_* vars)

## Files (required)
- **personality**: /agents/tn100x-intern/personality.md  (fileId: …)
- **storyline**: /agents/tn100x-intern/storyline.md  (fileId: …)

## Files (optional)
- **arc_state**: /.memory/project_intern_trade_awareness.md  (fileId: …)
- **trade_outcomes**: /intern/trade-outcomes.md  (fileId: …)
- **trading_config**: /intern/trading-config.md  (fileId: …)

## Post-image library
- **post_images_folder**: /agents/tn100x-intern/post-images/
- Filename convention: descriptive, kebab-case (e.g. `intern-at-desk-plus38.png`).
- Pulled at post-time by reading the filename from the folder; no manifest needed.

## Archive
- **archive_folder**: /agents/tn100x-intern/archive/
```

Bundle.md is the single source of truth for "where does this agent keep X". If a file lives outside `/agents/{slug}/` (e.g. legacy paths at root or in `/.memory/`), the bundle's path entry just points at the current location — files don't have to be moved to be listed.

### Post-image Library: `/agents/{slug}/post-images/`

Every agent has a folder of images it can attach to posts. Usage:
- The user drops images into this folder (hand-drawn art, designed graphics, screenshots, reaction images — anything that might get attached to a tweet).
- When drafting a tweet that wants an image, reference a file from this folder by name.
- Posting uploads the image as media via the X v1.1 media endpoint, then attaches the returned `media_id` to the v2 tweet call.
- Prefer user-provided images when available. If none fit, text-only post is the default.

## The Personality & Storyline System

Every agent requires, at minimum, `personality.md` and `storyline.md` in its folder.

### Building a Personality

If an agent has no personality.md, walk the user through creating one by asking:

1. "what's the account about? give me the elevator pitch"
2. "how would you describe the vibe? pick a few: sharp, witty, degen, serious, chaotic, chill, academic, edgy, wholesome, provocative, technical, meme-heavy"
3. "what topics do you want to tweet about? what's strictly off-limits?"
4. "short punchy tweets or longer form? threads?"
5. "emojis? hashtags? lowercase or proper grammar?"
6. "any signature phrases or words you always use?"
7. "give me 2-3 example tweets that sound like you — or accounts you want to sound like"
8. "is there a character or persona the account should tweet as? or is it just you?"

Save as `/agents/{slug}/personality.md` and register the path in bundle.md.

### Pre-Flight Checklist

Before composing or posting any tweet, the agent MUST:
1. Resolve the target agent slug (from the user's request or the default agent).
2. Read `/agents/{slug}/bundle.md` to discover all file paths.
3. Read `personality.md` and `storyline.md` via the paths in bundle.md.
4. If the bundle declares optional files (arc_state, trade_outcomes, trading_config, etc.), read the ones relevant to the current operation.
5. Filter the proposed content through the personality directives and ensure it continues the storyline.
6. Cross-reference drafts against storyline.md to prevent repeating jokes, themes, or phrases already used.
7. Run the Guardrail Check (below) on every draft.
8. If attaching an image, read from `/agents/{slug}/post-images/` and confirm the file exists.
9. After posting, update `storyline.md` with the new entry using `edit_file`. Update any declared arc_state file if the operation advances narrative state.

## Guardrails (CRITICAL — Apply to Manual AND Automated Posts)

These apply to every tweet the agent drafts for any agent, manual or scheduled. A draft that violates any of these routes to approval instead of posting.

### Never Reply Unprompted (Hard Rule)

The agent MUST NEVER reply to a post it was not invited into. There are exactly three legal post types:

1. **Top-level posts** composed by the agent itself.
2. **Replies to mentions** — only when the agent's handle is *explicitly* tagged as a standalone `@handle` token in `text`.
3. **Replies to comments on the agent's own posts** — `in_reply_to_user_id === agentUserId` AND the conversation root is authored by the agent.

Anything else is FORBIDDEN and must be dropped from the draft set before the guardrail check runs. Quote-tweets of strangers, reply-chains the agent isn't tagged in, trending-topic replies, drive-by replies to big accounts — all prohibited under autonomous operation.

Mention-scan filter (enforce in the fetch step):
- Keep a mention only if `text` contains the agent's `@handle` as a standalone token.
- OR keep it if `in_reply_to_user_id === agentUserId` AND the conversation root is authored by the agent.
- Discard everything else before ranking.

### Hard Blocks (Always Route to Approval)

1. **Never autonomously tag `@bankrbot`.** Bankr's X agent executes onchain actions when tagged from a wallet-linked account. Any tweet mentioning `@bankrbot` — top-level or reply — MUST be surfaced for approval. Every time.
2. **Never post onchain-action-looking content autonomously.** EVM address regex `0x[a-fA-F0-9]{40}`, Solana addresses, "send" + ticker (e.g. "send 100 USDC"), signed-message patterns, anything that reads like a transaction instruction → route to approval.
3. **Never post pre-declared arc milestones autonomously.** storyline.md lists approval-gated milestones under `## Approval-Gated Milestones`. Drafts matching those route to approval.
4. **Never engage autonomously with flagged accounts.** storyline.md lists VIPs under `## Approval-Gated Accounts` (project founders, sister brands, other wallet-linked agents). Replies to those accounts route to approval.

### Follower-Weighted Approval

- Replies to accounts with **>50k followers** → approval.
- Replies to accounts with **1k–50k followers** → autonomous if they clear all other guardrails.
- Replies to accounts with **<1k followers** → autonomous only if setup quality is strong (not generic "gm" or emoji spam).

### Skip List (Automations Filter These Out Entirely)

- FUD / rug accusations
- Political content
- Requests for financial advice
- Obvious spam / tag-farm threads (3+ unrelated @s stacked)
- Accounts shilling unrelated tokens
- Any mention the storyline marks as already-replied-to

### Approval Routing

When a draft hits a guardrail, the automation:
1. Does NOT post it to X.
2. Includes the draft in its final output message: draft text, flag reason, target tweet ID (if reply), author handle + follower count, and a suggested approve/reject command.
3. Appends a `pending-approval` entry to storyline.md under `## Pending Approval Queue`.
4. Delivers via the configured output destination (e.g., Telegram).
5. Waits for the user to manually approve (e.g. "approve pending draft {id}") or reject.

## Reply Workflow

### Step 1: Scan Mentions
Use `execute_cli` with `twitter-api-v2@1.17.2` to fetch recent mentions:
- Fetch mentions via `userMentionTimeline`
- Include author follower counts for prioritization
- Flag which mentions reply to which of the agent's tweets
- Cross-reference against storyline.md's replied-to list
- **Apply the "Never Reply Unprompted" filter** before ranking

### Step 2: Read Storyline
Load storyline.md BEFORE drafting. Extract:
- Already-replied tweet IDs
- Used jokes / themes / phrases
- Current narrative state
- Approval-gated milestones + accounts

### Step 3: Prioritize
1. High-follower accounts first (10k+ = priority for reach, subject to follower-weighted approval)
2. Good setup lines
3. Easy layups
4. Skip per Skip List

### Step 4: Draft Replies + Optional New Post
- 4–6 replies per batch
- Optionally 1 new top-level post per session
- Cross-reference each draft against storyline
- Run Guardrail Check on each
- Manual mode: present all drafts for approval
- Automation mode: route flagged drafts to configured output destination

### Step 5: Post & Update
- Post approved tweets via `execute_cli` (~1.5s spacing between posts)
- Update storyline.md with all new entries via `edit_file`
- If the bundle declares an arc_state file and this post advances narrative state, update that file too

## Engagement Best Practices

- **4–6 replies + 1 top-level post per session** is the sweet spot
- **Never repeat content** — cross-reference storyline every time
- **Storyline-first drafting** — every reply references or advances a thread
- **Acknowledge big accounts via approval** — reach matters, tone matters more
- **Don't engage with FUD**
- **Never cold-reply**

## File Management

### CRITICAL: Use edit_file, Not create_file
When updating storyline.md, personality.md, bundle.md, or any arc_state file — ALWAYS `edit_file` with the existing fileId. `create_file` spawns duplicates. If duplicates exist, merge content into the newer/larger file and delete the older.

### Storyline File Structure
- **Current State**: location, mood, objective, environment
- **Narrative History**: chronological entries with tweet IDs, content, narrative impact
- **Key Characters & Objects**: recurring lore elements
- **Storyline Threads to Continue**: active plot threads
- **Approval-Gated Milestones**: arc-critical posts, never auto-posted
- **Approval-Gated Accounts**: including `@bankrbot`
- **Pending Approval Queue**: drafts awaiting human review

### Compaction Convention

When storyline.md exceeds ~200 KB or ~50 entries, compact:
1. Write the full current storyline.md to `/agents/{slug}/archive/storyline-archive-YYYY-MM-DD.md`.
2. In the live storyline.md: keep the last 20 entries verbatim, all Weekly Audit blocks verbatim, any Correction Note blocks verbatim, the Current State block verbatim.
3. Compact older entries into a `## Historical Digest` section: one line per entry with `Entry N | date | tweetId | title | 1-line summary` — drop full reply-sweep prose, mention-ranking justifications, per-draft skip rationales.
4. Preserve fully even when compacting: every tweet ID ever posted, every lore anchor (characters/objects/threads), every approval-gated milestone + status, every rested/saturated phrase list, every open Pending Approval Queue item.
5. Add a top-of-file banner: `> COMPACTED YYYY-MM-DD: Entries N–M compressed into Historical Digest; full snapshot at archive/...`
6. Update bundle.md if the archive path is new.

## Manual → Automated Rollout

Automations amplify whatever voice the agent currently has. If the voice is half-baked, automations will mass-produce half-baked tweets at schedule. Treat the shift from manual to automated as a deliberate step, not a switch.

### Why manual-first matters

- **Voice calibration**: personality.md is a hypothesis until you've posted 5–10 times in live conditions and adjusted. Automations lock in whatever's on the page today.
- **Storyline shape**: the first dozen entries establish recurring objects, signature phrases, and thread conventions. Automations trained on a thin storyline tend to over-rely on the few anchors that exist.
- **Guardrail pattern-match**: you learn which drafts *feel* off before the guardrail explicitly catches them. That intuition becomes new guardrail rules before automations lean on them.
- **Cadence sanity**: X's reach is fickle; you want to see which manual post types actually land before you schedule them three times a week.

### Readiness checklist (do NOT enable automations until all true)

- [ ] ≥ 10 top-level tweets posted manually.
- [ ] ≥ 2 reply sweeps completed manually (so you've seen real mentions and practiced the Never-Reply-Unprompted filter).
- [ ] personality.md has been edited at least once based on a live post that felt off (proves you've closed the calibration loop).
- [ ] storyline.md has ≥ 3 distinct "threads to continue" and ≥ 5 lore anchors (objects/characters/phrases).
- [ ] storyline.md has an explicit `## Approval-Gated Milestones` and `## Approval-Gated Accounts` section, populated.
- [ ] Zero "unprompted reply" incidents in the manual history (if there's even one, tighten the filter before automating).

### Rollout

Once the checklist clears, enable the full automation set at once — all five recipes. No staggered rollout required; the guardrails run identically whether one or five automations are live.

Recommended full set:
1. Storyline Audit (Recipe 5) — weekly, never posts.
2. Weekday Morning Post (Recipe 1).
3. Weekend Post (Recipe 4).
4. Reply Sweep — Midday (Recipe 2).
5. Reply Sweep — Evening (Recipe 3).

### Observation — what to watch for

Once automations are live, check daily for the first week, then spot-check:

- **Voice drift**: are autonomous posts recognizably the agent, or generic? If generic, personality.md needs more specificity.
- **Repetition**: is the automation reaching for the same 2–3 jokes / objects? Rest them in storyline.md with explicit "RESTED — do not use for N posts" notes.
- **Guardrail flag rate**: if flagged drafts are flooding, guardrails are too loose OR the mention filter is letting junk through. If silent for days, guardrails might be dropping legitimate replies.
- **Storyline growth**: every autonomous post should produce a new storyline entry. If entries are missing or stub-quality, the automation is skipping the ledger step.
- **X account health**: check for rate-limit warnings, shadowban indicators, the automated-label still being present.

### Rolling back to manual

If any of these happen, **disable automations immediately** and return to manual posting until fixed:

- Any autonomous reply to an account the agent wasn't tagged by.
- Any autonomous mention of `@bankrbot`, an EVM/Solana address, or onchain-action language that wasn't flagged to approval.
- Two+ posts in a week that the user would not have posted manually ("that's not the voice").
- storyline.md failing to update after a post.
- Any X platform warning, suspension notice, or rate-limit spike.

Rollback: (a) pause the automation in Bankr, (b) add a Correction Note to storyline.md describing what went wrong, (c) patch personality.md / guardrail rules / storyline gate lists as needed, (d) run 3–5 manual posts that demonstrate the fix, (e) re-enable the automation.

### Graduation

An agent is "fully automated" when the user hasn't had to reject a flagged draft for 7+ consecutive days and no rollback triggers have fired. Even graduated agents keep the approval-gated milestones + approval-gated accounts + @bankrbot hard blocks forever — full autonomy doesn't mean no gates.

## Automation Recipes

Bankr automations run an agent prompt on a cron schedule. Paste the prompt below **verbatim** into the automation's command field. 

### Paste Rules (IMPORTANT)

The prompt IS the command — no prefixes, no labels, no "run this:" framing. Every recipe is written as a direct imperative.

**Wrong:** `Weekday Morning Post: Run the twitter-agent skill...`
**Wrong:** `When this runs, the agent should post...`
**Right:** `Run the twitter-agent skill for agent {slug}...`

Every recipe takes an explicit `{slug}` — set this when creating the automation so the same recipe works for any agent.

### Cron Timezones

All Bankr crons run in UTC. ET offsets:
- DST (~Mar–Nov): UTC-4 → 9:00am ET = 13:00 UTC, 12:00pm ET = 16:00 UTC, 7:00pm ET = 23:00 UTC
- Non-DST: UTC-5

### Recipe 1: Weekday Morning Post (autonomous)

**Cron (UTC):** `15 13 * * 1-5`
**Output:** any Bankr-supported destination (Telegram recommended for real-time approval of flagged drafts)

> Run the twitter-agent skill for agent {slug}, weekday morning top-level post. Steps: (1) Load the twitter-agent skill. (2) Read /agents/{slug}/bundle.md. (3) Read personality.md and storyline.md via the paths in bundle.md. (4) Read any optional files the bundle declares as relevant to state (e.g. arc_state). (5) Fetch recent tweets from the account via the X API to confirm what was just posted and avoid immediate repetition — resolve credentials via X_*_{SLUG_UPPER} falling through to default X_*. (6) Compose ONE top-level tweet, 80–180 chars, following personality.md. It should advance or reference an existing thread from "Storyline Threads to Continue". (7) If a matching image exists in /agents/{slug}/post-images/ and fits the tweet, attach it. (8) Run the full Guardrail Check. If the best draft hits a guardrail, pick a different beat; if no safe beat fits, do NOT post — output the draft + flag reason as the final message (delivered to whichever destination the automation is configured for), and log to Pending Approval Queue. (9) Cross-reference storyline for phrase/joke repeats. (10) Post via execute_cli. (11) Append an Entry to storyline.md with tweet ID, content, narrative impact, new lore. (12) Update Current State if time/mood changed. (13) Update arc_state if declared and advanced. (14) Return a short final summary.

### Recipe 2: Reply Sweep — Midday (hybrid: autonomous + approval)

**Cron (UTC):** `30 16 * * *`
**Output:** any Bankr-supported destination (Telegram recommended for real-time approval of flagged drafts)

> Run the twitter-agent skill for agent {slug}, mentions reply sweep. Steps: (1) Load the skill. (2) Read /agents/{slug}/bundle.md, then personality.md + storyline.md. (3) Fetch last 50 mentions via X API using credentials resolved for {slug}. (4) Apply "Never Reply Unprompted": keep only tweets where the agent's @handle is a standalone token in `text`, OR replies where in_reply_to_user_id matches the agent's user ID AND conversation root is authored by the agent. Discard all others before ranking. (5) Filter to UNREPLIED by cross-referencing storyline. (6) Apply Skip List. (7) Rank by setup quality + follower count, pick top 2–4. (8) Draft each reply (60–200 chars) in voice, cross-referencing storyline for callbacks. (9) Run Guardrail Check per draft. Any @bankrbot mention, EVM/Solana address, onchain-action language, approval-gated milestone match, approval-gated account target, OR >50k-follower target → DO NOT POST. Include in final output message with draft + flag reason + target tweet ID + author handle + follower count. Log to Pending Approval Queue. (10) Post safe drafts via execute_cli with 1.5s spacing. (11) Append an Entry to storyline.md logging every posted reply AND every escalated draft. (12) Return a final summary.

### Recipe 3: Reply Sweep — Evening (hybrid)

**Cron (UTC):** `0 23 * * *`
**Output:** any Bankr-supported destination (Telegram recommended for real-time approval of flagged drafts)

*(identical to Recipe 2)*

### Recipe 4: Weekend Post (autonomous)

**Cron (UTC):** `0 15 * * 6,0`
**Output:** any Bankr-supported destination (Telegram recommended for real-time approval of flagged drafts)

> Run the twitter-agent skill for agent {slug}, weekend top-level post. Steps: (1) Load skill. (2) Read /agents/{slug}/bundle.md, then personality.md + storyline.md + any declared arc_state. (3) Compose ONE top-level tweet, 80–220 chars, in voice. Lean into weekend atmosphere or storyline-tagged weekend threads. (4) If a fitting image exists in /agents/{slug}/post-images/, attach it. (5) Run full Guardrail Check. Flagged → approval + Pending Approval Queue. (6) Post via execute_cli using credentials for {slug}. (7) Append Entry to storyline.md. (8) Return final summary.

### Recipe 5: Storyline Audit (no posting)

**Cron (UTC):** `0 2 * * 1`
**Output:** any Bankr-supported destination (Telegram recommended for real-time approval of flagged drafts)

> Run a storyline audit for the twitter-agent skill, agent {slug}. Steps: (1) Read /agents/{slug}/bundle.md, then storyline.md end-to-end. (2) Identify: threads dormant 10+ days that could revive, threads overused (3+ in a week), repeated phrases/jokes, lore contradictions, approval-gated milestone statuses, unresolved Pending Approval Queue entries, storyline.md size (flag if approaching compaction threshold ~200 KB / 50 entries). (3) Prepend a `### Weekly Audit [date]` entry to storyline.md with bullet notes. Do NOT post tweets. Do NOT generate character content. (4) Return audit notes as the final message.

### What NOT to Automate

- Major arc beats (flag as approval-gated milestones in storyline.md, keep manual)
- Any `@bankrbot` interaction — onchain risk, manual every time
- Flagged-account interactions
- Photo replies, quote tweets, threads — creative judgment stays manual
- Anything that triggers an onchain action from a wallet-linked X account
- Replies to posts the agent isn't tagged in and that aren't on the agent's own conversation tree

## Migration from Single-Agent Layout

If you already have `twitter-personality.md` and `twitter-storyline.md` at the root of your file system (pre-multi-agent), you do NOT have to move them. Bundle.md abstracts paths — it can point at current locations while you migrate on your schedule.

**Minimum migration (no moves):**
1. Create `/agents/index.md` with one row for your existing agent.
2. Create `/agents/{slug}/bundle.md` with paths pointing at current file locations (e.g. `personality: /twitter-personality.md`).
3. Done — every automation now resolves via bundle.md.

**Full migration (optional, when you're ready):**
1. Create `/agents/{slug}/` folder.
2. Move personality.md, storyline.md, archive snapshots into it.
3. Create `/agents/{slug}/post-images/` and move any existing image library into it.
4. Update bundle.md paths + fileIds.
5. Update `/agents/index.md`.

## User Prompts (Example Commands)

- "using the twitter-agent skill, draft a new tweet from {slug} and post it"
- "use the twitter skill to check {slug}'s mentions and reply in character"
- "using the twitter-agent skill, add a new agent called {new-slug}"
- "use the twitter skill to post from {slug} with image {filename} attached"
- "using the twitter-agent skill, compact {slug}'s storyline"
- "using the twitter-agent skill, run the storyline audit for {slug}"
- "using the twitter-agent skill, approve pending draft {id} for {slug}"

When only one agent exists in `/agents/index.md`, commands can omit the slug and the skill defaults to that agent.

## Technical Implementation

All Twitter interactions use `execute_cli` with `twitter-api-v2@1.17.2`.

### Credential Resolution Pattern

```javascript
function resolveCreds(slugUpper) {
  const k = (suffix) => process.env[`X_${suffix}_${slugUpper}`] ?? process.env[`X_${suffix}`];
  const creds = {
    appKey: k('API_KEY'),
    appSecret: k('API_KEY_SECRET'),
    accessToken: k('ACCESS_TOKEN'),
    accessSecret: k('ACCESS_TOKEN_SECRET'),
  };
  const missing = Object.entries(creds).filter(([,v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`Missing X creds for ${slugUpper}: ${missing.join(', ')}. Set X_*_${slugUpper} or default X_* env vars.`);
  return creds;
}
// slugUpper = bundle.metadata.env_var_prefix || slug.toUpperCase().replace(/-/g,'_')
```

### Posting Pattern

```javascript
const { TwitterApi } = require('twitter-api-v2');
const client = new TwitterApi(resolveCreds(slugUpper));

// Text-only tweet
const tweet = await client.v2.tweet('personality-filtered text');

// Tweet with image from /agents/{slug}/post-images/
const mediaId = await client.v1.uploadMedia('/path/to/agents/{slug}/post-images/filename.png');
const tweetWithImage = await client.v2.tweet({
  text: 'personality-filtered text',
  media: { media_ids: [mediaId] }
});

// Reply
await client.v2.reply('reply text', originalTweetId);

// Quote
await client.v2.tweet('quote text', { quote_tweet_id: tweetId });
```

### Mention Scanning Pattern

```javascript
const me = await client.v2.me();
const mentions = await client.v2.userMentionTimeline(me.data.id, {
  max_results: 50,
  expansions: ['author_id', 'in_reply_to_user_id', 'referenced_tweets.id'],
  'tweet.fields': ['created_at', 'conversation_id', 'in_reply_to_user_id', 'referenced_tweets', 'text', 'public_metrics'],
  'user.fields': ['username', 'name', 'public_metrics']
});

const myHandle = me.data.username.toLowerCase();
const myId = me.data.id;
const tagRegex = new RegExp(`(^|[^a-zA-Z0-9_])@${myHandle}([^a-zA-Z0-9_]|$)`, 'i');

const eligible = (mentions.data.data || []).filter(t => {
  const explicitlyTagged = tagRegex.test(t.text || '');
  const isReplyOnOurTree = t.in_reply_to_user_id === myId; // verify conversation root via conversation_id lookup
  return explicitlyTagged || isReplyOnOurTree;
});
```

### execute_cli Configuration

- packages: `["twitter-api-v2@1.17.2"]`
- includeEnvVars: `true` (required — injects the X keys)
- timeoutMs: `30000`
- runtime: sandbox has `bun`. `node` is NOT available. Use `bun script.js`.

## Troubleshooting

- **403 Forbidden**: App lacks Write permission. Enable Read+Write in X Developer Portal.
- **401 Unauthorized**: Keys wrong/expired. Regenerate. Confirm the right set was resolved (suffix vs default).
- **429 Rate Limit**: Free tier ~50 tweets/day. Wait and retry.
- **Duplicate tweet**: X rejects identical text. Vary the draft.
- **Duplicate storyline files**: Merge into newer/larger, delete older, always use edit_file going forward.
- **Wrong account posted**: Bundle's env_var_prefix mismatched. Confirm `X_*_{SLUG_UPPER}` values point at the intended X account.
- **`node: command not found`**: Use `bun script.js`.
- **Image upload fails**: Confirm file exists at `/agents/{slug}/post-images/{filename}`. X media upload uses v1.1 endpoint — v2 is tweet-text-only.
- **If you chose Telegram as the output and delivery is missing**: Link Telegram to Bankr; select Telegram output in the automation.
- **Suspension warning**: Verify automated-account label still set at https://x.com/settings/account/automation; audit recent posts for unprompted replies.

## Best Practices

- Label every agent account as automated first.
- Never reply unprompted. Three legal post types.
- Manual first per agent, automate later.
- Configure an output destination for flagged drafts — Telegram works well but isn't required; the Pending Approval Queue in storyline.md is the always-on fallback.
- Narrative continuity — reference prior events naturally.
- Character integrity — never break voice.
- Storyline updates every time.
- Cross-reference before posting.
- Prefer user-provided images from `post-images/` over AI-generated.
- Rate limits: ~50 tweets/day free tier.
- Pin packages: `twitter-api-v2@1.17.2`.
- `@bankrbot` approval, no exceptions.
- `edit_file` not `create_file`.
- Bundle.md is source of truth — keep paths + fileIds current after any move/rename.
- Compact storyline proactively at ~200 KB / 50 entries.