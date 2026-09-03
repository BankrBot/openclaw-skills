# File Storage Reference

Every Bankr wallet has a persistent filesystem. Documents the agent generates for you, files you upload, installed CLI skills, and the agent's memory all live there — browsable, editable, and shared across every surface the agent runs on. Because state lives on your wallet, the CLI, the web terminal, the API, and the social platforms all see exactly the same files.

## Tiers

| | Free | Bankr Club |
|---|------|------------|
| Total storage | 1 GB | 10 GB |
| Max per-file size | 10 MB | 50 MB |
| Monthly downloads | 10 GB / month | 100 GB / month |

You don't need a Club subscription to use file storage — read, write, edit, and organize all work on the free tier. Club buys headroom, bigger single files, and roughly 10× the monthly download budget.

Quotas are checked at the moment of write and resolved from your current Club status, so subscribing raises your cap immediately with no migration. The per-file cap is separate from the total: a single file over the cap is rejected even with plenty of free space.

## Layout

```
/                    ← your root (permanent, wallet-scoped)
├─ .memory/          ← auto-managed agent memory
├─ cli/              ← installed CLI skills and manifests
└─ (your folders)

/runs/               ← run outputs (conversation-scoped, expiring) — see below
```

`/runs` is a reserved namespace: you can't create a folder of your own by that name.

## Using Files From Chat

Just ask — the agent has tools for creating, reading, updating, searching, moving, renaming, and deleting.

```
save this analysis as /research/unichain-vs-base.md
open my DCA plan
rename /portfolio-report to /reports/2026-q1
search my files for "hyperliquid"
delete the draft from yesterday
```

A **path** (`/research/notes.md`) works anywhere a file ID does, on every file tool. When the agent generates a document you get a clickable link in the chat that opens the built-in preview/editor.

## Run Outputs (`/runs`)

Your permanent files are one half of what the agent can see. The other is `/runs` — a scratch namespace holding what a run produced: deliverables a sandboxed skill wrote, and tool results too large to sit in the conversation.

- **Anything a sandboxed run writes to `./output/` is persisted automatically** to a `/runs/…` path when the call ends, and the run's summary lists those paths. You can ask the agent to read them back by path in a later turn, without re-running anything.
- **Oversized tool results are stored rather than pasted.** A large result is written to `/runs` with a short preview kept inline, so a big fetch doesn't crowd out the rest of the conversation — the agent re-reads the full file by path when it needs it.
- Ask for `/runs` listings the same way you ask for any other folder: *"list my run files"*, *"read /runs/… back to me"*.

| | Limit |
|---|---|
| Scope | Your wallet **and** the conversation — run files aren't visible from another thread |
| Retention | ~14 days, refreshed on each read or write, so an active conversation's files don't lapse |
| Per file | 10 MB |
| Per conversation | 100 MB across all run files |
| Per sandbox call | 25 files / 10 MB synced out of `./output/` |
| Content | **Text only.** Binary output (images, archives, PDFs) is refused — a run publishes those as artifacts instead |

Run outputs are deliberately not durable storage. When something matters beyond the conversation, have the agent save it into your own filesystem (`/reports/…`), which is permanent and wallet-wide.

## Asking Questions About a File

Some questions are about a file rather than its bytes — how many rows match, what the total is, which entries clear a threshold. Loading a 4 MB CSV into the conversation to count lines is slow and burns context, so the agent instead runs a small read-only pipeline against the file in a sandbox and returns only the answer. The file itself never enters the conversation.

```
how many rows in /exports/portfolio-2026-04.csv have a negative pnl?
count the ERROR lines in /logs/run.log
what's the highest score in /data/candidates.json?
```

Available on **every wallet** — no Club subscription needed — and you don't have to ask for it by name; the agent reaches for it when a question is an aggregation rather than a read.

**What it can run:** `jq` for JSON and JSONL, plus `grep`, `egrep`, `fgrep`, `awk`, `cut`, `sort`, `uniq`, `wc`, `head`, `tail`, `cat`, `tr`, `nl`, `rev`, `paste`, `column`, `comm`, and pipes between them. No redirection, command chaining, command substitution, or network access. It is read-only and can never modify the file.

**Limits:** text files only (not PDFs, images, or archives), up to roughly **5 MB** per query — above that the agent falls back to reading the file in ranges. Answers are capped at ~8,000 characters and the pipeline is cut off after **10 seconds**. If you hit either, narrow the question to a count or a top-N rather than a dump.

## CLI Commands

```bash
bankr files ls                                  # List files
bankr files ls --folder /research               # Scoped to one folder
bankr files upload ./report.csv --folder /data  # Upload from your machine
bankr files download <fileId>                   # Get a download URL
bankr files cat <fileId>                        # Print contents to stdout
bankr files edit <fileId> -f "old" -r "new"     # Find/replace (--all for every occurrence)
bankr files write <fileId> --from ./new.md      # Overwrite from a local file or stdin
bankr files search "hyperliquid" --limit 20     # Search names, extensions, descriptions
bankr files mkdir reports --parent /            # Create a folder
bankr files rm <fileId>                         # Delete (soft)
bankr files storage                             # Usage and quota
```

Listings can be scoped to a folder, and results come back with full paths — so a name that appears in several folders is unambiguous.

## REST API

The same filesystem is available under `/user/files/*` for programmatic access.

## Uploads and Downloads

Upload from the web at [bankr.bot](https://bankr.bot) → **Files** panel (drag and drop, or the upload button). Text (`.md`, `.txt`, `.csv`, `.json`, code files), images, and PDFs are supported; executables (`.exe`, `.sh`, `.bat`, `.com`) are blocked.

Each download counts against your monthly budget, which resets on the 1st of each month (UTC). The cap exists to stop Bankr storage becoming a free CDN — normal use never approaches it.

## Deletion

Deletion is **soft**: the file leaves listings immediately and is permanently deleted **24 hours later**. Within that window a support agent can restore it. After it, the file is unrecoverable.

## Quota Errors

A write that would push you over fails fast rather than half-succeeding:

```
Storage full (950MB of 1.0GB used, attempted 200MB). Join Bankr Club for 10.0GB.
```

The agent sees the same error and relays it, so you can delete files, pick a smaller write, or subscribe.

## Notes

- File ownership is per-wallet; files can't be shared with another wallet directly. Download and send it yourself.
- Letting a Club subscription lapse is non-destructive: your tier reverts to Free, existing files are preserved and remain readable and downloadable, and only new uploads that would exceed 1 GB are blocked.
