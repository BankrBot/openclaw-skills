# Using defi-native in ChatGPT

ChatGPT and Codex are different products, and only one of them can install a skill.

| Product | Can it install the skill? | How |
|---|---|---|
| Codex (CLI, IDE, cloud) | Yes | `npx skills add emlai/defi-native-skill` |
| Claude Code, Cursor, Grok, and 70+ others | Yes | Same command |
| ChatGPT chat window | No | Port it as a Custom GPT, below |

The ChatGPT chat window has no filesystem, so there is no directory for a skill
to be installed into. What you can do is carry the same instructions and the same
reference material across as a Custom GPT.

## Custom GPT setup

1. Download this repo (Code, then Download ZIP) and unzip it.
2. In ChatGPT: sidebar, GPTs, Create. Name it `defi-native`.
3. Paste `INSTRUCTIONS.md` from this folder into the **Instructions** box.
4. Under **Knowledge**, upload these 18 files (the limit is 20):
   - `SKILL.md`
   - everything in `references/` (15 files)
   - `manifest.json` and `api-routes.json`
   - two slots spare, so you can add `examples/assessment-example.md` if you want a worked example
5. Under **Capabilities**, turn on **Web Search**.

Run `python3 scripts/pack_chatgpt.py` from the repo root to get those files
collected into one folder ready to drag in.

## Why the instructions are a separate file

`SKILL.md` is about 10,700 characters. ChatGPT caps the Instructions field near
8,000. `INSTRUCTIONS.md` is a condensed version of the same content: the eight
prime directives, the routing table, the working loop and the output rules, at
roughly 6,600 characters. Nothing was invented; it is a compression.

## What you lose

- **Automatic loading.** A real skill wakes up when the subject matches. A Custom
  GPT is always on, so say *use defi-native* if it drifts.
- **Live data**, unless Web Search is enabled. Dating every number is half of what
  this skill does, so enable it.
- **Room to grow.** This uses 18 of ChatGPT's 20 Knowledge slots. Two more
  reference files and something has to give. `pack_chatgpt.py` fails loudly
  rather than truncating when that happens.

## Keeping it current

There is no update command here. When the skill releases a new version, download
the repo again and re-upload the changed files. `CHANGELOG.md` says what moved.
