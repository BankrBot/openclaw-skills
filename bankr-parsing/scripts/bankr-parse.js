/**
 * bankr-parse.js — Bankr response parsing utilities
 *
 * Usage:
 *   const bp = require('./bankr-parse');
 *   const raw = bp.bankr('What is my balance?');
 *   const text = bp.parseResponse(raw);
 *   const amounts = bp.parseAmounts(text);
 *   const confirmed = bp.isConfirmed(raw);
 *
 * Set BANKR_SCRIPT env var to override default bankr.sh path.
 */

'use strict';
const { execFileSync } = require('child_process');
const path = require('path');

const BANKR_SCRIPT = process.env.BANKR_SCRIPT ||
  path.join(process.env.HOME, '.clawdbot/skills/bankr/scripts/bankr.sh');

// ── Calling Bankr ──────────────────────────────────────────────────────────

/**
 * Run a bankr prompt and return raw stdout.
 * Returns null on timeout (operation may still have executed on-chain).
 *
 * Uses execFileSync (not execSync) to pass the prompt as a direct argument,
 * bypassing the shell entirely — prevents injection via backticks, $(), etc.
 */
function bankr(prompt, timeoutSeconds = 90) {
  try {
    return execFileSync(BANKR_SCRIPT, [prompt], {
      encoding: 'utf8',
      maxBuffer: 5 * 1024 * 1024,
      timeout: timeoutSeconds * 1000,
    });
  } catch (e) {
    if (e.code === 'ETIMEDOUT' || e.signal === 'SIGTERM') return null;
    return e.stdout || null;
  }
}

// ── Response Parsing ───────────────────────────────────────────────────────

/**
 * Extract the `response` string from raw bankr output JSON.
 * Falls back to returning the raw string if no JSON envelope found.
 */
function parseResponse(raw) {
  if (!raw) return '';
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]).response || '';
  } catch (_) {}
  return raw.trim();
}

/**
 * Parse the full JSON envelope: { success, jobId, response, processingTime, ... }
 * Returns null if not found/parseable.
 */
function parseEnvelope(raw) {
  if (!raw) return null;
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
  } catch (_) {}
  return null;
}

// ── Amount Extraction ──────────────────────────────────────────────────────

/**
 * Parse token amounts from a bankr response string.
 * Handles: "claimed: 0.0012 WETH / 11742.5 TOKEN", "bought 500 BNKR", "received 0.5 ETH", etc.
 * Returns: [{ symbol: 'WETH', amount: 0.0012 }, ...]
 */
