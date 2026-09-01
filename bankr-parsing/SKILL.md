---
name: bankr-parsing
description: Parse and handle Bankr API responses reliably in automation scripts. Use when writing scripts that call bankr.sh and need to extract amounts, tx hashes, or determine success/failure from Bankr's natural-language JSON responses. Covers response envelope format, amount/tx parsing regexes, timeout handling, and common failure detection patterns.
---

# Bankr Response Parsing

Bankr returns natural-language responses wrapped in a JSON envelope. Parsing them correctly is non-obvious. This skill captures the patterns needed to do it reliably.

## Response Envelope

```bash
bankr.sh "your prompt" 2>&1
```

Output is a single-line JSON object (may be preceded by status lines like `→ doing something`):

```json
{
  "success": true,
  "jobId": "job_XXX",
  "response": "Successfully claimed 0.0012 WETH from your PROOFBOT token.\n\ntx: https://basescan.org/tx/0xabc...",
  "processingTime": 61234,
  "completedAt": "2026-02-17T..."
}
```

**Parse `response` — that's the natural-language content to extract data from.**

## Core Helpers

```js
const { execFileSync } = require('child_process');
const BANKR_SCRIPT = process.env.BANKR_SCRIPT ||
  `${process.env.HOME}/.clawdbot/skills/bankr/scripts/bankr.sh`;

function bankr(prompt, timeoutSeconds = 90) {
  try {
    // execFileSync passes prompt as a direct argv element — no shell involved,
    // so backticks, $(), and other shell metacharacters cannot be injected.
    return execFileSync(BANKR_SCRIPT, [prompt], {
      encoding: 'utf8', maxBuffer: 5 * 1024 * 1024, timeout: timeoutSeconds * 1000
    });
  } catch (e) {
    if (e.code === 'ETIMEDOUT' || e.signal === 'SIGTERM') return null;
    return e.stdout || null;
  }
}

function parseResponse(raw) {
  if (!raw) return '';
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]).response || '';
  } catch (_) {}
  return raw.trim(); // fallback if no JSON found
}
```

**Always call `parseResponse()` before extracting any data.**

## Parsing Amounts

Bankr describes amounts in natural language — the same value may appear in many forms. Use a pattern battery:

```js
function parseAmounts(text) {
  const results = [];
  const seen = new Set();
  const patterns = [
    // "claimed: 0.0012 WETH / 11742.5 TOKEN"
    /(?:claimed|amounts?)[:\s]+([\d,]+\.?\d*)\s+([A-Z0-9]+)\s*\/\s*([\d,]+\.?\d*)\s+([A-Z0-9]+)/gi,
    // "claimed 11742 TOKEN" or "11742 TOKEN claimed" — requires explicit claimed keyword on one side
    /(?:claimed\s+([\d,]+\.?\d*)\s+([A-Z]{2,10})|([\d,]+\.?\d*)\s+([A-Z]{2,10})\s+claimed)/gi,
    // "received 5000 TOKEN" / "bought 0.5 ETH"
    /(?:received|bought|purchased|swapped\s+(?:for|into))\s+([\d,]+\.?\d*)\s+([A-Z]{2,10})/gi,
  ];

  for (const pattern of patterns) {
    let m;
    pattern.lastIndex = 0;
    while ((m = pattern.exec(text)) !== null) {
      const pairs = m[3] ? [[m[1], m[2]], [m[3], m[4]]] : [[m[1], m[2]]];
      for (const [amtStr, sym] of pairs) {
        const amount = parseFloat(amtStr.replace(/,/g, ''));
        const symbol = sym.toUpperCase();
        const key = `${symbol}:${amount}`;
        if (!seen.has(key) && amount > 0 && symbol.length >= 2 && symbol.length <= 10) {
          seen.add(key);
          results.push({ symbol, amount });
        }
      }
    }
  }
  return results;
}
```

## Extracting TX Hashes

```js
function extractTxHashes(text) {
  const matches = text.match(/0x[a-fA-F0-9]{64}/g) || [];
  return [...new Set(matches)];
}
```

## Common Status Patterns

```js
// No fees / nothing to claim
const NO_FEES = [
  /no unclaimed fees/i, /no fees available/i, /nothing to claim/i,
  /0 available/i, /below.*minimum/i, /minimum threshold/i,
];
const hasNoFees = text => NO_FEES.some(p => p.test(text));

// Token not in Bankr system (Clanker, Uniswap, etc.)
const isNotBankrToken = text =>
  /not found in.*bankr|wasn't launched via.*bankr|not.*bankr.*launcher/i.test(text);

// Response too small to distribute
const isBelowMinimum = text =>
  /below.*minimum|too small|minimum threshold|\$0\.0[0-4]/i.test(text);

// General failure patterns
const FAILURES = [
  /insufficient\s+(balance|funds|eth|sol)/i,
  /transaction\s+(?:failed|reverted|rejected)/i,
  /slippage\s+(?:too high|exceeded)/i,
  /token\s+not\s+found/i,
  /unauthorized|invalid.*api.*key/i,
  /job\s+(?:timed?\s*out|failed|errored)/i,
];
const isFailure = text => !text || FAILURES.some(p => p.test(text));
```

## Strong Success Check

Don't rely on the word "success" alone — Bankr can say "submitted successfully" even when the tx fails. Require a TX hash or explorer URL:

```js
function isConfirmed(rawOutput) {
  try {
    const envelope = JSON.parse(rawOutput.match(/\{[\s\S]*\}/)[0]);
    if (!envelope.success) return false;
    const text = envelope.response || '';
    const hasTx = /0x[a-fA-F0-9]{64}/.test(text);
    const hasExplorer = /basescan|solscan|polygonscan|abscan|blockscout|etherscan/.test(text);
    return !isFailure(text) && (hasTx || hasExplorer);
  } catch (_) { return false; }
}
```

## Timeout Handling

Bankr operations vary widely in duration. Set timeouts based on operation type:

| Operation | Recommended timeout |
|---|---|
| Balance / price check | 30s |
| Single trade / swap | 90s |
| Single token fee claim | 90s |
| Token deployment | 120s |
| Bulk fee claim (all tokens) | 580s |

If `bankr()` returns `null` → timed out. Do not retry immediately — bulk claims especially may have still executed on-chain.

## Reference Files

- **`references/response-patterns.md`** — Full pattern catalogue: swap confirmations, stake confirmations, deployment confirmations, portfolio responses, and error messages with real examples
- **`scripts/bankr-parse.js`** — All helpers above as a `require()`-able module
