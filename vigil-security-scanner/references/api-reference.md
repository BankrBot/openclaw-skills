# VIGIL API Reference

VIGIL is an MCP server. The live, supported transport is a single JSON-RPC 2.0
endpoint — no API key required for read-only scans.

- **Call a tool:** `POST https://mcp.vigil.codes/tools/call`
- **List tools:** `GET https://mcp.vigil.codes/tools/list`
- **Health:** `GET https://mcp.vigil.codes/health`

All calls share this envelope:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": { "name": "<tool>", "arguments": { ... } }
}
```

The result is returned under `.result`. Errors come back as `.error`. A few
premium tools (scan_token, deployer_check, token_market, batch_scan,
wallet_report, consensus) may respond with an x402 payment-required body
(`x402Version` + `accepts`) when paid mode is enabled; core safety checks
(safety_score, detect_honeypot, check_tax, check_ownership, detect_clone,
simulate_approval, liquidity_lock, check_scam, scan_approvals, monitor_wallet,
sentinel_status) are always free.

---

## Tools

### vigil_safety_score
Args: `contract` (0x address), `chain` (default `base`).
Returns: `score` (0-100), `risk_level`, `breakdown[]`, `risk_factors[]`,
`positive_factors[]`, `recommendation`.

### vigil_detect_honeypot
Args: `token`, `chain`.
Returns: `is_honeypot`, `can_buy`, `can_sell`, `buy_tax`, `sell_tax`,
`block_reason`, `simulations[]`.

### vigil_check_tax
Args: `token`, `chain`.
Returns: `risk` (safe|caution|high|dangerous|unknown), `buy_tax`, `sell_tax`,
`transfer_tax` (fractions; 0.05 == 5%), `tax_modifiable`,
`personal_tax_modifiable`, `trading_cooldown`, `cannot_buy`, `notes[]`.
Owner-modifiable tax ("0% now, 99% later") is treated as dangerous. Missing
data returns `unknown`, never `safe`.

### vigil_check_ownership
Args: `token`, `chain`.
Returns: `risk` (safe|caution|high|dangerous|unknown), `owner_address`,
`ownership_renounced`, `owner_percent`, `powers[]` (mint, pause_transfers,
blacklist, reclaim_ownership, hidden_owner, modify_balances, selfdestruct, ...),
`notes[]`. A renounced owner (null address) neutralizes powers; reclaimable or
hidden ownership is dangerous. Missing data returns `unknown`.

### vigil_detect_clone
Args: `token`, `chain`.
Returns: `risk` (safe|suspicious|dangerous|unknown), `fingerprint`,
`clone_count`, `clones[]`, `scam_siblings[]`, `notes[]`. Fingerprints bytecode
and flags copy-paste clones; escalates to dangerous only when a sibling is a
reported scam. Missing data returns `unknown`.

### vigil_simulate_approval
Args: `spender` (0x), `token` (0x), `amount` (`unlimited` or numeric), `chain`.
Returns: `risk` (safe|suspicious|dangerous), `spender_profile`, `reasons[]`,
`recommendation`. Answers "if I approve this spender right now, what could it
do?" before you sign.

### vigil_liquidity_lock
Args: `token`, `chain`.
Returns: `lock_status` (locked|burned|unlocked|unknown), `determined` (bool),
`locked_fraction`, `pair_address`, `lp_token`, `locker_name`, `notes[]`.
`unknown` means insufficient data — never a safety guarantee. Covers V2-style
ERC-20 LP tokens; V3/NFT positions return `unknown`.

### vigil_consensus
Args: `token`, `chain`.
Returns: `verdict` (safe|low|medium|high|critical|unknown), `confidence`,
`risk_sources`, `safe_sources`, `total_sources`, `votes[]`, `summary`.
Aggregates 6 independent sources: GoPlus, onchain bytecode, market liquidity,
deployer verification, community scam DB, liquidity lock. A single source caps
the verdict at "medium" — the false-positive guard.

### vigil_scan_token
Args: `token`, `chain`.
Returns: rugpull indicators — hidden mint, proxy pattern, tax manipulation,
blacklist functions, with severity-tagged findings.

### vigil_scan_approvals
Args: `wallet` (0x address), `chain`.
Returns: `approvals[]` with risk levels, `total`, `summary` counts. Flags
unlimited allowances and risky spenders.

### vigil_wallet_report
Args: `wallet`, `chain`.
Returns: aggregate security posture — approvals summary, scam-DB hits, top
risks, recommendations.

### vigil_monitor_wallet
Args: `wallet`, `chain`, `lookback_blocks` (default 1000).
Returns: `alerts[]` (new approvals, risky interactions, balance changes),
`summary`, `recommendations`.

### vigil_token_market
Args: `token`, `chain`.
Returns: `price_usd`, `liquidity_usd`, `volume_24h_usd`, `pair_created_at`,
`pool_age_hours`, `liquidity_risk`.

### vigil_deployer_check
Args: `contract`, `chain`.
Returns: `verified`, contract `name`, `deployer`, `creation_tx`, reputation
note (via Basescan; some fields need a paid Basescan plan).

### vigil_batch_scan
Args: `tokens` (array of 0x addresses), `chain`.
Returns: per-token `score` + `risk_level`, ranked by risk. Capped at 25 tokens.

### vigil_check_scam
Args: `token`, `chain`.
Returns: `reported` (bool), `report_count`, report summaries from the community
scam database.

### vigil_sentinel_status
Args: none.
Returns: autonomous Sentinel watchlist + loop configuration (interval, severity
threshold, lookback).

---

## Chains

Base-first (`chainid=8453`). The scanners target Base mainnet. A small set of
Ethereum stablecoins are kept in the verified registry so multichain wallets
get correct labels. Unsupported chains degrade gracefully (clear note, never a
misleading verdict).

## Address validation

Every address argument must be `0x` + exactly 40 hex chars. Malformed input is
rejected with an error rather than scored — a bad address never returns a fake
verdict.
