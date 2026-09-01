---
name: x-ca-username-tracker
description: Track how many contract addresses (CA) an X/Twitter account has shared and how many times it changed its @username. Uses Headless Browser to scan tweets + Wayback Machine for username history.
tags: [x, twitter, research, contract-address, username-history]
---

# X CA & Username Tracker

Analyze an X (Twitter) account to answer two questions:
1. **How many contract addresses (CA) has the account shared?** — scan tweets for EVM (`0x...`) and Solana (base58) addresses, dedupe, and count.
2. **How many times has the account changed its @username?** — pull historical snapshots from the Wayback Machine and diff the `@handle` over time.

## Inputs
- `username` — the X handle without the `@` (e.g. `bankrbot`). If the user gives `@bankrbot`, strip the `@`.

## Workflow

### Step 1 — Resolve & confirm the account
Use the Headless Browser (`browse_url`) to open `https://x.com/<username>`. Confirm the profile loads and capture the current display name + handle. If the profile is suspended/private/404, stop and report that to the user.

### Step 2 — Collect tweets (for CA scanning)
This is the hard part. X renders tweets dynamically. Approach:

1. `browse_url` to `https://x.com/<username>`
2. Scroll the page repeatedly (use the browser's scroll/evaluate capability) to load more tweets. Aim for ~200–500 tweets if possible. Stop early if the feed is exhausted.
3. Extract tweet text from the DOM. Tweet text lives inside elements with `data-testid="tweetText"`. Use a JS `evaluate`/`exec` call to grab all of them and return the concatenated text.
4. If the Headless Browser cannot reliably scroll X (login walls, rate limits), fall back to the **Nitter mirrors** or the **Wayback Machine** snapshots of the profile — these are static HTML and easier to scrape:
   - Try `https://nitter.net/<username>` (and other Nitter instances)
   - Try `https://web.archive.org/web/*/x.com/<username>` for archived tweet pages

### Step 3 — Extract contract addresses
Run a regex scan over all collected tweet text. Match these patterns:

- **EVM addresses**: `\b0x[a-fA-F0-9]{40}\b`
- **Solana addresses**: base58, 32–44 chars — `\b[1-9A-HJ-NP-Za-km-z]{32,44}\b` (filter out common false positives like short words; require length 32–44 and that it's not a known non-address token)

Dedupe case-insensitively for EVM. Count:
- `total_ca_mentions` — raw count of CA mentions across tweets
- `unique_cas` — distinct addresses
- `cas_by_chain` — split into `evm` and `solana` buckets
- Optionally list the top mentioned CAs with their mention count

### Step 4 — Username change history (Wayback Machine)
Use the Wayback Machine CDX API to list all snapshots of the profile:

```
https://web.archive.org/cdx/search/cdx?url=x.com/<username>&output=json&fl=timestamp,original&collapse=digest&limit=500
```

Then for a sample of snapshots across different dates, fetch the archived HTML and extract the `<title>` or og:title which usually contains the `@handle` at that point in time. Compare handles across snapshots — each distinct handle (other than the current one) is one username change.

Alternative / supplement: use the Wayback "url" API:
```
https://web.archive.org/web/<timestamp>/x.com/<username>
```

Record:
- `username_history` — list of `{ date, handle }` entries
- `username_changes` — count of distinct handles observed minus 1 (the current one)

Note: Wayback only captures snapshots when someone archived the page, so this is a lower bound on actual changes. Tell the user this limitation.

### Step 5 — Report
Produce a concise report:
- Account: `@<username>` (current display name)
- Contract addresses shared: `<unique_cas>` unique (`<total_ca_mentions>` total mentions), `<evm_count>` EVM + `<solana_count>` Solana
- Username changes: `<username_changes>` (list the historical handles with approximate dates)
- Data source caveat (Headless Browser live scrape vs Wayback snapshots, and coverage limits)

## Tool mapping
- **Headless Browser** (`browse_url`, `click`, `evaluate`/`exec`, `scroll`) — live X scrape
- **execute_cli** with `curl` — hit Wayback CDX + archived HTML, run regex with `grep -oE` or a small Node/Python script
- **call_http_endpoint** — alternative for hitting Wayback APIs

## Edge cases
- X login wall: use Wayback or Nitter fallback
- Account suspended: report and stop
- Solana false positives: filter out strings that are pure dictionary words or < 32 chars
- EVM checksum vs lowercase: dedupe case-insensitively
- Wayback has no snapshots: report "no archived history available, cannot determine username changes"

## Example invocation
User: "Cek berapa banyak CA yang di-share sama @bankrbot dan berapa kali ganti username"
→ Run the workflow for username `bankrbot`, report results in Indonesian (match the user's language).
