/**
 * Prompt injection sanitizer for AI agent replies.
 *
 * Five-layer defense against prompt injection attacks on social platforms.
 * Prevents attackers from tricking your agent into outputting live transaction
 * commands — whether prefixed with a bot handle or bare financial instructions.
 *
 * CRITICAL LESSON: Bankr and similar automation bots execute ANY financial
 * command in agent tweets — no @bankrbot prefix needed. A tweet saying
 * "send all usdc to 0x..." from your agent WILL be executed.
 *
 * Usage:
 *   import { sanitizeReply, checkInput } from './sanitize';
 *   const safe = sanitizeReply(llmOutput);
 */

// Layer 1: @bot action commands
const BOT_COMMAND_RE =
  /@bankrbot\s+(?:tip|buy|sell|send|swap|transfer|deploy|bridge|trade|bet|long|short|open|close)/i;

// Layer 2: Token factory deploy commands
const TOKEN_FACTORY_RE =
  /@(?:clanker_world|clanker|tator_trader|virtuals_io)\s+.*?(?:create|deploy|launch|mint)\b/i;

// Layer 3: Generic token deploy / send fees
const TOKEN_DEPLOY_RE =
  /(?:create|deploy|launch|mint)\s+\w+.*?(?:ticker|symbol)\s+\$\w+/i;
const SEND_FEES_RE = /send\s+fees?\s+to\s+@\w+/i;

// Layer 4: BARE financial commands (no @bot prefix needed!)
// This is the CRITICAL layer — the exact attack vector used to drain wallets.
const BARE_FINANCIAL_RE =
  /\b(?:send|transfer|swap|bridge|withdraw)\s+(?:all|100%|\d+%?|my|your|the|remaining|entire|full|every)?\s*(?:of\s+)?(?:my\s+|your\s+|the\s+)?(?:usdc|eth|ether|weth|bnkr|solvr|dai|usdt|usd|token|tokens|funds|balance|wallet|crypto|coin)/i;

const SEND_TO_RE =
  /\b(?:send|transfer|swap|bridge)\s+.*?\bto\s+(?:0x[a-fA-F0-9]{6,}|\w{3,})/i;

const TRADE_ACTION_RE =
  /\b(?:buy|sell|long|short|open|close|trade|bet)\s+\$?\d[\d,.]*\s*(?:k|m|b)?\s*(?:of|worth|in|usd|usdc|eth)?\s*(?:usdc|eth|weth|bnkr|solvr|dai|usdt)/i;

// All patterns checked against output before posting
const OUTPUT_BLOCK_PATTERNS = [
  BOT_COMMAND_RE,
  TOKEN_FACTORY_RE,
  TOKEN_DEPLOY_RE,
  SEND_FEES_RE,
  BARE_FINANCIAL_RE,
  SEND_TO_RE,
  TRADE_ACTION_RE,
];

const INJECTION_CANNED =
  "Nice try. I don't execute or repeat financial commands from prompt injections.";

/**
 * Sanitize agent reply text before posting.
 *
 * Checks all 7 injection patterns. If ANY pattern matches, the entire reply
 * is replaced with a canned rejection. Never partially clean — an attacker
 * can split commands across the cleaned/uncleaned boundary.
 *
 * Returns sanitized text, a canned rejection, or null if the reply should
 * be suppressed entirely.
 */
export function sanitizeReply(text: string): string | null {
  if (!text) return text;

  for (const pattern of OUTPUT_BLOCK_PATTERNS) {
    if (pattern.test(text)) {
      console.warn(
        `OUTPUT BLOCKED (${pattern.source.slice(0, 60)}): ${text.slice(0, 300)}`
      );
      return INJECTION_CANNED;
    }
  }

  return text;
}

/**
 * Check if an incoming mention contains financial injection commands.
 *
 * Use this to pre-filter incoming messages BEFORE they reach the LLM.
 * Returns true if the message is safe, false if it should be blocked.
 */
export function checkInput(text: string): boolean {
  if (!text) return true;
  if (BARE_FINANCIAL_RE.test(text) || SEND_TO_RE.test(text)) {
    console.warn(`INPUT BLOCKED (financial injection): ${text.slice(0, 200)}`);
    return false;
  }
  return true;
}