function parseAmounts(text) {
  if (!text) return [];
  const results = [];
  const seen = new Set();

  const patterns = [
    // Slash-separated pairs: "claimed: 0.0012 WETH / 11742 TOKEN"
    /(?:claimed|amounts?)[:\s]+([\d,]+\.?\d*)\s+([A-Z0-9]+)\s*\/\s*([\d,]+\.?\d*)\s+([A-Z0-9]+)/gi,
    // Action + amount: "bought 500 BNKR", "received 0.5 ETH", "swapped for 100 USDC"
    /(?:bought|purchased|received|acquired|swapped\s+(?:for|into)|staked?)\s+([\d,]+\.?\d*)\s+([A-Z]{2,10})/gi,
    // "claimed 11742 TOKEN" or "11742 TOKEN claimed" — requires at least one claimed keyword
    /(?:claimed\s+([\d,]+\.?\d*)\s+([A-Z]{2,10})|([\d,]+\.?\d*)\s+([A-Z]{2,10})\s+claimed)/gi,
  ];

  for (let pi = 0; pi < patterns.length; pi++) {
    const pattern = patterns[pi];
    let m;
    pattern.lastIndex = 0;
    while ((m = pattern.exec(text)) !== null) {
      let pairs;
      if (pi === 0) {
        // Slash-separated: groups 1,2 and 3,4
        pairs = m[3] ? [[m[1], m[2]], [m[3], m[4]]] : [[m[1], m[2]]];
      } else if (pi === 2) {
        // "claimed 11742 TOKEN" → groups 1,2; "11742 TOKEN claimed" → groups 3,4
        const amtStr = m[1] ?? m[3];
        const sym    = m[2] ?? m[4];
        pairs = amtStr && sym ? [[amtStr, sym]] : [];
      } else {
        pairs = [[m[1], m[2]]];
      }
      for (const [amtStr, sym] of pairs) {
        if (!amtStr || !sym) continue;
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

/**
 * Parse a swap/convert result.
 * Returns: { from: { symbol, amount }, to: { symbol, amount } } or null.
 */
function parseSwap(text) {
  if (!text) return null;
  const arrow = text.match(/([\d,]+\.?\d*)\s+([A-Z]+)\s*(?:→|to)\s*([\d,]+\.?\d*)\s+([A-Z]+)/i);
  if (arrow) return {
    from: { amount: parseFloat(arrow[1].replace(/,/g, '')), symbol: arrow[2].toUpperCase() },
    to:   { amount: parseFloat(arrow[3].replace(/,/g, '')), symbol: arrow[4].toUpperCase() },
  };
  const swapped = text.match(/swapped?\s+([\d,]+\.?\d*)\s+([A-Z]+)\s+for\s+([\d,]+\.?\d*)\s+([A-Z]+)/i);
  if (swapped) return {
    from: { amount: parseFloat(swapped[1].replace(/,/g, '')), symbol: swapped[2].toUpperCase() },
    to:   { amount: parseFloat(swapped[3].replace(/,/g, '')), symbol: swapped[4].toUpperCase() },
  };
  return null;
}

/**
 * Extract a USD dollar value from text. E.g. "$1,234.56" → 1234.56
 */
function extractUSD(text) {
  const m = text?.match(/\$([\d,]+\.?\d*)/);
  return m ? parseFloat(m[1].replace(/,/g, '')) : null;
}

/**
 * Extract a price multiplier. E.g. "up 2.3x" → 2.3
 */
function extractMultiplier(text) {
  const m = text?.match(/(\d+\.?\d*)x/);
  return m ? parseFloat(m[1]) : null;
}

// ── TX & Chain ─────────────────────────────────────────────────────────────

/**
 * Extract all EVM tx hashes from text (deduplicated).
 */
function extractTxHashes(text) {
  return [...new Set(text?.match(/0x[a-fA-F0-9]{64}/g) || [])];
}

/**
 * Extract contract address (42 chars) from text.
 * Avoids confusing with tx hashes (66 chars).
 */
function extractContractAddress(text) {
  const m = text?.match(/(?:contract|address)[:\s]+(0x[a-fA-F0-9]{40})\b/i);
  if (m) return m[1];
  const addrs = text?.match(/0x[a-fA-F0-9]{40}\b/g) || [];
  return addrs.find(a => a.length === 42) || null;
}

/**
 * Detect which chain a response refers to, based on explorer URLs and keywords.
 */
function detectChain(text) {
  const chains = {
    Base:     /\bbase\b|basescan\.org|base\.blockscout/i,
    Solana:   /\bsolana\b|solscan\.io|explorer\.solana/i,
    Ethereum: /\bethereum\b|etherscan\.io/i,
    Polygon:  /\bpolygon\b|polygonscan\.com/i,
    Abstract: /\babstract\b|abscan\.org/i,
  };
  for (const [chain, re] of Object.entries(chains)) {
    if (re.test(text)) return chain;
  }
  return null;
}

// ── Status Detection ───────────────────────────────────────────────────────

const _NO_FEES = [
  /no unclaimed fees/i, /no fees available/i, /nothing to claim/i,
  /0 available/i, /below.*minimum/i, /minimum threshold/i,
];
/** True if response indicates there is nothing to claim. */
const hasNoFees = text => _NO_FEES.some(p => p.test(text));

/** True if Bankr says this token wasn't deployed through its system. */
const isNotBankrToken = text =>
  /not found in.*bankr|wasn't launched via.*bankr|not.*bankr.*launcher/i.test(text ?? '');

/** True if response indicates an amount is below Bankr's minimum threshold. */
const isBelowMinimum = text =>
  /below.*minimum|too small|minimum threshold|\$0\.0[0-4]/i.test(text ?? '');

const _FAILURES = [
  /insufficient\s+(balance|funds|eth|sol|matic)/i,
  /transaction\s+(?:failed|reverted|rejected)/i,
  /slippage\s+(?:too high|exceeded|tolerance)/i,
  /token\s+not\s+found/i,
  /not found in.*bankr/i,
  /unauthorized|invalid.*api.*key/i,
  /rate\s+limit\s+exceeded/i,
  /job\s+(?:timed?\s*out|failed|errored)/i,
];
/** True if response text contains a known failure pattern. */
const isFailure = text => !text || _FAILURES.some(p => p.test(text));

/**
 * Strong confirmation: requires success:true envelope + tx hash or explorer URL.
 * Do NOT rely on just "success" wording in the text — use this instead.
 */
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

module.exports = {
  // Calling
  bankr,
  // Parsing
  parseResponse,
  parseEnvelope,
  parseAmounts,
  parseSwap,
  extractUSD,
  extractMultiplier,
  // TX & chain
  extractTxHashes,
  extractContractAddress,
  detectChain,
  // Status
  hasNoFees,
  isNotBankrToken,
  isBelowMinimum,
  isFailure,
  isConfirmed,
};
